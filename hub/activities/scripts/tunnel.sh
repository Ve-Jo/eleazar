#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
HUB_ROOT="$(cd -- "${PROJECT_ROOT}/.." && pwd)"
HUB_ENV="${HUB_ROOT}/.env"
ACTIVITIES_ENV="${PROJECT_ROOT}/.env"
CLI_PORT="${ACTIVITY_TUNNEL_PORT:-}"
CLI_PUBLIC_HOSTNAME="${ACTIVITY_TUNNEL_PUBLIC_HOSTNAME:-}"
CLI_SUBDOMAIN="${ACTIVITY_TUNNEL_SUBDOMAIN:-}"
CLI_QUICK_MODE="${ACTIVITY_TUNNEL_QUICK_MODE:-}"
CLI_PROVIDER="${ACTIVITY_TUNNEL_PROVIDER:-}"
CLI_CF_QUICK_FALLBACK="${ACTIVITY_CLOUDFLARED_QUICK_FALLBACK:-}"
CLI_LOCALTUNNEL_HOST="${ACTIVITY_TUNNEL_HOST:-}"
CLI_NGROK_DOMAIN="${ACTIVITY_NGROK_DOMAIN:-}"
CLI_NGROK_AUTHTOKEN="${ACTIVITY_NGROK_AUTHTOKEN:-}"

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

PORT="${CLI_PORT:-${ACTIVITY_TUNNEL_PORT:-5174}}"
PUBLIC_HOSTNAME="${CLI_PUBLIC_HOSTNAME:-${ACTIVITY_TUNNEL_PUBLIC_HOSTNAME:-}}"
SUBDOMAIN="${CLI_SUBDOMAIN:-${ACTIVITY_TUNNEL_SUBDOMAIN:-eleazar-activities-dev}}"
QUICK_MODE="${CLI_QUICK_MODE:-${ACTIVITY_TUNNEL_QUICK_MODE:-false}}"
TUNNEL_PROVIDER="${CLI_PROVIDER:-${ACTIVITY_TUNNEL_PROVIDER:-ngrok}}"
CF_QUICK_FALLBACK="${CLI_CF_QUICK_FALLBACK:-${ACTIVITY_CLOUDFLARED_QUICK_FALLBACK:-true}}"
LOCALTUNNEL_HOST="${CLI_LOCALTUNNEL_HOST:-${ACTIVITY_TUNNEL_HOST:-https://localtunnel.me}}"
CF_EDGE_IP_VERSION="${ACTIVITY_CLOUDFLARED_EDGE_IP_VERSION:-4}"
NGROK_DOMAIN="${CLI_NGROK_DOMAIN:-${ACTIVITY_NGROK_DOMAIN:-}}"
NGROK_AUTHTOKEN="${CLI_NGROK_AUTHTOKEN:-${ACTIVITY_NGROK_AUTHTOKEN:-}}"
FALLBACK_STATIC_PORT="${ACTIVITY_SERVER_PORT:-3007}"

is_local_port_open() {
  local port="$1"
  (echo >"/dev/tcp/127.0.0.1/${port}") >/dev/null 2>&1
}

resolve_origin_port() {
  if is_local_port_open "${PORT}"; then
    return
  fi

  if [[ "${PORT}" != "${FALLBACK_STATIC_PORT}" ]] && is_local_port_open "${FALLBACK_STATIC_PORT}"; then
    echo "[tunnel] Port ${PORT} is not reachable on localhost."
    echo "[tunnel] Falling back to the activities server on port ${FALLBACK_STATIC_PORT}."
    echo "[tunnel] Start \`bun run dev:tunnel:vite\` if you want the Vite client on port ${PORT}."
    PORT="${FALLBACK_STATIC_PORT}"
    return
  fi

  echo "[tunnel] Port ${PORT} is not reachable on localhost."
  echo "[tunnel] Start the activity app first:"
  echo "[tunnel] - \`bun run dev:tunnel:vite\` for Vite on port ${PORT}"
  echo "[tunnel] - \`bun run dev:tunnel\` for the static build on port ${FALLBACK_STATIC_PORT}"
  exit 1
}

resolve_origin_port

