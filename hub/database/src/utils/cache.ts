import { createClient, type RedisClientType } from "redis";

// Redis client instance
let redisClient: RedisClientType | null = null;
let isConnected = false;

// Cache TTLs (in seconds)
const CACHE_TTLS = {
  default: 300, // 5 minutes
  user: 600, // 10 minutes
  guild: 900, // 15 minutes
  crates: 1800, // 30 minutes
  cooldowns: 60, // 1 minute
  economy: 300, // 5 minutes
  leaderboard: 120, // 2 minutes
};

// Initialize Redis connection
async function initializeRedis() {
  if (redisClient && isConnected) return redisClient;

  try {
    redisClient = createClient({
      url: process.env.REDIS_URL || "redis://localhost:6379",
    });

    redisClient.on("error", (err) => {
      console.error("[Redis] Error:", err);
      isConnected = false;
    });

    redisClient.on("connect", () => {
      console.log("[Redis] Connected successfully");
      isConnected = true;
    });

    redisClient.on("disconnect", () => {
      console.log("[Redis] Disconnected");
      isConnected = false;
    });

    await redisClient.connect();
    return redisClient;
  } catch (error) {
    console.error("[Redis] Failed to initialize:", error);
    redisClient = null;
    isConnected = false;
    return null;
  }
}

async function getFromCache(key: string): Promise<any> {
  if (!redisClient || !isConnected) {
    await initializeRedis();
  }
  
  if (!redisClient || !isConnected) {
    return null;
  }

  try {
    const value = await redisClient.get(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    console.error("[Redis] Get error:", error);
    return null;
  }
}

async function setCache(
  key: string,
  value: unknown,
  ttl: number | null = null
): Promise<boolean> {
  if (!redisClient || !isConnected) {
    await initializeRedis();
  }
  
  if (!redisClient || !isConnected) {
    return false;
  }

  try {
    const serializedValue = JSON.stringify(value);
    const cacheTtl = typeof ttl === "number" ? ttl : CACHE_TTLS.default;
    
    if (cacheTtl > 0) {
      await redisClient.setEx(key, cacheTtl, serializedValue);
    } else {
      await redisClient.set(key, serializedValue);
    }
    
    return true;
  } catch (error) {
    console.error("[Redis] Set error:", error);
    return false;
  }
}

async function invalidateCache(keys: string[]): Promise<boolean> {
  if (!redisClient || !isConnected) {
    await initializeRedis();
  }
  
  if (!redisClient || !isConnected) {
    return false;
  }

  try {
    if (keys.length === 0) return true;
    
    // Filter out undefined keys and ensure all keys are strings
    const validKeys = keys.filter(
      (candidate): candidate is string =>
        typeof candidate === "string" && candidate.length > 0
    );
    if (validKeys.length === 0) return true;
    
    if (validKeys.length === 1) {
      const singleKey = validKeys[0];
      if (!singleKey) return true;
      await redisClient.del(singleKey);
    } else {
      await redisClient.del(validKeys);
    }
    
    return true;
  } catch (error) {
    console.error("[Redis] Invalidate error:", error);
    return false;
  }
}

async function deleteFromCache(key: string): Promise<boolean> {
  if (!redisClient || !isConnected) {
    await initializeRedis();
  }
  
  if (!redisClient || !isConnected) {
    return false;
  }

  try {
    await redisClient.del(key);
    return true;
  } catch (error) {
    console.error("[Redis] Delete error:", error);
    return false;
  }
}

// Helper functions for cache key generation
export const CacheKeys = {
  user: (guildId: string, userId: string) => `user:${guildId}:${userId}`,
  guild: (guildId: string) => `guild:${guildId}`,
  crates: (guildId: string, userId: string) => `crates:${guildId}:${userId}`,
  cooldowns: (guildId: string, userId: string) => `cooldowns:${guildId}:${userId}`,
  economy: (guildId: string, userId: string) => `economy:${guildId}:${userId}`,
  leaderboard: (guildId: string, type: string) => `leaderboard:${guildId}:${type}`,
  balance: (guildId: string, userId: string) => `balance:${guildId}:${userId}`,
  level: (guildId: string, userId: string) => `level:${guildId}:${userId}`,
};

export { 
  getFromCache, 
  setCache, 
  invalidateCache, 
  deleteFromCache,
  initializeRedis,
  CACHE_TTLS
};
