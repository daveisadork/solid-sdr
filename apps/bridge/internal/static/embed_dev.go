//go:build !release

package static

import "net/http"

// Handler returns nil in dev builds. Static files are served by the Vite dev
// server (port 3003), which proxies WebSocket connections to the bridge.
func Handler() http.Handler { return nil }
