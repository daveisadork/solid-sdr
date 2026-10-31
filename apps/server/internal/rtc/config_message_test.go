package rtc

import (
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

const (
	testSTUNURL = "stun:stun.example.com:3478"
	readTimeout = 2 * time.Second
)

func testServer(turn bool) *Server {
	s := &Server{
		version:            "test",
		clientSTUN:         []string{testSTUNURL},
		turnTTL:            time.Hour,
		iceTransportPolicy: "all",
	}
	if turn {
		s.turnURLs = []string{"turn:turn.example.com:3478", "turns:turn.example.com:443?transport=tcp"}
		s.turnSecret = "test-secret"
	}

	return s
}

func marshalConfig(t *testing.T, cfg configPayload) string {
	t.Helper()

	data, err := json.Marshal(cfg)
	if err != nil {
		t.Fatal(err)
	}

	return string(data)
}

func TestClientConfig_Defaults(t *testing.T) {
	t.Parallel()

	got := marshalConfig(t, testServer(false).clientConfig(time.Unix(0, 0)))

	want := `{"iceServers":[{"urls":["stun:stun.example.com:3478"]}],"iceTransportPolicy":"all"}`
	if got != want {
		t.Errorf("got  %s\nwant %s", got, want)
	}
}

func TestClientConfig_WithTURN(t *testing.T) {
	t.Parallel()

	s := testServer(true)
	s.iceTransportPolicy = "relay"
	now := time.Unix(1000, 0)

	cfg := s.clientConfig(now)
	creds := newTURNCredentials("test-secret", time.Hour, now)

	want := `{"iceServers":[{"urls":["stun:stun.example.com:3478"]},` +
		`{"urls":["turn:turn.example.com:3478","turns:turn.example.com:443?transport=tcp"],` +
		`"username":"` + creds.Username + `","credential":"` + creds.Password + `"}],` +
		`"iceTransportPolicy":"relay"}`

	got := marshalConfig(t, cfg)
	if got != want {
		t.Errorf("got  %s\nwant %s", got, want)
	}
}

func TestClientConfig_Empty(t *testing.T) {
	t.Parallel()

	s := testServer(false)
	s.clientSTUN = nil

	got := marshalConfig(t, s.clientConfig(time.Unix(0, 0)))

	want := `{"iceServers":[],"iceTransportPolicy":"all"}`
	if got != want {
		t.Errorf("got  %s\nwant %s", got, want)
	}
}

func TestClientConfig_SecretWithoutURLs(t *testing.T) {
	t.Parallel()

	s := testServer(false)
	s.turnSecret = "test-secret"

	cfg := s.clientConfig(time.Unix(0, 0))
	if len(cfg.ICEServers) != 1 {
		t.Errorf("expected only the STUN entry, got %+v", cfg.ICEServers)
	}
}

func dialTestServer(t *testing.T, s *Server) *websocket.Conn {
	t.Helper()

	ts := httptest.NewServer(s)
	t.Cleanup(ts.Close)

	url := "ws" + strings.TrimPrefix(ts.URL, "http")

	ws, resp, err := websocket.DefaultDialer.Dial(url, nil)
	if err != nil {
		t.Fatal(err)
	}

	_ = resp.Body.Close()

	t.Cleanup(func() { _ = ws.Close() })

	return ws
}

func readMessage(t *testing.T, ws *websocket.Conn) message {
	t.Helper()

	_ = ws.SetReadDeadline(time.Now().Add(readTimeout))

	var msg message

	err := ws.ReadJSON(&msg)
	if err != nil {
		t.Fatal(err)
	}

	return msg
}

func TestServeHTTP_SendsConfigBeforeVersion(t *testing.T) {
	t.Parallel()

	ws := dialTestServer(t, testServer(false))

	first := readMessage(t, ws)
	if first.Type != typeConfig {
		t.Fatalf("first message: got %q, want %q", first.Type, typeConfig)
	}

	var cfg configPayload

	err := json.Unmarshal(first.Payload, &cfg)
	if err != nil {
		t.Fatal(err)
	}

	if len(cfg.ICEServers) != 1 || cfg.ICEServers[0].URLs[0] != testSTUNURL {
		t.Errorf("unexpected config payload: %s", first.Payload)
	}

	second := readMessage(t, ws)
	if second.Type != typeVersion {
		t.Fatalf("second message: got %q, want %q", second.Type, typeVersion)
	}
}
