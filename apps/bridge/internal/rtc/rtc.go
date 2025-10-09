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
	"github.com/pion/interceptor"
	"github.com/pion/webrtc/v4"
)

type Server struct {
	Sessions   *core.SessionManager
	ICEServers []webrtc.ICEServer
	api        *webrtc.API
}

func New(sessions *core.SessionManager, iceServers []webrtc.ICEServer) *Server {
	m := &webrtc.MediaEngine{}
	if err := m.RegisterDefaultCodecs(); err != nil {
		panic(err)
	}
	ir := &interceptor.Registry{}
	if err := webrtc.RegisterDefaultInterceptors(m, ir); err != nil {
		panic(err)
	}

	var se webrtc.SettingEngine

	_ = se.SetEphemeralUDPPortRange(50313, 50323)

	// If you have 1:1 port forwarding on a public IP, advertise it as HOST candidates:
	// se.SetNAT1To1IPs([]string{"203.0.113.10"}, webrtc.ICECandidateTypeHost)

	api := webrtc.NewAPI(
		webrtc.WithMediaEngine(m),
		webrtc.WithInterceptorRegistry(ir),
		webrtc.WithSettingEngine(se),
	)

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

	pc, err := s.api.NewPeerConnection(webrtc.Configuration{ICEServers: s.ICEServers})
	if err != nil {
		return "", stepErr("new-pc", err)
	}
	rs.PC = pc

	// Capture client-created datachannel "udp".
	pc.OnDataChannel(func(dc *webrtc.DataChannel) {
		if dc.Label() != "udp" {
			return
		}
		rs.DC = dc
	})

	pc.OnConnectionStateChange(func(st webrtc.PeerConnectionState) {
		log.Printf("[rtc] PeerConnection state: %s (handle %s)", st.String(), handleHex)
		if st == webrtc.PeerConnectionStateFailed || st == webrtc.PeerConnectionStateClosed {
			_ = pc.Close()
		}
	})

	// Remote offer first.
	if err := pc.SetRemoteDescription(webrtc.SessionDescription{
		Type: webrtc.SDPTypeOffer,
		SDP:  offerSDP,
	}); err != nil {
		return "", stepErr("set-remote", err)
	}

	// Always install a sample track if the offer has audio (so answer contains an audio sender).
	if err := s.addAudioTrackIfOffered(rs); err != nil {
		log.Printf("[rtc] addAudioTrackIfOffered: %v", err)
	}

	// Create + set local answer.
	answer, err := pc.CreateAnswer(nil)
	if err != nil {
		return "", stepErr("create-answer", err)
	}
	g := webrtc.GatheringCompletePromise(pc)
	if err := pc.SetLocalDescription(answer); err != nil {
		return "", stepErr("set-local", err)
	}
	<-g

	ld := pc.LocalDescription()
	if ld == nil {
		return "", stepErr("no-local-desc", errors.New("no local description"))
	}

	// After answering, wire UDP and start demux (errors here shouldn't fail the HTTP cycle).
	go s.postAnswerPlumbing(rs)

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

// If the browser offered audio, add a TrackLocalStaticSample(Opus) before CreateAnswer.
func (s *Server) addAudioTrackIfOffered(rs *core.RadioSession) error {
	if rs.PC == nil || rs.AudioSample != nil {
		return nil
	}
	hasAudio := false
	for _, t := range rs.PC.GetTransceivers() {
		if t.Kind() == webrtc.RTPCodecTypeAudio {
			hasAudio = true
			break
		}
	}
	if !hasAudio {
		return nil
	}

	tr, err := webrtc.NewTrackLocalStaticSample(
		webrtc.RTPCodecCapability{
			MimeType:  webrtc.MimeTypeOpus,
			ClockRate: 48000,
			Channels:  2,
		},
		"radio-audio",
		"radio",
	)
	if err != nil {
		return err
	}
	if _, err := rs.PC.AddTrack(tr); err != nil {
		return err
	}
	rs.AudioSample = tr
	return nil
}

// Optional: called by TCP/WS when radio announces Opus stream creation.
//
//	S<handle>|stream 0x04000008 type=remote_audio_rx compression=OPUS ...
func (s *Server) NoteStreamCreated(handleHex string, streamID uint32, typ, compression string) {
	rs := s.Sessions.Get(strings.ToUpper(handleHex))
	if rs == nil {
		return
	}
	if !strings.EqualFold(typ, "remote_audio_rx") || !strings.EqualFold(compression, "OPUS") {
		return
	}
	rs.AudioStreamID = streamID
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
