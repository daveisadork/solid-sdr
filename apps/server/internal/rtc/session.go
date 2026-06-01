package rtc

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/pion/webrtc/v4"
)

const (
	typeOffer              = "offer"
	typeAnswer             = "answer"
	typeICE                = "ice"
	typeError              = "error"
	typeNetworkDiagnostics = "networkDiagnostics"
	typePing               = "ping"
	typePong               = "pong"
	typeVersion            = "version"
)

type message struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload,omitempty"`
}

type errorPayload struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

type versionPayload struct {
	Version string `json:"version"`
}

func encode(msgType string, payload any) (message, error) {
	data, err := json.Marshal(payload)
	if err != nil {
		return message{}, fmt.Errorf("error encoding %v message: %w", msgType, err)
	}

	return message{Type: msgType, Payload: data}, nil
}

func mustEncode(msgType string, payload any) message {
	msg, err := encode(msgType, payload)
	if err != nil {
		return message{Type: typeError, Payload: json.RawMessage(`{"code":"ENCODE_ERROR"}`)}
	}

	return msg
}

type clientSession struct {
	srv        *Server
	ws         *websocket.Conn
	cancel     context.CancelFunc
	send       chan message
	audioTrack *webrtc.TrackLocalStaticSample
	clientIP   string

	mu    sync.Mutex
	pc    *webrtc.PeerConnection
	radio *radioConn
}

func newClientSession(srv *Server, ws *websocket.Conn, cancel context.CancelFunc, clientIP string) *clientSession {
	return &clientSession{
		srv:      srv,
		ws:       ws,
		cancel:   cancel,
		send:     make(chan message, 64),
		clientIP: clientIP,
	}
}

func (cs *clientSession) serve(ctx context.Context) {
	var wg sync.WaitGroup
	wg.Go(func() {
		for {
			select {
			case msg, ok := <-cs.send:
				if !ok {
					return
				}

				_ = cs.ws.SetWriteDeadline(time.Now().Add(10 * time.Second))

				err := cs.ws.WriteJSON(msg)
				if err != nil {
					cs.cancel()

					return
				}
			case <-ctx.Done():
				return
			}
		}
	})

	for {
		var env message

		err := cs.ws.ReadJSON(&env)
		if err != nil {
			log.Printf("[rtc] error read message: %v", err)

			break
		}

		cs.dispatch(ctx, env)
	}

	wg.Wait()
}

func (cs *clientSession) trySend(msg message) {
	select {
	case cs.send <- msg:
	default:
	}
}

func (cs *clientSession) dispatch(ctx context.Context, msg message) {
	switch msg.Type {
	case typeOffer:
		cs.handleOffer(ctx, msg.Payload)
	case typeICE:
		cs.handleICE(msg.Payload)
	case typePing:
		cs.trySend(mustEncode(typePong, nil))
	case typeVersion:
		cs.handleVersion(msg.Payload)
	default:
		log.Printf("[rtc] unknown message type: %q", msg.Type)
	}
}

func (cs *clientSession) handleVersion(raw json.RawMessage) {
	var p versionPayload

	err := json.Unmarshal(raw, &p)
	if err != nil {
		return
	}

	log.Printf("[rtc] client %s connected with version %s", cs.clientIP, p.Version)
}

func (cs *clientSession) reportServerToRadioDiagnostics(
	diagnostics serverRadioNetworkDiagnostics,
) {
	cs.trySend(mustEncode(typeNetworkDiagnostics, diagnostics))
}

func (cs *clientSession) handleOffer(ctx context.Context, raw json.RawMessage) {
	var offer webrtc.SessionDescription

	err := json.Unmarshal(raw, &offer)
	if err != nil {
		cs.trySend(mustEncode(typeError, errorPayload{Code: "BAD_PAYLOAD", Message: err.Error()}))

		return
	}

	cs.mu.Lock()
	if cs.pc == nil {
		pc, err := cs.srv.api.NewPeerConnection(webrtc.Configuration{ICEServers: cs.srv.iceServers})
		if err != nil {
			cs.mu.Unlock()
			cs.trySend(mustEncode(typeError, errorPayload{Code: "PC_CREATE_FAILED", Message: err.Error()}))

			return
		}

		cs.pc = pc
		cs.mu.Unlock()
		cs.setupPeerConnection(ctx)
	} else {
		cs.mu.Unlock()
	}

	err = cs.pc.SetRemoteDescription(offer)
	if err != nil {
		cs.trySend(mustEncode(typeError, errorPayload{Code: "SET_REMOTE_FAILED", Message: err.Error()}))

		return
	}

	answer, err := cs.pc.CreateAnswer(&webrtc.AnswerOptions{
		OfferAnswerOptions: webrtc.OfferAnswerOptions{
			ICETricklingSupported: true,
		},
	})
	if err != nil {
		cs.trySend(mustEncode(typeError, errorPayload{Code: "ANSWER_FAILED", Message: err.Error()}))

		return
	}

	err = cs.pc.SetLocalDescription(answer)
	if err != nil {
		cs.trySend(mustEncode(typeError, errorPayload{Code: "SET_LOCAL_FAILED", Message: err.Error()}))

		return
	}

	cs.trySend(mustEncode(typeAnswer, cs.pc.LocalDescription()))
}

