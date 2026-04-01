package rtc

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"strconv"
	"strings"

	"github.com/daveisadork/flex-bridge/internal/core"
	"github.com/pion/ice/v4"
	"github.com/pion/webrtc/v4"
)

// Options configures the RTC server.
type Options struct {
	// ICE port
	ICEPortStart uint16
	ICEPortEnd   uint16

	// STUN servers (full URLs like stun:stun.l.google.com:19302).
	STUN []string

	// Optional public IPs to advertise for host candidates (static NAT).
	NAT1To1IPs []string
}

var (
	errNoTCPSession = errors.New("no TCP session")
	errNoLocalDesc  = errors.New("no local description")
)

type Server struct {
	Sessions   *core.SessionManager
	ICEServers []webrtc.ICEServer
	api        *webrtc.API
}

func New(sessions *core.SessionManager, opt Options) *Server {
	var se webrtc.SettingEngine

	se.SetNetworkTypes([]webrtc.NetworkType{
		webrtc.NetworkTypeUDP4, webrtc.NetworkTypeUDP6,
	})

	if opt.ICEPortStart == opt.ICEPortEnd {
		// ---- single fixed port => create mux ----
		port := int(opt.ICEPortStart)
		if mux, err := ice.NewMultiUDPMuxFromPort(
			port,
			ice.UDPMuxFromPortWithNetworks(ice.NetworkTypeUDP4, ice.NetworkTypeUDP6),
		); err == nil {
			se.SetICEUDPMux(mux)
			hasUDP4, hasUDP6, listeners := summarizeMuxListeners(mux.GetListenAddresses())
			log.Printf("[rtc] using single-port UDP mux on port %d (udp4=%t udp6=%t listeners=%s)",
				port, hasUDP4, hasUDP6, strings.Join(listeners, ","))

			if !hasUDP4 || !hasUDP6 {
				log.Printf("[rtc] warning: requested dual-stack UDP mux but only udp4=%t udp6=%t listeners were created", hasUDP4, hasUDP6)
			}
		} else {
			log.Fatalf("[rtc] failed to create UDP mux on port %d: %v", port, err)
		}
	} else {
		// ---- normal ephemeral range ----
		err := se.SetEphemeralUDPPortRange(opt.ICEPortStart, opt.ICEPortEnd)
		if err != nil {
			log.Fatalf("[rtc] invalid ICE port range %d..%d: %v", opt.ICEPortStart, opt.ICEPortEnd, err)
		}
	}

	// mapper, pubIP, err := nat.Discover()
	// if err != nil {
	// 	log.Printf("[nat] discovery: %v", err)
	// } else {
	// 	log.Printf("[nat] external IP: %s", pubIP)
	// 	if len(opt.NAT1To1IPs) == 0 {
	// 		opt.NAT1To1IPs = []string{pubIP}
	// 	}
	// 	mapper.Close()
	// }

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

	api := webrtc.NewAPI(
		webrtc.WithSettingEngine(se),
	)

	var iceServers []webrtc.ICEServer
	if len(opt.STUN) > 0 {
		iceServers = append(iceServers, webrtc.ICEServer{URLs: opt.STUN})
	}

	return &Server{
		Sessions:   sessions,
		ICEServers: iceServers,
		api:        api,
	}
}

