#!/usr/bin/env bash
set -euo pipefail

TARGET="${HOME}/.local/bin/cloudflared"
mkdir -p "${HOME}/.local/bin"

curl -fsSL -o "${TARGET}" \
  https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
chmod +x "${TARGET}"

"${TARGET}" --version
