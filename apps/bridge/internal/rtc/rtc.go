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
	"github.com/daveisadork/flex-bridge/internal/nat"
	"github.com/pion/ice/v4"
	"github.com/pion/webrtc/v4"
)

// Options configures the RTC server.
type Options struct {
	// ICE port
	ICEPortStart int
	ICEPortEnd   int

	// STUN servers (full URLs like stun:stun.l.google.com:19302).
	STUN []string

	// Optional public IPs to advertise for host candidates (static NAT).
	NAT1To1IPs []string
}

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
		port := opt.ICEPortStart
		if mux, err := ice.NewMultiUDPMuxFromPort(port); err == nil {
			se.SetICEUDPMux(mux)
			log.Printf("[rtc] using UDP mux on all interfaces, port %d\n", port)
		} else {
			log.Fatalf("[rtc] failed to create UDP mux on port %d: %v", port, err)
		}
	} else {
		// ---- normal ephemeral range ----
		if err := se.SetEphemeralUDPPortRange(uint16(opt.ICEPortStart), uint16(opt.ICEPortEnd)); err != nil {
			log.Fatalf("[rtc] invalid ICE port range %d..%d: %v", opt.ICEPortStart, opt.ICEPortEnd, err)
		}
	}

	mapper, pubIP, err := nat.Discover()
	if err != nil {
		log.Printf("[nat] discovery: %v", err)
	} else {
		log.Printf("[nat] external IP: %s", pubIP)
		if len(opt.NAT1To1IPs) == 0 {
			opt.NAT1To1IPs = []string{pubIP}
		}
		mapper.Close()
	}

	if len(opt.NAT1To1IPs) > 0 {
		se.SetNAT1To1IPs(opt.NAT1To1IPs, webrtc.ICECandidateTypeHost)
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

	ans, err := s.handleOffer(handle, offerSDP)
	if err != nil {
		log.Printf("[rtc] handleOffer failed: %v", err)
		w.WriteHeader(http.StatusConflict)
		_ = json.NewEncoder(w).Encode(map[string]string{
			"error": rootMsg(err),
			"code":  "NO_TCP_SESSION_OR_OFFER_FAIL",
		})
		return
	}
	_ = json.NewEncoder(w).Encode(answerResponse{SDP: ans})
}

func normalizeHandle(h string) string {
	h = strings.TrimSpace(h)
	if len(h) > 0 && (h[0] == 'H' || h[0] == 'h') {
		h = h[1:]
	}
	return strings.ToUpper(h)
}

// ---------- SDP + transport wiring ----------

func (s *Server) handleOffer(handleHex, offerSDP string) (string, error) {
	rs := s.Sessions.Get(handleHex)
	if rs == nil || rs.TCP == nil {
		return "", stepErr("no-tcp-session", fmt.Errorf("no TCP session for handle %s", handleHex))
	}

	newConnection := rs.PC == nil
	if newConnection {
		pc, err := s.api.NewPeerConnection(webrtc.Configuration{ICEServers: s.ICEServers})
		if err != nil {
			return "", stepErr("new-pc", err)
		}
		rs.PC = pc

		// Capture client-created datachannel "udp".
		rs.PC.OnDataChannel(func(dc *webrtc.DataChannel) {
			if dc.Label() != "udp" {
				return
			}
			rs.DC = dc
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
		return "", stepErr("no-local-desc", errors.New("no local description"))
	}

	// After answering, wire UDP and start demux (errors here shouldn't fail the HTTP cycle).
	if newConnection {
		go s.postAnswerPlumbing(rs)
	}

	return ld.SDP, nil
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
	if _, ok := rs.AudioStreams[streamID]; ok {
		return
	}
	stream := fmt.Sprintf("0x%08X", streamID)
	log.Printf("[rtc] NoteStreamCreated handle: %s, stream %s, type: %s, compression: %s\n", handleHex, stream, typ, compression)
	if compression != "OPUS" {
		return
	}
	tr, err := webrtc.NewTrackLocalStaticSample(
		webrtc.RTPCodecCapability{
			MimeType:  webrtc.MimeTypeOpus,
			ClockRate: 48000,
			Channels:  2,
		},
		typ,
		stream,
	)
	if err != nil {
		return
	}
	if rs.PC == nil {
		return
	}
	if _, err := rs.PC.AddTrack(tr); err != nil {
		return
	}
	rs.AudioStreams[streamID] = tr
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
