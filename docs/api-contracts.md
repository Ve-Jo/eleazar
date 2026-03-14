# Eleazar API Contracts (Draft)

This document captures the current API surface for the bot + hub services so we can type DTOs during the JS→TS migration.

## Service Ports & URLs (defaults)

| Service | Default Port | Default URL |
| --- | --- | --- |
| database | 3001 | http://localhost:3001 |
| rendering | 3002 | http://localhost:3002 |
| localization | 3005 | http://localhost:3005 |
| ai | 8080 | http://localhost:8080 |
| client | 3006 | http://localhost:3006 |

Source of truth: `hub/shared/src/serviceConfig.js`.

## Common DTOs

- `HealthResponse`: `status`, `service`, `timestamp`, `uptime`, `version`
- `ErrorResponse`: `error`, `message`, `timestamp`
- `PaginationInput`: `limit`, `offset`

Source of truth: `hub/shared/src/contracts/dtos.ts`.

## Database Service (hub/database)

Base URL: `DATABASE_SERVICE_URL`

- `GET /health` → `HealthResponse`
- `GET /users/:guildId/:userId`
- `GET /economy/:guildId/:userId`
- `GET /games/:guildId/:userId`
- `GET /stats/:guildId/:userId`
- `GET /cooldowns/:guildId/:userId`
- `GET /levels/:guildId/:userId`
- `GET /crypto/wallets/:guildId/:userId`
- `GET /crypto-wallet/portfolio/:guildId/:userId`
- `POST /crypto-wallet/withdrawals`

See `hub/database/src/routes/*` for the full list.

## Rendering Service (hub/rendering)

Base URL: `RENDERING_SERVICE_URL`

- `GET /health` → `HealthResponse`
- `POST /generate` → image buffer or `{ image, coloring }`
- `POST /colors` → color palette
- `GET /components` → list of available rendering components

## Localization Service (hub/localization)

Base URL: `LOCALIZATION_SERVICE_URL`

- `GET /health` → `HealthResponse`
- `GET /i18n/translate?key=...&locale=...&variables=...`
- `POST /i18n/register` → `{ success: true }`
- `POST /i18n/add` → `{ success: true }`
- `GET /i18n/group?groupKey=...&locale=...`
- `POST /i18n/save-all` → `{ success: true }`
- `POST /i18n/set-locale` → `{ locale }`
- `GET /i18n/locale` → `{ locale }`
- `GET /i18n/locales` → `{ locales }`

## AI Service (hub/ai)

Base URL: `AI_SERVICE_URL`

- `GET /health` (service root health)
- `GET /ai/health` → AI subsystem health
- `GET /ai/models` (filters: provider, capability, refresh, sorting)
- `GET /ai/models/search`
- `GET /ai/models/by-price`
- `GET /ai/models/cheapest`
- `GET /ai/models/most-expensive`
- `GET /ai/models/pricing-summary`
- `POST /ai/process` → non-streaming AI request
- `POST /ai/process/stream` → returns WS session info
- `POST /ai/process/batch`
- `GET /ai/process/status/:requestId`
- `POST /ai/stream/start`
- `POST /ai/stream/stop`
- `GET /ai/stream/sessions`
- `GET /ai/stream/sessions/:sessionId`
- `GET /ai/stream/stats`
- `GET /ai/stream/health`
- `POST /ai/stream/control`

## Client Service (hub/client)

Base URL: `CLIENT_SERVICE_URL`

- `GET /health` → `HealthResponse`
- `POST /api/token` / `/.proxy/api/token` (forwards to database service)
- `GET /api/config` / `/.proxy/api/config`
- `GET /api/launcher-data` / `/.proxy/api/launcher-data`
- `POST /api/games/records/update` / `/.proxy/api/games/records/update`

---

Next: expand DTOs for each endpoint and map request/response payloads as we migrate.
