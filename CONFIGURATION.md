# Configuration

solid-sdr-server reads configuration from three sources, in order of precedence:

1. **Command-line flags** (highest)
2. **Environment variables** — prefix `FLEX_`, hyphens become underscores
   (e.g. `FLEX_HTTP_PORT=8081`)
3. **Config file** — `solid-sdr-server.yaml` in the current directory, or set
   `FLEX_CONFIG=/path/to/file.(yaml|json|toml)`

Copy `solid-sdr-server.example.yaml` to `solid-sdr-server.yaml` to get started.

## Options

| Flag                     | Env var                     | Default             | Description                                                                                                                                               |
| ------------------------ | --------------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--http-port` / `-p`     | `FLEX_HTTP_PORT`            | `8080`              | HTTP listen port                                                                                                                                          |
| `--static-dir`           | `FLEX_STATIC_DIR`           | _(embedded UI)_     | Serve web UI from this directory instead of the embedded copy                                                                                             |
| `--enable-coi`           | `FLEX_ENABLE_COI`           | `true`              | Cross-Origin-Isolation headers (required for the web UI)                                                                                                  |
| `--enable-cors`          | `FLEX_ENABLE_CORS`          | `true`              | Permissive CORS headers                                                                                                                                   |
| `--discovery-port`       | `FLEX_DISCOVERY_PORT`       | `4992`              | UDP port for FlexRadio discovery                                                                                                                          |
| `--ice-port-start`       | `FLEX_ICE_PORT_START`       | `50313`             | Lowest UDP port for WebRTC ICE                                                                                                                            |
| `--ice-port-end`         | `FLEX_ICE_PORT_END`         | `50313`             | Highest UDP port for WebRTC ICE                                                                                                                           |
| `--stun`                 | `FLEX_STUN`                 | Google + Cloudflare | Comma-separated STUN URLs that the server itself uses (not sent to web clients)                                                                           |
| `--nat-1to1-ips`         | `FLEX_NAT_1TO1_IPS`         | _(none)_            | Public IPs for NAT 1:1 mapping                                                                                                                            |
| `--client-stun`          | `FLEX_CLIENT_STUN`          | Google + Cloudflare | Comma-separated STUN URLs sent to web clients. Set an empty list to send none. See [TURN](#restrictive-networks--turn)                                    |
| `--turn-urls`            | `FLEX_TURN_URLS`            | _(none)_            | Comma-separated TURN URLs sent to web clients (`turn:` or `turns:`). Requires `--turn-secret`                                                             |
| `--turn-secret`          | `FLEX_TURN_SECRET`          | _(none)_            | Shared secret of the TURN server (coturn `static-auth-secret`)                                                                                            |
| `--turn-ttl`             | `FLEX_TURN_TTL`             | `52h`               | Lifetime of the TURN credentials that the server generates for each client                                                                                |
| `--ice-transport-policy` | `FLEX_ICE_TRANSPORT_POLICY` | `all`               | `all` or `relay`. `relay` makes web clients use only TURN (for tests)                                                                                     |
| `--api-log-file`         | `FLEX_API_LOG_FILE`         | `messages.txt`      | Path for raw API message log — **on by default**, writing to `messages.txt` in the current directory. Set to empty string to disable: `--api-log-file ""` |
| `--config`               | `FLEX_CONFIG`               | _(none)_            | Path to a config file (yaml/json/toml)                                                                                                                    |

## Ports

Open these ports in your firewall:

| Port  | Protocol | Purpose                              |
| ----- | -------- | ------------------------------------ |
| 8080  | TCP      | HTTP server and WebSocket signaling  |
| 4992  | UDP      | FlexRadio discovery broadcasts       |
| 50313 | UDP      | WebRTC ICE (default single-port mux) |

If you change `--ice-port-start` / `--ice-port-end` to a range, open that
entire UDP range instead.

TURN support adds no ports to solid-sdr-server. A TURN server needs its own
ports, see [Restrictive networks / TURN](#restrictive-networks--turn).

## Restrictive networks / TURN

The browser and the server exchange all radio data over one WebRTC
connection. By default, this connection uses UDP to the ICE port of the server
(50313). Some networks block UDP or block ports other than 80 and 443, for
example company networks or some mobile hotspots. In such networks the
connection fails.

Try these steps first. They do not need a TURN server:

- Forward the ICE port (UDP 50313) on the router of the server network to
  solid-sdr-server.
- Give solid-sdr-server IPv6 access to the internet and allow UDP 50313 in
  the IPv6 firewall. When the browser also has IPv6, the connection does not
  need NAT traversal.

If the network of the browser still blocks the connection, a TURN server can
help. The browser connects to the TURN server over UDP, TCP or TLS (for
example on port 443). The TURN server relays the data to solid-sdr-server.

Limits of TURN:

- Each relay adds latency. Over TCP or TLS, packet loss also delays all data
  that comes after it. Panadapter, waterfall and audio are less smooth than
  with a direct UDP connection.
- TURN over TLS on port 443 does not pass firewalls that inspect TLS or that
  block unknown domains.

solid-sdr-server does not include a TURN server. Use a TURN server that
supports the TURN REST API (shared secret), for example
[coturn](https://github.com/coturn/coturn), eturnal or pion/turn.

### How it works

- When a browser connects, solid-sdr-server sends it the list of STUN and TURN
  servers.
- For each connection, the server makes new TURN credentials from
  `turn-secret`. They are valid for `turn-ttl`. No static password goes to the
  browser.
- A new WebSocket connection (for example after a page reload) gets new
  credentials.
- coturn checks the expiry time only when it creates a new allocation. An
  existing coturn relay continues after expiry. Other TURN servers (for
  example pion/turn) close the relay at expiry. For them, set `turn-ttl` longer
  than your longest session.
- The browser uses TURN only when a direct connection is not possible.

### Example: coturn

`/etc/turnserver.conf`:

```ini
listening-port=3478
# TURN over TLS on 443 for networks that allow only HTTPS ports.
tls-listening-port=443
cert=/etc/ssl/turn.example.com/fullchain.pem
pkey=/etc/ssl/turn.example.com/privkey.pem

