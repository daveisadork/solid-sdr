package rtc

import (
	"encoding/json"
	"net"
	"net/http/httptest"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"github.com/pion/turn/v5"
	"github.com/pion/webrtc/v4"
)

const (
	relayTestSecret  = "relay-test-secret" //nolint:gosec // test-only secret for a local TURN server
	relayTestTimeout = 15 * time.Second
)

// Start a TURN server on the loopback interface. It accepts TURN REST API credentials.
// It returns one TURN URL for UDP and one for TCP.
func startTURNServer(t *testing.T) (udpURL, tcpURL string) {
	t.Helper()

	var lc net.ListenConfig

	udpConn, err := lc.ListenPacket(t.Context(), "udp4", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}

	tcpListener, err := lc.Listen(t.Context(), "tcp4", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}

	relay := &turn.RelayAddressGeneratorStatic{RelayAddress: net.ParseIP("127.0.0.1"), Address: "0.0.0.0"}

	server, err := turn.NewServer(turn.ServerConfig{
		Realm:             "solid-sdr.test",
		AuthHandler:       turn.LongTermTURNRESTAuthHandler(relayTestSecret, nil),
		PacketConnConfigs: []turn.PacketConnConfig{{PacketConn: udpConn, RelayAddressGenerator: relay}},
		ListenerConfigs:   []turn.ListenerConfig{{Listener: tcpListener, RelayAddressGenerator: relay}},
	})
	if err != nil {
		t.Fatal(err)
	}

	t.Cleanup(func() { _ = server.Close() })

	udpPort := strconv.Itoa(udpConn.LocalAddr().(*net.UDPAddr).Port) //nolint:forcetypeassert // udp4 listener
	tcpPort := strconv.Itoa(tcpListener.Addr().(*net.TCPAddr).Port)  //nolint:forcetypeassert // tcp4 listener

	return "turn:127.0.0.1:" + udpPort + "?transport=udp", "turn:127.0.0.1:" + tcpPort + "?transport=tcp"
}

// Start a solid-sdr signaling server and connect to it.
func connectSignaling(t *testing.T, opt Options) *websocket.Conn {
	t.Helper()

	opt.ICEPortStart = 50500
	opt.ICEPortEnd = 50599
	opt.ClientSTUN = nil

	ts := httptest.NewServer(New(nil, opt))
	t.Cleanup(ts.Close)

	ws, resp, err := websocket.DefaultDialer.Dial("ws"+strings.TrimPrefix(ts.URL, "http"), nil)
	if err != nil {
		t.Fatal(err)
	}

	_ = resp.Body.Close()

	t.Cleanup(func() { _ = ws.Close() })

	return ws
}

func readConfig(t *testing.T, ws *websocket.Conn) webrtc.Configuration {
	t.Helper()

	msg := readMessage(t, ws)
	if msg.Type != typeConfig {
		t.Fatalf("first message: got %q, want %q", msg.Type, typeConfig)
	}

	var payload configPayload

	err := json.Unmarshal(msg.Payload, &payload)
	if err != nil {
		t.Fatal(err)
	}

	cfg := webrtc.Configuration{ICETransportPolicy: webrtc.NewICETransportPolicy(payload.ICETransportPolicy)}
	for _, s := range payload.ICEServers {
		cfg.ICEServers = append(cfg.ICEServers, webrtc.ICEServer{
			URLs:       s.URLs,
			Username:   s.Username,
			Credential: s.Credential,
		})
	}

	return cfg
}

