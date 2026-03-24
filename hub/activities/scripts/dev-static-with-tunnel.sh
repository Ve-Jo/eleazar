#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
HUB_ROOT="$(cd -- "${PROJECT_ROOT}/.." && pwd)"
HUB_ENV="${HUB_ROOT}/.env"
ACTIVITIES_ENV="${PROJECT_ROOT}/.env"

cd "${PROJECT_ROOT}"

if [[ -f "${HUB_ENV}" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${HUB_ENV}"
  set +a
fi

if [[ -f "${ACTIVITIES_ENV}" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${ACTIVITIES_ENV}"
  set +a
fi

SERVER_PORT="${ACTIVITIES_SERVICE_PORT:-3007}"

if command -v lsof >/dev/null 2>&1 && lsof -ti "tcp:${SERVER_PORT}" >/dev/null 2>&1; then
  EXISTING_PIDS="$(lsof -ti "tcp:${SERVER_PORT}" | tr '\n' ' ' | sed 's/[[:space:]]*$//')"
  echo "[dev:tunnel] Port ${SERVER_PORT} is already in use by PID(s): ${EXISTING_PIDS}"
  echo "[dev:tunnel] Stop the old hub/activities process first, then retry."
  exit 1
fi

echo "[dev:tunnel] Building activity client once before start..."
bun run --cwd client build

if command -v concurrently >/dev/null 2>&1; then
  exec concurrently \
    --kill-others-on-fail \
    --names "activities,build,tunnel" \
    --prefix-colors "blue,yellow,green" \
    "bun run start" \
    "bun run --cwd client build:watch" \
    "ACTIVITY_TUNNEL_PORT=${SERVER_PORT} bash ./scripts/tunnel.sh"
fi

exec bunx concurrently \
  --kill-others-on-fail \
  --names "activities,build,tunnel" \
  --prefix-colors "blue,yellow,green" \
  "bun run start" \
  "bun run --cwd client build:watch" \
  "ACTIVITY_TUNNEL_PORT=${SERVER_PORT} bash ./scripts/tunnel.sh"
