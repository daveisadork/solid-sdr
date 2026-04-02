package signaling

import (
	"encoding/json"
	"log"
	"net"
	"net/http"
	"sync"
	"time"

	"github.com/daveisadork/flex-bridge/internal/core"
	"github.com/daveisadork/flex-bridge/internal/discovery"
	"github.com/daveisadork/flex-bridge/internal/rtc"
	"github.com/gorilla/websocket"
	"github.com/pion/webrtc/v4"
)

// Handler is the HTTP handler for /ws/signal.
type Handler struct {
	disco    *discovery.Service
	sessions *core.SessionManager
	rtc      *rtc.Server
}

// New creates a signaling WebSocket handler.
func New(disco *discovery.Service, sessions *core.SessionManager, rtcSrv *rtc.Server) *Handler {
	return &Handler{disco: disco, sessions: sessions, rtc: rtcSrv}
}

func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	upgrader := websocket.Upgrader{
		CheckOrigin:       func(*http.Request) bool { return true },
		EnableCompression: false,
	}

	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}

	defer func() { _ = ws.Close() }()

	clientIP := r.Header.Get("X-Forwarded-For")
	if clientIP == "" {
		clientIP, _, _ = net.SplitHostPort(r.RemoteAddr)
	}
	log.Printf("[signal] new connection from %s", clientIP)

	send := make(chan Message, 64)
	stop := make(chan struct{})

	var writerDone sync.WaitGroup

	// writer — serializes all outbound messages onto the WebSocket
	writerDone.Go(func() {
		for {
			select {
			case msg, ok := <-send:
				if !ok {
					return
				}

				_ = ws.SetWriteDeadline(time.Now().Add(10 * time.Second))

				err := ws.WriteJSON(msg)
				if err != nil {
					return
				}
			case <-stop:
				return
			}
		}
	})

	// discovery relay — subscribes to multicast packets and forwards to client
	discoCh := h.disco.Subscribe()

	go func() {
		defer h.disco.Unsubscribe(discoCh)

		for {
			select {
			case pkt, ok := <-discoCh:
				if !ok {
					return
				}

				msg, err := encode(TypeDiscovery, DiscoveryPayload{Packet: pkt})
				if err != nil {
					continue
				}

				select {
				case send <- msg:
				case <-stop:
					return
				}
			case <-stop:
				return
			}
		}
	}()

	// read loop — inbound messages from client
	for {
		var env Message

		err := ws.ReadJSON(&env)
		if err != nil {
			break
		}

		h.dispatch(env, send, stop, clientIP)
	}

	close(stop)
	writerDone.Wait()
}

func (h *Handler) dispatch(msg Message, send chan<- Message, stop <-chan struct{}, clientIP string) {
	switch msg.Type {
	case TypeOffer:
		var payload OfferPayload

		err := json.Unmarshal(msg.Payload, &payload)
		if err != nil {
			safeSend(send, stop, mustEncode(TypeError, ErrorPayload{
				Code:    "BAD_PAYLOAD",
				Message: err.Error(),
			}))

			return
		}

		if payload.Host == "" || payload.Port == 0 || payload.SDP == "" {
			safeSend(send, stop, mustEncode(TypeError, ErrorPayload{
				Code:    "BAD_PAYLOAD",
				Message: "host, port, and sdp are required",
			}))

			return
		}

		// Run in a goroutine — ConnectAndOffer blocks on TCP dial + handshake.
		go func() {
			sessionID, version, handle, answerSDP, err := h.rtc.ConnectAndOffer(
				payload.Host, payload.Port, payload.SDP, clientIP,
				func(sid string, c webrtc.ICECandidateInit) {
					safeSend(send, stop, mustEncode(TypeICE, ICEPayload{
						SessionID: sid,
						Candidate: &ICECandidateInit{
							Candidate:        c.Candidate,
							SDPMid:           c.SDPMid,
							SDPMLineIndex:    c.SDPMLineIndex,
							UsernameFragment: c.UsernameFragment,
						},
					}))
				},
				func(sid string) {
					safeSend(send, stop, mustEncode(TypeICE, ICEPayload{
						SessionID: sid,
						Candidate: nil,
					}))
				},
			)
			if err != nil {
				log.Printf("[signal] ConnectAndOffer failed: %v", err)
				safeSend(send, stop, mustEncode(TypeError, ErrorPayload{
					Code:    "CONNECT_FAILED",
					Message: err.Error(),
				}))

				return
			}

			safeSend(send, stop, mustEncode(TypeAnswer, AnswerPayload{
				SessionID: sessionID,
				SDP:       answerSDP,
				Version:   version,
				Handle:    handle,
			}))
		}()

	case TypeICE:
		// TODO: parse ICEPayload, call pc.AddICECandidate
		log.Printf("[signal] ice candidate received (not yet implemented)")

	default:
		log.Printf("[signal] unknown message type: %q", msg.Type)
	}
}

// safeSend sends msg to send, aborting if stop is closed.
func safeSend(send chan<- Message, stop <-chan struct{}, msg Message) {
	select {
	case send <- msg:
	case <-stop:
	}
}

// mustEncode encodes a typed payload into a Message.
// Encoding a known struct should never fail; if it does a generic error is returned.
func mustEncode(msgType string, payload any) Message {
	msg, err := encode(msgType, payload)
	if err != nil {
		return Message{Type: TypeError, Payload: json.RawMessage(`{"code":"ENCODE_ERROR"}`)}
	}

	return msg
}
