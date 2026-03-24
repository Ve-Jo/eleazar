# Discord Activities local run + stable tunnel

This package supports two dev modes:

- `bun run dev`: runs API server + Vite client locally.
- `bun run dev:tunnel`: runs API server + built static client + public tunnel (Discord-friendly).
- `bun run dev:tunnel:vite`: runs API server + Vite dev server + tunnel (fast local iteration).

## 1) Discord Developer Portal setup (one-time)

In your Discord application:

1. Enable your Activity / Embedded App entry point.
2. Add your activity URL domain to allowed domains.
3. Set OAuth2 redirect URL to the Activity placeholder value from Discord's Activity OAuth guide:
`https://127.0.0.1`
4. Save changes.

For Activities, Discord handles returning control to the embedded app after `AUTHORIZE`, so this redirect does not need to point at your tunnel domain.

## 2) Env setup (`hub/.env` or `hub/activities/.env`)

The Activities service now loads both files in this order:
1. `hub/.env`
2. `hub/activities/.env` (overrides hub values if duplicated)

Required:

```env
ACTIVITY_CLIENT_ID=<discord app client id>
ACTIVITY_CLIENT_SECRET=<discord app client secret>
ACTIVITY_PUBLIC_BASE_URL=https://<your-stable-domain>
ACTIVITY_REDIRECT_URI=https://127.0.0.1
ACTIVITIES_SERVICE_PORT=3007
ACTIVITY_TUNNEL_PORT=5174
```

Recommended tunnel config:

```env
ACTIVITY_TUNNEL_PROVIDER=ngrok
ACTIVITY_NGROK_DOMAIN=<optional-reserved-domain.ngrok-free.app>
ACTIVITY_NGROK_AUTHTOKEN=<optional-if-not-configured-globally>
```

ngrok-only flow:

```env
ACTIVITY_TUNNEL_PROVIDER=ngrok
ACTIVITY_NGROK_DOMAIN=
ACTIVITY_NGROK_AUTHTOKEN=
```

ngrok requires a verified account + auth token (`ngrok config add-authtoken ...`).

If you later want Cloudflare named mode, create it with:

```bash
bun run install:cloudflared
bun run tunnel:cloudflare:setup
```

`ACTIVITY_TUNNEL_PUBLIC_HOSTNAME` must be a hostname on a domain managed in your Cloudflare account.
If `CLOUDFLARE_TUNNEL_TOKEN` is not set, the script uses Cloudflare quick tunnels (URL changes every run).

Localtunnel is still available as a fallback provider:

```env
ACTIVITY_TUNNEL_PROVIDER=localtunnel
ACTIVITY_TUNNEL_SUBDOMAIN=eleazar-activities-dev
ACTIVITY_TUNNEL_HOST=https://localtunnel.me
```

Optional legacy quick mode flag (not required when `ACTIVITY_CLOUDFLARED_QUICK_FALLBACK=true`):

```env
ACTIVITY_TUNNEL_QUICK_MODE=true
```

## 3) Run

From `hub/activities`:

```bash
bun install
bun run tunnel:info
bun run dev:tunnel
```

Standalone tunnel process (keep this running in a separate terminal while restarting hub):

```bash
bun run tunnel:ngrok:standalone
```

If you want the old Vite hot-reload tunnel mode instead:

```bash
bun run dev:tunnel:vite
```

From `hub` (all hub services + activities tunnel):

```bash
bun run dev:tunnel
```

The tunnel script chooses this order:

1. `ngrok` provider: ngrok tunnel (reserved or ephemeral)
2. `cloudflared_quick` provider: Cloudflare quick tunnel
3. `cloudflared` provider: named tunnel (token) with optional quick fallback
4. `localtunnel` only when explicitly selected

If localtunnel is used, the script automatically retries on disconnect.
In quick mode, Cloudflare timeouts are also retried automatically.

## Notes

- `dev:tunnel` tunnels port `3007` so Discord loads the API + static build from one origin.
- `dev:tunnel:vite` tunnels `ACTIVITY_TUNNEL_PORT` (default `5174`).
- API calls in the Activity client use same-origin `/api/*` and are proxied to `http://localhost:3007` during dev.
- If you change the stable domain, update the Activity URL mapping / allowed domain and `ACTIVITY_PUBLIC_BASE_URL`.
- For Activity OAuth, keep the Discord Portal redirect URL on `https://127.0.0.1` unless you intentionally move away from the Embedded App SDK authorize flow.
