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
	typeOffer  = "offer"
	typeAnswer = "answer"
	typeICE    = "ice"
	typeError  = "error"
	typePing   = "ping"
	typePong   = "pong"
)

type message struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload,omitempty"`
}

type errorPayload struct {
	Code    string `json:"code"`
	Message string `json:"message"`
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

	mu    sync.Mutex
	pc    *webrtc.PeerConnection
	radio *radioConn
}

func newClientSession(srv *Server, ws *websocket.Conn, cancel context.CancelFunc) *clientSession {
	return &clientSession{
		srv:    srv,
		ws:     ws,
		cancel: cancel,
		send:   make(chan message, 64),
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
	default:
		log.Printf("[rtc] unknown message type: %q", msg.Type)
	}
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
		log.Printf("[rtc] connection state: %s", state)

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
	rc, err := newRadioConn(dc, dc.Label())
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

		r.mu.RLock()
		tcp := r.tcpConn
		r.mu.RUnlock()

		if tcp == nil || len(msg.Data) == 0 {
			return
		}

		if _, err := tcp.Write(msg.Data); err != nil {
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
		rc.mu.RUnlock()

		if u == nil || len(msg.Data) == 0 {
			return
		}

		if _, err := u.Write(msg.Data); err != nil {
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
		rc.mu.RUnlock()

		if u == nil {
			continue
		}

		pkt := buildTXOpusPacket(streamID, count, packet.Payload)
		if _, err := u.Write(pkt); err != nil {
			return
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
