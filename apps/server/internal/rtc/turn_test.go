package rtc

import (
	"testing"
	"time"
)

func TestNewTURNCredentials_KnownVector(t *testing.T) {
	t.Parallel()

	// Reference values from Python:
	// base64(hmac.new(b"test-secret", b"1767412800:solid-sdr", hashlib.sha1).digest())
	now := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)

	got := newTURNCredentials("test-secret", 52*time.Hour, now)

	if got.Username != "1767412800:solid-sdr" {
		t.Errorf("Username: got %q", got.Username)
	}

	if got.Password != "gcW+2ytE+WXBro3GgIZUljM0mZg=" {
		t.Errorf("Password: got %q", got.Password)
	}
}
