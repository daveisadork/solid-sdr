package config

import (
	"errors"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/spf13/pflag"
	"github.com/spf13/viper"
)

var (
	errInvalidICEPortRange = errors.New("invalid ICE port range")
	errInvalidURL          = errors.New("invalid ICE server URL")
	errMissingTURNSecret   = errors.New("turn-urls is set but turn-secret is empty")
	errInvalidTURNTTL      = errors.New("turn-ttl must be greater than zero")
	errInvalidPolicy       = errors.New("ice-transport-policy must be all or relay")
)

// DefaultClientSTUN is the STUN list that web clients used before the server sent it.
//
//nolint:gochecknoglobals // read-only default list
var DefaultClientSTUN = []string{
	"stun:stun.l.google.com:19302",
	"stun:stun1.l.google.com:19302",
	"stun:stun2.l.google.com:19302",
	"stun:stun.cloudflare.com:3478",
}

type Config struct {
	// HTTP
	HTTPPort      int    `mapstructure:"http-port"`
	StaticDir     string `mapstructure:"static-dir"`
	EnableCOI     bool   `mapstructure:"enable-coi"`
	EnableCORS    bool   `mapstructure:"enable-cors"`
	DiscoveryPort int    `mapstructure:"discovery-port"`

	// WebRTC / ICE
	ICEPortStart uint16   `mapstructure:"ice-port-start"`
	ICEPortEnd   uint16   `mapstructure:"ice-port-end"`
	StunURLs     []string `mapstructure:"stun"`
	NAT1To1IPs   []string `mapstructure:"nat-1to1-ips"`

	// ICE servers for web clients
	ClientSTUN         []string      `mapstructure:"client-stun"`
	TURNURLs           []string      `mapstructure:"turn-urls"`
	TURNSecret         string        `mapstructure:"turn-secret"`
	TURNTTL            time.Duration `mapstructure:"turn-ttl"`
	ICETransportPolicy string        `mapstructure:"ice-transport-policy"`

	// Diagnostics
	APILogFile string `mapstructure:"api-log-file"`

	// Server defaults
	DefaultsFile string `mapstructure:"defaults-file"`

	// Config file path (optional)
	ConfigFile string `mapstructure:"-"`
}

func defaultAPILogPath() string {
	_, err := os.Stat(filepath.Join("apps", "server"))
	if err == nil {
		return filepath.Join("apps", "server", "messages.txt")
	}

	return "messages.txt"
}

