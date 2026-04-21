# Building

## Prerequisites

### For development

- **Node.js** ≥ 18 — [nodejs.org](https://nodejs.org)
- **pnpm** — version is pinned in `package.json`. Install via:
  ```sh
  npm install -g pnpm
  ```
- **Go** ≥ 1.24 — [go.dev/dl](https://go.dev/dl/)
- **air** — live reload for the Go server:
  ```sh
  go install github.com/air-verse/air@latest
  ```
  Make sure `$(go env GOPATH)/bin` is on your `PATH`.

### For release builds

Everything above, plus:

- **GoReleaser** v2+:
  ```sh
  # macOS
  brew install goreleaser/tap/goreleaser

  # Linux / Windows: https://goreleaser.com/install/
  ```

## Development

Run the server and web app in separate terminals:

**Terminal 1 — web (Vite dev server, port 3003):**
```sh
pnpm dev:web
```

**Terminal 2 — server (air live reload, port 8080):**
```sh
pnpm dev:server
```

The web app proxies `/ws` WebSocket connections to the server. Open
http://localhost:3003 in your browser.

> The server runs without embedded web assets in dev. Vite handles the
> frontend and proxies `/ws` (WebSocket) and `/rtc` (HTTP) to the server.

## Building release artifacts

```sh
pnpm release:build
```

This runs GoReleaser in snapshot mode (no git tag required). Artifacts are
written to `dist/`:

GoReleaser names each artifact with a version component — for snapshot builds
the names will look like:

```
solid-sdr-server_0.0.1-next_linux_amd64.tar.gz
solid-sdr-server_0.0.1-next_linux_arm64.tar.gz
solid-sdr-server_0.0.1-next_linux_armv7.tar.gz
solid-sdr-server_0.0.1-next_darwin_amd64.tar.gz
solid-sdr-server_0.0.1-next_darwin_arm64.tar.gz
solid-sdr-server_0.0.1-next_windows_amd64.zip
solid-sdr-server_0.0.1-next_windows_386.zip
solid-sdr-server_0.0.1-next_windows_arm64.zip
checksums.txt
```

Each archive contains the `solid-sdr-server` binary and `solid-sdr-server.example.yaml`.