// Act as a browser that can only use TURN. Use the configuration from the server.
// Pass when the PeerConnection connects and the selected pair is a relay pair.
func runRelayClient(t *testing.T, turnURL string) {
	t.Helper()

	ws := connectSignaling(t, Options{
		TURNURLs:           []string{turnURL},
		TURNSecret:         relayTestSecret,
		TURNTTL:            time.Hour,
		ICETransportPolicy: "relay",
	})

	cfg := readConfig(t, ws)
	if cfg.ICETransportPolicy != webrtc.ICETransportPolicyRelay {
		t.Fatalf("policy: got %s, want relay", cfg.ICETransportPolicy)
	}

	pc, err := webrtc.NewPeerConnection(cfg)
	if err != nil {
		t.Fatal(err)
	}

	t.Cleanup(func() { _ = pc.Close() })

	connected := make(chan struct{})

	pc.OnConnectionStateChange(func(s webrtc.PeerConnectionState) {
		if s == webrtc.PeerConnectionStateConnected {
			close(connected)
		}
	})

	// The WebSocket allows only one writer at a time.
	var sendMu sync.Mutex

	send := func(msgType string, payload any) {
		sendMu.Lock()
		defer sendMu.Unlock()

		_ = ws.WriteJSON(mustEncode(msgType, payload))
	}

	pc.OnICECandidate(func(c *webrtc.ICECandidate) {
		if c != nil {
			send(typeICE, c.ToJSON())
		}
	})

	_, err = pc.CreateDataChannel("relay-test", nil)
	if err != nil {
		t.Fatal(err)
	}

	offer, err := pc.CreateOffer(nil)
	if err != nil {
		t.Fatal(err)
	}

	err = pc.SetLocalDescription(offer)
	if err != nil {
		t.Fatal(err)
	}

	send(typeOffer, offer)

	go readSignaling(t, ws, pc)

	select {
	case <-connected:
	case <-time.After(relayTestTimeout):
		t.Fatalf("no connection within %s (state %s)", relayTestTimeout, pc.ConnectionState())
	}

	pair, err := pc.SCTP().Transport().ICETransport().GetSelectedCandidatePair()
	if err != nil || pair == nil {
		t.Fatalf("no selected candidate pair: %v", err)
	}

	if pair.Local.Typ != webrtc.ICECandidateTypeRelay {
		t.Errorf("local candidate: got %s, want relay", pair.Local.Typ)
	}
}

func readSignaling(t *testing.T, ws *websocket.Conn, pc *webrtc.PeerConnection) {
	t.Helper()

	// Remove the read deadline from readMessage. Signaling stays open for the whole test.
	_ = ws.SetReadDeadline(time.Time{})

	for {
		var msg message

		err := ws.ReadJSON(&msg)
		if err != nil {
			return
		}

		switch msg.Type {
		case typeAnswer:
			var answer webrtc.SessionDescription
			if json.Unmarshal(msg.Payload, &answer) == nil {
				_ = pc.SetRemoteDescription(answer)
			}
		case typeICE:
			var c webrtc.ICECandidateInit
			if json.Unmarshal(msg.Payload, &c) == nil {
				_ = pc.AddICECandidate(c)
			}
		}
	}
}

func TestRelay_TURNOverUDP(t *testing.T) {
	t.Parallel()

	udpURL, _ := startTURNServer(t)
	runRelayClient(t, udpURL)
}

func TestRelay_TURNOverTCP(t *testing.T) {
	t.Parallel()

	_, tcpURL := startTURNServer(t)
	runRelayClient(t, tcpURL)
}

func TestRelay_WrongSecretGetsNoRelayCandidate(t *testing.T) {
	t.Parallel()

	udpURL, _ := startTURNServer(t)

	creds := newTURNCredentials("wrong-secret", time.Hour, time.Now())

	server := webrtc.ICEServer{URLs: []string{udpURL}, Username: creds.Username, Credential: creds.Password}

	pc, err := webrtc.NewPeerConnection(webrtc.Configuration{
		ICEServers:         []webrtc.ICEServer{server},
		ICETransportPolicy: webrtc.ICETransportPolicyRelay,
	})
	if err != nil {
		t.Fatal(err)
	}

	t.Cleanup(func() { _ = pc.Close() })

	_, err = pc.CreateDataChannel("relay-test", nil)
	if err != nil {
		t.Fatal(err)
	}

	offer, err := pc.CreateOffer(nil)
	if err != nil {
		t.Fatal(err)
	}

	gathered := webrtc.GatheringCompletePromise(pc)

	err = pc.SetLocalDescription(offer)
	if err != nil {
		t.Fatal(err)
	}

	select {
	case <-gathered:
	case <-time.After(relayTestTimeout):
		t.Fatal("ICE gathering did not complete")
	}

	if strings.Contains(pc.LocalDescription().SDP, "typ relay") {
		t.Error("got a relay candidate with a wrong secret")
	}
}