func (cs *clientSession) handleICE(raw json.RawMessage) {
	cs.mu.Lock()
	pc := cs.pc
	cs.mu.Unlock()

	if pc == nil {
		return
	}

	var candidate webrtc.ICECandidateInit

	err := json.Unmarshal(raw, &candidate)
	if err != nil {
		cs.trySend(mustEncode(typeError, errorPayload{Code: "BAD_PAYLOAD", Message: err.Error()}))

		return
	}

	err = pc.AddICECandidate(candidate)
	if err != nil {
		cs.trySend(mustEncode(typeError, errorPayload{Code: "ADD_ICE_FAILED", Message: err.Error()}))
	}
}

func (cs *clientSession) setupPeerConnection(ctx context.Context) {
	track, err := webrtc.NewTrackLocalStaticSample(
		webrtc.RTPCodecCapability{MimeType: webrtc.MimeTypeOpus, ClockRate: 48000, Channels: 2},
		"remote_audio", "remote_audio",
	)
	if err != nil {
		log.Printf("[rtc] failed to create audio track: %v", err)

		return
	}

	_, err = cs.pc.AddTrack(track)
	if err != nil {
		log.Printf("[rtc] failed to add audio track: %v", err)

		return
	}

	cs.audioTrack = track
	cs.pc.OnICECandidate(func(c *webrtc.ICECandidate) {
		if c == nil {
			return
		}

		cs.trySend(mustEncode(typeICE, c.ToJSON()))
	})
	cs.pc.OnConnectionStateChange(func(state webrtc.PeerConnectionState) {
		if state == webrtc.PeerConnectionStateFailed || state == webrtc.PeerConnectionStateClosed {
			cs.cancel()
			_ = cs.pc.Close()
		}
	})
	cs.pc.OnDataChannel(func(dc *webrtc.DataChannel) {
		switch dc.Protocol() {
		case "discovery":
			go cs.serveDiscovery(ctx, dc)
		case "tcp":
			dc.OnOpen(func() { cs.openTCP(dc) })
		case "udp":
			dc.OnOpen(func() { cs.openUDP(dc) })
		case "upload":
			dc.OnOpen(func() { go cs.openUploadProxy(dc) })
		case "download":
			dc.OnOpen(func() {
				cs.mu.Lock()
				rc := cs.radio
				cs.mu.Unlock()

				if rc != nil {
					rc.setDownloadDC(dc)
				}
			})
		default:
			log.Printf("[rtc] unknown data channel protocol %q label %q", dc.Protocol(), dc.Label())
		}
	})
	cs.pc.OnTrack(func(track *webrtc.TrackRemote, _ *webrtc.RTPReceiver) {
		go cs.handleTXTrack(track)
	})
}

func (cs *clientSession) serveDiscovery(ctx context.Context, dc *webrtc.DataChannel) {
	defer func() { _ = dc.Close() }()

	ch := cs.srv.disco.Subscribe()
	defer cs.srv.disco.Unsubscribe(ch)

	for {
		select {
		case pkt, ok := <-ch:
			if !ok {
				return
			}

			err := dc.Send(pkt)
			if err != nil {
				return
			}
		case <-ctx.Done():
			return
		}
	}
}

func (cs *clientSession) openTCP(dc *webrtc.DataChannel) {
	rc, err := newRadioConn(dc, dc.Label(), cs.reportServerToRadioDiagnostics)
	if err != nil {
		log.Printf("[rtc] tcp dial %q: %v", dc.Label(), err)
		_ = dc.Close()

		return
	}

	cs.mu.Lock()
	cs.radio = rc
	cs.mu.Unlock()
	dc.OnMessage(func(msg webrtc.DataChannelMessage) {
		cs.mu.Lock()
		r := cs.radio
		cs.mu.Unlock()

		if r == nil {
			return
		}

		if len(msg.Data) == 0 {
			return
		}

		r.noteOutgoingCommand(msg.Data)

		if err := r.writeTCP(msg.Data); err != nil {
			log.Printf("[rtc] tcp write: %v", err)

			_ = dc.Close()
		}
	})
	dc.OnClose(func() {
		cs.mu.Lock()
		r := cs.radio
		cs.radio = nil
		cs.mu.Unlock()

		if r != nil {
			r.close()
		}
	})
}

