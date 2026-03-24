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

PUBLIC_BASE_URL="${ACTIVITY_PUBLIC_BASE_URL:-}"
REDIRECT_URI="${ACTIVITY_REDIRECT_URI:-}"
HOSTNAME="${ACTIVITY_TUNNEL_PUBLIC_HOSTNAME:-}"
TUNNEL_PROVIDER="${ACTIVITY_TUNNEL_PROVIDER:-cloudflared}"
CF_QUICK_FALLBACK="${ACTIVITY_CLOUDFLARED_QUICK_FALLBACK:-true}"
CF_TUNNEL_NAME="${ACTIVITY_CLOUDFLARE_TUNNEL_NAME:-eleazar-activities}"
NGROK_DOMAIN="${ACTIVITY_NGROK_DOMAIN:-}"
NGROK_AUTHTOKEN="${ACTIVITY_NGROK_AUTHTOKEN:-}"

if [[ -z "${PUBLIC_BASE_URL}" && -n "${HOSTNAME}" ]]; then
  PUBLIC_BASE_URL="https://${HOSTNAME}"
fi

if [[ -z "${REDIRECT_URI}" && -n "${PUBLIC_BASE_URL}" ]]; then
  REDIRECT_URI="https://127.0.0.1"
fi

echo "Discord Portal values"
echo "- Activity URL domain: ${HOSTNAME:-<unset>}"
echo "- OAuth2 Redirect URL: ${REDIRECT_URI:-<unset>}"
echo

echo "Tunnel mode"
echo "- ACTIVITY_TUNNEL_PROVIDER: ${TUNNEL_PROVIDER}"
echo "- ACTIVITY_CLOUDFLARED_QUICK_FALLBACK: ${CF_QUICK_FALLBACK}"
echo "- ACTIVITY_CLOUDFLARE_TUNNEL_NAME: ${CF_TUNNEL_NAME}"
echo "- ACTIVITY_NGROK_DOMAIN: ${NGROK_DOMAIN:-<unset>}"
[[ -n "${NGROK_AUTHTOKEN}" ]] && echo "- ACTIVITY_NGROK_AUTHTOKEN: set" || echo "- ACTIVITY_NGROK_AUTHTOKEN: missing"
echo

echo "Env sanity check"
[[ -n "${ACTIVITY_CLIENT_ID:-}" ]] && echo "- ACTIVITY_CLIENT_ID: set" || echo "- ACTIVITY_CLIENT_ID: missing"
[[ -n "${ACTIVITY_CLIENT_SECRET:-}" ]] && echo "- ACTIVITY_CLIENT_SECRET: set" || echo "- ACTIVITY_CLIENT_SECRET: missing"
[[ -n "${PUBLIC_BASE_URL}" ]] && echo "- ACTIVITY_PUBLIC_BASE_URL: ${PUBLIC_BASE_URL}" || echo "- ACTIVITY_PUBLIC_BASE_URL: missing"
[[ -n "${REDIRECT_URI}" ]] && echo "- ACTIVITY_REDIRECT_URI: ${REDIRECT_URI}" || echo "- ACTIVITY_REDIRECT_URI: missing (recommended: https://127.0.0.1)"
[[ -n "${CLOUDFLARE_TUNNEL_TOKEN:-}" ]] && echo "- CLOUDFLARE_TUNNEL_TOKEN: set" || echo "- CLOUDFLARE_TUNNEL_TOKEN: missing"

if [[ -n "${REDIRECT_URI}" && "${REDIRECT_URI}" != "https://127.0.0.1" ]]; then
  echo
  echo "Warning: Discord Activity OAuth usually expects the placeholder redirect URL https://127.0.0.1."
  echo "Your current ACTIVITY_REDIRECT_URI is: ${REDIRECT_URI}"
fi

if [[ "${TUNNEL_PROVIDER}" == "cloudflared" && -z "${CLOUDFLARE_TUNNEL_TOKEN:-}" ]]; then
  echo
  echo "Notice: CLOUDFLARE_TUNNEL_TOKEN is not set."
  echo "Cloudflare quick tunnels change URL on restart and are not suitable for stable Activity URL mappings."
fi

if [[ "${TUNNEL_PROVIDER}" == "cloudflared_quick" ]]; then
  echo
  echo "Notice: cloudflared_quick mode always uses an ephemeral trycloudflare URL."
  echo "Keep the tunnel process alive to keep the same URL during development sessions."
fi

if [[ "${TUNNEL_PROVIDER}" == "ngrok" && -z "${NGROK_DOMAIN}" ]]; then
  echo
  echo "Notice: ACTIVITY_NGROK_DOMAIN is not set."
  echo "ngrok will use an ephemeral URL unless you configure a reserved domain."
fi
