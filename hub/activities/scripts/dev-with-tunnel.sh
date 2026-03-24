#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"

cd "${PROJECT_ROOT}"

if command -v concurrently >/dev/null 2>&1; then
  exec concurrently \
    --kill-others-on-fail \
    --names "activities,tunnel" \
    --prefix-colors "blue,green" \
    "bun run dev" \
    "bash ./scripts/tunnel.sh"
fi

exec bunx concurrently \
  --kill-others-on-fail \
  --names "activities,tunnel" \
  --prefix-colors "blue,green" \
  "bun run dev" \
  "bash ./scripts/tunnel.sh"
