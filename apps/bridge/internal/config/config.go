package config

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"

	"github.com/spf13/pflag"
	"github.com/spf13/viper"
)

type Config struct {
	// HTTP
	HTTPPort      int    `mapstructure:"http-port"`
	StaticDir     string `mapstructure:"static-dir"`
	EnableCOI     bool   `mapstructure:"enable-coi"`
	EnableCORS    bool   `mapstructure:"enable-cors"`
	DiscoveryPort int    `mapstructure:"discovery-port"`

	// WebRTC / ICE
	ICEPortStart int      `mapstructure:"ice-port-start"`
	ICEPortEnd   int      `mapstructure:"ice-port-end"`
	StunURLs     []string `mapstructure:"stun"`
	NAT1To1IPs   []string `mapstructure:"nat-1to1-ips"`

	// Diagnostics
	APILogFile string `mapstructure:"api-log-file"`

	// Config file path (optional)
	ConfigFile string `mapstructure:"-"`
}

func defaultAPILogPath() string {
	if _, err := os.Stat(filepath.Join("apps", "bridge")); err == nil {
		return filepath.Join("apps", "bridge", "messages.txt")
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
	fs.Int("ice-port-end", 50413, "Highest UDP port for ICE (inclusive)")
	fs.StringSlice("stun", []string{
		"stun:stun.l.google.com:19302",
		"stun:stun.cloudflare.com:3478",
	}, "Comma-separated STUN URLs")
	fs.StringSlice("nat-1to1-ips", nil, "Optional public IPs for NAT 1:1 mapping (e.g. 203.0.113.2,2001:db8::2)")
	fs.String("api-log-file", defaultAPILogPath(), "Path to write raw TCP API messages (set empty to disable)")
	fs.String("config", "", "Path to optional config file")

	// Usage
	fs.Usage = func() {
		fmt.Fprintf(os.Stderr, `flex-bridge

Usage:
  %s [flags]

Flags:
`, os.Args[0])
		fs.PrintDefaults()
		fmt.Fprintf(os.Stderr, `
Environment:
  Prefix: FLEX_
  Examples:
    FLEX_HTTP_PORT=8081 FLEX_STATIC_DIR=./dist
    FLEX_STUN="stun:stun1.example.com,stun:stun2.example.com"

Config file:
  Set FLEX_CONFIG=/path/to/file.(yaml|json|toml)
  Or place flex-bridge.yaml/json/toml in current directory
`)
	}

	pflag.CommandLine.AddFlagSet(fs)
	pflag.Parse()

	// Viper setup
	v := viper.New()
	v.SetEnvPrefix("FLEX")
	v.AutomaticEnv()
	// allow FLEX_HTTP_PORT to map to "http_port"
	v.SetEnvKeyReplacer(strings.NewReplacer("-", "_"))
	// Viper takes over
	if err := v.BindPFlags(pflag.CommandLine); err != nil {
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
		v.SetConfigName("flex-bridge")
		v.AddConfigPath(".")
	}
	if err := v.ReadInConfig(); err == nil {
		log.Printf("Using config file: %s\n", v.ConfigFileUsed())
	}

	// Unmarshal into your struct
	if err := v.Unmarshal(&cfg); err != nil {
		return cfg, fmt.Errorf("unmarshal: %w", err)
	}
	cfg.ConfigFile = v.ConfigFileUsed()
	log.Printf("[config] http=:%d static=%q ice=%d..%d api-log=%q file=%q\n",
		cfg.HTTPPort, cfg.StaticDir, cfg.ICEPortStart, cfg.ICEPortEnd, cfg.APILogFile, cfg.ConfigFile)

	// Sanity checks
	if cfg.ICEPortEnd < cfg.ICEPortStart {
		return cfg, fmt.Errorf("invalid ICE port range %d–%d", cfg.ICEPortStart, cfg.ICEPortEnd)
	}

	return cfg, nil
}
