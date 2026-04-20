//go:build release

package static

import (
	"embed"
	"io/fs"
	"net/http"
)

//go:embed web/dist
var webDist embed.FS

// Handler returns an http.Handler that serves the compiled web UI embedded at
// build time. The web/dist directory is populated by the GoReleaser pre-hook
// before go build runs; it is gitignored and must not be committed.
func Handler() http.Handler {
	sub, err := fs.Sub(webDist, "web/dist")
	if err != nil {
		panic("static: failed to sub embedded FS: " + err.Error())
	}
	return http.FileServer(http.FS(sub))
}
