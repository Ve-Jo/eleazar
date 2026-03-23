# Redis Outage and Degradation Behavior

This document describes how the bot handles Redis unavailability and degradation scenarios in sharded deployments.

## Overview

The bot uses Redis for:
- **Distributed locking** (reminder loops, leader-only tasks)
- **Command cooldowns** (atomic SET NX PX with TTL)
- **AI pending interactions** (cross-shard state sharing)
- **Idempotency keys** (reminder send tracking)

All Redis-dependent features implement graceful degradation to in-memory fallbacks when Redis is unavailable.

## Connection Behavior

### Initial Connection
- Redis client attempts connection on first feature request
- Connection failures are logged but don't block bot startup
- Failed connections result in `redisReady = false`, triggering fallback mode

### Reconnection
- Automatic reconnection with exponential backoff: `min(100 + retries * 50, 3000)` ms
- Connection state tracked via event handlers (`connect`, `end`, `error`)

## Feature-Specific Degradation

### 1. Distributed Locks

**Normal Operation:**
- `acquireDistributedLock()` uses Redis SET NX PX for atomic lock acquisition
- `releaseDistributedLock()` uses Lua script for safe lock release

**Degraded Mode (Redis unavailable):**
- Locks immediately return `{ acquired: true, token: null }`
- **Risk:** Multiple shards may execute leader-only tasks simultaneously
- **Mitigation:** DB-level uniqueness constraints, idempotency checks

### 2. Command Cooldowns

**Normal Operation:**
- `checkAndSetCommandCooldown()` uses atomic SET NX PX
- Returns `{ allowed: false, retryAfterMs }` if key exists

**Degraded Mode (Redis unavailable):**
- Immediately returns `{ allowed: true, retryAfterMs: 0 }`
- **Risk:** Cooldown enforcement bypassed, potential command spam
- **Mitigation:** In-memory cooldowns for critical paths, rate limiting at Discord API level

### 3. AI Pending Interactions

**Normal Operation:**
- `setPendingInteraction()` stores in Redis with 5-minute TTL
- `getPendingInteraction()` retrieves from Redis first
- Cross-shard access enabled

**Degraded Mode (Redis unavailable):**
- Falls back to in-memory `pendingInteractionsMemory` object
- **Risk:** Model selection state not shared across shards
- **Impact:** User must complete model selection on same shard that received the message
- **Mitigation:** 5-minute TTL on memory entries prevents indefinite leaks

### 4. Reminder Idempotency

**Normal Operation:**
- `checkReminderIdempotency()` uses SET NX to track sent reminders
- 24-hour TTL prevents duplicate sends

**Degraded Mode (Redis unavailable):**
- Immediately returns `true` (allow send)
- **Risk:** Duplicate reminders possible if lock lost between shards
- **Mitigation:** DB-level `reminderEligible` flag provides secondary check

## Monitoring and Alerting

### Log Patterns
```
[runtimeRedis] REDIS_URL/BOT_REDIS_URL is not set; using in-memory fallbacks
[runtimeRedis] failed to initialize, using in-memory fallback: <error>
[runtimeRedis] client error: <error>
[runtimeRedis] disconnected
```

### Metrics to Track
- `runtime_redis_connected` - Boolean gauge
- `runtime_redis_fallback_activations` - Counter by feature
- `runtime_redis_operation_errors` - Counter by operation type

## Recovery Procedure

### Redis Outage
1. Bot continues operating in degraded mode
2. Monitor logs for fallback activation messages
3. No immediate action required - automatic reconnection attempts continue

### Redis Recovery
1. Automatic reconnection on next operation attempt
2. `[runtimeRedis] connected` log message
3. Features automatically resume normal operation
4. In-memory fallback data is **not** synced to Redis (by design)

### Manual Failover
If Redis is permanently unavailable:
1. Set `BOT_REDIS_URL` to empty or invalid value
2. Bot operates in full fallback mode
3. **Limitation:** Leader-only tasks may duplicate across shards
4. **Recommendation:** Use single-shard deployment or external coordination

## Configuration

### Environment Variables
```bash
# Required for Redis features
BOT_REDIS_URL=redis://localhost:6379
BOT_REDIS_DB=0              # Optional, defaults to 0
BOT_REDIS_PREFIX=bot        # Optional, defaults to "bot"

# Fallback chain: BOT_REDIS_URL -> REDIS_URL -> null (fallback mode)
```

### Shard-Specific Considerations
- Each shard maintains independent Redis connection
- No cross-shard Redis key conflicts (keys prefixed with `bot:` or custom prefix)
- Lock tokens include process ID for uniqueness

## Testing Degradation

To simulate Redis outage in development:
```typescript
// Force fallback mode
process.env.BOT_REDIS_URL = "";

// Or block Redis port temporarily
// Bot will detect connection failure and activate fallbacks
```

## Future Improvements

- Add Redis Sentinel support for HA
- Implement circuit breaker pattern for Redis operations
- Add metrics export for monitoring dashboards
- Consider Redis Cluster for horizontal scaling