run_ngrok_loop() {
  if ! command -v ngrok >/dev/null 2>&1; then
    echo "[tunnel] ngrok provider selected, but ngrok is not installed."
    exit 1
  fi

  if [[ -z "${NGROK_AUTHTOKEN}" ]]; then
    HAS_CONFIG_TOKEN="false"
    if [[ -f "${HOME}/.config/ngrok/ngrok.yml" ]] && grep -q "authtoken:" "${HOME}/.config/ngrok/ngrok.yml"; then
      HAS_CONFIG_TOKEN="true"
    fi
    if [[ -f "${HOME}/.ngrok2/ngrok.yml" ]] && grep -q "authtoken:" "${HOME}/.ngrok2/ngrok.yml"; then
      HAS_CONFIG_TOKEN="true"
    fi
    if [[ "${HAS_CONFIG_TOKEN}" != "true" ]]; then
      echo "[tunnel] ngrok auth token is missing."
      echo "[tunnel] Run: ngrok config add-authtoken <YOUR_TOKEN>"
      echo "[tunnel] Or set ACTIVITY_NGROK_AUTHTOKEN in your env."
      exit 1
    fi
  fi

  if [[ -n "${NGROK_AUTHTOKEN}" ]]; then
    ngrok config add-authtoken "${NGROK_AUTHTOKEN}" >/dev/null 2>&1 || true
  fi

  echo "[tunnel] Starting ngrok tunnel mode on port ${PORT}."
  if [[ -n "${NGROK_DOMAIN}" ]]; then
    echo "[tunnel] Using reserved ngrok domain: https://${NGROK_DOMAIN}"
  fi

  while true; do
    set +e
    if [[ -n "${NGROK_DOMAIN}" ]]; then
      ngrok http --domain="${NGROK_DOMAIN}" "${PORT}"
    else
      ngrok http "${PORT}"
    fi
    EXIT_CODE=$?
    set -e
    echo "[tunnel] ngrok exited with code ${EXIT_CODE}. Reconnecting in 2 seconds..."
    sleep 2
  done
}

if [[ "${TUNNEL_PROVIDER}" == "ngrok" ]]; then
  run_ngrok_loop
fi

run_cloudflare_quick_loop() {
  echo "[tunnel] Starting Cloudflare quick tunnel mode on port ${PORT} (edge IP version: ${CF_EDGE_IP_VERSION})."
  while true; do
    set +e
    cloudflared tunnel \
      --url "http://localhost:${PORT}" \
      --edge-ip-version "${CF_EDGE_IP_VERSION}" \
      --no-autoupdate
    EXIT_CODE=$?
    set -e
    echo "[tunnel] Cloudflare quick tunnel exited with code ${EXIT_CODE}. Reconnecting in 2 seconds..."
    sleep 2
  done
}

if [[ "${TUNNEL_PROVIDER}" == "cloudflared_quick" ]]; then
  if ! command -v cloudflared >/dev/null 2>&1; then
    echo "[tunnel] cloudflared quick provider selected, but cloudflared is not installed."
    exit 1
  fi
  run_cloudflare_quick_loop
fi

if [[ "${TUNNEL_PROVIDER}" == "cloudflared" ]]; then
  if ! command -v cloudflared >/dev/null 2>&1; then
    echo "[tunnel] cloudflared provider selected, but cloudflared is not installed."
    echo "[tunnel] Install cloudflared or set ACTIVITY_TUNNEL_PROVIDER=localtunnel/cloudflared_quick."
    exit 1
  fi

  if [[ -n "${CLOUDFLARE_TUNNEL_TOKEN:-}" ]]; then
    echo "[tunnel] Starting Cloudflare named tunnel (stable URL)."
    if [[ -n "${PUBLIC_HOSTNAME}" ]]; then
      echo "[tunnel] Public URL: https://${PUBLIC_HOSTNAME}"
    fi
    exec cloudflared tunnel run --token "${CLOUDFLARE_TUNNEL_TOKEN}"
  fi

  if [[ "${CF_QUICK_FALLBACK}" == "true" || "${QUICK_MODE}" == "true" ]]; then
    echo "[tunnel] CLOUDFLARE_TUNNEL_TOKEN not set."
    run_cloudflare_quick_loop
  fi

  echo "[tunnel] CLOUDFLARE_TUNNEL_TOKEN is missing and quick fallback is disabled."
  echo "[tunnel] Run: bun run tunnel:cloudflare:setup"
  echo "[tunnel] Or set ACTIVITY_CLOUDFLARED_QUICK_FALLBACK=true for non-stable quick mode."
  exit 1
fi

if [[ "${TUNNEL_PROVIDER}" != "localtunnel" ]]; then
  echo "[tunnel] Unknown ACTIVITY_TUNNEL_PROVIDER=${TUNNEL_PROVIDER}. Use 'ngrok', 'cloudflared_quick', 'cloudflared', or 'localtunnel'."
  exit 1
fi

echo "[tunnel] Using localtunnel fallback provider."
echo "[tunnel] Subdomain target: https://${SUBDOMAIN}.loca.lt"
echo "[tunnel] Note: localtunnel subdomains are best-effort and can occasionally be unavailable."
echo "[tunnel] Using localtunnel host: ${LOCALTUNNEL_HOST}"

while true; do
  bunx localtunnel --port "${PORT}" --subdomain "${SUBDOMAIN}" --host "${LOCALTUNNEL_HOST}"
  echo "[tunnel] localtunnel disconnected. Reconnecting in 2 seconds..."
  sleep 2
done
