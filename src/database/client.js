import { PrismaClient } from "@prisma/client";
import Redis from "ioredis";

const CACHE_PREFIX = "eleazar:";

// Utility function to handle BigInt serialization
function serializeWithBigInt(data) {
  return JSON.stringify(data, (_, value) => {
    if (typeof value === "bigint") {
      return { type: "BigInt", value: value.toString() };
    }
    // Handle Prisma Decimal type
    if (value?.type === "Decimal") {
      return { type: "Decimal", value: value.toString() };
    }
    return value;
  });
}

function deserializeWithBigInt(jsonString) {
  return JSON.parse(jsonString, (_, value) => {
    if (value && typeof value === "object") {
      if (value.type === "BigInt") {
        try {
          return BigInt(value.value);
        } catch {
          console.warn("Failed to parse BigInt:", value.value);
          return value.value;
        }
      }
      if (value.type === "Decimal") {
        return value.value;
      }
    }
    return value;
  });
}

export const COOLDOWNS = {
  daily: 24 * 60 * 60 * 1000, // 24 hours
  work: 4 * 60 * 60 * 1000, // 4 hours
  crime: 8 * 60 * 60 * 1000, // 8 hours
  message: 60 * 1000, // 1 minute
};

export const UPGRADES = {
  daily: {
    emoji: "🎁",
    basePrice: 20,
    priceMultiplier: 1.5,
    effectMultiplier: 0.15, // 15% increase starting from level 2
  },
  crime: {
    emoji: "🦹",
    basePrice: 50,
    priceMultiplier: 1.2,
    effectValue: 20 * 60 * 1000, // 20 minutes reduction per level
  },
};

export const DEFAULT_VALUES = {
  user: {
    balance: 0,
    xp: 0,
    bannerUrl: null,
    lastActivity: Date.now(),
  },
  economy: {
    balance: 0,
    bankBalance: 0,
    bankRate: 0,
    bankStartTime: 0,
  },
  stats: {
    messageCount: 0,
    commandCount: 0,
    totalEarned: 0,
  },
  cooldowns: {},
  upgrades: {
    daily: { level: 1 },
    crime: { level: 1 },
  },
  ping: {
    music: { players: 0, ping: 0 },
    render: { recentRequests: 0, ping: 0 },
    database: { averageSpeed: 0, ping: 0, cachingPing: 0 },
  },
  guild: {
    settings: {},
  },
};

class Database {
  constructor() {
    // Initialize Redis client
    this.redis = new Redis({
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT) || 6379,
      keyPrefix: CACHE_PREFIX,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
    });

    // Redis error handling
    this.redis.on("error", (error) => {
      console.error("Redis connection error:", error);
    });

    this.redis.on("ready", () => {
      console.log("Redis connection established");
    });

    this.client = new PrismaClient({
      log:
        process.env.NODE_ENV === "production" ? ["error"] : ["query", "error"],
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    });

    // Ping collection interval
    this.pingInterval = null;
    this.collectionInterval = 60000; // 1 minute

