import { createClient, type RedisClientType } from "redis";

type CooldownResult = {
  allowed: boolean;
  retryAfterMs: number;
};

type LockResult = {
  acquired: boolean;
  token: string | null;
};

let redisClient: RedisClientType | null = null;
let redisReady = false;
let redisInitAttempted = false;

function getRedisUrl(): string | null {
  return process.env.BOT_REDIS_URL || process.env.REDIS_URL || null;
}

async function getRuntimeRedisClient(): Promise<RedisClientType | null> {
  if (redisReady && redisClient) {
    return redisClient;
  }

  if (redisInitAttempted) {
    return null;
  }

  const redisUrl = getRedisUrl();
  if (!redisUrl) {
    redisInitAttempted = true;
    console.warn("[runtimeRedis] REDIS_URL/BOT_REDIS_URL is not set; using in-memory fallbacks");
    return null;
  }

  redisInitAttempted = true;

  try {
    redisClient = createClient({
      url: redisUrl,
      password: process.env.REDIS_PASSWORD || undefined,
      database: parseInt(process.env.BOT_REDIS_DB || process.env.REDIS_DB || "0", 10),
      socket: {
        reconnectStrategy: (retries: number) => Math.min(100 + retries * 50, 3000),
      },
    });

    redisClient.on("error", (error: unknown) => {
      redisReady = false;
      console.error("[runtimeRedis] client error:", error);
    });

    redisClient.on("connect", () => {
      redisReady = true;
      console.log("[runtimeRedis] connected");
    });

    redisClient.on("end", () => {
      redisReady = false;
      console.warn("[runtimeRedis] disconnected");
    });

    await redisClient.connect();
    redisReady = true;
    return redisClient;
  } catch (error) {
    redisReady = false;
    redisClient = null;
    console.error("[runtimeRedis] failed to initialize, using in-memory fallback:", error);
    return null;
  }
}

function buildPrefixedKey(key: string): string {
  const prefix = process.env.BOT_REDIS_PREFIX || "bot";
  return `${prefix}:${key}`;
}

async function checkAndSetCommandCooldown(
  guildId: string,
  userId: string,
  commandKey: string,
  cooldownMs: number
): Promise<CooldownResult> {
  const client = await getRuntimeRedisClient();
  if (!client || cooldownMs <= 0) {
    return {
      allowed: true,
      retryAfterMs: 0,
    };
  }

  const key = buildPrefixedKey(`cooldown:${guildId}:${userId}:${commandKey}`);

  try {
    const result = await client.set(key, Date.now().toString(), {
      PX: cooldownMs,
      NX: true,
    });

    if (result === "OK") {
      return {
        allowed: true,
        retryAfterMs: 0,
      };
    }

    const ttl = await client.pTTL(key);
    return {
      allowed: false,
      retryAfterMs: Math.max(ttl, 0),
    };
  } catch (error) {
    console.error("[runtimeRedis] cooldown operation failed, allowing fallback path:", error);
    return {
      allowed: true,
      retryAfterMs: 0,
    };
  }
}

function generateLockToken(): string {
  return `${process.pid}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

async function acquireDistributedLock(lockName: string, ttlMs: number): Promise<LockResult> {
  const client = await getRuntimeRedisClient();
  if (!client) {
    return { acquired: true, token: null };
  }

  const token = generateLockToken();
  const key = buildPrefixedKey(`locks:${lockName}`);

  try {
    const result = await client.set(key, token, {
      PX: ttlMs,
      NX: true,
    });

    return {
      acquired: result === "OK",
      token: result === "OK" ? token : null,
    };
  } catch (error) {
    console.error("[runtimeRedis] lock acquire failed:", error);
    return { acquired: false, token: null };
  }
}

async function releaseDistributedLock(lockName: string, token: string | null): Promise<void> {
  if (!token) {
    return;
  }

  const client = await getRuntimeRedisClient();
  if (!client) {
    return;
  }

  const key = buildPrefixedKey(`locks:${lockName}`);

  try {
    const script = `
      if redis.call("GET", KEYS[1]) == ARGV[1] then
        return redis.call("DEL", KEYS[1])
      else
        return 0
      end
    `;

    await client.eval(script, {
      keys: [key],
      arguments: [token],
    });
  } catch (error) {
    console.error("[runtimeRedis] lock release failed:", error);
  }
}

function getShardId(client: unknown): number {
  const typedClient = client as {
    shard?: {
      ids?: number[];
    };
  };

  return typedClient.shard?.ids?.[0] ?? 0;
}

function isLeaderShard(client: unknown): boolean {
  return getShardId(client) === 0;
}

// In-memory fallback for AI pending interactions
const pendingInteractionsMemory: Record<string, unknown> = {};

/**
 * Store a pending AI interaction for a user (used during model selection flow).
 * In sharded mode, this is stored in Redis so any shard can retrieve it.
 * Falls back to in-memory if Redis is unavailable.
 */
async function setPendingInteraction(
  userId: string,
  message: unknown,
  ttlMs: number = 5 * 60 * 1000
): Promise<void> {
  const client = await getRuntimeRedisClient();
  const key = buildPrefixedKey(`ai:pending:${userId}`);

  if (client) {
    try {
      await client.set(key, JSON.stringify(message), { PX: ttlMs });
      return;
    } catch (error) {
      console.error("[runtimeRedis] setPendingInteraction failed, using memory fallback:", error);
    }
  }

  // Fallback to in-memory
  pendingInteractionsMemory[userId] = message;
  setTimeout(() => {
    delete pendingInteractionsMemory[userId];
  }, ttlMs);
}

/**
 * Retrieve a pending AI interaction for a user.
 * Returns null if not found or expired.
 */
async function getPendingInteraction(userId: string): Promise<unknown | null> {
  const client = await getRuntimeRedisClient();
  const key = buildPrefixedKey(`ai:pending:${userId}`);

  if (client) {
    try {
      const data = await client.get(key);
      if (data) {
        return JSON.parse(data);
      }
      return null;
    } catch (error) {
      console.error("[runtimeRedis] getPendingInteraction failed, checking memory fallback:", error);
    }
  }

  // Fallback to in-memory
  return pendingInteractionsMemory[userId] || null;
}

/**
 * Delete a pending AI interaction after it's been used.
 */
async function deletePendingInteraction(userId: string): Promise<void> {
  const client = await getRuntimeRedisClient();
  const key = buildPrefixedKey(`ai:pending:${userId}`);

  if (client) {
    try {
      await client.del(key);
      return;
    } catch (error) {
      console.error("[runtimeRedis] deletePendingInteraction failed:", error);
    }
  }

  // Also clear from memory fallback
  delete pendingInteractionsMemory[userId];
}

/**
 * Check if a pending interaction exists for a user.
 */
async function hasPendingInteraction(userId: string): Promise<boolean> {
  const client = await getRuntimeRedisClient();
  const key = buildPrefixedKey(`ai:pending:${userId}`);

  if (client) {
    try {
      const exists = await client.exists(key);
      return exists === 1;
    } catch (error) {
      console.error("[runtimeRedis] hasPendingInteraction failed:", error);
    }
  }

  return userId in pendingInteractionsMemory;
}

export {
  checkAndSetCommandCooldown,
  acquireDistributedLock,
  releaseDistributedLock,
  getShardId,
  isLeaderShard,
  setPendingInteraction,
  getPendingInteraction,
  deletePendingInteraction,
  hasPendingInteraction,
  getRuntimeRedisClient,
  buildPrefixedKey,
};
