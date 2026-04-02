package signaling

import "encoding/json"

// Message type constants — used as the "type" discriminator on the wire.
const (
	TypeDiscovery = "discovery" // bridge→client: raw discovery UDP packet
	TypeOffer     = "offer"     // client→bridge: SDP offer
	TypeAnswer    = "answer"    // bridge→client: SDP answer
	TypeICE       = "ice"       // both directions: trickle ICE candidate
	TypeStats     = "stats"     // bridge→client: network health metrics
	TypeError     = "error"     // bridge→client: signaling error
)

// Message is the wire envelope for all /ws/signal messages.
type Message struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload,omitempty"`
}

// DiscoveryPayload carries a raw discovery UDP packet.
// encoding/json base64-encodes the []byte automatically.
type DiscoveryPayload struct {
	Packet []byte `json:"packet"`
}

// OfferPayload is sent client→bridge to initiate a WebRTC connection to a radio.
type OfferPayload struct {
	Host string `json:"host"`
	Port int    `json:"port"`
	SDP  string `json:"sdp"`
}

// AnswerPayload is sent bridge→client in response to an offer.
// Version and Handle are the first two lines of the radio TCP handshake,
// delivered here so the client has them before the "tcp" data channel opens.
type AnswerPayload struct {
	SessionID string `json:"sessionId"` // handle hex, e.g. "591502EF"
	SDP       string `json:"sdp"`
	Version   string `json:"version"` // e.g. "V1.4.0.0"
	Handle    string `json:"handle"`  // e.g. "H591502EF"
}

// ICECandidateInit mirrors RTCIceCandidateInit from the browser WebRTC API.
type ICECandidateInit struct {
	Candidate        string  `json:"candidate"`
	SDPMid           *string `json:"sdpMid"`
	SDPMLineIndex    *uint16 `json:"sdpMLineIndex"`
	UsernameFragment *string `json:"usernameFragment"`
}

// ICEPayload carries a trickle ICE candidate in either direction.
// Candidate is nil to signal end-of-candidates (gathering complete).
type ICEPayload struct {
	SessionID string            `json:"sessionId"`
	Candidate *ICECandidateInit `json:"candidate"`
}

// StatsPayload carries per-session network health metrics from the bridge.
// Fields are populated incrementally as more tracking is wired up.
type StatsPayload struct {
	SessionID        string  `json:"sessionId"`
	RadioRTTMs       int64   `json:"radioRttMs"`
	OpusRXLossPct    float64 `json:"opusRxLossPct"`
	MeterLossPct     float64 `json:"meterLossPct"`
	FFTLossPct       float64 `json:"fftLossPct"`
	WaterfallLossPct float64 `json:"waterfallLossPct"`
}

// ErrorPayload describes a signaling error from the bridge.
type ErrorPayload struct {
	Code      string `json:"code"`
	Message   string `json:"message"`
	SessionID string `json:"sessionId,omitempty"`
}

// encode marshals a typed payload into a Message envelope.
func encode(msgType string, payload any) (Message, error) {
	data, err := json.Marshal(payload)
	if err != nil {
		return Message{}, err
	}

	return Message{Type: msgType, Payload: data}, nil
}