func summarizeMuxListeners(addrs []net.Addr) (hasUDP4 bool, hasUDP6 bool, listeners []string) {
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

// ---------- HTTP: /rtc/offer ----------

type offerRequest struct {
	SessionID string `json:"sessionId"` // radio handle; with or without leading 'H'
	SDP       string `json:"sdp"`       // full SDP (keep CRLFs)
}
type answerResponse struct {
	SDP string `json:"sdp"`
}

func (s *Server) OfferHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	var req offerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"bad json"}`, http.StatusBadRequest)

		return
	}

	handle := normalizeHandle(req.SessionID)
	offerSDP := req.SDP // do not TrimSpace; preserve CRLFs

	if handle == "" || offerSDP == "" || !strings.HasPrefix(offerSDP, "v=") {
		http.Error(w, `{"error":"missing/invalid sessionId or sdp"}`, http.StatusBadRequest)

		return
	}

	ans, err := s.handleOffer(handle, offerSDP, clientIPFromRequest(r))
	if err != nil {
		log.Printf("[rtc] handleOffer failed: %v", err)
		w.WriteHeader(http.StatusConflict)
		if encErr := json.NewEncoder(w).Encode(map[string]string{
			"error": rootMsg(err),
			"code":  "NO_TCP_SESSION_OR_OFFER_FAIL",
		}); encErr != nil {
			log.Printf("[rtc] failed to write error response: %v", encErr)
		}

		return
	}

	if err := json.NewEncoder(w).Encode(answerResponse{SDP: ans}); err != nil {
		log.Printf("[rtc] failed to write answer response: %v", err)
	}
}

func normalizeHandle(h string) string {
	h = strings.TrimSpace(h)
	if len(h) > 0 && (h[0] == 'H' || h[0] == 'h') {
		h = h[1:]
	}

	return strings.ToUpper(h)
}

// ---------- SDP + transport wiring ----------

func (s *Server) handleOffer(handleHex, offerSDP, clientIP string) (string, error) {
	rs := s.Sessions.Get(handleHex)
	if rs == nil || rs.TCP == nil {
		return "", stepErr("no-tcp-session", fmt.Errorf("%w: handle %s", errNoTCPSession, handleHex))
	}

	newConnection := rs.PC == nil
	if newConnection {
		pc, err := s.api.NewPeerConnection(webrtc.Configuration{ICEServers: s.ICEServers})
		if err != nil {
			return "", stepErr("new-pc", err)
		}

		rs.PC = pc
		if err := ensureRXTrack(rs); err != nil {
			return "", stepErr("add-rx-track", err)
		}

		log.Printf("[rtc] new client connection: handle=%s client_ip=%s", sanitizeLog(handleHex), sanitizeLog(clientIP)) //nolint:gosec // values are sanitized via sanitizeLog before logging

		// Capture client-created data channels.
		rs.PC.OnDataChannel(func(dc *webrtc.DataChannel) {
			switch dc.Label() {
			case "udp":
				rs.SetUDPDataChannel(dc)
				dc.OnMessage(func(msg webrtc.DataChannelMessage) {
					if msg.IsString || len(msg.Data) == 0 || rs.UDPConn == nil {
						return
					}
					if _, err := rs.UDPConn.Write(msg.Data); err != nil {
						log.Printf("[rtc] udp datachannel write failed handle=%s err=%v", handleHex, err)
					}
				})

			case "tcp":
				rs.SetTCPDataChannel(dc)
				dc.OnMessage(func(msg webrtc.DataChannelMessage) {
					if len(msg.Data) == 0 || rs.TCP == nil {
						return
					}
					if _, err := rs.TCP.Write(msg.Data); err != nil {
						log.Printf("[rtc] tcp datachannel write failed handle=%s err=%v", handleHex, err)
					}
				})
				dc.OnClose(func() {
					rs.SetTCPDataChannel(nil)
				})
			}
		})

		rs.PC.OnTrack(func(track *webrtc.TrackRemote, receiver *webrtc.RTPReceiver) {
			go s.handleIncomingTrack(handleHex, rs, track, receiver)
		})

		rs.PC.OnConnectionStateChange(func(st webrtc.PeerConnectionState) {
			log.Printf("[rtc] PeerConnection state: %s (handle %s)", st.String(), handleHex)

			if st == webrtc.PeerConnectionStateFailed || st == webrtc.PeerConnectionStateClosed {
				_ = pc.Close()
			}
		})
	}

	// Remote offer first.
	if err := rs.PC.SetRemoteDescription(webrtc.SessionDescription{
		Type: webrtc.SDPTypeOffer,
		SDP:  offerSDP,
	}); err != nil {
		return "", stepErr("set-remote", err)
	}

	gatherComplete := webrtc.GatheringCompletePromise(rs.PC)

	// Always install a sample track if the offer has audio (so answer contains an audio sender).
	// if err := s.addAudioTrackIfOffered(rs); err != nil {
	// 	log.Printf("[rtc] addAudioTrackIfOffered: %v", err)
	// }

	// Create + set local answer.
	answer, err := rs.PC.CreateAnswer(nil)
	if err != nil {
		return "", stepErr("create-answer", err)
	}

	if err := rs.PC.SetLocalDescription(answer); err != nil {
		return "", stepErr("set-local", err)
	}

	<-gatherComplete

	ld := rs.PC.LocalDescription()
	if ld == nil {
		return "", stepErr("no-local-desc", errNoLocalDesc)
	}

	// After answering, wire UDP and start demux (errors here shouldn't fail the HTTP cycle).
	if newConnection {
		go s.postAnswerPlumbing(rs)
	}

	return ld.SDP, nil
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

func (s *Server) postAnswerPlumbing(rs *core.RadioSession) {
	// UDP to radio (port = TCP+1)
	raddr, err := net.ResolveUDPAddr("udp", net.JoinHostPort(rs.Host, strconv.Itoa(rs.BasePort+1)))
	if err != nil {
		return
	}

	u, err := net.DialUDP("udp", &net.UDPAddr{IP: net.IPv4zero, Port: 0}, raddr)
	if err != nil {
		return
	}

	rs.UDPConn = u

	// Tell radio our UDP port via TCP.
	if ua, ok := u.LocalAddr().(*net.UDPAddr); ok {
		_, _ = io.WriteString(rs.TCP, fmt.Sprintf("C0|client udpport %d\n", ua.Port))
	}

	// UDP → (Opus → WebRTC) | (everything else → DataChannel)
	startUDPDemux(rs)
}

// Optional: called by TCP/WS when radio announces Opus stream creation.
//
//	S<handle>|stream 0x04000008 type=remote_audio_rx compression=OPUS ...
func (s *Server) NoteStreamCreated(handleHex string, streamID uint32, typ, compression string) {
	rs := s.Sessions.Get(strings.ToUpper(handleHex))
	if rs == nil {
		return
	}

	stream := fmt.Sprintf("0x%08X", streamID)
	log.Printf("[rtc] NoteStreamCreated handle: %s, stream %s, type: %s, compression: %s\n", handleHex, stream, typ, compression)

	if typ == "remote_audio_tx" {
		if compression != "OPUS" {
			return
		}

		rs.SetActiveTXStream(streamID)
		log.Printf("[rtc] registered inbound tx audio stream %s (handle %s)\n", stream, handleHex)

		return
	}

	if typ != "remote_audio_rx" || compression != "OPUS" {
		return
	}

	rs.SetActiveRXStream(streamID)
	log.Printf("[rtc] activated rx audio stream %s (handle %s)\n", stream, handleHex)
}

func (s *Server) NoteStreamRemoved(handleHex string, streamID uint32) {
	rs := s.Sessions.Get(strings.ToUpper(handleHex))
	if rs == nil {
		return
	}

	stream := fmt.Sprintf("0x%08X", streamID)
	rs.ClearActiveRXStream(streamID)
	rs.ClearActiveTXStream(streamID)
	log.Printf("[rtc] removed audio stream %s (handle %s)\n", stream, handleHex)
}

func ensureRXTrack(rs *core.RadioSession) error {
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
		return err
	}

	_, err = rs.PC.AddTrack(track)
	if err != nil {
		return err
	}

	rs.SetRXTrack(track)

	return nil
}

// ----- small helpers -----

type stepError struct {
	step string
	err  error
}

func (e *stepError) Error() string         { return fmt.Sprintf("%s: %v", e.step, e.err) }
func stepErr(step string, err error) error { return &stepError{step: step, err: err} }

func rootMsg(err error) string {
	var se *stepError
	if errors.As(err, &se) {
		return se.err.Error()
	}

	return err.Error()
}

func sanitizeLog(s string) string {
	return strings.Map(func(r rune) rune {
		if r == '\n' || r == '\r' || r == '\t' {
			return ' '
		}
		if r < 0x20 {
			return -1
		}
		return r
	}, s)
}
