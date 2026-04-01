package core

import (
	"net"
	"sync"

	"github.com/pion/webrtc/v4"
)

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
	PC      *webrtc.PeerConnection
	UDPDC   *webrtc.DataChannel // "udp" datachannel
	TCPDC   *webrtc.DataChannel // "tcp" datachannel (ordered, reliable)
	RXTrack *webrtc.TrackLocalStaticSample

	ActiveRXStreamID uint32
	ActiveTXStreamID uint32
	TXPacketCount    uint8

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
			HandleHex: handleHex,
			Host:      host,
			BasePort:  basePort,
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

func (rs *RadioSession) SetUDPDataChannel(dc *webrtc.DataChannel) {
	rs.stateMu.Lock()
	defer rs.stateMu.Unlock()

	rs.UDPDC = dc
}

func (rs *RadioSession) SetTCPDataChannel(dc *webrtc.DataChannel) {
	rs.stateMu.Lock()
	defer rs.stateMu.Unlock()

	rs.TCPDC = dc
}

// SendTCPLine sends a trimmed text line to the "tcp" data channel if one is open.
// It is a no-op when no data channel has been registered.
func (rs *RadioSession) SendTCPLine(line string) {
	rs.stateMu.RLock()
	dc := rs.TCPDC
	rs.stateMu.RUnlock()

	if dc == nil {
		return
	}

	_ = dc.SendText(line)
}

func (rs *RadioSession) SetRXTrack(track *webrtc.TrackLocalStaticSample) {
	rs.stateMu.Lock()
	defer rs.stateMu.Unlock()

	rs.RXTrack = track
}

func (rs *RadioSession) RXAudioTrack() *webrtc.TrackLocalStaticSample {
	rs.stateMu.RLock()
	defer rs.stateMu.RUnlock()

	return rs.RXTrack
}

func (rs *RadioSession) SetActiveRXStream(streamID uint32) {
	rs.stateMu.Lock()
	defer rs.stateMu.Unlock()

	rs.ActiveRXStreamID = streamID
}

func (rs *RadioSession) ClearActiveRXStream(streamID uint32) {
	rs.stateMu.Lock()
	defer rs.stateMu.Unlock()

	if rs.ActiveRXStreamID == streamID {
		rs.ActiveRXStreamID = 0
	}
}

func (rs *RadioSession) IsActiveRXStream(streamID uint32) bool {
	rs.stateMu.RLock()
	defer rs.stateMu.RUnlock()

	return rs.ActiveRXStreamID != 0 && rs.ActiveRXStreamID == streamID
}

func (rs *RadioSession) SetActiveTXStream(streamID uint32) {
	rs.stateMu.Lock()
	defer rs.stateMu.Unlock()

	rs.ActiveTXStreamID = streamID
	rs.TXPacketCount = 0
}

func (rs *RadioSession) ClearActiveTXStream(streamID uint32) {
	rs.stateMu.Lock()
	defer rs.stateMu.Unlock()

	if rs.ActiveTXStreamID == streamID {
		rs.ActiveTXStreamID = 0
		rs.TXPacketCount = 0
	}
}

func (rs *RadioSession) NextTXPacket() (uint32, uint8, bool) {
	rs.stateMu.Lock()
	defer rs.stateMu.Unlock()

	if rs.ActiveTXStreamID == 0 {
		return 0, 0, false
	}

	streamID := rs.ActiveTXStreamID
	packetCount := rs.TXPacketCount
	rs.TXPacketCount = (rs.TXPacketCount + 1) % 16

	return streamID, packetCount, true
}
