import { createClient } from "redis";
import { logger } from "../utils/logger.js";
import {
  recordModelCacheHit,
  recordModelCacheMiss,
} from "../middleware/metrics.js";

class CacheService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.defaultTTL = parseInt(process.env.MODEL_CACHE_TTL || "600000"); // 10 minutes
    this.maxSize = parseInt(process.env.MAX_MODEL_CACHE_SIZE || "1000");
  }

  async initialize() {
    try {
      logger.info("Initializing Redis cache service...");

      this.client = createClient({
        url: process.env.REDIS_URL || "redis://localhost:6379",
        password: process.env.REDIS_PASSWORD || undefined,
        database: parseInt(process.env.REDIS_DB || "0"),
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              logger.error("Redis connection failed after 10 retries");
              return new Error("Too many retries");
            }
            return Math.min(retries * 100, 3000);
          },
        },
      });

      // Handle Redis events
      this.client.on("error", (err) => {
        logger.error("Redis client error", { error: err.message });
        this.isConnected = false;
      });

      this.client.on("connect", () => {
        logger.info("Redis client connected");
        this.isConnected = true;
      });

      this.client.on("disconnect", () => {
        logger.warn("Redis client disconnected");
        this.isConnected = false;
      });

      this.client.on("reconnecting", () => {
        logger.info("Redis client reconnecting...");
      });

      await this.client.connect();
      logger.info("Cache service initialized successfully");
    } catch (error) {
      logger.error("Failed to initialize cache service", {
        error: error.message,
      });
      throw error;
    }
  }

  async shutdown() {
    try {
      if (this.client) {
        await this.client.disconnect();
        logger.info("Cache service shut down successfully");
      }
    } catch (error) {
      logger.error("Error during cache service shutdown", {
        error: error.message,
      });
      throw error;
    }
  }

  // Basic cache operations
  async get(key) {
    try {
      if (!this.isConnected) {
        logger.warn("Cache get attempted while disconnected", { key });
        return null;
      }

      const value = await this.client.get(key);

      if (value !== null) {
        recordModelCacheHit("redis");
        logger.debug("Cache hit", { key });
      } else {
        recordModelCacheMiss("redis");
        logger.debug("Cache miss", { key });
      }

      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error("Cache get error", { key, error: error.message });
      return null;
    }
  }

  async set(key, value, ttl = this.defaultTTL) {
    try {
      if (!this.isConnected) {
        logger.warn("Cache set attempted while disconnected", { key });
        return false;
      }

      const serializedValue = JSON.stringify(value);
      const result = await this.client.setEx(
        key,
        Math.ceil(ttl / 1000),
        serializedValue
      );

      logger.debug("Cache set", { key, ttl });
      return result === "OK";
    } catch (error) {
      logger.error("Cache set error", { key, error: error.message });
      return false;
    }
  }

  async del(key) {
    try {
      if (!this.isConnected) {
        logger.warn("Cache delete attempted while disconnected", { key });
        return false;
      }

      const result = await this.client.del(key);
      logger.debug("Cache delete", { key, deleted: result > 0 });
      return result > 0;
    } catch (error) {
      logger.error("Cache delete error", { key, error: error.message });
      return false;
    }
  }

  async exists(key) {
    try {
      if (!this.isConnected) {
        return false;
      }

      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error("Cache exists error", { key, error: error.message });
      return false;
    }
  }

  async ttl(key) {
    try {
      if (!this.isConnected) {
        return -2;
      }

      const result = await this.client.ttl(key);
      return result;
    } catch (error) {
      logger.error("Cache TTL error", { key, error: error.message });
      return -2;
    }
  }

  // Hash operations
  async hget(key, field) {
    try {
      if (!this.isConnected) {
        return null;
      }

      const value = await this.client.hGet(key, field);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error("Cache hget error", { key, field, error: error.message });
      return null;
    }
  }

  async hset(key, field, value, ttl = this.defaultTTL) {
    try {
      if (!this.isConnected) {
        return false;
      }

      const serializedValue = JSON.stringify(value);
      const result = await this.client.hSet(key, field, serializedValue);

      // Set TTL on the hash if it's a new field
      if (result === 1 && ttl > 0) {
        await this.client.expire(key, Math.ceil(ttl / 1000));
      }

      return result > 0;
    } catch (error) {
      logger.error("Cache hset error", { key, field, error: error.message });
      return false;
    }
  }

  async hgetall(key) {
    try {
      if (!this.isConnected) {
        return {};
      }

      const hash = await this.client.hGetAll(key);
      const result = {};

      for (const [field, value] of Object.entries(hash)) {
        try {
          result[field] = JSON.parse(value);
        } catch (e) {
          result[field] = value;
        }
      }

      return result;
    } catch (error) {
      logger.error("Cache hgetall error", { key, error: error.message });
      return {};
    }
  }

  async hdel(key, field) {
    try {
      if (!this.isConnected) {
        return false;
      }

      const result = await this.client.hDel(key, field);
      return result > 0;
    } catch (error) {
      logger.error("Cache hdel error", { key, field, error: error.message });
      return false;
    }
  }

  // List operations
  async lpush(key, value, ttl = this.defaultTTL) {
    try {
      if (!this.isConnected) {
        return 0;
      }

      const serializedValue = JSON.stringify(value);
      const result = await this.client.lPush(key, serializedValue);

      if (result === 1 && ttl > 0) {
        await this.client.expire(key, Math.ceil(ttl / 1000));
      }

      return result;
    } catch (error) {
      logger.error("Cache lpush error", { key, error: error.message });
      return 0;
    }
  }

  async rpush(key, value, ttl = this.defaultTTL) {
    try {
      if (!this.isConnected) {
        return 0;
      }

      const serializedValue = JSON.stringify(value);
      const result = await this.client.rPush(key, serializedValue);

      if (result === 1 && ttl > 0) {
        await this.client.expire(key, Math.ceil(ttl / 1000));
      }

      return result;
    } catch (error) {
      logger.error("Cache rpush error", { key, error: error.message });
      return 0;
    }
  }

  async lrange(key, start, stop) {
    try {
      if (!this.isConnected) {
        return [];
      }

      const values = await this.client.lRange(key, start, stop);
      return values.map((value) => {
        try {
          return JSON.parse(value);
        } catch (e) {
          return value;
        }
      });
    } catch (error) {
      logger.error("Cache lrange error", { key, error: error.message });
      return [];
    }
  }

  async llen(key) {
    try {
      if (!this.isConnected) {
        return 0;
      }

      return await this.client.lLen(key);
    } catch (error) {
      logger.error("Cache llen error", { key, error: error.message });
      return 0;
    }
  }

  // Set operations
  async sadd(key, member, ttl = this.defaultTTL) {
    try {
      if (!this.isConnected) {
        return 0;
      }

      const serializedMember = JSON.stringify(member);
      const result = await this.client.sAdd(key, serializedMember);

      if (result === 1 && ttl > 0) {
        await this.client.expire(key, Math.ceil(ttl / 1000));
      }

      return result;
    } catch (error) {
      logger.error("Cache sadd error", { key, error: error.message });
      return 0;
    }
  }

  async smembers(key) {
    try {
      if (!this.isConnected) {
        return [];
      }

      const members = await this.client.sMembers(key);
      return members.map((member) => {
        try {
          return JSON.parse(member);
        } catch (e) {
          return member;
        }
      });
    } catch (error) {
      logger.error("Cache smembers error", { key, error: error.message });
      return [];
    }
  }

  async sismember(key, member) {
    try {
      if (!this.isConnected) {
        return false;
      }

      const serializedMember = JSON.stringify(member);
      return await this.client.sIsMember(key, serializedMember);
    } catch (error) {
      logger.error("Cache sismember error", { key, error: error.message });
      return false;
    }
  }

  // Cache management
  async flushall() {
    try {
      if (!this.isConnected) {
        return false;
      }

      await this.client.flushAll();
      logger.info("Cache flushed");
      return true;
    } catch (error) {
      logger.error("Cache flushall error", { error: error.message });
      return false;
    }
  }

  async keys(pattern = "*") {
    try {
      if (!this.isConnected) {
        return [];
      }

      return await this.client.keys(pattern);
    } catch (error) {
      logger.error("Cache keys error", { pattern, error: error.message });
      return [];
    }
  }

  async info() {
    try {
      if (!this.isConnected) {
        return null;
      }

      const info = await this.client.info();
      return this.parseRedisInfo(info);
    } catch (error) {
      logger.error("Cache info error", { error: error.message });
      return null;
    }
  }

  // Parse Redis INFO output
  parseRedisInfo(info) {
    const result = {};
    const sections = info.split("\r\n\r\n");

    for (const section of sections) {
      const lines = section.split("\r\n");
      let currentSection = null;

      for (const line of lines) {
        if (line.startsWith("# ")) {
          currentSection = line.substring(2).toLowerCase();
          result[currentSection] = {};
        } else if (line.includes(":") && currentSection) {
          const [key, value] = line.split(":");
          result[currentSection][key] = isNaN(value) ? value : Number(value);
        }
      }
    }

    return result;
  }

  // Health check
  async health() {
    try {
      if (!this.isConnected) {
        return {
          status: "disconnected",
          connected: false,
          uptime: 0,
          memory: null,
        };
      }

      const ping = await this.client.ping();
      const info = await this.info();

      return {
        status: ping === "PONG" ? "healthy" : "unhealthy",
        connected: true,
        uptime: info?.server?.uptime_in_seconds || 0,
        memory: {
          used: info?.memory?.used_memory || 0,
          peak: info?.memory?.used_memory_peak || 0,
        },
        connections: info?.clients?.connected_clients || 0,
      };
    } catch (error) {
      logger.error("Cache health check error", { error: error.message });
      return {
        status: "error",
        connected: false,
        error: error.message,
      };
    }
  }

  // Get connection status
  isHealthy() {
    return this.isConnected;
  }
}

export { CacheService };