func Load() (Config, error) {
	var cfg Config

	fs := pflag.NewFlagSet(os.Args[0], pflag.ContinueOnError)
	fs.SetOutput(os.Stderr)
	fs.SortFlags = true

	// Flags (with sensible defaults)
	fs.IntP("http-port", "p", 8080, "HTTP port to listen on")
	fs.String("static-dir", "", "Path to serve built UI (optional)")
	fs.Bool("enable-coi", true, "Enable Cross-Origin-Isolation headers (COOP/COEP)")
	fs.Bool("enable-cors", true, "Enable permissive CORS headers")
	fs.Int("discovery-port", 4992, "UDP discovery port")

	fs.Int("ice-port-start", 50313, "Lowest UDP port for ICE (inclusive)")
	fs.Int("ice-port-end", 50313, "Highest UDP port for ICE (inclusive); set equal to start for single-port UDP mux")
	fs.StringSlice("stun", []string{
		"stun:stun.l.google.com:19302",
		"stun:stun.cloudflare.com:3478",
	}, "Comma-separated STUN URLs")
	fs.StringSlice("nat-1to1-ips", nil, "Optional public IPs for NAT 1:1 mapping (e.g. 203.0.113.2,2001:db8::2)")
	fs.StringSlice("client-stun", DefaultClientSTUN, "Comma-separated STUN URLs sent to web clients")
	fs.StringSlice("turn-urls", nil, "Comma-separated TURN URLs sent to web clients (requires turn-secret)")
	fs.String("turn-secret", "", "Shared secret of the TURN server (TURN REST API, coturn static-auth-secret)")
	fs.Duration("turn-ttl", 52*time.Hour, "Lifetime of generated TURN credentials")
	fs.String("ice-transport-policy", "all", "ICE transport policy for web clients: all or relay")
	fs.String("api-log-file", defaultAPILogPath(), "Path to write raw TCP API messages (set empty to disable)")
	fs.String("defaults-file", "", "Path to JSON file served as server defaults (optional)")
	fs.String("config", "", "Path to optional config file")

	// Usage
	usage := func() {
		fmt.Fprintf(os.Stderr, `solid-sdr-server

Usage:
  %s [flags]

Flags:
  -V, --version         Print version and exit
`, os.Args[0])
		fs.PrintDefaults()
		fmt.Fprintf(os.Stderr, `
Environment:
  Prefix: FLEX_
  Examples:
    FLEX_HTTP_PORT=8081 FLEX_STATIC_DIR=./dist
    FLEX_STUN="stun:stun1.example.com,stun:stun2.example.com"
    FLEX_TURN_URLS="turn:turn.example.com:3478,turns:turn.example.com:443?transport=tcp"

Config file:
  Set FLEX_CONFIG=/path/to/file.(yaml|json|toml)
  Or place solid-sdr-server.yaml/json/toml in current directory
`)
	}
	fs.Usage = usage

	pflag.CommandLine.AddFlagSet(fs)
	pflag.CommandLine.Usage = usage
	pflag.Usage = usage

	pflag.Parse()

	// Viper setup
	v := viper.New()
	v.SetEnvPrefix("FLEX")
	v.AutomaticEnv()
	// allow FLEX_HTTP_PORT to map to "http_port"
	v.SetEnvKeyReplacer(strings.NewReplacer("-", "_"))
	// Viper takes over
	err := v.BindPFlags(pflag.CommandLine)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n\n", err)
		fs.Usage()
		os.Exit(2)
	}

	// Config file
	cfgFile := v.GetString("config")
	if envFile := os.Getenv("FLEX_CONFIG"); envFile != "" {
		cfgFile = envFile
	}

	if cfgFile != "" {
		v.SetConfigFile(cfgFile)
	} else {
		v.SetConfigName("solid-sdr-server")
		v.AddConfigPath(".")
	}

	err = v.ReadInConfig()
	if err == nil {
		log.Printf("Using config file: %s\n", v.ConfigFileUsed())
	}

	// Unmarshal into your struct
	err = v.Unmarshal(&cfg)
	if err != nil {
		return cfg, fmt.Errorf("unmarshal: %w", err)
	}

	cfg.ConfigFile = v.ConfigFileUsed()
	log.Printf("[config] http=:%d static=%q ice=%d..%d api-log=%q defaults=%q file=%q\n",
		cfg.HTTPPort, cfg.StaticDir, cfg.ICEPortStart, cfg.ICEPortEnd, cfg.APILogFile, cfg.DefaultsFile, cfg.ConfigFile)
	log.Printf("[config] client-stun=%d turn-urls=%v turn-ttl=%s policy=%s\n",
		len(cfg.ClientSTUN), cfg.TURNURLs, cfg.TURNTTL, cfg.ICETransportPolicy)

	warnings, err := validate(cfg)
	for _, w := range warnings {
		log.Printf("[config] warning: %s\n", w)
	}

	return cfg, err
}

func validate(cfg Config) ([]string, error) {
	var warnings []string

	if cfg.ICEPortEnd < cfg.ICEPortStart {
		return nil, fmt.Errorf("%w: %d–%d", errInvalidICEPortRange, cfg.ICEPortStart, cfg.ICEPortEnd)
	}

	err := checkSchemes("client-stun", cfg.ClientSTUN, "stun:", "stuns:")
	if err != nil {
		return nil, err
	}

	err = checkSchemes("turn-urls", cfg.TURNURLs, "turn:", "turns:")
	if err != nil {
		return nil, err
	}

	if len(cfg.TURNURLs) > 0 && cfg.TURNSecret == "" {
		return nil, errMissingTURNSecret
	}

	if len(cfg.TURNURLs) == 0 && cfg.TURNSecret != "" {
		warnings = append(warnings, "turn-secret is set but turn-urls is empty; TURN is off")
	}

	if cfg.TURNTTL <= 0 {
		return nil, fmt.Errorf("%w: %s", errInvalidTURNTTL, cfg.TURNTTL)
	}

	switch cfg.ICETransportPolicy {
	case "all":
	case "relay":
		if len(cfg.TURNURLs) == 0 {
			warnings = append(warnings, "ice-transport-policy is relay but turn-urls is empty; clients cannot connect")
		}
	default:
		return nil, fmt.Errorf("%w: %q", errInvalidPolicy, cfg.ICETransportPolicy)
	}

	return warnings, nil
}

func checkSchemes(key string, urls []string, schemes ...string) error {
	for _, u := range urls {
		ok := false

		for _, scheme := range schemes {
			if strings.HasPrefix(u, scheme) {
				ok = true

				break
			}
		}

		if !ok {
			return fmt.Errorf("%w in %s: %q (allowed: %s)", errInvalidURL, key, u, strings.Join(schemes, ", "))
		}
	}

	return nil
}
