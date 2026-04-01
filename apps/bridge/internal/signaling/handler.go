package signaling

import (
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/daveisadork/flex-bridge/internal/core"
	"github.com/daveisadork/flex-bridge/internal/discovery"
	"github.com/daveisadork/flex-bridge/internal/rtc"
	"github.com/gorilla/websocket"
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

		h.dispatch(env, send)
	}

	close(stop)
	writerDone.Wait()
}

func (h *Handler) dispatch(msg Message, _ chan<- Message) {
	switch msg.Type {
	case TypeOffer:
		// TODO: parse OfferPayload, call rtc.handleOffer, send TypeAnswer + trickle TypeICE
		log.Printf("[signal] offer received (not yet implemented)")
	case TypeICE:
		// TODO: parse ICEPayload, call pc.AddICECandidate
		log.Printf("[signal] ice candidate received (not yet implemented)")
	default:
		log.Printf("[signal] unknown message type: %q", msg.Type)
	}
}
