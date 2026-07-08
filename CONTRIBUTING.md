# Contributing to SolidSDR

## Prerequisites

### Toolchain

The easiest way to get every tool at the right version is
[mise](https://mise.jdx.dev/):

```sh
# install mise (see https://mise.jdx.dev/getting-started.html for other methods)
curl https://mise.run | sh

# from the repo root — installs Node, pnpm, Go, air, and GoReleaser
mise install
```

Versions are pinned in [`mise.toml`](mise.toml). Make sure mise is
[activated in your shell](https://mise.jdx.dev/getting-started.html#activate-mise)
so the tools are on your `PATH` inside the repo.

If you'd rather install things yourself:

- **Node.js** ≥ 20 — [nodejs.org](https://nodejs.org)
- **pnpm** — the exact version is pinned in the `packageManager` field of
  `package.json`; `corepack enable` will pick it up automatically
- **Go** — version tracked in `apps/server/go.mod` ([go.dev/dl](https://go.dev/dl/))
- **air** — live reload for the Go server:
  `go install github.com/air-verse/air@latest`
  (make sure `$(go env GOPATH)/bin` is on your `PATH`)
- **GoReleaser** v2+ — only needed for [release builds](#release-builds)

### A radio

You'll want a FlexRadio running 4.x firmware on the same network as your
machine. The server finds radios via UDP discovery broadcasts on port 4992,
so it must run on the same LAN — SmartLink is not supported.

## Repository layout

| Path | What it is |
|------|------------|
| `apps/web` | SolidJS web client (Vite) |
| `apps/server` | Go server — HTTP/WebSocket/WebRTC bridge between browser and radio |
| `packages/flexlib` | TypeScript FlexRadio protocol library |
| `packages/tailwind-config` | Shared Tailwind styles |

The web app consumes `@repo/flexlib` directly from source (aliased in
`vite.config.ts` and `tsconfig.json`), so no package build step is needed
before development.

## Development

```sh
pnpm install
pnpm dev
```

`pnpm dev` uses Turborepo to start both processes:

- **Vite dev server** on <http://localhost:3003> — this is what you open in
  your browser
- **Go server** (via air, rebuilt on save) on port 8080

Vite proxies `/ws` (WebSocket signaling) and `/defaults.json` to the Go
server, so everything works through the single origin at port 3003. In dev
the Go server has no embedded web assets — Vite owns the frontend.

> **Note:** the server logs raw radio API traffic to `messages.txt` in its
> working directory by default. Set `FLEX_API_LOG_FILE=""` to disable.

## Checks and tests

```sh
pnpm lint          # Biome (TS) + golangci-lint (Go)
pnpm format        # Biome, write fixes
pnpm check-types   # tsc --noEmit, all packages

pnpm --filter @repo/flexlib test   # vitest
pnpm --filter @repo/server test    # go test ./...
```

## Release builds

Real releases are automated: pushing a `v*` tag runs GoReleaser via GitHub
Actions (`.github/workflows/release.yml`) and uploads artifacts to a draft
GitHub release.

To test the release pipeline locally without a tag:

```sh
pnpm release:build
```

This builds the web app, embeds it into the Go binary, and writes
per-platform archives plus `checksums.txt` to `dist/`. Snapshot artifacts are
versioned like `solid-sdr-server_0.2.6-next_linux_amd64.tar.gz`.

> If a release build fails partway through, the temporary web assets at
> `apps/server/internal/static/web/` may be left behind. Remove them before
> retrying: `rm -rf apps/server/internal/static/web`
