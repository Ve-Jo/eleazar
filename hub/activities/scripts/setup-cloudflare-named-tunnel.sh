#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
HUB_ROOT="$(cd -- "${PROJECT_ROOT}/.." && pwd)"
HUB_ENV="${HUB_ROOT}/.env"
ACTIVITIES_ENV="${PROJECT_ROOT}/.env"

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

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "[cloudflare-setup] cloudflared is not installed."
  exit 1
fi

TUNNEL_NAME="${ACTIVITY_CLOUDFLARE_TUNNEL_NAME:-eleazar-activities}"
PUBLIC_HOSTNAME="${ACTIVITY_TUNNEL_PUBLIC_HOSTNAME:-}"

if [[ -z "${PUBLIC_HOSTNAME}" ]]; then
  echo "[cloudflare-setup] ACTIVITY_TUNNEL_PUBLIC_HOSTNAME is required."
  echo "[cloudflare-setup] Example: ACTIVITY_TUNNEL_PUBLIC_HOSTNAME=activities-dev.example.com"
  exit 1
fi

if [[ "${PUBLIC_HOSTNAME}" == *.loca.lt ]]; then
  echo "[cloudflare-setup] ${PUBLIC_HOSTNAME} is a localtunnel domain."
  echo "[cloudflare-setup] For a stable Cloudflare named tunnel, use a domain/subdomain managed in your Cloudflare account."
  exit 1
fi

if [[ ! -f "${HOME}/.cloudflared/cert.pem" ]]; then
  echo "[cloudflare-setup] Cloudflare origin cert not found. Launching login..."
  cloudflared tunnel login
fi

echo "[cloudflare-setup] Ensuring tunnel exists: ${TUNNEL_NAME}"
if cloudflared tunnel list -o json | grep -q "\"name\":\"${TUNNEL_NAME}\""; then
  echo "[cloudflare-setup] Tunnel already exists."
else
  cloudflared tunnel create "${TUNNEL_NAME}"
fi

echo "[cloudflare-setup] Routing DNS ${PUBLIC_HOSTNAME} -> ${TUNNEL_NAME}"
cloudflared tunnel route dns "${TUNNEL_NAME}" "${PUBLIC_HOSTNAME}"

TOKEN="$(cloudflared tunnel token "${TUNNEL_NAME}")"

cat <<EOT

[cloudflare-setup] Done. Put these values into your env (hub/.env or hub/activities/.env):

ACTIVITY_TUNNEL_PROVIDER=cloudflared
ACTIVITY_CLOUDFLARED_QUICK_FALLBACK=false
CLOUDFLARE_TUNNEL_TOKEN=${TOKEN}
ACTIVITY_PUBLIC_BASE_URL=https://${PUBLIC_HOSTNAME}
ACTIVITY_REDIRECT_URI=https://127.0.0.1

Then configure Discord Developer Portal like this:
- Activity URL Mapping / allowed domain: ${PUBLIC_HOSTNAME}
- OAuth2 Redirect URL: https://127.0.0.1
EOT
