package rtc

import (
	"bufio"
	"fmt"
	"io"
	"log"
	"net"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/pion/webrtc/v4"
)

type radioConn struct {
	mu sync.RWMutex

	handleHex string
	handleU32 uint32

	tcpConn net.Conn
	udpConn *net.UDPConn
	tcpDC   *webrtc.DataChannel
	udpDC   *webrtc.DataChannel

	activeRXStream uint32
	activeTXStream uint32
	txPacketCount  uint8
}

// sendTCPLine sends a line to the "tcp" data channel if it is open.
func (rc *radioConn) sendTCPLine(line string) {
	rc.mu.RLock()
	dc := rc.tcpDC
	rc.mu.RUnlock()

	if dc == nil {
		return
	}

	_ = dc.SendText(line)
}

// nextTXPacket returns the stream ID and packet count for the next TX packet.
// Returns ok=false when no TX stream is active.
func (rc *radioConn) nextTXPacket() (streamID uint32, count uint8, ok bool) {
	rc.mu.Lock()
	defer rc.mu.Unlock()

	if rc.activeTXStream == 0 {
		return 0, 0, false
	}

	streamID = rc.activeTXStream
	count = rc.txPacketCount
	rc.txPacketCount = (rc.txPacketCount + 1) % 16

	return streamID, count, true
}

func (rc *radioConn) noteStreamCreated(streamID uint32, typ, compression string) {
	stream := fmt.Sprintf("0x%08X", streamID)

	switch typ {
	case "remote_audio_tx":
		if compression != "OPUS" {
			return
		}

		rc.mu.Lock()
		rc.activeTXStream = streamID
		rc.txPacketCount = 0
		rc.mu.Unlock()
		log.Printf("[rtc] tx audio stream %s registered (handle 0x%s)", stream, rc.handleHex)
	case "remote_audio_rx":
		if compression != "OPUS" {
			return
		}

		rc.mu.Lock()
		rc.activeRXStream = streamID
		rc.mu.Unlock()
		log.Printf("[rtc] rx audio stream %s activated (handle 0x%s)", stream, rc.handleHex)
	}
}

func (rc *radioConn) noteStreamRemoved(streamID uint32) {
	rc.mu.Lock()
	defer rc.mu.Unlock()

	if rc.activeRXStream == streamID {
		rc.activeRXStream = 0
	}

	if rc.activeTXStream == streamID {
		rc.activeTXStream = 0
		rc.txPacketCount = 0
	}

	log.Printf("[rtc] audio stream 0x%08X removed (handle 0x%s)", streamID, rc.handleHex)
}

// newRadioConn dials TCP to addr, reads the 2-line radio handshake, and starts
// the TCP forwarder goroutine. dc must be the "tcp" data channel.
func newRadioConn(dc *webrtc.DataChannel, addr string) (*radioConn, error) {
	tcp, err := net.DialTimeout("tcp", addr, 10*time.Second)
	if err != nil {
		return nil, err
	}

	rd := bufio.NewReader(tcp)

	line1, err := rd.ReadString('\n')
	if err != nil {
		_ = tcp.Close()

		return nil, fmt.Errorf("read line1: %w", err)
	}

	line2, err := rd.ReadString('\n')
	if err != nil {
		_ = tcp.Close()

		return nil, fmt.Errorf("read line2: %w", err)
	}

	l1 := strings.TrimSpace(line1)
	l2 := strings.TrimSpace(line2)

	_, handleLine := l1, l2
	if strings.HasPrefix(l1, "H") {
		log.Printf("[rtc] warning: radio handshake lines swapped, trying to recover")

		_, handleLine = l2, l1
	}

	handleHex := strings.ToUpper(strings.TrimPrefix(handleLine, "H"))
	handleU32, _ := strconv.ParseUint(handleHex, 16, 32)

	rc := &radioConn{
		handleHex: handleHex,
		handleU32: uint32(handleU32),
		tcpConn:   tcp,
		tcpDC:     dc,
	}

	rc.sendTCPLine(line1)
	rc.sendTCPLine(line2)

	log.Printf("[rtc] radio connected handle=0x%s", handleHex)

	go rc.tcpForwarder(rd)

	return rc, nil
}

// openUDP dials UDP to addr, tells the radio our local port, and stores the connection.
func (rc *radioConn) openUDP(dc *webrtc.DataChannel, addr string) error {
	raddr, err := net.ResolveUDPAddr("udp", addr)
	if err != nil {
		return err
	}

	u, err := net.DialUDP("udp", &net.UDPAddr{IP: net.IPv4zero, Port: 0}, raddr)
	if err != nil {
		return err
	}

	rc.mu.Lock()
	rc.udpConn = u
	rc.udpDC = dc
	rc.mu.Unlock()

	if ua, ok := u.LocalAddr().(*net.UDPAddr); ok {
		_, _ = io.WriteString(rc.tcpConn, fmt.Sprintf("C0|client udpport %d\n", ua.Port))
	}

	return nil
}

// close shuts down TCP and UDP connections.
func (rc *radioConn) close() {
	rc.mu.Lock()
	defer rc.mu.Unlock()

	if rc.tcpConn != nil {
		_ = rc.tcpConn.Close()
		rc.tcpConn = nil
	}

	if rc.udpConn != nil {
		_ = rc.udpConn.Close()
		rc.udpConn = nil
	}
}

// tcpForwarder reads lines from the radio, forwards to the TCP data channel,
// and watches for stream announcements.
func (rc *radioConn) tcpForwarder(rd *bufio.Reader) {
	for {
		b, err := rd.ReadString('\n')
		if err != nil {
			return
		}

		rc.sendTCPLine(b)

		stream, ok := parseAudioStream(b)
		if !ok {
			continue
		}

		if stream.Removed {
			rc.noteStreamRemoved(stream.StreamID)

			continue
		}

		rc.mu.RLock()
		handle := rc.handleU32
		rc.mu.RUnlock()

		if stream.ClientHandle == handle {
			rc.noteStreamCreated(stream.StreamID, stream.Type, stream.Compression)
		}
	}
}
