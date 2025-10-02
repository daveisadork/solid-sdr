package radio

import (
	"bufio"
	"context"
	"errors"
	"fmt"
	"log"
	"net"
	"net/http"
	"net/netip"
	"strconv"
	"time"

	"github.com/gorilla/websocket"
)

// WSHandler bridges a single Flex radio session to one WebSocket client.
// Query: /ws/radio?host=192.168.1.10&port=4992
func WSHandler(w http.ResponseWriter, r *http.Request) {
	up := websocket.Upgrader{
		CheckOrigin:       func(*http.Request) bool { return true },
		EnableCompression: false,
	}
	ws, err := up.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	defer func() { _ = ws.Close() }()

	host := r.URL.Query().Get("host")
	portStr := r.URL.Query().Get("port")
	port, _ := strconv.Atoi(portStr)
	if host == "" || port <= 0 || port > 65535 {
		_ = ws.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(1008, "bad params"), time.Now().Add(time.Second))
		return
	}

	ctx, cancel := context.WithCancel(r.Context())
	defer cancel()

	sess, err := NewSession(ctx, host, port)
	if err != nil {
		_ = ws.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(1011, "connect failed"), time.Now().Add(time.Second))
		return
	}
	defer sess.Close()

	// pumps
	// 1) WS -> TCP (commands)
	go func() {
		for {
			mt, data, err := ws.ReadMessage()
			if err != nil {
				cancel()
				return
			}
			if mt == websocket.TextMessage || mt == websocket.BinaryMessage {
				_ = sess.WriteTCP(data)
			}
		}
	}()

	// 2) TCP lines -> WS text; 3) UDP -> WS binary
	for {
		select {
		case <-ctx.Done():
			return
		case line, ok := <-sess.TCPLines:
			if !ok {
				return
			}
			log.Printf("[radio->tcp] %q", line)
			_ = ws.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := ws.WriteMessage(websocket.TextMessage, []byte(line)); err != nil {
				return
			}
		case pkt, ok := <-sess.UDPPackets:
			if !ok {
				return
			}
			_ = ws.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := ws.WriteMessage(websocket.BinaryMessage, pkt); err != nil {
				return
			}
		}
	}
}

// Session owns one TCP + one UDP connection to a Flex radio.
// It exposes line-oriented TCP and raw UDP packets as channels.

type Session struct {
	ctx    context.Context
	cancel context.CancelFunc

	tcp net.Conn
	udp *net.UDPConn

	TCPLines   chan string
	UDPPackets chan []byte
}

func NewSession(parent context.Context, host string, port int) (*Session, error) {
	ctx, cancel := context.WithCancel(parent)
	tcp, err := net.DialTimeout("tcp", fmt.Sprintf("%s:%d", host, port), 9*time.Second)
	if err != nil {
		cancel()
		return nil, err
	}

	// Determine local IP used by TCP
	var lip netip.Addr
	if la, ok := tcp.LocalAddr().(*net.TCPAddr); ok {
		if a, ok := netip.AddrFromSlice(la.IP); ok {
			lip = a
		}
	}

	udp, err := dialUDP(lip, host, port+1)
	if err != nil {
		_ = tcp.Close()
		cancel()
		return nil, err
	}

	s := &Session{
		ctx:        ctx,
		cancel:     cancel,
		tcp:        tcp,
		udp:        udp,
		TCPLines:   make(chan string, 256),
		UDPPackets: make(chan []byte, 256),
	}

	// Tell radio our UDP port
	if ua, ok := udp.LocalAddr().(*net.UDPAddr); ok {
		_ = s.WriteTCP(fmt.Appendf(nil, "C0|client udpport %d\n", ua.Port))
	}

	go s.readTCPLines()
	go s.readUDPPackets()
	return s, nil
}

func (s *Session) Close() {
	s.cancel()
	if s.tcp != nil {
		_ = s.tcp.Close()
	}
	if s.udp != nil {
		_ = s.udp.Close()
	}
	close(s.TCPLines)
	close(s.UDPPackets)
}

func (s *Session) WriteTCP(b []byte) error {
	if s.tcp == nil {
		return errors.New("tcp closed")
	}
	// Ensure a single trailing newline so commands are always parsed correctly
	if len(b) == 0 || b[len(b)-1] != '\n' {
		b = append(b, '\n')
	}
	log.Printf("[tcp->radio] %q", b)
	_, err := s.tcp.Write(b)
	return err
}

func (s *Session) readTCPLines() {
	defer func() { _ = recover() }()
	scan := bufio.NewScanner(s.tcp)
	scan.Buffer(make([]byte, 0, 64*1024), 512*1024)
	for scan.Scan() {
		select {
		case <-s.ctx.Done():
			return
		case s.TCPLines <- scan.Text():
		}
	}
}

func (s *Session) readUDPPackets() {
	defer func() { _ = recover() }()
	buf := make([]byte, 64*1024)
	for {
		_ = s.udp.SetReadDeadline(time.Now().Add(10 * time.Second))
		n, _, err := s.udp.ReadFromUDP(buf)
		if ne, ok := err.(net.Error); ok && ne.Timeout() {
			if s.ctx.Err() != nil {
				return
			}
			continue
		}
		if err != nil {
			return
		}
		pkt := make([]byte, n)
		copy(pkt, buf[:n])
		select {
		case <-s.ctx.Done():
			return
		case s.UDPPackets <- pkt:
		}
	}
}

func dialUDP(local netip.Addr, host string, port int) (*net.UDPConn, error) {
	// Resolve remote preferring the same family as local if provided
	rAddrs, err := net.LookupIP(host)
	if err != nil || len(rAddrs) == 0 {
		return nil, errors.New("resolve failed")
	}
	sel := rAddrs[0]
	if local.IsValid() {
		is4 := local.Is4()
		for _, ip := range rAddrs {
			if (is4 && ip.To4() != nil) || (!is4 && ip.To4() == nil) {
				sel = ip
				break
			}
		}
	}
	var laddr *net.UDPAddr
	if local.IsValid() {
		laddr = &net.UDPAddr{IP: local.AsSlice(), Port: 0}
	}
	raddr := &net.UDPAddr{IP: sel, Port: port}
	return net.DialUDP("udp", laddr, raddr)
}
