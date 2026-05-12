#!/usr/bin/env bash

set -euo pipefail

repo="daveisadork/solid-sdr"
downloads_dir="${HOME}/Downloads"
install_dir="${1:-${downloads_dir}/solid-sdr-server}"

arch="$(uname -m)"

case "$arch" in
  arm64)
    asset_suffix="macos_apple-silicon.zip"
    ;;
  x86_64)
    asset_suffix="macos_intel.zip"
    ;;
  *)
    echo "Unsupported macOS architecture: $arch" >&2
    exit 1
    ;;
esac

tmpdir="$(mktemp -d "${TMPDIR:-/tmp}/solid-sdr.XXXXXX")"

cleanup() {
  rm -rf "$tmpdir"
}

trap cleanup EXIT

echo "Looking up the latest SolidSDR release..."

asset_url="$(
  curl -fsSL -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/${repo}/releases/latest" |
    grep -Eo "https://[^\"]+solid-sdr-server_[^\"]+_${asset_suffix}" |
    head -n 1
)"

if [ -z "${asset_url:-}" ]; then
  echo "Could not find a matching macOS release asset." >&2
  exit 1
fi

archive="$tmpdir/${asset_suffix}"

echo "Downloading $(basename "$asset_url")..."
curl -fL "$asset_url" -o "$archive"

rm -rf "$install_dir"
mkdir -p "$install_dir"
unzip -oq "$archive" -d "$install_dir"

if command -v xattr >/dev/null 2>&1; then
  xattr -dr com.apple.quarantine "$install_dir" 2>/dev/null || true
fi

chmod +x "$install_dir/solid-sdr-server"

install_path="$(cd "$install_dir" && pwd)"

cat <<EOF
Installed SolidSDR to:
  $install_path

Next:
  Open "$install_path"
  Double click "solid-sdr-server"

Then open:
  http://localhost:8080
EOF
