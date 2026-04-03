package signaling

import (
	"bufio"
	"context"
	"encoding/json"
	"log"
	"net"
	"net/http"
	"strconv"
	"strings"
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

type ClientSession struct {
	ws *websocket.Conn
	rs *core.RadioSession
	pc *webrtc.PeerConnection

	disco *discovery.Service
	rtc   *rtc.Server

	send chan Message
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

	clientIP := clientIPFromRequest(r)
	log.Printf("[signal] new connection from %s", clientIP)

	pc, err := webrtc.NewPeerConnection(webrtc.Configuration{})
	if err != nil {
		log.Printf("[signal] failed to create PeerConnection: %v", err)

		return
	}

	send := make(chan Message, 64)
	s := &ClientSession{ws: ws, disco: h.disco, rtc: h.rtc, pc: pc, send: send}
	ctx, cancel := context.WithCancel(r.Context())

	pc.OnConnectionStateChange(func(state webrtc.PeerConnectionState) {
		if state == webrtc.PeerConnectionStateFailed || state == webrtc.PeerConnectionStateClosed {
			cancel()
			close(send)
		}
	})

	ws.SetCloseHandler(func(code int, text string) error {
		pc.Close()

		return nil
	})

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
					cancel()
				}
			case <-ctx.Done():
				return
			}
		}
	})

	s.Serve(ctx)
	writerDone.Wait()
}

func (s *ClientSession) Serve(ctx context.Context) {
	pc, err := s.rtc.CreatePeerConnection()
	if err != nil {
		return
	}

	s.pc = pc
	rs := &core.RadioSession{
		PC: pc,
	}

	pc.OnICECandidate(func(c *webrtc.ICECandidate) {
		if c == nil {
			return
		}

		s.Send(ctx, mustEncode(TypeICE, c.ToJSON()))
	})

	track, err := webrtc.NewTrackLocalStaticSample(
		webrtc.RTPCodecCapability{
			MimeType:  webrtc.MimeTypeOpus,
			ClockRate: 48000,
			Channels:  2,
		},
		"remote_audio_rx",
		"rtc_audio_rx",
	)
	if err != nil {
		return
	}

	_, err = pc.AddTrack(track)
	if err != nil {
		return
	}

	rs.SetRXTrack(track)

	pc.OnDataChannel(func(dc *webrtc.DataChannel) {
		switch dc.Protocol() {
		case "udp":
			log.Printf("[rtc] new udp data channel (handle %s)", dc.Label())

			rs.SetUDPDataChannel(dc)
			dc.OnMessage(func(msg webrtc.DataChannelMessage) {
				if _, err := rs.UDPConn.Write(msg.Data); err != nil {
					log.Printf("[rtc] udp datachannel write failed err=%v", err)
				}
			})

			go s.rtc.ConnectUDP(rs, dc.Label())
		case "tcp":
			log.Printf("[rtc] new tcp data channel (handle %s)", dc.Label())

			host, port, err := net.SplitHostPort(dc.Label())
			if err != nil {
				log.Printf("[rtc] invalid tcp data channel label %q: %v", dc.Label(), err)

				return
			}

			portInt, err := strconv.ParseInt(port, 10, 16)
			if err != nil {
				log.Printf("[rtc] invalid tcp data channel port %q: %v", port, err)

				return
			}

			tcp, err := net.DialTimeout("tcp", dc.Label(), 9*time.Second)
			if err != nil {
				log.Printf("[rtc] failed to connect to tcp target %q: %v", dc.Label(), err)

				return
			}

			rs.TCPConn = tcp
			rs.Host = host
			rs.BasePort = int(portInt)
			rs.SetTCPDataChannel(dc)

			dc.OnMessage(func(msg webrtc.DataChannelMessage) {
				if _, err := tcp.Write(msg.Data); err != nil {
					log.Printf("[rtc] tcp datachannel write failed err=%v", err)
				}
			})

			dc.OnClose(func() {
				rs.SetTCPDataChannel(nil)
			})

			go func() {
				defer func() {
					_ = dc.Close()
					_ = tcp.Close()
				}()

				rd := bufio.NewReader(tcp)
				for {
					b, err := rd.ReadString('\n')
					if err != nil {
						return
					}

					rs.SendTCPLine(b)

					// stream, ok := core.ParseAudioStream(b)
					// if !ok {
					// 	continue
					// }
					//
					// if stream.Removed {
					// 	s.NoteStreamRemoved(handleHex, stream.StreamID)
					// 	continue
					// }
					//
					// if stream.ClientHandle == rs.HandleU32 {
					// 	s.NoteStreamCreated(handleHex, stream.StreamID, stream.Type, stream.Compression)
					// }
				}
			}()

		case "discovery":
			log.Printf("[rtc] new discovery data channel (handle %s)", dc.ID())

			go func() {
				defer func() {
					_ = dc.Close()
				}()

				discoCh := s.disco.Subscribe()
				defer s.disco.Unsubscribe(discoCh)

				for {
					select {
					case pkt, ok := <-discoCh:
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
			}()
		default:
			log.Printf("[rtc] unknown data channel label: %q (handle %s)", dc.Protocol(), dc.ID())
		}
	})

	for {
		var env Message

		err := s.ws.ReadJSON(&env)
		if err != nil {
			break
		}

		s.dispatch(ctx, env)
	}
}

func (s *ClientSession) Send(ctx context.Context, msg Message) {
	s.send <- msg
}

func (s *ClientSession) dispatch(ctx context.Context, msg Message) {
	switch msg.Type {
	case TypeOffer:
		var offer webrtc.SessionDescription

		err := json.Unmarshal(msg.Payload, &offer)
		if err != nil {
			s.Send(ctx, mustEncode(TypeError, ErrorPayload{
				Code:    "BAD_PAYLOAD",
				Message: err.Error(),
			}))

			return
		}

		err = s.pc.SetRemoteDescription(offer)
		if err != nil {
			s.Send(ctx, mustEncode(TypeError, ErrorPayload{
				Code:    "SET_REMOTE_FAILED",
				Message: err.Error(),
			}))

			return
		}

		answer, err := s.pc.CreateAnswer(nil)
		if err != nil {
			s.Send(ctx, mustEncode(TypeError, ErrorPayload{
				Code:    "ANSWER_FAILED",
				Message: err.Error(),
			}))

			return
		}

		err = s.pc.SetLocalDescription(answer)
		if err != nil {
			s.Send(ctx, mustEncode(TypeError, ErrorPayload{
				Code:    "SET_LOCAL_FAILED",
				Message: err.Error(),
			}))

			return
		}

		s.Send(ctx, mustEncode(TypeAnswer, answer))

	case TypeICE:
		var candidate webrtc.ICECandidateInit

		err := json.Unmarshal(msg.Payload, &candidate)
		if err != nil {
			s.Send(ctx, mustEncode(TypeError, ErrorPayload{
				Code:    "BAD_PAYLOAD",
				Message: err.Error(),
			}))

			return
		}

		err = s.pc.AddICECandidate(candidate)
		if err != nil {
			s.Send(ctx, mustEncode(TypeError, ErrorPayload{
				Code:    "ADD_ICE_FAILED",
				Message: err.Error(),
			}))

			return
		}
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
		ip := parsePotentialIP(candidate)
		if ip != "" {
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
