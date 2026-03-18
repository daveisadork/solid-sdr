package core

import (
	"net"
	"strings"
	"sync"

	"github.com/pion/webrtc/v4"
)

type TXAudioStreamState struct {
	Type                string
	Compression         string
	BoundRemoteStreamID string
	BoundRemoteTrackID  string
	PacketCount         uint8
}

type RXAudioStreamState struct {
	Track  *webrtc.TrackLocalStaticSample
	Sender *webrtc.RTPSender
}

type RadioSession struct {
	stateMu sync.RWMutex

	// Identity from radio
	HandleHex string // e.g. "591502EF" (uppercase, no leading 'H')
	HandleU32 uint32
	Version   string // e.g. "V1.4.0.0"

	// Connection params
	Host     string
	BasePort int

	// TCP leg (owned by WS handler)
	TCP net.Conn

	// RTC leg (owned by RTC handler)
	PC           *webrtc.PeerConnection
	DC           *webrtc.DataChannel
	AudioStreams map[uint32]*RXAudioStreamState
	TXStreams    map[uint32]*TXAudioStreamState

	// UDP leg to radio (created by RTC handler, connected to Host:(BasePort+1))
	UDPConn *net.UDPConn
}

type SessionManager struct {
	mu   sync.RWMutex
	sess map[string]*RadioSession // key: HandleHex (uppercase)
}

func NewSessionManager() *SessionManager {
	return &SessionManager{sess: make(map[string]*RadioSession)}
}

func (m *SessionManager) PutTCP(handleHex, host string, basePort int, tcp net.Conn) *RadioSession {
	m.mu.Lock()
	defer m.mu.Unlock()
	rs := m.sess[handleHex]
	if rs == nil {
		rs = &RadioSession{
			HandleHex:    handleHex,
			Host:         host,
			BasePort:     basePort,
			AudioStreams: make(map[uint32]*RXAudioStreamState),
			TXStreams:    make(map[uint32]*TXAudioStreamState),
		}
		m.sess[handleHex] = rs
	}
	rs.TCP = tcp
	return rs
}

func (m *SessionManager) Get(handleHex string) *RadioSession {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.sess[handleHex]
}

func (m *SessionManager) Delete(handleHex string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.sess, handleHex)
}

func (rs *RadioSession) HasRXAudioStream(streamID uint32) bool {
	rs.stateMu.RLock()
	defer rs.stateMu.RUnlock()
	_, ok := rs.AudioStreams[streamID]
	return ok
}

func (rs *RadioSession) AddRXAudioStream(streamID uint32, track *webrtc.TrackLocalStaticSample, sender *webrtc.RTPSender) bool {
	rs.stateMu.Lock()
	defer rs.stateMu.Unlock()
	if _, ok := rs.AudioStreams[streamID]; ok {
		return false
	}
	rs.AudioStreams[streamID] = &RXAudioStreamState{
		Track:  track,
		Sender: sender,
	}
	return true
}

func (rs *RadioSession) RXAudioStream(streamID uint32) (*webrtc.TrackLocalStaticSample, bool) {
	rs.stateMu.RLock()
	defer rs.stateMu.RUnlock()
	stream, ok := rs.AudioStreams[streamID]
	if !ok || stream == nil || stream.Track == nil {
		return nil, false
	}
	return stream.Track, true
}

func (rs *RadioSession) RemoveRXAudioStream(streamID uint32) *RXAudioStreamState {
	rs.stateMu.Lock()
	defer rs.stateMu.Unlock()
	stream := rs.AudioStreams[streamID]
	delete(rs.AudioStreams, streamID)
	return stream
}

func (rs *RadioSession) UpsertTXAudioStream(streamID uint32, typ, compression string) {
	rs.stateMu.Lock()
	defer rs.stateMu.Unlock()

	stream, ok := rs.TXStreams[streamID]
	if !ok {
		rs.TXStreams[streamID] = &TXAudioStreamState{
			Type:        typ,
			Compression: compression,
		}
		return
	}

	stream.Type = typ
	stream.Compression = compression
}

func (rs *RadioSession) RemoveTXAudioStream(streamID uint32) {
	rs.stateMu.Lock()
	defer rs.stateMu.Unlock()
	delete(rs.TXStreams, streamID)
}

func (rs *RadioSession) BindTXAudioTrack(typ, remoteStreamID, remoteTrackID string) (uint32, string, bool) {
	rs.stateMu.Lock()
	defer rs.stateMu.Unlock()

	for streamID, stream := range rs.TXStreams {
		if stream.BoundRemoteStreamID == remoteStreamID && stream.BoundRemoteTrackID == remoteTrackID {
			return streamID, stream.Compression, true
		}
	}

	for streamID, stream := range rs.TXStreams {
		if stream.Type != typ || !strings.EqualFold(stream.Compression, "OPUS") {
			continue
		}
		if stream.BoundRemoteStreamID != "" || stream.BoundRemoteTrackID != "" {
			continue
		}
		stream.BoundRemoteStreamID = remoteStreamID
		stream.BoundRemoteTrackID = remoteTrackID
		return streamID, stream.Compression, true
	}

	return 0, "", false
}

func (rs *RadioSession) ReleaseTXAudioTrackBinding(streamID uint32, remoteStreamID, remoteTrackID string) {
	rs.stateMu.Lock()
	defer rs.stateMu.Unlock()

	stream, ok := rs.TXStreams[streamID]
	if !ok {
		return
	}
	if stream.BoundRemoteStreamID != remoteStreamID || stream.BoundRemoteTrackID != remoteTrackID {
		return
	}
	stream.BoundRemoteStreamID = ""
	stream.BoundRemoteTrackID = ""
}

func (rs *RadioSession) NextTXPacketCount(streamID uint32) (uint8, bool) {
	rs.stateMu.Lock()
	defer rs.stateMu.Unlock()

	stream, ok := rs.TXStreams[streamID]
	if !ok {
		return 0, false
	}

	packetCount := stream.PacketCount
	stream.PacketCount = (stream.PacketCount + 1) % 16
	return packetCount, true
}
