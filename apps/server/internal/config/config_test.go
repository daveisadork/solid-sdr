package config

import (
	"errors"
	"testing"
	"time"
)

const testTURNURL = "turn:a.example.com"

func validConfig() Config {
	return Config{
		ICEPortStart:       50313,
		ICEPortEnd:         50313,
		ClientSTUN:         DefaultClientSTUN,
		TURNTTL:            52 * time.Hour,
		ICETransportPolicy: "all",
	}
}

func TestValidate_Errors(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name   string
		modify func(*Config)
		want   error
	}{
		{"port range", func(c *Config) { c.ICEPortEnd = c.ICEPortStart - 1 }, errInvalidICEPortRange},
		{"turn scheme in client-stun", func(c *Config) { c.ClientSTUN = []string{testTURNURL} }, errInvalidURL},
		{"bad scheme in client-stun", func(c *Config) { c.ClientSTUN = []string{"a.example.com:3478"} }, errInvalidURL},
		{"stun scheme in turn-urls", func(c *Config) {
			c.TURNURLs = []string{"stun:a.example.com"}
			c.TURNSecret = "s"
		}, errInvalidURL},
		{"turn-urls without secret", func(c *Config) { c.TURNURLs = []string{testTURNURL} }, errMissingTURNSecret},
		{"zero ttl", func(c *Config) { c.TURNTTL = 0 }, errInvalidTURNTTL},
		{"negative ttl", func(c *Config) { c.TURNTTL = -time.Minute }, errInvalidTURNTTL},
		{"unknown policy", func(c *Config) { c.ICETransportPolicy = "none" }, errInvalidPolicy},
		{"empty policy", func(c *Config) { c.ICETransportPolicy = "" }, errInvalidPolicy},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			cfg := validConfig()
			tt.modify(&cfg)

			_, err := validate(cfg)
			if !errors.Is(err, tt.want) {
				t.Errorf("got %v, want %v", err, tt.want)
			}
		})
	}
}

func TestValidate_Valid(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name         string
		modify       func(*Config)
		wantWarnings int
	}{
		{"defaults", func(*Config) {}, 0},
		{"no client stun", func(c *Config) { c.ClientSTUN = nil }, 0},
		{"stuns scheme", func(c *Config) { c.ClientSTUN = []string{"stuns:a.example.com:5349"} }, 0},
		{"turn and turns", func(c *Config) {
			c.TURNURLs = []string{"turn:a.example.com:3478?transport=udp", "turns:a.example.com:443?transport=tcp"}
			c.TURNSecret = "s"
		}, 0},
		{"relay with turn", func(c *Config) {
			c.TURNURLs = []string{testTURNURL}
			c.TURNSecret = "s"
			c.ICETransportPolicy = "relay"
		}, 0},
		{"secret without turn-urls", func(c *Config) { c.TURNSecret = "s" }, 1},
		{"relay without turn", func(c *Config) { c.ICETransportPolicy = "relay" }, 1},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			cfg := validConfig()
			tt.modify(&cfg)

			warnings, err := validate(cfg)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if len(warnings) != tt.wantWarnings {
				t.Errorf("got %d warnings %q, want %d", len(warnings), warnings, tt.wantWarnings)
			}
		})
	}
}
