package core

import (
	"net"
	"sync"

	"github.com/pion/webrtc/v4"
)

type RadioSession struct {
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
	AudioStreams map[uint32]*webrtc.TrackLocalStaticSample

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
			AudioStreams: make(map[uint32]*webrtc.TrackLocalStaticSample),
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
