# Configuration

solid-sdr-server reads configuration from three sources, in order of precedence:

1. **Command-line flags** (highest)
2. **Environment variables** — prefix `FLEX_`, hyphens become underscores
   (e.g. `FLEX_HTTP_PORT=8081`)
3. **Config file** — `solid-sdr-server.yaml` in the current directory, or set
   `FLEX_CONFIG=/path/to/file.(yaml|json|toml)`

Copy `solid-sdr-server.example.yaml` to `solid-sdr-server.yaml` to get started.

## Options

| Flag | Env var | Default | Description |
|------|---------|---------|-------------|
| `--http-port` / `-p` | `FLEX_HTTP_PORT` | `8080` | HTTP listen port |
| `--static-dir` | `FLEX_STATIC_DIR` | _(embedded UI)_ | Serve web UI from this directory instead of the embedded copy |
| `--enable-coi` | `FLEX_ENABLE_COI` | `true` | Cross-Origin-Isolation headers (required for the web UI) |
| `--enable-cors` | `FLEX_ENABLE_CORS` | `true` | Permissive CORS headers |
| `--discovery-port` | `FLEX_DISCOVERY_PORT` | `4992` | UDP port for FlexRadio discovery |
| `--ice-port-start` | `FLEX_ICE_PORT_START` | `50313` | Lowest UDP port for WebRTC ICE |
| `--ice-port-end` | `FLEX_ICE_PORT_END` | `50313` | Highest UDP port for WebRTC ICE |
| `--stun` | `FLEX_STUN` | Google + Cloudflare | Comma-separated STUN server URLs |
| `--nat-1to1-ips` | `FLEX_NAT_1TO1_IPS` | _(none)_ | Public IPs for NAT 1:1 mapping |
| `--api-log-file` | `FLEX_API_LOG_FILE` | `messages.txt` | Path for raw API message log — **on by default**, writing to `messages.txt` in the current directory. Set to empty string to disable: `--api-log-file ""` |
| `--config` | `FLEX_CONFIG` | _(none)_ | Path to a config file (yaml/json/toml) |

## Ports

Open these ports in your firewall:

| Port | Protocol | Purpose |
|------|----------|---------|
| 8080 | TCP | HTTP server and WebSocket signaling |
| 4992 | UDP | FlexRadio discovery broadcasts |
| 50313 | UDP | WebRTC ICE (default single-port mux) |

If you change `--ice-port-start` / `--ice-port-end` to a range, open that
entire UDP range instead.

## Running as a systemd service (Linux)

Create `/etc/systemd/system/solid-sdr-server.service`:

```ini
[Unit]
Description=solid-sdr-server
After=network.target

[Service]
ExecStart=/usr/local/bin/solid-sdr-server
Restart=on-failure
User=solid-sdr-server

[Install]
WantedBy=multi-user.target
```

Then:

```sh
sudo systemctl enable --now solid-sdr-server
```
