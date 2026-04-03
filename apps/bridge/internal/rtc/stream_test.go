package rtc

import "testing"

func TestParseAudioStream_RX(t *testing.T) {
	line := "S591502EF|stream 0x04000008 type=remote_audio_rx compression=OPUS client_handle=0x591502EF"

	s, ok := parseAudioStream(line)
	if !ok {
		t.Fatal("expected ok=true")
	}

	if s.StreamID != 0x04000008 {
		t.Errorf("StreamID: got 0x%08X want 0x04000008", s.StreamID)
	}

	if s.Type != "remote_audio_rx" {
		t.Errorf("Type: got %q", s.Type)
	}

	if s.Compression != "OPUS" {
		t.Errorf("Compression: got %q", s.Compression)
	}

	if s.ClientHandle != 0x591502EF {
		t.Errorf("ClientHandle: got 0x%08X", s.ClientHandle)
	}

	if s.Removed {
		t.Error("Removed should be false")
	}
}

func TestParseAudioStream_Removed(t *testing.T) {
	line := "S591502EF|stream 0x04000008 removed"

	s, ok := parseAudioStream(line)
	if !ok {
		t.Fatal("expected ok=true")
	}

	if s.StreamID != 0x04000008 {
		t.Errorf("StreamID: got 0x%08X", s.StreamID)
	}

	if !s.Removed {
		t.Error("Removed should be true")
	}
}

func TestParseAudioStream_NoMatch(t *testing.T) {
	_, ok := parseAudioStream("some random line with no stream")
	if ok {
		t.Error("expected ok=false for non-stream line")
	}
}

func TestParseAudioStream_TX(t *testing.T) {
	line := "S591502EF|stream 0x08000001 type=remote_audio_tx compression=OPUS client_handle=0x591502EF"

	s, ok := parseAudioStream(line)
	if !ok {
		t.Fatal("expected ok=true")
	}

	if s.Type != "remote_audio_tx" {
		t.Errorf("Type: got %q", s.Type)
	}
}