func (cs *clientSession) openUDP(dc *webrtc.DataChannel) {
	cs.mu.Lock()
	rc := cs.radio
	cs.mu.Unlock()

	if rc == nil {
		log.Printf("[rtc] udp DC opened but no radio conn; closing")

		_ = dc.Close()

		return
	}

	err := rc.openUDP(dc, dc.Label())
	if err != nil {
		log.Printf("[rtc] udp dial %q: %v", dc.Label(), err)
		_ = dc.Close()

		return
	}

	dc.OnMessage(func(msg webrtc.DataChannelMessage) {
		rc.mu.RLock()
		u := rc.udpConn
		raddr := rc.udpRaddr
		rc.mu.RUnlock()

		if u == nil || raddr == nil || len(msg.Data) == 0 {
			return
		}

		if _, err := u.WriteToUDP(msg.Data, raddr); err != nil {
			log.Printf("[rtc] udp write: %v", err)

			_ = dc.Close()
		}
	})
	startUDPDemux(rc, cs.audioTrack)
}

func (cs *clientSession) handleTXTrack(track *webrtc.TrackRemote) {
	for {
		packet, _, err := track.ReadRTP()
		if err != nil {
			return
		}

		if len(packet.Payload) == 0 {
			continue
		}

		cs.mu.Lock()
		rc := cs.radio
		cs.mu.Unlock()

		if rc == nil {
			continue
		}

		streamID, count, ok := rc.nextTXPacket()
		if !ok {
			continue
		}

		rc.mu.RLock()
		u := rc.udpConn
		raddr := rc.udpRaddr
		rc.mu.RUnlock()

		if u == nil || raddr == nil {
			continue
		}

		pkt := buildTXOpusPacket(streamID, count, packet.Payload)
		if _, err := u.WriteToUDP(pkt, raddr); err != nil {
			return
		}
	}
}

// openUploadProxy dials the radio's upload TCP port, signals the client when
// ready, and forwards incoming data channel messages to the TCP connection.
func (cs *clientSession) openUploadProxy(dc *webrtc.DataChannel) {
	addr := dc.Label()

	tcp, err := net.DialTimeout("tcp", addr, 10*time.Second)
	if err != nil {
		log.Printf("[rtc] upload dial %q: %v", addr, err)
		_ = dc.SendText("error:" + err.Error())
		_ = dc.Close()

		return
	}

	data := make(chan []byte, 256)

	// Set up OnMessage BEFORE sending ready so no chunks are missed.
	dc.OnMessage(func(msg webrtc.DataChannelMessage) {
		if len(msg.Data) == 0 {
			return
		}

		data <- msg.Data
	})

	dc.OnClose(func() {
		close(data)
	})

	dc.OnError(func(err error) {
		log.Printf("[rtc] upload dc err: %v", err)
	})

	// Single null byte signals the client that the TCP connection is open.
	if err := dc.Send([]byte{0}); err != nil {
		log.Printf("[rtc] upload ready signal: %v", err)

		_ = tcp.Close()
		_ = dc.Close()
	}

	defer func() {
		log.Printf("[rtc] closing upload tcp")

		_ = tcp.Close()
	}()

	for chunk := range data {
		_, writeErr := tcp.Write(chunk)
		if writeErr != nil {
			log.Printf("[rtc] upload tcp write: %v", writeErr)

			break
		}
	}
}

func clientIPFromRequest(r *http.Request) string {
	if r == nil {
		return "unknown"
	}

	for _, header := range []string{"CF-Connecting-IP", "X-Forwarded-For", "X-Real-IP"} {
		if ip := firstValidIP(r.Header.Get(header)); ip != "" {
			return ip
		}
	}

	if ip := firstValidIP(r.RemoteAddr); ip != "" {
		return ip
	}

	return "unknown"
}

func firstValidIP(raw string) string {
	if raw == "" {
		return ""
	}

	for candidate := range strings.SplitSeq(raw, ",") {
		if ip := parsePotentialIP(candidate); ip != "" {
			return ip
		}
	}

	return ""
}

func parsePotentialIP(raw string) string {
	v := strings.TrimSpace(strings.Trim(raw, `"`))
	if v == "" || strings.EqualFold(v, "unknown") {
		return ""
	}

	if host, _, err := net.SplitHostPort(v); err == nil {
		v = host
	}

	v = strings.Trim(v, "[]")

	ip := net.ParseIP(v)
	if ip == nil {
		return ""
	}

	return ip.String()
}
