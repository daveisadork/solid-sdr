package version

import (
	"context"
	"os/exec"
	"runtime/debug"
	"strings"
	"time"
)

// Version is overridden at build time by GoReleaser via -X ldflags.
var Version = "dev" //nolint:gochecknoglobals

// GitDescribe is substituted by git archive via export-subst (.gitattributes).
// When building from a git checkout the literal $Format:...$ marker is retained.
const GitDescribe = "$Format:%(describe:tags=true)$"

// Resolve returns the most informative version string available.
// Priority: ldflags → export-subst → git describe --tags → vcs hash → "dev".
func Resolve() string {
	if Version != "dev" {
		return Version
	}

	if !strings.HasPrefix(GitDescribe, "$Format:") {
		return GitDescribe
	}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	out, err := exec.CommandContext(ctx, "git", "describe", "--tags").Output()
	if err == nil {
		if v := strings.TrimSpace(string(out)); v != "" {
			return v
		}
	}

	if info, ok := debug.ReadBuildInfo(); ok {
		for _, s := range info.Settings {
			if s.Key == "vcs.revision" && len(s.Value) >= 7 {
				return "dev+" + s.Value[:7]
			}
		}
	}

	return "dev"
}