    // Cache middleware with performance monitoring
    this.client.$use(async (params, next) => {
      const start = Date.now();
      const isReadOperation = ["findUnique", "findFirst", "findMany"].includes(
        params.action
      );

      if (isReadOperation) {
        try {
          // Skip caching for transactions
          if (params.runInTransaction) {
            return next(params);
          }

          // Generate cache key based on query parameters and model relationships
          const cacheKey = `${params.model}:${params.action}:${
            params.args?.include
              ? `${JSON.stringify(params.args)}:include:${JSON.stringify(
                  params.args.include
                )}`
              : JSON.stringify(params.args)
          }`;

          // Try to get from cache first
          const cached = await this.redis.get(cacheKey);
          if (cached) {
            const duration = Date.now() - start;
            if (duration > 100) {
              console.log(`Cache hit (${duration}ms):`, {
                model: params.model,
                action: params.action,
              });
            }
            return deserializeWithBigInt(cached);
          }

          // If not in cache, query database
          const result = await next(params);
          const duration = Date.now() - start;

          // Cache the result if it exists with model-specific TTL
          if (result) {
            const modelTTLs = {
              economy: 60, // 1 minute TTL for economy data
              statistics: 300, // 5 minutes TTL for statistics
              user: 300, // 5 minutes TTL for user data
            };
            const ttl = modelTTLs[params.model] || 300; // Default 5 minutes TTL
            await this.redis.setex(cacheKey, ttl, serializeWithBigInt(result));
          }

          if (duration > 500) {
            console.warn(`Slow query (${duration}ms):`, {
              model: params.model,
              action: params.action,
              args: params.args,
              duration,
            });
          }

          return result;
        } catch (error) {
          console.error("Cache operation failed:", error);
          return next(params);
        }
      } else {
        // For write operations, invalidate related cache
        try {
          if (params.model) {
            // Get all related models from the operation
            const relatedModels = new Set([params.model]);
            if (params.args?.include) {
              Object.keys(params.args.include).forEach((model) =>
                relatedModels.add(model.toLowerCase())
              );
            }
            if (params.args?.data?.connect) {
              Object.keys(params.args.data.connect).forEach((model) =>
                relatedModels.add(model.toLowerCase())
              );
            }

            // Invalidate cache for all related models
            for (const model of relatedModels) {
              await this.redis.del(`${model}:*`);
            }
          }
        } catch (error) {
          console.error("Cache invalidation failed:", error);
        }

        // Execute write operation and track performance
        try {
          const result = await next(params);
          const duration = Date.now() - start;

          if (duration > 500) {
            console.warn(`Slow write operation (${duration}ms):`, {
              model: params.model,
              action: params.action,
              args: params.args,
              duration,
            });
          }

          return result;
        } catch (error) {
          const duration = Date.now() - start;
          console.error(
            `Write operation ${params.model}.${params.action} failed after ${duration}ms`,
            {
              error: error.message,
              stack: error.stack,
              params,
            }
          );
          throw error;
        }
      }
    });

    // Error handling middleware with specific error messages
    this.client.$use(async (params, next) => {
      try {
        return await next(params);
      } catch (error) {
        if (error.code) {
          switch (error.code) {
            case "P2002":
              throw new Error(
                `Duplicate entry for ${error.meta?.target?.join(", ")}`
              );
            case "P2025":
              throw new Error("Record not found");
            case "P2003":
              throw new Error("Related record not found");
            default:
              throw error;
          }
        }
        throw error;
      }
    });

    // Handle cleanup
    process.on("beforeExit", async () => {
      await this.disconnect();
      await this.redis.quit();
      process.exit(0);
    });

    process.on("SIGINT", async () => {
      console.log("\nReceived SIGINT. Cleaning up...");
      await this.disconnect();
      await this.redis.quit();
      process.exit(0);
    });

    process.on("SIGTERM", async () => {
      console.log("\nReceived SIGTERM. Cleaning up...");
      await this.disconnect();
      await this.redis.quit();
      process.exit(0);
    });

    process.on("uncaughtException", async (error) => {
      console.error("Uncaught Exception:", error);
      await this.disconnect();
      process.exit(1);
    });

    process.on("unhandledRejection", async (error) => {
      console.error("Unhandled Rejection:", error);
      await this.disconnect();
      process.exit(1);
    });
  }

  async initialize() {
    try {
      await this.client.$connect();
      console.log("Database connection initialized successfully");
      await this.initializeModules();
      return this;
    } catch (error) {
      console.error("Failed to initialize database connection:", error);
      throw error;
    }
  }

  async disconnect() {
    try {
      await this.client.$disconnect();
      await this.redis.quit();
      console.log("Database and Redis connections closed successfully");
    } catch (error) {
      console.error("Error disconnecting from database:", error);
      throw error;
    }
  }

  getAllMethods(obj) {
    return Object.getOwnPropertyNames(obj).filter(
      (item) => typeof obj[item] === "function" && item !== "default"
    );
  }

  async initializeModules() {
    try {
      const fs = await import("fs");
      const path = await import("path");

      const dirname = path.dirname(new URL(import.meta.url).pathname);
      const files = await fs.promises.readdir(dirname);
      const moduleFiles = files.filter(
        (file) =>
          file.endsWith(".js") && file !== "client.js" && !file.startsWith(".")
      );

      // Import and initialize each module
      for (const file of moduleFiles) {
        const module = await import(`./${file}`);
        this.getAllMethods(module.default).forEach((method) => {
          this[method] = module.default[method];
        });
        console.log(`Module for DB "${file}" initialized successfully`);
      }
    } catch (error) {
      console.error("Error initializing modules:", error);
      throw error;
    }
  }
}

export default new Database();
