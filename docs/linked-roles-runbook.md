# Discord Linked Roles Runbook

## Overview
- New service: `hub/linked-roles` (default port `3008`).
- Uses current Discord app (`DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` / `DISCORD_TOKEN`).
- Stores encrypted OAuth tokens in DB table `linked_role_connections`.
- Uses one selected guild per user as metadata source.

## Required Env
Configure in `hub/.env`:

```env
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
DISCORD_TOKEN=
WEB_APP_URL=http://localhost:5173

LINKED_ROLES_SERVICE_URL=http://localhost:3008
LINKED_ROLES_SERVICE_PORT=3008
LINKED_ROLES_PUBLIC_BASE_URL=http://localhost:3008
LINKED_ROLES_OAUTH_REDIRECT_URI=http://localhost:3008/oauth/discord/callback
LINKED_ROLES_VERIFICATION_URL=http://localhost:3008/linked-role

LINKED_ROLES_ENCRYPTION_KEY=<32-byte key or secret string>
LINKED_ROLES_INTERNAL_WEBHOOK_KEY=<shared secret>

LINKED_ROLES_RECONCILIATION_INTERVAL_MS=300000
LINKED_ROLES_QUEUE_MAX_RETRIES=6
LINKED_ROLES_QUEUE_BASE_DELAY_MS=2000
LINKED_ROLES_QUEUE_MAX_DELAY_MS=120000
```

`LINKED_ROLES_INTERNAL_WEBHOOK_KEY` must match in:
- `hub/database` (event webhook sender)
- `hub/client` (signed OAuth start context)
- `hub/linked-roles` (internal webhook + signature verification)

## Discord Developer Portal Setup
Use the same app as the bot:

1. OAuth2 Redirects: add `LINKED_ROLES_OAUTH_REDIRECT_URI`.
2. Linked Roles Verification URL: set `LINKED_ROLES_VERIFICATION_URL`.
3. Keep bot token valid (`DISCORD_TOKEN`) to register metadata schema.

## Startup
From `hub/`:

```bash
bun run dev
```

Or only linked roles service:

```bash
cd linked-roles
bun run dev
```

Force schema sync:

```bash
cd linked-roles
bun run metadata:sync
```

## Operational Notes
- OAuth connect flow starts from web account page via `hub/client` signed redirect.
- DB emits metric-update events after balance/xp mutations.
- Linked roles service queues sync jobs with retry (backoff + jitter).
- Reconciliation job requeues stale connections periodically.

## Troubleshooting
- `oauth_error` in account page:
  - Verify redirect URI and client secret.
  - Check `DISCORD_CLIENT_ID` consistency across services.
- `syncStatus=token_error`:
  - User may need reconnect (refresh token invalid).
- Repeated `403` on internal event endpoint:
  - `LINKED_ROLES_INTERNAL_WEBHOOK_KEY` mismatch.
- No role updates in Discord:
  - Confirm metadata schema was registered (`bun run metadata:sync`).
  - Check selected guild is set and user has data in that guild.
