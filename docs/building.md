# Building

## Prerequisites

### For development

- **Node.js** ≥ 18 — [nodejs.org](https://nodejs.org)
- **pnpm** — version is pinned in `package.json`. Install via:
  ```sh
  npm install -g pnpm
  ```
- **Go** ≥ 1.24 — [go.dev/dl](https://go.dev/dl/)
- **air** — live reload for the Go bridge:
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

Run the bridge and web app in separate terminals:

**Terminal 1 — web (Vite dev server, port 3003):**
```sh
pnpm dev:web
```

**Terminal 2 — bridge (air live reload, port 8080):**
```sh
pnpm dev:server
```

The web app proxies `/ws` WebSocket connections to the bridge. Open
http://localhost:3003 in your browser.

> The bridge runs without embedded web assets in dev. Vite handles the
> frontend and proxies `/ws` (WebSocket) and `/rtc` (HTTP) to the bridge.

## Building release artifacts

```sh
pnpm release:build
```

This runs GoReleaser in snapshot mode (no git tag required). Artifacts are
written to `dist/`:

GoReleaser names each artifact with a version component — for snapshot builds
the names will look like:

```
flex-bridge_0.0.1-next_linux_amd64.tar.gz
flex-bridge_0.0.1-next_linux_arm64.tar.gz
flex-bridge_0.0.1-next_linux_armv7.tar.gz
flex-bridge_0.0.1-next_darwin_amd64.tar.gz
flex-bridge_0.0.1-next_darwin_arm64.tar.gz
flex-bridge_0.0.1-next_windows_amd64.zip
flex-bridge_0.0.1-next_windows_386.zip
flex-bridge_0.0.1-next_windows_arm64.zip
checksums.txt
```

Each archive contains the `flex-bridge` binary and `flex-bridge.example.yaml`.
