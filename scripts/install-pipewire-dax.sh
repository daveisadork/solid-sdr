#!/usr/bin/env bash

set -euo pipefail

repo="daveisadork/solid-sdr"
branch="main"
config_filename="95-dax.conf"
config_url="https://raw.githubusercontent.com/${repo}/${branch}/scripts/${config_filename}"

config_dir="${XDG_CONFIG_HOME:-${HOME}/.config}/pipewire/pipewire.conf.d"
config_path="${config_dir}/${config_filename}"

if [ "$(uname -s)" != "Linux" ]; then
  echo "This installer is for Linux only (PipeWire). Detected: $(uname -s)" >&2
  exit 1
fi

if ! command -v pipewire >/dev/null 2>&1; then
  echo "PipeWire does not appear to be installed." >&2
  echo "Install it via your distro's package manager, then re-run this script." >&2
  exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required but not installed." >&2
  exit 1
fi

echo "Installing SolidSDR DAX virtual devices for PipeWire..."

mkdir -p "$config_dir"

echo "Downloading ${config_filename}..."
curl -fsSL "$config_url" -o "$config_path"

echo "Installed: $config_path"

restarted=0
if command -v systemctl >/dev/null 2>&1; then
  echo "Restarting PipeWire user services..."
  if systemctl --user restart pipewire pipewire-pulse wireplumber 2>/dev/null; then
    restarted=1
  fi
fi

cat <<EOF

Done. Virtual devices installed:
  DAX TX        (output — apps send TX audio here)
  DAX RX 1..4   (output — browser sends RX audio here)

Each has a matching input device with the same name for capture.

EOF

if [ "$restarted" -eq 0 ]; then
  cat <<EOF
Could not auto-restart PipeWire. Run this manually:
  systemctl --user restart pipewire pipewire-pulse wireplumber

(or log out and back in)
EOF
else
  echo "If devices don't appear in your apps yet, log out and back in."
fi
