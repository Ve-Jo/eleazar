import Redis from "ioredis";
import { DEFAULT_VALUES } from "../utils/economy.js";

class CacheService {
  constructor() {
    this.redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    this.redis.on("connect", () => {
      console.log("Redis connection established successfully");
    });

    this.redis.on("error", (err) => {
      console.error("Redis connection error:", err);
    });

    this.redis.on("ready", () => {
      console.log("Redis client ready");
    });

    this.redis.on("reconnecting", () => {
      console.log("Redis client reconnecting");
    });

    this.redis.on("end", () => {
      console.log("Redis client connection ended");
    });

    // Default TTLs in seconds
    this.TTL = {
      USER: 300 * 60, // 5 minutes -> 300 seconds
      GUILD: 600 * 60, // 10 minutes -> 600 seconds
      COOLDOWN: 60 * 60, // 1 minute -> 60 seconds
      UPGRADE: 1800 * 60, // 30 minutes -> 1800 seconds
      LEADERBOARD: 300 * 60, // 5 minutes -> 300 seconds
    };

    this.PREFIXES = {
      USER: "user:",
      GUILD: "guild:",
      COOLDOWN: "cooldown:",
      UPGRADE: "upgrade:",
      LEADERBOARD: "leaderboard:",
    };
  }

  // Key generators
  getUserKey(guildId, userId) {
    return `${this.PREFIXES.USER}${guildId}:${userId}`;
  }

  getGuildKey(guildId) {
    return `${this.PREFIXES.GUILD}${guildId}`;
  }

  getCooldownKey(guildId, userId, type) {
    return `${this.PREFIXES.COOLDOWN}${guildId}:${userId}:${type}`;
  }

  getUpgradeKey(guildId, userId) {
    return `${this.PREFIXES.UPGRADE}${guildId}:${userId}`;
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
      // Convert BigInt to Number before serialization
      const convertBigIntToNumber = (obj) => {
        if (typeof obj === "bigint") {
          return Number(obj);
        }
        if (Array.isArray(obj)) {
          return obj.map(convertBigIntToNumber);
        }
        if (typeof obj === "object" && obj !== null) {
          const converted = {};
          for (const key in obj) {
            converted[key] = convertBigIntToNumber(obj[key]);
          }
          return converted;
        }
        return obj;
      };

      const convertedValue = convertBigIntToNumber(value);
      const serialized = JSON.stringify(convertedValue);

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

  // User caching
  async getUser(guildId, userId) {
    const key = this.getUserKey(guildId, userId);
    return await this.get(key);
  }

  async setUser(guildId, userId, userData) {
    const key = this.getUserKey(guildId, userId);
    return await this.set(key, userData, this.TTL.USER);
  }

  async invalidateUser(guildId, userId) {
    const key = this.getUserKey(guildId, userId);
    return await this.del(key);
  }

  // Guild caching
  async getGuild(guildId) {
    const key = this.getGuildKey(guildId);
    return await this.get(key);
  }

  async setGuild(guildId, guildData) {
    const key = this.getGuildKey(guildId);
    return await this.set(key, guildData, this.TTL.GUILD);
  }

  async invalidateGuild(guildId) {
    const key = this.getGuildKey(guildId);
    return await this.del(key);
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

  // Upgrade caching
  async getUpgrades(guildId, userId) {
    const key = this.getUpgradeKey(guildId, userId);
    return await this.get(key);
  }

  async setUpgrades(guildId, userId, upgrades) {
    const key = this.getUpgradeKey(guildId, userId);
    return await this.set(key, upgrades, this.TTL.UPGRADE);
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
