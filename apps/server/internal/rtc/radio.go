package rtc

import (
	"bufio"
	"context"
	"fmt"
	"log"
	"net"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/pion/webrtc/v4"
)

const internalPingSequence = 2147483647

type radioConn struct {
	mu sync.RWMutex

	handleHex string
	handleU32 uint32

	tcpConn    net.Conn
	udpConn    *net.UDPConn
	tcpDC      *webrtc.DataChannel
	udpDC      *webrtc.DataChannel
	tcpWriteMu sync.Mutex

	activeRXStream uint32
	activeTXStream uint32
	txPacketCount  uint8

	pingCancel           context.CancelFunc
	internalPingSentAt   time.Time
	serverToRadioRTTMax  time.Duration
	onNetworkDiagnostics func(serverRadioNetworkDiagnostics)

	downloadDC           *webrtc.DataChannel
	pendingDownloadSeq   uint32
	pendingDownloadSeqOk bool
}

type serverRadioNetworkDiagnostics struct {
	ServerToRadioRttMs    *int64 `json:"serverToRadioRttMs"`
	ServerToRadioRttMaxMs *int64 `json:"serverToRadioRttMaxMs"`
	SampledAt             int64  `json:"sampledAt"`
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

func (rc *radioConn) writeTCP(data []byte) error {
	rc.mu.RLock()
	tcp := rc.tcpConn
	rc.mu.RUnlock()

	if tcp == nil {
		return net.ErrClosed
	}

	rc.tcpWriteMu.Lock()
	defer rc.tcpWriteMu.Unlock()

	_, err := tcp.Write(data)

	return err
}

func (rc *radioConn) writeTCPString(line string) error {
	return rc.writeTCP([]byte(line))
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
func newRadioConn(
	dc *webrtc.DataChannel,
	addr string,
	onNetworkDiagnostics func(serverRadioNetworkDiagnostics),
) (*radioConn, error) {
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
	pingCtx, pingCancel := context.WithCancel(context.Background())

	rc := &radioConn{
		handleHex:            handleHex,
		handleU32:            uint32(handleU32),
		tcpConn:              tcp,
		tcpDC:                dc,
		pingCancel:           pingCancel,
		onNetworkDiagnostics: onNetworkDiagnostics,
	}

	rc.sendTCPLine(line1)
	rc.sendTCPLine(line2)
	rc.reportServerToRadioRTT(nil, nil, time.Now())

	log.Printf("[rtc] radio connected handle=0x%s", handleHex)

	go rc.tcpForwarder(rd)
	go rc.internalPingLoop(pingCtx)

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
		_ = rc.writeTCPString(fmt.Sprintf("C0|client udpport %d\n", ua.Port))
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

	if rc.pingCancel != nil {
		rc.pingCancel()
		rc.pingCancel = nil
	}

	if rc.udpConn != nil {
		_ = rc.udpConn.Close()
		rc.udpConn = nil
	}
}

func (rc *radioConn) setDownloadDC(dc *webrtc.DataChannel) {
	rc.mu.Lock()
	rc.downloadDC = dc
	rc.mu.Unlock()
}

var (
	reFileDownloadCmd   = regexp.MustCompile(`^C(\d+)\|file download `)
	reFileDownloadReply = regexp.MustCompile(`^R(\d+)\|0\|(\d+)\s*$`)
)

// noteOutgoingCommand inspects data the client is about to send to the radio
// and records the sequence number of any `file download` command.
func (rc *radioConn) noteOutgoingCommand(data []byte) {
	line := strings.TrimRight(string(data), "\r\n")
	m := reFileDownloadCmd.FindStringSubmatch(line)
	if m == nil {
		return
	}
	seq, err := strconv.ParseUint(m[1], 10, 32)
	if err != nil {
		return
	}
	rc.mu.Lock()
	rc.pendingDownloadSeq = uint32(seq)
	rc.pendingDownloadSeqOk = true
	rc.mu.Unlock()
}

// serveDownload listens on port, accepts one connection from the radio, and
// relays the received bytes to the client's download data channel in chunks.
// An empty Send signals EOF.
func (rc *radioConn) serveDownload(port int, dc *webrtc.DataChannel) {
	ln, err := net.Listen("tcp", fmt.Sprintf(":%d", port))
	if err != nil {
		log.Printf("[rtc] download listen :%d: %v", port, err)
		_ = dc.Send([]byte("error:" + err.Error()))
		return
	}
	defer ln.Close()

	conn, err := ln.Accept()
	if err != nil {
		log.Printf("[rtc] download accept: %v", err)
		return
	}
	defer conn.Close()

	buf := make([]byte, 32*1024)
	for {
		n, readErr := conn.Read(buf)
		if n > 0 {
			chunk := make([]byte, n)
			copy(chunk, buf[:n])
			if sendErr := dc.Send(chunk); sendErr != nil {
				log.Printf("[rtc] download dc send: %v", sendErr)
				return
			}
		}
		if readErr != nil {
			break
		}
	}

	// EOF signal — zero-length frame.
	_ = dc.Send([]byte{})
}

// tcpForwarder reads lines from the radio, forwards to the TCP data channel,
// and watches for stream announcements.
func (rc *radioConn) tcpForwarder(rd *bufio.Reader) {
	for {
		b, err := rd.ReadString('\n')
		if err != nil {
			return
		}

		trimmed := strings.TrimSpace(b)

		if rc.consumeInternalPingReply(trimmed, time.Now()) {
			continue
		}

		// Intercept file download replies: start the TCP listener BEFORE
		// forwarding the reply to the client so the radio never connects to
		// a port we haven't opened yet.
		if m := reFileDownloadReply.FindStringSubmatch(trimmed); m != nil {
			seq, _ := strconv.ParseUint(m[1], 10, 32)
			port, _ := strconv.Atoi(m[2])

			rc.mu.Lock()
			match := rc.pendingDownloadSeqOk && rc.pendingDownloadSeq == uint32(seq)
			dc := rc.downloadDC
			if match {
				rc.pendingDownloadSeqOk = false
			}
			rc.mu.Unlock()

			if match && dc != nil && port > 0 {
				go rc.serveDownload(port, dc)
			}
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

func (rc *radioConn) internalPingLoop(ctx context.Context) {
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	rc.sendInternalPing(time.Now())

	for {
		select {
		case <-ctx.Done():
			return
		case tick := <-ticker.C:
			rc.sendInternalPing(tick)
		}
	}
}

func (rc *radioConn) sendInternalPing(now time.Time) {
	rc.mu.RLock()
	sentAt := rc.internalPingSentAt
	rc.mu.RUnlock()

	if !sentAt.IsZero() && now.Sub(sentAt) < 5*time.Second {
		return
	}

	if err := rc.writeTCPString(
		fmt.Sprintf("C%d|ping ms_timestamp=%d\n", internalPingSequence, now.UnixMilli()),
	); err != nil {
		return
	}

	rc.mu.Lock()
	rc.internalPingSentAt = now
	rc.mu.Unlock()
}

func (rc *radioConn) consumeInternalPingReply(line string, now time.Time) bool {
	if !strings.HasPrefix(line, fmt.Sprintf("R%d|", internalPingSequence)) {
		return false
	}

	rc.mu.Lock()
	sentAt := rc.internalPingSentAt
	if sentAt.IsZero() {
		rc.mu.Unlock()
		return false
	}

	rc.internalPingSentAt = time.Time{}
	rtt := now.Sub(sentAt)
	if rtt > rc.serverToRadioRTTMax {
		rc.serverToRadioRTTMax = rtt
	}

	currentMs := int64(rtt / time.Millisecond)
	maxMs := int64(rc.serverToRadioRTTMax / time.Millisecond)
	rc.mu.Unlock()

	rc.reportServerToRadioRTT(&currentMs, &maxMs, now)

	return true
}

func (rc *radioConn) reportServerToRadioRTT(
	currentMs *int64,
	maxMs *int64,
	now time.Time,
) {
	if rc.onNetworkDiagnostics == nil {
		return
	}

	rc.onNetworkDiagnostics(serverRadioNetworkDiagnostics{
		ServerToRadioRttMs:    currentMs,
		ServerToRadioRttMaxMs: maxMs,
		SampledAt:             now.UnixMilli(),
	})
}
