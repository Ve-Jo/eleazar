# Bot Sharding Implementation Checklist

This checklist mirrors the sharding plan and tracks completion status in-repo.

## Phase 0 — Baseline & Guardrails

- [x] Add hubClient route-level latency/error metrics
- [x] Add per-event timing metrics (`interactionCreate`, `messageCreate`, AI mention, reminder loop)
- [ ] Capture p95/p99 baselines for command/message paths
- [ ] Define and document SLO targets for 1000+ guilds

## Phase 1 — Sharding Bootstrap

- [x] Add dedicated sharding launcher (`bot/launcher.ts`)
- [x] Route bot startup through launcher (`package.json`)
- [x] Add shard-aware startup logging (`shard`, `leader`)
- [x] Gate slash command registration to leader shard
- [x] Gate one-time startup tasks (DB health/reminders) to leader shard
- [ ] Validate shard spawn strategy and failure recovery in staging

## Phase 2 — Redis Shared State (Critical)

- [x] Add bot runtime Redis module (`runtimeRedis.ts`)
- [x] Implement Redis command cooldown keys with TTL + atomic `SET NX PX`
- [x] Keep in-memory fallback for non-guild/Redis-unavailable paths
- [x] Add distributed lock acquire/release primitives
- [x] Use distributed lock in daily reminder loop
- [x] Move AI pending interaction/session state from memory to Redis
- [ ] Add explicit Redis outage/degrade behavior docs

## Phase 3 — Hot-Path API Optimization

- [x] Remove duplicate guild settings fetch in `message.ts` XP path
- [x] Batch/compose high-frequency hub calls where possible
- [x] Parallelize independent hub calls in message/interaction handlers
- [x] Add bounded retry/backoff policy in bot hub client
- [ ] Design safe hub/database Redis cache re-introduction track

## Phase 4 — Background Job Hardening

- [x] Prevent duplicate `dailyCrateReminders` execution with Redis lock
- [x] Add jittered reminder schedule
- [x] Paginate/chunk reminder sweep instead of full in-memory traversal
- [x] Enforce strict idempotency in reminder send/mark path

## Phase 5 — Command/Localization Registration Safety

- [x] Ensure command registration only runs on leader shard
- [x] Add command schema hash diffing to skip no-op global updates
- [x] Reduce startup localization sync pressure (leader-only/one-time strategy)

## Phase 6 — Capacity Validation & Rollout

- [ ] Run shard-mode staging load tests (target: 1000 guild profile)
- [ ] Canary rollout with shard subset in production
- [ ] Complete full rollout with monitoring and rollback toggles

## Current Env Expectations

- `SHARDING_ENABLED=true|false`
- `TOTAL_SHARDS=auto|<number>`
- `BOT_REDIS_URL` (or fallback to `REDIS_URL`)
- `BOT_REDIS_DB` (optional, defaults to `REDIS_DB` or `0`)
- `BOT_REDIS_PREFIX` (optional, defaults to `bot`)
