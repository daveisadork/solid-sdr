package rtc

import (
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"github.com/pion/webrtc/v4"
)

func TestSendICE_HoldsCandidatesUntilRelease(t *testing.T) {
	t.Parallel()

	cs := newClientSession(nil, nil, func() {}, "test")
	cs.holdICE = true

	cs.sendICE(message{Type: typeICE})
	cs.trySend(message{Type: typeAnswer})
	cs.releaseICE()
	cs.sendICE(message{Type: typeICE})

	for i, want := range []string{typeAnswer, typeICE, typeICE} {
		select {
		case msg := <-cs.send:
			if msg.Type != want {
				t.Fatalf("message %d: got %q, want %q", i, msg.Type, want)
			}
		default:
			t.Fatalf("message %d: missing, want %q", i, want)
		}
	}
}

// The server must send the answer before its ICE candidates.
// The rewrite rule makes all host candidates come at the same time, as in a NAT setup.
func TestHandleOffer_SendsAnswerBeforeCandidates(t *testing.T) {
	t.Parallel()

	ts := httptest.NewServer(New(nil, Options{
		ICEPortStart: 50500,
		ICEPortEnd:   50599,
		NAT1To1IPs:   []string{"192.0.2.10"},
	}))
	t.Cleanup(ts.Close)

	ws, resp, err := websocket.DefaultDialer.Dial("ws"+strings.TrimPrefix(ts.URL, "http"), nil)
	if err != nil {
		t.Fatal(err)
	}

	_ = resp.Body.Close()

	t.Cleanup(func() { _ = ws.Close() })

	pc, err := webrtc.NewPeerConnection(webrtc.Configuration{})
	if err != nil {
		t.Fatal(err)
	}

	t.Cleanup(func() { _ = pc.Close() })

	_, err = pc.AddTransceiverFromKind(webrtc.RTPCodecTypeAudio)
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

	err = ws.WriteJSON(mustEncode(typeOffer, offer))
	if err != nil {
		t.Fatal(err)
	}

	_ = ws.SetReadDeadline(time.Now().Add(2 * time.Second))
	gotAnswer := false

	for {
		var msg message

		err = ws.ReadJSON(&msg)
		if err != nil {
			t.Fatal(err)
		}

		switch msg.Type {
		case typeAnswer:
			gotAnswer = true
		case typeICE:
			if !gotAnswer {
				t.Fatal("got an ICE candidate before the answer")
			}

			return
		}
	}
}