realm=turn.example.com
use-auth-secret
static-auth-secret=CHANGE-THIS-SECRET

# Relay ports. Open them in the firewall of the TURN server (UDP).
min-port=49160
max-port=49200

# Relay only to solid-sdr-server. Replace 192.0.2.10 with its address.
denied-peer-ip=0.0.0.0-255.255.255.255
denied-peer-ip=::-ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff
allowed-peer-ip=192.0.2.10

fingerprint
no-cli
```

`solid-sdr-server.yaml`:

```yaml
turn-urls:
  - turn:turn.example.com:3478?transport=udp
  - turn:turn.example.com:3478?transport=tcp
  - turns:turn.example.com:443?transport=tcp
turn-secret: CHANGE-THIS-SECRET
```

Ports on the TURN server: 3478 UDP and TCP, 443 TCP, and the relay range
(49160-49200 UDP in the example). The TURN server must be able to send UDP to
the ICE port of solid-sdr-server.

### Security

- Every client that can open the WebSocket `/ws/signal` gets TURN credentials.
  When you configure TURN, put solid-sdr-server behind authentication, for
  example a reverse proxy with login.
- Restrict the TURN server so that it relays only to solid-sdr-server
  (`denied-peer-ip` and `allowed-peer-ip` in the example). Otherwise, other
  people can use credentials to relay to any address.
- Keep `turn-secret` secret. solid-sdr-server does not write it or the
  generated credentials to the log.
- `turn-ttl` sets how long a copied credential stays valid. The default
  (`52h`) is longer than the longest contests.

### Test the TURN server

1. Open the web UI with `?relay=true` in the URL (for example
   `http://localhost:8080/?relay=true`). The browser then uses only TURN.
   To force TURN for all clients, set `ice-transport-policy: relay`.
2. In Chrome, open `chrome://webrtc-internals`. Make sure that the selected
   candidate pair has the type `relay`.
3. Make sure that audio, panadapter and transmit work.

### Compatibility

All new options are off by default. With the defaults, browsers get the same
STUN servers as before. Web clients of this version need a server that sends
its version on connect (solid-sdr-server from May 2026 or later).

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
