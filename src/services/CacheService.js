import Redis from "ioredis";
import { DEFAULT_VALUES } from "../utils/economy.js";

class CacheService {
  constructor() {
    this.redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      retryStrategy: (times) => Math.min(times * 50, 2000),
    });

    // Event handlers
    this.redis.on("connect", () => console.log("Redis connection established"));
    this.redis.on("error", (err) => console.error("Redis error:", err));
    this.redis.on("ready", () => console.log("Redis client ready"));
    this.redis.on("reconnecting", () =>
      console.log("Redis client reconnecting")
    );
    this.redis.on("end", () => console.log("Redis connection ended"));

    // TTLs in seconds
    this.TTL = {
      USER: 60, // Reduced from 300 to 60 seconds
      COOLDOWN: 60,
      LEADERBOARD: 300,
    };

    this.PREFIXES = {
      USER: "user:",
      COOLDOWN: "cd:",
      LEADERBOARD: "lb:",
      VERSION: "version:", // Add version tracking
    };
  }

  // Key generators
  getUserKey(guildId, userId) {
    return `${this.PREFIXES.USER}${guildId}:${userId}`;
  }

  getCooldownKey(guildId, userId, type) {
    return `${this.PREFIXES.COOLDOWN}${guildId}:${userId}:${type}`;
  }

  getLeaderboardKey(guildId) {
    return `${this.PREFIXES.LEADERBOARD}${guildId}`;
  }

  // Cache operations
  async get(key) {
    try {
      const data = await this.redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error("Cache get error:", error);
      return null;
    }
  }

  async set(key, value, ttl = null) {
    try {
      const serialized = JSON.stringify(this.convertBigIntToNumber(value));
      if (ttl) {
        await this.redis.setex(key, ttl, serialized);
      } else {
        await this.redis.set(key, serialized);
      }
      return true;
    } catch (error) {
      console.error("Cache set error:", error);
      return false;
    }
  }

  async del(key) {
    try {
      await this.redis.del(key);
      return true;
    } catch (error) {
      console.error("Cache delete error:", error);
      return false;
    }
  }

  // Type conversion
  convertBigIntToNumber(value) {
    if (typeof value === "bigint") {
      return Number(value);
    }
    if (Array.isArray(value)) {
      return value.map(this.convertBigIntToNumber.bind(this));
    }
    if (typeof value === "object" && value !== null) {
      const converted = {};
      for (const key in value) {
        converted[key] = this.convertBigIntToNumber(value[key]);
      }
      return converted;
    }
    return value;
  }

  // Version tracking for cache invalidation
  async getVersion(guildId, userId) {
    const key = `${this.PREFIXES.VERSION}${guildId}:${userId}`;
    const version = await this.redis.get(key);
    return version ? parseInt(version) : 0;
  }

  async incrementVersion(guildId, userId) {
    const key = `${this.PREFIXES.VERSION}${guildId}:${userId}`;
    return await this.redis.incr(key);
  }

  // Modified user caching with version tracking
  async getUser(guildId, userId) {
    try {
      const key = this.getUserKey(guildId, userId);
      const data = await this.get(key);

      if (!data) {
        console.log("Cache miss for user:", { guildId, userId });
        return null;
      }

      // Check if version matches
      const currentVersion = await this.getVersion(guildId, userId);
      console.log("Cache version check:", {
        guildId,
        userId,
        cachedVersion: data._version,
        currentVersion,
      });

      if (data._version !== currentVersion) {
        console.log("Cache version mismatch, invalidating:", {
          guildId,
          userId,
          cachedVersion: data._version,
          currentVersion,
        });
        await this.invalidateUser(guildId, userId);
        return null;
      }

      delete data._version;
      return data;
    } catch (error) {
      console.error("Error in getUser:", error);
      return null;
    }
  }

  async setUser(guildId, userId, userData) {
    try {
      const key = this.getUserKey(guildId, userId);
      const version = await this.getVersion(guildId, userId);

      console.log("Setting user data in cache:", {
        guildId,
        userId,
        version,
        hasData: !!userData,
      });

      if (!userData) {
        console.log("No user data to cache");
        return false;
      }

      // Add version to cached data
      const dataToCache = {
        ...userData,
        _version: version,
      };

      const result = await this.set(key, dataToCache, this.TTL.USER);
      console.log("Cache set result:", { guildId, userId, success: result });
      return result;
    } catch (error) {
      console.error("Error in setUser:", error);
      return false;
    }
  }

  async invalidateUser(guildId, userId) {
    try {
      console.log("Invalidating user cache:", { guildId, userId });
      const key = this.getUserKey(guildId, userId);
      await this.incrementVersion(guildId, userId);
      const result = await this.del(key);
      console.log("Cache invalidation result:", {
        guildId,
        userId,
        success: result,
      });
      return result;
    } catch (error) {
      console.error("Error in invalidateUser:", error);
      return false;
    }
  }

  // Cooldown caching
  async getCooldown(guildId, userId, type) {
    const key = this.getCooldownKey(guildId, userId, type);
    return await this.get(key);
  }

  async setCooldown(guildId, userId, type, timestamp) {
    const key = this.getCooldownKey(guildId, userId, type);
    return await this.set(key, timestamp, this.TTL.COOLDOWN);
  }

  // Leaderboard caching
  async getLeaderboard(guildId) {
    const key = this.getLeaderboardKey(guildId);
    return await this.get(key);
  }

  async setLeaderboard(guildId, leaderboardData) {
    const key = this.getLeaderboardKey(guildId);
    return await this.set(key, leaderboardData, this.TTL.LEADERBOARD);
  }

  // Batch operations
  async mget(keys) {
    try {
      const values = await this.redis.mget(keys);
      return values.map((v) => (v ? JSON.parse(v) : null));
    } catch (error) {
      console.error("Cache mget error:", error);
      return keys.map(() => null);
    }
  }

  // Clear all cache
  async flush() {
    try {
      await this.redis.flushdb();
      return true;
    } catch (error) {
      console.error("Cache flush error:", error);
      return false;
    }
  }
}

export default new CacheService();
