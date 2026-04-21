package rtc

import (
	"context"
	"log"
	"net"
	"net/http"
	"strings"

	"github.com/daveisadork/solid-sdr/apps/server/internal/discovery"
	"github.com/gorilla/websocket"
	"github.com/pion/ice/v4"
	"github.com/pion/webrtc/v4"
)

type Options struct {
	ICEPortStart uint16
	ICEPortEnd   uint16
	STUN         []string
	NAT1To1IPs   []string
}

type Server struct {
	disco      *discovery.Service
	api        *webrtc.API
	iceServers []webrtc.ICEServer
}

func New(disco *discovery.Service, opt Options) *Server {
	var se webrtc.SettingEngine
	se.SetNetworkTypes([]webrtc.NetworkType{webrtc.NetworkTypeUDP4, webrtc.NetworkTypeUDP6})

	if opt.ICEPortStart == opt.ICEPortEnd {
		port := int(opt.ICEPortStart)

		mux, err := ice.NewMultiUDPMuxFromPort(port,
			ice.UDPMuxFromPortWithNetworks(ice.NetworkTypeUDP4, ice.NetworkTypeUDP6))
		if err != nil {
			log.Fatalf("[rtc] failed to create UDP mux on port %d: %v", port, err)
		}

		se.SetICEUDPMux(mux)
		hasUDP4, hasUDP6, listeners := summarizeMuxListeners(mux.GetListenAddresses())
		log.Printf("[rtc] single-port UDP mux on port %d (udp4=%t udp6=%t listeners=%s)",
			port, hasUDP4, hasUDP6, strings.Join(listeners, ","))

		if !hasUDP4 || !hasUDP6 {
			log.Printf("[rtc] warning: missing stack(s) — udp4=%t udp6=%t", hasUDP4, hasUDP6)
		}
	} else {
		err := se.SetEphemeralUDPPortRange(opt.ICEPortStart, opt.ICEPortEnd)
		if err != nil {
			log.Fatalf("[rtc] invalid ICE port range %d..%d: %v", opt.ICEPortStart, opt.ICEPortEnd, err)
		}
	}

	if len(opt.NAT1To1IPs) > 0 {
		err := se.SetICEAddressRewriteRules(webrtc.ICEAddressRewriteRule{
			External:        append([]string(nil), opt.NAT1To1IPs...),
			AsCandidateType: webrtc.ICECandidateTypeHost,
			Mode:            webrtc.ICEAddressRewriteReplace,
		})
		if err != nil {
			log.Fatalf("[rtc] invalid ICE address rewrite config: %v", err)
		}
	}

	api := webrtc.NewAPI(webrtc.WithSettingEngine(se))

	var iceServers []webrtc.ICEServer
	if len(opt.STUN) > 0 {
		iceServers = append(iceServers, webrtc.ICEServer{URLs: opt.STUN})
	}

	return &Server{disco: disco, api: api, iceServers: iceServers}
}

var upgrader = websocket.Upgrader{ //nolint:gochecknoglobals
	ReadBufferSize:    64 * 1024,
	WriteBufferSize:   64 * 1024,
	CheckOrigin:       func(*http.Request) bool { return true },
	EnableCompression: false,
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}

	defer func() { _ = ws.Close() }()

	clientIP := clientIPFromRequest(r)
	log.Printf("[rtc] new connection from %s", clientIP)

	ctx, cancel := context.WithCancel(r.Context())
	defer cancel()

	cs := newClientSession(s, ws, cancel)
	cs.serve(ctx)
}

func summarizeMuxListeners(addrs []net.Addr) (hasUDP4, hasUDP6 bool, listeners []string) {
	listeners = make([]string, 0, len(addrs))
	for _, addr := range addrs {
		listeners = append(listeners, addr.String())

		udpAddr, ok := addr.(*net.UDPAddr)
		if !ok || udpAddr.IP == nil {
			continue
		}

		if udpAddr.IP.To4() != nil {
			hasUDP4 = true
		} else if udpAddr.IP.To16() != nil {
			hasUDP6 = true
		}
	}

	return hasUDP4, hasUDP6, listeners
}
