import { PrismaClient } from "@prisma/client";
import { createClient } from "redis"; // Use official redis client

export function serializeWithBigInt(data) {
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

export function deserializeWithBigInt(jsonString) {
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
  weekly: 7 * 24 * 60 * 60 * 1000, // 1 week
  work: 3 * 60 * 60 * 1000, // 3 hours
  crime: 2 * 60 * 60 * 1000, // 2 hours
  message: 60 * 1000, // 1 minute
  upgraderevert: 10 * 60 * 1000, // 10 minutes
};

export const CRATE_TYPES = {
  daily: {
    cooldown: 24 * 60 * 60 * 1000, // 24 hours (same as daily cooldown)
    emoji: "🎁",
    rewards: {
      min_coins: 10,
      max_coins: 100,
      xp_chance: 0.5,
      xp_amount: 50,
      discount_chance: 0.3,
      discount_amount: 5, // 5% discount
      cooldown_reducer_chance: 0, // Removed cooldown reducer
      cooldown_reducer_amount: 0, // Removed cooldown reducer
    },
  },
  weekly: {
    cooldown: 7 * 24 * 60 * 60 * 1000, // 7 days
    emoji: "📦",
    rewards: {
      min_coins: 50, // Reduced from 100
      max_coins: 250, // Reduced from 500
      xp_chance: 0.5, // Reduced from 0.7
      xp_amount: 100, // Reduced from 200
      discount_chance: 0.3, // Reduced from 0.5
      discount_amount: 5, // Reduced from 10%
      cooldown_reducer_chance: 0, // Removed cooldown reducer
      cooldown_reducer_amount: 0, // Removed cooldown reducer
    },
  },
  // Add more crate types as needed
};

export const UPGRADES = {
  daily_bonus: {
    emoji: "🎁",
    basePrice: 20,
    priceMultiplier: 1.5,
    effectMultiplier: 0.15, // 15% increase starting from level 2
    category: "economy",
  },
  daily_cooldown: {
    emoji: "⏳",
    basePrice: 50,
    priceMultiplier: 1.4,
    effectValue: 30 * 60 * 1000, // 30 minutes reduction per level
    category: "cooldowns",
  },
  crime: {
    emoji: "🦹",
    basePrice: 50,
    priceMultiplier: 1.2,
    effectValue: 20 * 60 * 1000, // 20 minutes reduction per level
    category: "cooldowns",
  },
  bank_rate: {
    emoji: "💰",
    basePrice: 100,
    priceMultiplier: 1.6,
    effectValue: 0.05, // 5% increase per level
    category: "economy",
  },
  games_earning: {
    emoji: "🎮",
    basePrice: 75,
    priceMultiplier: 1.3,
    effectMultiplier: 0.1, // 10% increase per level
    category: "economy",
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
    daily_bonus: { level: 1 },
    daily_cooldown: { level: 1 },
    crime: { level: 1 },
    bank_rate: { level: 1 },
    games_earning: { level: 1 },
  },
  ping: {
    music: { players: 0, ping: 0 },
    render: { recentRequests: 0, ping: 0 },
    database: { averageSpeed: 0, ping: 0 },
  },
  guild: {
    settings: {},
  },
};

const COLLECTION_INTERVAL = 60000; // 1 minute
const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
const DEFAULT_RETENTION_DAYS = 1; // Keep only 7 days of analytics by default

const BANK_MAX_INACTIVE_DAYS = 2;
const BANK_MAX_INACTIVE_MS = BANK_MAX_INACTIVE_DAYS * 24 * 60 * 60 * 1000;

// --- Retry Configuration ---
const MAX_RETRIES = 5; // Max number of retries
const INITIAL_DELAY_MS = 1000; // Initial delay in ms
const MAX_DELAY_MS = 10000; // Maximum delay in ms

// --- Delay Helper ---
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Define standard cache TTLs (in seconds)
const CACHE_TTL = {
  USER: 60 * 15, // 15 minutes
  COOLDOWN: 60 * 5, // 5 minutes
  LEVEL: 60 * 15, // 15 minutes
  GUILD: 60 * 60, // 1 hour
  STATS: 60 * 15, // 15 minutes
  CRATE: 60 * 30, // 30 minutes
  PLAYER: 60 * 60 * 2, // 2 hours
  SEASON: 60 * 60 * 6, // 6 hours
  VOICE_SESSION: 60 * 5, // 5 minutes
  DEFAULT: 60 * 10, // 10 minutes
};

class Database {
  constructor() {
    this.pingInterval = null;
    this.cleanupInterval = null;
    this.retentionDays = DEFAULT_RETENTION_DAYS;

    // Set up Prisma client with correct configuration
    this.client = new PrismaClient({
      log:
        process.env.NODE_ENV === "production" ? ["error"] : ["query", "error"],
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    });

    // Initialize Redis Client (using node-redis)
    this.redisClient = null;
    try {
      if (process.env.REDIS_URL) {
        this.redisClient = createClient({
          url: process.env.REDIS_URL,
          // Add other node-redis options if needed (e.g., socket timeouts)
        });

        this.redisClient.on("connect", () =>
          console.log("Connecting to Redis...")
        );
        this.redisClient.on("error", (err) =>
          console.error("Redis Connection Error:", err)
        );
        this.redisClient.on("ready", () =>
          console.log("Redis client is ready")
        );

        // Connect the client
        (async () => {
          // IIFE to use async/await for retry logic
          let retries = 0;
          let connected = false;
          while (retries < MAX_RETRIES && !connected) {
            try {
              await this.redisClient.connect();
              connected = true; // Connection successful
              // Ready event should fire after this
            } catch (err) {
              retries++;
              if (retries >= MAX_RETRIES) {
                console.error(
                  `Redis connect failed after ${MAX_RETRIES} retries:`,
                  err
                );
                this.redisClient = null; // Disable caching
                break; // Exit loop
              }
              const delayMs = Math.min(
                INITIAL_DELAY_MS * Math.pow(2, retries - 1),
                MAX_DELAY_MS
              );
              console.warn(
                `Redis connect failed (attempt ${retries}/${MAX_RETRIES}). Retrying in ${delayMs}ms...`
              );
              await delay(delayMs);
            }
          }
          if (!connected) {
            console.error(
              "Failed to connect to Redis after multiple retries. Caching disabled."
            );
            this.redisClient = null;
          }
        })(); // End IIFE
      } else {
        console.warn(
          "REDIS_URL not found in environment variables. Redis caching will be disabled."
        );
        this.redisClient = null; // Explicitly set to null if no URL
      }
    } catch (error) {
      console.error("Failed to initialize Redis client:", error);
      this.redisClient = null;
    }

    // Log connection status in production
    if (process.env.NODE_ENV === "production") {
      console.log("Initializing database with production settings");

      // Middleware to detect and log connection issues
      this.client.$use(async (params, next) => {
        try {
          return await next(params);
        } catch (error) {
          if (error.message && error.message.includes("Connection")) {
            console.error("Database connection issue detected:", error.message);
            // Try to reconnect
            try {
              await this.client.$disconnect();
              await this.client.$connect();
              console.log("Successfully reconnected to database");
            } catch (reconnectError) {
              console.error("Failed to reconnect to database:", reconnectError);
            }
          }
          throw error;
        }
      });
    }

    // Performance monitoring & Retry middleware
    this.client.$use(async (params, next) => {
      let retries = 0;
      const start = Date.now();

      while (retries < MAX_RETRIES) {
        try {
          const result = await next(params);
          const duration = Date.now() - start;

          // Log slow operations (optional)
          if (duration > 500) {
            console.warn(`Slow Prisma operation (${duration}ms):`, {
              model: params.model,
              action: params.action,
              args: params.args,
            });
          }
          return result; // Success, return result
        } catch (error) {
          const duration = Date.now() - start;
          // Check if it's a connection-related error (adjust codes as needed)
          // Common codes: P1001 (Can't reach DB), P1003 (DB does not exist), potentially others
          const isConnectionError =
            (error.code &&
              ["P1000", "P1001", "P1002", "P1003", "P1017"].includes(
                error.code
              )) ||
            (error.message &&
              error.message.toLowerCase().includes("connection"));

          retries++;
          if (!isConnectionError || retries >= MAX_RETRIES) {
            // Not a connection error OR max retries reached, log and re-throw
            console.error(
              `Prisma operation ${params.model}.${params.action} failed after ${duration}ms (Attempt ${retries}/${MAX_RETRIES}):`,
              {
                error: error.message,
                code: error.code,
                stack: error.stack,
                params,
              }
            );
            throw error;
          }

          // Is a connection error and retries remain
          const delayMs = Math.min(
            INITIAL_DELAY_MS * Math.pow(2, retries - 1),
            MAX_DELAY_MS
          );
          console.warn(
            `Prisma operation ${params.model}.${params.action} failed due to connection error (Attempt ${retries}/${MAX_RETRIES}). Retrying in ${delayMs}ms...`
          );
          await delay(delayMs);
        }
      }
      // Should not be reached if loop logic is correct, but throw just in case
      throw new Error(
        `Prisma operation ${params.model}.${params.action} failed definitively after ${MAX_RETRIES} retries.`
      );
    });

    // Error handling middleware with specific error messages
    this.client.$use(async (params, next) => {
      try {
        return await next(params);
      } catch (error) {
        if (error.code) {
          switch (error.code) {
            case "P2002":
              // Special handling for User creation with duplicate user_id
              if (
                params.model === "User" &&
                params.action === "create" &&
                error.meta?.target?.includes("user_id")
              ) {
                console.warn(
                  `Handling duplicate user_id for ${params.args?.data?.id} in guild ${params.args?.data?.guildId}`
                );

                try {
                  // First, check if the user exists in this guild
                  const existingUser = await this.client.user.findUnique({
                    where: {
                      guildId_id: {
                        id: params.args.data.id,
                        guildId: params.args.data.guildId,
                      },
                    },
                    include: params.args.include,
                  });

                  if (existingUser) {
                    console.log(
                      `User already exists in this guild, returning existing user`
                    );
                    return existingUser;
                  }

                  // If it's truly a cross-guild conflict, create with composite ID
                  const compositeId = `${params.args.data.id}_${params.args.data.guildId}`;
                  console.log(
                    `Creating user with composite ID: ${compositeId}`
                  );

                  // Try creating with a modified ID
                  const newArgs = {
                    ...params.args,
                    data: {
                      ...params.args.data,
                      id: compositeId,
                    },
                  };

                  return await this.client[params.model][params.action](
                    newArgs
                  );
                } catch (innerError) {
                  console.error("Error handling duplicate user:", innerError);
                }
              }

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
      process.exit(0);
    });

    process.on("SIGINT", async () => {
      console.log("\nReceived SIGINT. Cleaning up...");
      await this.disconnect();
      process.exit(0);
    });

    process.on("SIGTERM", async () => {
      console.log("\nReceived SIGTERM. Cleaning up...");
      await this.disconnect();
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

  // Initialize Prisma Client and connect
  async initialize() {
    try {
      let retries = 0;
      let connected = false;
      while (retries < MAX_RETRIES && !connected) {
        try {
          await this.client.$connect();
          console.log("Database connection initialized successfully");
          connected = true;
        } catch (error) {
          retries++;
          if (retries >= MAX_RETRIES) {
            console.error(
              `Prisma connect failed after ${MAX_RETRIES} retries:`,
              error
            );
            throw error; // Re-throw after max retries
          }
          const delayMs = Math.min(
            INITIAL_DELAY_MS * Math.pow(2, retries - 1),
            MAX_DELAY_MS
          );
          console.warn(
            `Prisma connect failed (attempt ${retries}/${MAX_RETRIES}). Retrying in ${delayMs}ms...`
          );
          await delay(delayMs);
        }
      }

      if (!connected) {
        throw new Error("Failed to connect to Prisma after multiple retries.");
      }

      /*await this.initializeModules();
       await this.initializeSeason();*/
      return this;
    } catch (error) {
      console.error("Failed to initialize database connection:", error);
      throw error;
    }
  }

  async initializeSeason() {
    try {
      const now = new Date();
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const seasonEnds = nextMonth.getTime() - 1;

      const currentSeason = await this.client.seasons.findUnique({
        where: { id: "current" },
      });

      if (!currentSeason) {
        // First time initialization
        await this.client.seasons.create({
          data: {
            id: "current",
            seasonEnds,
            seasonNumber: 1,
          },
        });
        console.log("First season initialized");
        return;
      }

      // Check if current season has ended
      if (now.getTime() >= currentSeason.seasonEnds) {
        await this.client.seasons.update({
          where: { id: "current" },
          data: {
            seasonEnds,
            seasonNumber: currentSeason.seasonNumber + 1,
          },
        });

        // Reset all season XP
        await this.client.level.updateMany({
          data: { seasonXp: 0n },
        });

        console.log(
          `New season ${
            currentSeason.seasonNumber + 1
          } started, reset all season XP`
        );
      }

      console.log("Season check completed");
    } catch (error) {
      console.error("Error initializing season:", error);
      throw error;
    }
  }

  async checkAndUpdateSeason() {
    /*try {
      const now = new Date();
      let currentSeason = await this.getCurrentSeason(); // Use cached method

      if (!currentSeason || now.getTime() >= currentSeason.seasonEnds) {
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const newSeasonEnds = nextMonth.getTime() - 1;

        await this.client.seasons.upsert({
          where: { id: "current" },
          create: {
            id: "current",
            seasonEnds: newSeasonEnds,
            seasonNumber: 1,
          },
          update: {
            seasonEnds: newSeasonEnds,
            seasonNumber: { increment: 1 },
          },
        });

        // Reset all season XP
        await this.client.level.updateMany({
          data: { seasonXp: 0n },
        });

        console.log("New season started, reset all season XP");
        return true;
      }

      return false;
    } catch (error) {
      console.error("Error checking season:", error);
      throw error;
    }*/
  }

  async getCurrentSeason() {
    const cacheKey = this._cacheKeySeason();

    // 1. Check cache
    if (this.redisClient) {
      try {
        const cachedData = await this._redisGet(cacheKey);
        if (cachedData) {
          return deserializeWithBigInt(cachedData);
        }
      } catch (err) {
        this._logRedis("get", cacheKey, err);
        // Fallback to DB
      }
    }

    // 2. Fetch from DB
    try {
      const season = await this.client.seasons.findUnique({
        where: { id: "current" },
      });

      // 3. Store in cache
      if (season && this.redisClient) {
        try {
          const serializedData = serializeWithBigInt(season);
          await this._redisSet(cacheKey, serializedData, {
            EX: CACHE_TTL.SEASON,
          });
          this._logRedis("set", cacheKey, true);
        } catch (err) {
          this._logRedis("set", cacheKey, err);
        }
      }

      return season;
    } catch (error) {
      console.error("Error getting current season:", error);
      throw error;
    }
  }

  async disconnect() {
    try {
      await this.client.$disconnect();
      if (this.redisClient && this.redisClient.isOpen) {
        await this.redisClient.quit();
        console.log("Redis connection closed successfully");
      }
      console.log("Database connection closed successfully");
    } catch (error) {
      console.error("Error disconnecting from database:", error);
      // Still try to disconnect redis even if prisma fails
      try {
        if (this.redisClient && this.redisClient.isOpen) {
          await this.redisClient.quit();
          console.log("Redis connection closed successfully after DB error.");
        }
      } catch (redisError) {
        console.error("Error disconnecting from Redis:", redisError);
      }
      throw error;
    }
  }

  /*getAllMethods(obj) {
    return Object.getOwnPropertyNames(obj).filter(
      (item) => typeof obj[item] === "function" && item !== "default"
    );
  }*/

  /*async initializeModules() {
    try {
      const fs = await import("fs");
      const path = await import("path");
      const { fileURLToPath } = await import("url");

      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);

      const files = await fs.promises.readdir(__dirname);
      const moduleFiles = files.filter(
        (file) =>
          file.endsWith(".js") && file !== "client.js" && !file.startsWith(".")
      );

      // Import and initialize each module
      // Each module includes a methods for database, for each database table (economy, level, music, guild_user, counter, cooldowns, upgrades, etc in the same folder)
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
  }*/

  async logAnalytics(type, data) {
    try {
      return await this.client.analytics.create({
        data: {
          timestamp: BigInt(Date.now()),
          type,
          data,
        },
      });
    } catch (error) {
      console.error(`Error logging analytics (${type}):`, error);
      // Return empty object instead of failing
      return {};
    }
  }

  async getAnalytics(type, limit = 100) {
    return this.client.analytics.findMany({
      where: { type },
      orderBy: { timestamp: "desc" },
      take: limit,
    });
  }

  // Cleanup old analytics data
  async cleanupOldAnalytics() {
    try {
      console.log("Beginning analytics cleanup...");

      // Get total count first
      const totalCount = await this.client.analytics.count();
      console.log(`Total analytics entries: ${totalCount}`);

      if (totalCount === 0) {
        console.log("No analytics entries to clean up.");
        return;
      }

      // Get the timestamp directly from the database as a string
      // This avoids any BigInt conversion issues
      const nowBigInt = BigInt(Date.now());
      console.log(`Current timestamp (BigInt): ${nowBigInt}`);

      // Ensure retentionDays is a number
      const retentionDays = Number(
        this.retentionDays || DEFAULT_RETENTION_DAYS
      );
      console.log(`Using retention days: ${retentionDays}`);

      // Calculate cutoff time
      const millisPerDay = BigInt(24 * 60 * 60 * 1000);
      // Use a number for days, then convert the final result to BigInt
      const retentionMs = BigInt(
        Math.floor(retentionDays * 24 * 60 * 60 * 1000)
      );
      const cutoffBigInt = nowBigInt - retentionMs;

      console.log(`Retention period: ${retentionDays} days`);
      console.log(`Retention milliseconds: ${retentionMs}`);
      console.log(`Cutoff timestamp (BigInt): ${cutoffBigInt}`);

      // Delete records
      try {
        const result = await this.client.analytics.deleteMany({
          where: {
            timestamp: {
              lt: cutoffBigInt,
            },
          },
        });

        console.log(`Deletion result: ${JSON.stringify(result)}`);

        if (result.count > 0) {
          console.log(
            `Cleaned up ${result.count} analytics entries older than ${this.retentionDays} days`
          );
        } else {
          console.log(
            `No analytics entries older than ${this.retentionDays} days found.`
          );
        }
      } catch (deleteError) {
        console.error(`Error during deletion:`, deleteError);
        console.error(`Error stack:`, deleteError.stack);
      }
    } catch (error) {
      console.error("Error cleaning up old analytics:", error);
      console.error("Error stack:", error.stack);
    }
  }

  // Simplified to return zeroes
  async collectSystemPings() {
    return {
      database: {
        averageSpeed: 0,
        ping: 0,
      },
      render: {
        recentRequests: 0,
        ping: 0,
      },
    };
  }

  // Simplified to return zeroes
  async collectMusicPings() {
    return {
      players: 0,
      ping: 0,
    };
  }

  async collectShardPings(client) {
    try {
      const shardsData = {};
      let totalGuilds = 0;

      // Use client.guilds.cache.size for single-shard bots
      if (!client.ws.shards) {
        totalGuilds = client.guilds.cache.size;
        // For non-sharded bots, still use the same structure but with shard 0
        shardsData[0] = {
          guildsOnShard: totalGuilds,
          shardPing: 0, // Zeroed out ping
        };
      } else {
        for (const shard of client.ws.shards.values()) {
          const guildCount = client.guilds.cache.filter(
            (g) => g.shardId === shard.id
          ).size;
          shardsData[shard.id] = {
            guildsOnShard: guildCount,
            shardPing: 0, // Zeroed out ping
          };
          totalGuilds += guildCount;
        }
      }

      return {
        serversCount: totalGuilds,
        shards: shardsData,
      };
    } catch (error) {
      console.error("Error collecting shard pings:", error);
      return {
        serversCount: 0,
        shards: {},
      };
    }
  }

  async recordPing(client) {
    try {
      const shardPings = await this.collectShardPings(client);

      const pingData = {
        ...shardPings,
        music: await this.collectMusicPings(),
        render: (await this.collectSystemPings()).render,
        database: (await this.collectSystemPings()).database,
      };

      await this.logAnalytics("ping", pingData);

      if (process.env.NODE_ENV !== "production") {
        console.log("Ping data recorded");
      }
    } catch (error) {
      console.error("Error recording ping:", error);
    }
  }

  startPingCollection(client) {
    this.stopPingCollection(); // Clear any existing interval
    this.pingInterval = setInterval(
      () => this.recordPing(client),
      COLLECTION_INTERVAL
    );
    console.log("Ping collection started");

    // Also start cleanup job
    this.startCleanupJob();
  }

  stopPingCollection() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
      console.log("Ping collection stopped");
    }
  }

  startCleanupJob() {
    this.stopCleanupJob(); // Clear any existing interval

    // Run cleanup once immediately
    this.cleanupOldAnalytics();

    // Then schedule regular cleanup
    this.cleanupInterval = setInterval(
      () => this.cleanupOldAnalytics(),
      CLEANUP_INTERVAL
    );
    console.log(
      `Analytics cleanup job started (retention: ${this.retentionDays} days)`
    );
  }

  stopCleanupJob() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      console.log("Analytics cleanup job stopped");
    }
  }

  async getCooldown(guildId, userId, type) {
    // Use specific cache key for cooldowns
    const cacheKey = this._cacheKeyCooldown(guildId, userId);
    let cooldowns = {};

    // 1. Try fetching from Redis first
    if (this.redisClient) {
      try {
        const cachedData = await this._redisGet(cacheKey);
        if (cachedData) {
          cooldowns = deserializeWithBigInt(cachedData); // Use your deserializer
        } else {
          // Cache miss, proceed to fetch from DB (will be done below if needed)
          cooldowns = null; // Mark as null to fetch from DB
        }
      } catch (err) {
        this._logRedis("get", cacheKey, err);
        cooldowns = null; // Fallback to DB on error
      }
    } else {
      cooldowns = null; // No Redis client, fetch from DB
    }

    // 2. Fetch from DB if not found in cache or Redis unavailable/error
    if (cooldowns === null) {
      const cooldownRecord = await this.client.cooldown.findUnique({
        where: { userId_guildId: { userId, guildId } },
      });

      if (cooldownRecord?.data) {
        if (
          typeof cooldownRecord.data === "object" &&
          !Array.isArray(cooldownRecord.data)
        ) {
          cooldowns = cooldownRecord.data;
        } else if (typeof cooldownRecord.data === "string") {
          try {
            cooldowns = JSON.parse(cooldownRecord.data);
          } catch (error) {
            console.warn(
              `Failed to parse cooldown data for ${userId} in guild ${guildId}: ${error.message}`
            );
            cooldowns = {};
          }
        }
      } else {
        cooldowns = {}; // Default to empty object if no record
      }

      // 3. Store fetched data in Redis (if available)
      if (this.redisClient) {
        try {
          await this._redisSet(cacheKey, serializeWithBigInt(cooldowns), {
            EX: CACHE_TTL.COOLDOWN,
          }); // Use your serializer
          this._logRedis("set", cacheKey, true);
        } catch (err) {
          this._logRedis("set", cacheKey, err);
        }
      }
    }

    // --- Existing cooldown logic ---
    const lastUsed = cooldowns[type] || 0;
    const baseTime = COOLDOWNS[type];

    if (type === "crime") {
      const userUpgrades = await this.client.upgrade.findMany({
        where: { userId, guildId },
      });
      const crimeUpgrade = userUpgrades.find((u) => u.type === "crime");
      const crimeLevel = crimeUpgrade?.level || 1;
      const reduction = (crimeLevel - 1) * UPGRADES.crime.effectValue;
      return Math.max(0, lastUsed + baseTime - reduction - Date.now());
    }

    return Math.max(0, lastUsed + baseTime - Date.now());
  }

  async updateCooldown(guildId, userId, type) {
    // First, make sure the user exists to avoid constraint errors
    await this.ensureUser(guildId, userId);

    // --- Invalidate Redis Cache ---
    const cacheKey = this._cacheKeyCooldown(guildId, userId);
    if (this.redisClient) {
      try {
        await this._redisDel(cacheKey);
      } catch (err) {
        this._logRedis("del", cacheKey, err);
      }
    }

    // Initialize a clean object to work with
    let cooldowns = {};

    // If data exists and it's an object, use it directly
    const cooldown = await this.client.cooldown.findUnique({
      where: { userId_guildId: { userId, guildId } },
    });

    if (cooldown?.data) {
      if (typeof cooldown.data === "object" && !Array.isArray(cooldown.data)) {
        cooldowns = cooldown.data;
      } else if (typeof cooldown.data === "string") {
        try {
          cooldowns = JSON.parse(cooldown.data);
        } catch (error) {
          console.warn(
            `Failed to parse cooldown data for ${userId} in guild ${guildId}: ${error.message}`
          );
        }
      }
    }

    // Update the timestamp for this specific cooldown
    cooldowns[type] = Date.now();

    // Perform cleanup - remove expired cooldowns
    // But make sure to preserve crate-related cooldowns!
    const now = Date.now();
    Object.entries(cooldowns).forEach(([cooldownType, timestamp]) => {
      // Skip cleanup for crate cooldowns
      if (cooldownType.startsWith("crate_")) return;

      const baseTime = COOLDOWNS[cooldownType];
      if (!baseTime || now >= timestamp + baseTime) {
        delete cooldowns[cooldownType];
      }
    });

    // If no active cooldowns, delete the record ONLY if there are no crate cooldowns
    // This ensures we don't accidentally delete crate cooldowns
    const hasCrateCooldowns = Object.keys(cooldowns).some((key) =>
      key.startsWith("crate_")
    );
    if (
      Object.keys(cooldowns).length === 0 ||
      (!hasCrateCooldowns &&
        Object.keys(cooldowns).every((key) => {
          const baseTime = COOLDOWNS[key];
          return !baseTime || now >= cooldowns[key] + baseTime;
        }))
    ) {
      if (cooldown) {
        return this.client.cooldown.delete({
          where: {
            userId_guildId: {
              userId,
              guildId,
            },
          },
        });
      }
      return { userId, guildId, data: {} };
    }

    // Update or create cooldown record with a proper object (not stringified)
    try {
      return await this.client.cooldown.upsert({
        where: {
          userId_guildId: {
            userId,
            guildId,
          },
        },
        create: {
          userId,
          guildId,
          data: cooldowns, // Prisma will handle JSONB conversion
        },
        update: {
          data: cooldowns, // Prisma will handle JSONB conversion
        },
      });
    } catch (error) {
      console.error(
        `Error updating cooldown for ${userId} in guild ${guildId}:`,
        error
      );
      // If something went wrong, return a placeholder
      return { userId, guildId, data: {} };
    }
  }

  async incrementMessageCount(guildId, userId) {
    const result = await this.client.statistics.upsert({
      where: {
        userId_guildId: { userId, guildId },
      },
      create: {
        user: {
          connectOrCreate: {
            where: {
              guildId_id: { guildId, id: userId },
            },
            create: {
              id: userId,
              guild: {
                connectOrCreate: {
                  where: { id: guildId },
                  create: { id: guildId },
                },
              },
              lastActivity: BigInt(Date.now()),
            },
          },
        },
        messageCount: 1,
        commandCount: 0,
        totalEarned: 0,
        lastUpdated: Date.now(),
      },
      update: {
        messageCount: { increment: 1 },
        lastUpdated: Date.now(),
      },
    });

    // Invalidate Stats cache
    const cacheKey = this._cacheKeyStats(guildId, userId);
    if (this.redisClient) {
      try {
        await this._redisDel(cacheKey);
        this._logRedis("del", cacheKey, true);
      } catch (err) {
        this._logRedis("del", cacheKey, err);
      }
    }
    // Also invalidate full user cache as stats might be embedded
    const userCacheKey = this._cacheKeyUser(guildId, userId, true);
    if (this.redisClient) {
      try {
        await this._redisDel(userCacheKey);
        this._logRedis("del", userCacheKey, true);
      } catch (err) {
        this._logRedis("del", userCacheKey, err);
      }
    }

    return result;
  }

  async incrementCommandCount(guildId, userId) {
    const result = await this.client.statistics.upsert({
      where: {
        userId_guildId: { userId, guildId },
      },
      create: {
        user: {
          connectOrCreate: {
            where: {
              guildId_id: { guildId, id: userId },
            },
            create: {
              id: userId,
              guild: {
                connectOrCreate: {
                  where: { id: guildId },
                  create: { id: guildId },
                },
              },
              lastActivity: BigInt(Date.now()),
            },
          },
        },
        messageCount: 0,
        commandCount: 1,
        totalEarned: 0,
        lastUpdated: Date.now(),
      },
      update: {
        commandCount: { increment: 1 },
        lastUpdated: Date.now(),
      },
    });

    // Invalidate Stats cache
    const cacheKey = this._cacheKeyStats(guildId, userId);
    if (this.redisClient) {
      try {
        await this._redisDel(cacheKey);
        this._logRedis("del", cacheKey, true);
      } catch (err) {
        this._logRedis("del", cacheKey, err);
      }
    }
    // Also invalidate full user cache as stats might be embedded
    const userCacheKey = this._cacheKeyUser(guildId, userId, true);
    if (this.redisClient) {
      try {
        await this._redisDel(userCacheKey);
        this._logRedis("del", userCacheKey, true);
      } catch (err) {
        this._logRedis("del", userCacheKey, err);
      }
    }

    return result;
  }

  async getUserCrates(guildId, userId) {
    const cacheKey = this._cacheKeyCrates(guildId, userId);

    // 1. Check cache
    if (this.redisClient) {
      try {
        const cachedData = await this._redisGet(cacheKey);
        if (cachedData) {
          return deserializeWithBigInt(cachedData);
        }
      } catch (err) {
        this._logRedis("get", cacheKey, err);
      }
    }

    // 2. Fetch from DB
    await this.ensureUser(guildId, userId);
    const crates = await this.client.crate.findMany({
      where: {
        userId,
        guildId,
      },
    });

    // 3. Store in cache
    if (this.redisClient) {
      try {
        const serializedData = serializeWithBigInt(crates);
        await this._redisSet(cacheKey, serializedData, { EX: CACHE_TTL.CRATE });
        this._logRedis("set", cacheKey, true);
      } catch (err) {
        this._logRedis("set", cacheKey, err);
      }
    }

    return crates;
  }

  // Get a specific crate or create it if not exists
  async getUserCrate(guildId, userId, type) {
    const cacheKey = this._cacheKeyCrate(guildId, userId, type);

    // 1. Check cache
    if (this.redisClient) {
      try {
        const cachedData = await this._redisGet(cacheKey);
        if (cachedData) {
          // Check for 'NOT_FOUND' marker? Maybe not needed with upsert.
          return deserializeWithBigInt(cachedData);
        }
      } catch (err) {
        this._logRedis("get", cacheKey, err);
      }
    }

    // 2. Fetch/Upsert in DB
    await this.ensureUser(guildId, userId);
    const crate = await this.client.crate.upsert({
      where: {
        userId_guildId_type: {
          userId,
          guildId,
          type,
        },
      },
      create: {
        userId,
        guildId,
        type,
        count: 0,
        acquired: 0,
      },
      update: {},
    });

    // 3. Store in cache
    if (this.redisClient) {
      try {
        const serializedData = serializeWithBigInt(crate);
        await this._redisSet(cacheKey, serializedData, { EX: CACHE_TTL.CRATE });
        this._logRedis("set", cacheKey, true);
      } catch (err) {
        this._logRedis("set", cacheKey, err);
      }
    }

    return crate;
  }

  // Add a crate to user's inventory
  async addCrate(guildId, userId, type, count = 1, properties = {}) {
    await this.ensureUser(guildId, userId);

    const result = await this.client.crate.upsert({
      where: {
        userId_guildId_type: {
          userId,
          guildId,
          type,
        },
      },
      create: {
        userId,
        guildId,
        type,
        count,
        properties: JSON.stringify(properties),
        acquired: Date.now(),
      },
      update: {
        count: {
          increment: count,
        },
        acquired: Date.now(),
      },
    });

    // Invalidate caches
    const cacheKeySpecific = this._cacheKeyCrate(guildId, userId, type);
    const cacheKeyList = this._cacheKeyCrates(guildId, userId);
    if (this.redisClient) {
      try {
        await this._redisDel([cacheKeySpecific, cacheKeyList]);
        this._logRedis("del", `${cacheKeySpecific}, ${cacheKeyList}`, true);
      } catch (err) {
        this._logRedis("del", `${cacheKeySpecific}, ${cacheKeyList}`, err);
      }
    }

    return result;
  }

  // Remove a crate from user's inventory
  async removeCrate(guildId, userId, type, count = 1) {
    // Fetch first to check count (cannot rely on potentially stale cache)
    const crate = await this.client.crate.findUnique({
      where: {
        userId_guildId_type: {
          userId,
          guildId,
          type,
        },
      },
    });

    // Invalidate caches
    const cacheKeySpecific = this._cacheKeyCrate(guildId, userId, type);
    const cacheKeyList = this._cacheKeyCrates(guildId, userId);
    if (this.redisClient) {
      try {
        await this._redisDel([cacheKeySpecific, cacheKeyList]);
        this._logRedis("del", `${cacheKeySpecific}, ${cacheKeyList}`, true);
      } catch (err) {
        this._logRedis("del", `${cacheKeySpecific}, ${cacheKeyList}`, err);
      }
    }

    return result;
  }

  // Check if a cooldown for a specific crate type is active
  async getCrateCooldown(guildId, userId, type) {
    // Get cooldowns using the cached method
    // Note: getCooldown itself handles fetching/caching cooldowns
    const cooldowns = await this._getCooldownData(guildId, userId);

    const crateKey = `crate_${type}`;
    const lastUsed = cooldowns[crateKey] || 0;

    // If no timestamp found, check legacy format just in case
    if (lastUsed === 0 && cooldowns[type]) {
      console.warn(
        `Found legacy cooldown format for crate ${type}, migrating to new format`
      );
      // Migrate old format to new format
      cooldowns[crateKey] = cooldowns[type];
      delete cooldowns[type];

      // Save the updated format
      await this.client.cooldown.upsert({
        where: {
          userId_guildId: {
            userId,
            guildId,
          },
        },
        create: {
          userId,
          guildId,
          data: cooldowns,
        },
        update: {
          data: cooldowns,
        },
      });
    }

    // Get the base cooldown time for this crate type
    const baseTime = CRATE_TYPES[type]?.cooldown || COOLDOWNS.daily;

    // Apply any cooldown reductions user might have
    // For daily crates, we'll reuse the existing daily_cooldown reduction logic
    if (type === "daily") {
      const userUpgrades = await this.client.upgrade.findMany({
        where: { userId, guildId },
      });
      const dailyCooldownUpgrade = userUpgrades.find(
        (u) => u.type === "daily_cooldown"
      );
      const dailyCooldownLevel = dailyCooldownUpgrade?.level || 1;

      // Calculate cooldown reduction (30 minutes per level starting from level 2)
      const cooldownReduction = (dailyCooldownLevel - 1) * (30 * 60 * 1000);

      return Math.max(0, lastUsed + baseTime - cooldownReduction - Date.now());
    }

    return Math.max(0, lastUsed + baseTime - Date.now());
  }

  // Update cooldown for a crate type
  async updateCrateCooldown(guildId, userId, type) {
    // Ensure user exists first
    await this.ensureUser(guildId, userId); // ensureUser uses cached getUser

    // --- Invalidate Cooldown Cache ---
    const cacheKey = this._cacheKeyCooldown(guildId, userId);
    // Invalidate *before* DB operation here as we merge data below
    if (this.redisClient) {
      try {
        await this._redisDel(cacheKey);
        this._logRedis("del", cacheKey, true);
      } catch (err) {
        this._logRedis("del", cacheKey, err);
      }
    }

    // Make sure we're working with a proper object
    let cooldowns = {};

    // Fetch current data for merging
    const cooldown = await this.client.cooldown.findUnique({
      where: { userId_guildId: { userId, guildId } },
    });

    // Handle all possible data formats
    if (cooldown?.data) {
      try {
        if (
          typeof cooldown.data === "object" &&
          !Array.isArray(cooldown.data)
        ) {
          // It's already an object
          cooldowns = cooldown.data;
        } else if (typeof cooldown.data === "string") {
          // It's a JSON string, parse it
          cooldowns = JSON.parse(cooldown.data);
        }
      } catch (error) {
        console.warn(
          `Failed to parse cooldown data for ${userId} in guild ${guildId}: ${error.message}`
        );
      }
    }

    const crateKey = `crate_${type}`;
    cooldowns[crateKey] = Date.now();

    // Perform cleanup - remove expired cooldowns to keep the table clean
    // But only for non-crate cooldowns to prevent wiping other crate cooldowns
    const now = Date.now();
    Object.entries(cooldowns).forEach(([key, timestamp]) => {
      if (!key.startsWith("crate_")) {
        const cooldownType = key;
        const baseTime = COOLDOWNS[cooldownType];
        if (!baseTime || now >= timestamp + baseTime) {
          delete cooldowns[key];
        }
      }
    });

    return this.client.cooldown.upsert({
      where: {
        userId_guildId: {
          userId,
          guildId,
        },
      },
      create: {
        userId,
        guildId,
        data: cooldowns, // Store as object directly
      },
      update: {
        data: cooldowns, // Store as object directly
      },
    });
  }

  // Reduce cooldown for a specific type
  async reduceCooldown(guildId, userId, type, amount) {
    // --- Invalidate Cooldown Cache ---
    const cacheKey = this._cacheKeyCooldown(guildId, userId);
    // Invalidate *before* DB operation here as we merge data below
    if (this.redisClient) {
      try {
        await this._redisDel(cacheKey);
        this._logRedis("del", cacheKey, true);
      } catch (err) {
        this._logRedis("del", cacheKey, err);
      }
    }

    // Fetch current data for merging
    const cooldown = await this.client.cooldown.findUnique({
      where: { userId_guildId: { userId, guildId } },
    });
    if (!cooldown) return null; // Exit if no cooldown record exists

    // Make sure we're working with a proper object
    let cooldowns = {};

    // Handle all possible data formats
    try {
      if (typeof cooldown.data === "object" && !Array.isArray(cooldown.data)) {
        // It's already an object
        cooldowns = cooldown.data;
      } else if (typeof cooldown.data === "string") {
        // It's a JSON string, parse it
        cooldowns = JSON.parse(cooldown.data);
      }
    } catch (error) {
      console.warn(
        `Failed to parse cooldown data for ${userId} in guild ${guildId}: ${error.message}`
      );
      return null;
    }

    // For crate cooldowns, we need to use the crate key format
    const cooldownKey = type.startsWith("crate_")
      ? type
      : ["daily", "weekly"].includes(type)
      ? `crate_${type}`
      : type;

    if (!cooldowns[cooldownKey]) {
      return null; // No cooldown to reduce
    }

    const currentValue = cooldowns[cooldownKey];
    cooldowns[cooldownKey] = Math.max(
      currentValue - amount,
      Date.now() - 60 * 1000 // Set to at most 1 minute ago
    );

    return this.client.cooldown.update({
      where: {
        userId_guildId: {
          userId,
          guildId,
        },
      },
      data: {
        data: cooldowns,
      },
    });
  }

  // Get user's upgrade discounts
  async getUpgradeDiscount(guildId, userId) {
    // Note: This fetches directly. Caching economy separately might be complex due to frequent balance updates.
    // Relying on the full user cache (which includes economy) from getUser might be sufficient if getUser is called first.
    // If this method is called independently very often, consider caching 'economy:<gid>:<uid>'
    const economy = await this.client.economy.findUnique({
      // Direct DB fetch
      where: {
        userId_guildId: {
          userId,
          guildId,
        },
      },
    });

    if (!economy) return 0;
    return Number(economy.upgradeDiscount || 0);
  }

  // Add discount for upgrades
  async addUpgradeDiscount(guildId, userId, discountPercent) {
    await this.ensureUser(guildId, userId);

    // Direct DB fetch needed to avoid race conditions with cache
    const economy = await this.client.economy.findUnique({
      where: {
        userId_guildId: {
          userId,
          guildId,
        },
      },
    });

    const currentDiscount = Number(economy?.upgradeDiscount || 0);
    const newDiscount = currentDiscount + discountPercent;

    return this.client.economy.upsert({
      where: {
        userId_guildId: {
          userId,
          guildId,
        },
      },
      create: {
        userId,
        guildId,
        upgradeDiscount: newDiscount,
      },
      update: {
        upgradeDiscount: newDiscount,
      },
    });
  }

  // Reset discount after any upgrade purchase
  async resetUpgradeDiscount(guildId, userId) {
    // Direct DB fetch needed
    const economy = await this.client.economy.findUnique({
      where: {
        userId_guildId: {
          userId,
          guildId,
        },
      },
    });

    if (!economy) return null;

    return this.client.economy.update({
      where: {
        userId_guildId: {
          userId,
          guildId,
        },
      },
      data: {
        upgradeDiscount: 0,
      },
    });
  }

  // Open a crate and get rewards
  async openCrate(guildId, userId, type) {
    // Fetch crate directly to check existence/count, don't rely on cache
    const crate = await this.client.crate.findUnique({
      where: {
        userId_guildId_type: {
          userId,
          guildId,
          type,
        },
      },
    });

    // For standard crates like daily/weekly, we check cooldowns
    if (["daily", "weekly"].includes(type)) {
      const cooldown = await this.getCrateCooldown(guildId, userId, type);
      if (cooldown > 0) {
        throw new Error(`Cooldown active: ${cooldown}`);
      }

      // Update cooldown for standard crates
      await this.updateCrateCooldown(guildId, userId, type);
    } else {
      // For special crates, we check if user has them
      if (!crate || crate.count <= 0) {
        throw new Error("No crates available");
      }

      // Remove one crate from inventory
      await this.removeCrate(guildId, userId, type, 1);
    }

    // Generate rewards based on crate type
    const rewards = await this.generateCrateRewards(guildId, userId, type);

    // Process and apply the rewards
    await this.processCrateRewards(guildId, userId, rewards);

    return rewards;
  }

  // Generate rewards for a crate
  async generateCrateRewards(guildId, userId, type) {
    const crateConfig = CRATE_TYPES[type];
    if (!crateConfig) {
      throw new Error(`Unknown crate type: ${type}`);
    }

    const rewards = {
      type,
      coins: 0,
      xp: 0,
      seasonXp: 0,
      discount: 0,
      cooldownReductions: {}, // Empty object for backward compatibility
    };

    // Generate coins reward
    rewards.coins = Math.floor(
      Math.random() *
        (crateConfig.rewards.max_coins - crateConfig.rewards.min_coins + 1) +
        crateConfig.rewards.min_coins
    );

    // XP reward (chance-based)
    if (Math.random() < crateConfig.rewards.xp_chance) {
      rewards.xp = crateConfig.rewards.xp_amount;
      rewards.seasonXp = crateConfig.rewards.xp_amount;
    }

    // Discount reward (chance-based)
    if (Math.random() < crateConfig.rewards.discount_chance) {
      rewards.discount = crateConfig.rewards.discount_amount;
    }

    // Removed cooldown reducer logic

    return rewards;
  }

  // Process and apply crate rewards
  async processCrateRewards(guildId, userId, rewards) {
    await this.client.$transaction(async (tx) => {
      // Add coins
      if (rewards.coins > 0) {
        await this.addBalance(guildId, userId, rewards.coins);
      }

      // Add XP
      if (rewards.xp > 0) {
        await this.addXP(guildId, userId, rewards.xp);
      }

      // Add discount
      if (rewards.discount > 0) {
        await this.addUpgradeDiscount(guildId, userId, rewards.discount);
      }

      // Cooldown reductions have been removed from the rewards system
    });

    return rewards;
  }

  async addBalance(guildId, userId, amount) {
    // Ensure user exists first
    await this.ensureUser(guildId, userId);

    const formattedAmount = parseFloat(amount).toFixed(5);

    const result = await this.client.$transaction(async (tx) => {
      // Check if we're creating a default record with 0 balance
      if (parseFloat(formattedAmount) === 0) {
        // Check if an economy record exists
        const existingEconomy = await tx.economy.findUnique({
          where: {
            userId_guildId: {
              userId,
              guildId,
            },
          },
        });

        // If there's no existing record, no need to create one with all zeros
        if (!existingEconomy) {
          return {
            userId,
            guildId,
            balance: "0.00000",
            bankBalance: "0.00000",
            bankRate: "0.00000",
            bankStartTime: 0,
          };
        }
      }

      const economy = await tx.economy.upsert({
        where: {
          userId_guildId: {
            userId,
            guildId,
          },
        },
        create: {
          userId,
          guildId,
          balance: formattedAmount,
          bankBalance: "0.00000",
          bankRate: "0.00000",
          bankStartTime: 0,
        },
        update: {
          balance: {
            increment: parseFloat(formattedAmount),
          },
        },
      });

      // Only update statistics if amount is positive
      if (parseFloat(amount) > 0) {
        await tx.statistics.upsert({
          where: {
            userId_guildId: {
              userId,
              guildId,
            },
          },
          create: {
            userId,
            guildId,
            totalEarned: formattedAmount,
            messageCount: 0,
            commandCount: 0,
            lastUpdated: Date.now(),
          },
          update: {
            totalEarned: {
              increment: parseFloat(formattedAmount),
            },
            lastUpdated: Date.now(),
          },
        });
      }

      await tx.user.update({
        where: {
          guildId_id: {
            guildId,
            id: userId,
          },
        },
        data: {
          lastActivity: Date.now(),
        },
      });

      return economy;
    });

    // Invalidate User and Stats cache
    const userCacheKeyFull = this._cacheKeyUser(guildId, userId, true);
    const userCacheKeyBasic = this._cacheKeyUser(guildId, userId, false);
    const statsCacheKey = this._cacheKeyStats(guildId, userId);
    if (this.redisClient) {
      try {
        const keysToDel = [userCacheKeyFull, userCacheKeyBasic];
        // Only invalidate stats if amount > 0 as stats are only updated then
        if (parseFloat(amount) > 0) {
          keysToDel.push(statsCacheKey);
        }
        if (keysToDel.length > 0) {
          await this._redisDel(keysToDel);
          this._logRedis("del", keysToDel.join(", "), true);
        }
      } catch (err) {
        this._logRedis(
          "del",
          `${userCacheKeyFull}, ${userCacheKeyBasic}, ${statsCacheKey}`,
          err
        );
      }
    }

    return result;
  }

  async transferBalance(guildId, fromUserId, toUserId, amount) {
    const formattedAmount = parseFloat(amount).toFixed(5);
    const result = await this.client.$transaction([
      this.addBalance(guildId, fromUserId, -formattedAmount),
      this.addBalance(guildId, toUserId, formattedAmount),
    ]);

    // Note: addBalance already invalidates cache for each user involved.
    // No extra invalidation needed here unless transferBalance adds unique logic.
    return result;
  }

  // Bank Operations
  async updateBankBalance(guildId, userId, amount, rate = 0) {
    const result = await this.client.$transaction(async (tx) => {
      // Always calculate current balance first within the transaction
      const currentBank = await tx.economy.findUnique({
        where: {
          userId_guildId: {
            userId,
            guildId,
          },
        },
        include: {
          user: true, // Include user for activity check
        },
      });

      let currentBalance = "0.00000";
      if (currentBank) {
        // Calculate interest if there's an existing balance
        const inactiveTime = Date.now() - Number(currentBank.user.lastActivity);
        if (inactiveTime > BANK_MAX_INACTIVE_MS) {
          currentBalance = this.calculateInterest(
            parseFloat(currentBank.bankBalance),
            parseFloat(currentBank.bankRate),
            BANK_MAX_INACTIVE_MS
          );
        } else if (currentBank.bankStartTime > 0) {
          const timeElapsed = Date.now() - Number(currentBank.bankStartTime);
          currentBalance = this.calculateInterest(
            parseFloat(currentBank.bankBalance),
            parseFloat(currentBank.bankRate),
            timeElapsed
          );
        }
      }

      // Ensure precise decimal handling
      const formattedAmount = (
        Math.round(parseFloat(amount) * 100000) / 100000
      ).toFixed(5);
      const formattedRate = (
        Math.round(parseFloat(rate) * 100000) / 100000
      ).toFixed(5);

      // If withdrawing all money, reset bank data
      const isEmptyingBank = parseFloat(formattedAmount) <= 0;

      // For deposits, add to current balance. For withdrawals, use the provided amount
      const finalBalance = isEmptyingBank
        ? formattedAmount
        : (parseFloat(currentBalance) + parseFloat(formattedAmount)).toFixed(5);

      const result = await tx.economy.upsert({
        where: {
          userId_guildId: {
            userId,
            guildId,
          },
        },
        create: {
          userId,
          guildId,
          balance: "0.00000",
          bankBalance: finalBalance,
          bankRate: formattedRate,
          bankStartTime: rate > 0 ? Date.now() : 0,
        },
        update: {
          bankBalance: finalBalance,
          bankRate: isEmptyingBank ? "0.00000" : formattedRate,
          bankStartTime: isEmptyingBank ? 0 : rate > 0 ? Date.now() : 0,
        },
      });

      // Update user activity
      await tx.user.update({
        where: {
          guildId_id: {
            guildId,
            id: userId,
          },
        },
        data: {
          lastActivity: Date.now(),
        },
      });

      return result;
    });

    // Invalidate User cache (as economy is part of it)
    const userCacheKeyFull = this._cacheKeyUser(guildId, userId, true);
    const userCacheKeyBasic = this._cacheKeyUser(guildId, userId, false);
    if (this.redisClient) {
      try {
        const keysToDel = [userCacheKeyFull, userCacheKeyBasic];
        if (keysToDel.length > 0) {
          await this._redisDel(keysToDel);
          this._logRedis("del", keysToDel.join(", "), true);
        }
      } catch (err) {
        this._logRedis("del", `${userCacheKeyFull}, ${userCacheKeyBasic}`, err);
      }
    }

    return result;
  }

  calculateInterest(principal, annualRate, timeMs) {
    // Convert milliseconds to years with proper precision
    const MS_PER_YEAR = 365 * 24 * 60 * 60 * 1000; // milliseconds in a year
    const timeInYears = Number((timeMs / MS_PER_YEAR).toFixed(10)); // limit decimal precision
    const rate = annualRate / 100;

    // Calculate simple interest for the elapsed time period
    // I = P * r * t where:
    // P = principal
    // r = interest rate (as decimal)
    // t = time in years
    const interest = Number((principal * rate * timeInYears).toFixed(10));

    // Return principal plus earned interest with 5 decimal places
    return (principal + interest).toFixed(5);
  }

  async calculateBankBalance(user, tx = null) {
    if (!user.economy?.bankBalance) return "0.00000";

    const inactiveTime = Date.now() - Number(user.lastActivity);
    const currentTime = Date.now();

    // Use the provided transaction client or the main client
    const dbClient = tx || this.client;

    // This logic should ideally not run within another transaction block if tx is provided.
    // Let's assume it calculates based on the provided user data primarily,
    // but needs a DB read to check the definitive current state if resetting due to inactivity.

    const currentBank = await dbClient.economy.findUnique({
      where: {
        userId_guildId: {
          userId: user.id,
          guildId: user.guildId,
        },
      },
    });

    if (!currentBank) return "0.00000";

    // Just return current balance if bank is not active
    if (!currentBank.bankStartTime || !currentBank.bankRate) {
      return currentBank.bankBalance;
    }

    // If user is inactive for more than 2 days, calculate final balance and reset bank
    if (inactiveTime > BANK_MAX_INACTIVE_MS) {
      const formattedBalance = this.calculateInterest(
        parseFloat(currentBank.bankBalance),
        parseFloat(currentBank.bankRate),
        BANK_MAX_INACTIVE_MS
      );

      // Update the bank balance and reset bank data
      await dbClient.economy.update({
        where: {
          userId_guildId: {
            userId: user.id,
            guildId: user.guildId,
          },
        },
        data: {
          bankBalance: formattedBalance,
          bankRate: "0.00000",
          bankStartTime: 0,
        },
      });

      return formattedBalance;
    }

    // For active users, display current balance with projected interest
    const timeElapsed = currentTime - Number(currentBank.bankStartTime);
    return this.calculateInterest(
      parseFloat(currentBank.bankBalance),
      parseFloat(currentBank.bankRate),
      timeElapsed
    );
  }

  async getUser(guildId, userId, includeRelations = true, tx = null) {
    const prisma = tx || this.client;
    const cacheKey = this._cacheKeyUser(guildId, userId, includeRelations);

    // Try fetching from cache first
    if (this.redisClient) {
      try {
        const cachedUser = await this._redisGet(cacheKey);
        if (cachedUser) {
          this._logRedis("HIT", cacheKey, "User found in cache");
          return cachedUser;
        } else {
          this._logRedis("MISS", cacheKey);
        }
      } catch (err) {
        console.error(`Redis GET Error for key ${cacheKey}:`, err);
        // Proceed to fetch from DB if cache fails
      }
    }

    try {
      const user = await prisma.user.findUnique({
        where: { guildId_id: { guildId, id: userId } },
        include: includeRelations
          ? {
              economy: true,
              stats: true,
              cooldowns: true,
              upgrades: true,
              Level: true,
              VoiceSession: true,
              crates: true,
            }
          : undefined, // Only include relations if requested
      });

      if (user && this.redisClient) {
        try {
          await this._redisSet(cacheKey, user, { EX: CACHE_TTL.USER });
          this._logRedis("SET", cacheKey, "User cached");
        } catch (err) {
          console.error(`Redis SET Error for key ${cacheKey}:`, err);
        }
      }

      return user;
    } catch (error) {
      console.error(
        `Error fetching user ${userId} in guild ${guildId}:`,
        error
      );
      throw error; // Rethrow to be handled by the caller
    }
  }

  /**
   * Gets the locale preference for a specific user.
   * @param {string} guildId - The guild ID.
   * @param {string} userId - The user ID.
   * @returns {Promise<string|null>} The user's locale string or null if not set/found.
   */
  async getUserLocale(guildId, userId) {
    const cacheKey = this._cacheKeyUserLocale(guildId, userId);

    // Try fetching from cache first
    if (this.redisClient) {
      try {
        const cachedLocale = await this._redisGet(cacheKey);
        if (cachedLocale !== null && cachedLocale !== undefined) {
          // Check specifically for null/undefined miss
          this._logRedis("HIT", cacheKey, "User locale found in cache");
          return cachedLocale; // Return cached value (could be null if explicitly cached as null)
        } else {
          this._logRedis("MISS", cacheKey);
        }
      } catch (err) {
        console.error(`Redis GET Error for key ${cacheKey}:`, err);
      }
    }

    try {
      // Fetch only the necessary field
      const user = await this.client.user.findUnique({
        where: { guildId_id: { guildId, id: userId } },
        select: { locale: true },
      });

      const locale = user ? user.locale : null;

      // Cache the result (even if null)
      if (this.redisClient) {
        try {
          // Cache null explicitly to represent 'checked and not found'
          await this._redisSet(
            cacheKey,
            locale === null ? "$$NULL$$" : locale,
            { EX: CACHE_TTL.USER }
          );
          this._logRedis(
            "SET",
            cacheKey,
            `User locale cached (Value: ${locale})`
          );
        } catch (err) {
          console.error(`Redis SET Error for key ${cacheKey}:`, err);
        }
      }

      return locale;
    } catch (error) {
      console.error(
        `Error fetching locale for user ${userId} in guild ${guildId}:`,
        error
      );
      return null; // Return null on error
    }
  }

  /**
   * Sets the locale preference for a specific user.
   * @param {string} guildId - The guild ID.
   * @param {string} userId - The user ID.
   * @param {string} locale - The locale string to set.
   * @returns {Promise<void>}
   */
  async setUserLocale(guildId, userId, locale) {
    try {
      await this.updateUser(guildId, userId, { locale: locale });

      // Update/Invalidate caches after successful DB update
      if (this.redisClient) {
        const localeCacheKey = this._cacheKeyUserLocale(guildId, userId);
        const userCacheKeyFull = this._cacheKeyUser(guildId, userId, true);
        const userCacheKeyBasic = this._cacheKeyUser(guildId, userId, false);

        try {
          // Update locale cache directly
          await this._redisSet(localeCacheKey, locale, { EX: CACHE_TTL.USER });
          this._logRedis(
            "SET",
            localeCacheKey,
            `User locale updated in cache (Value: ${locale})`
          );

          // Invalidate full and basic user caches as locale is part of the user object
          await this._redisDel([userCacheKeyFull, userCacheKeyBasic]);
          this._logRedis(
            "DEL",
            userCacheKeyFull,
            "Invalidated full user cache"
          );
          this._logRedis(
            "DEL",
            userCacheKeyBasic,
            "Invalidated basic user cache"
          );
        } catch (err) {
          console.error(
            `Redis DEL/SET Error during locale update for user ${userId} in guild ${guildId}:`,
            err
          );
        }
      }
    } catch (error) {
      console.error(
        `Error setting locale for user ${userId} in guild ${guildId}:`,
        error
      );
      throw error; // Rethrow to indicate failure
    }
  }

  async createUser(guildId, userId, data = {}) {
    // Ensure guild exists first
    await this.client.guild.upsert({
      where: { id: guildId },
      create: { id: guildId, settings: {} },
      update: {},
    });

    const { economy, level, cooldowns, upgrades, stats, ...userData } = data;

    try {
      return await this.client.$transaction(async (tx) => {
        // Explicitly check if the user exists in this specific guild with a FOR UPDATE lock
        // This prevents race conditions where two createUser calls might happen simultaneously
        const existingUser = await tx.user.findUnique({
          where: {
            guildId_id: {
              guildId,
              id: userId,
            },
          },
        });

        if (existingUser) {
          // User already exists in this guild, update instead of create
          // Only update if there are actual changes to minimize database operations
          const shouldUpdateUser =
            Object.keys(userData).length > 0 || userData.lastActivity;

          let user;

          if (shouldUpdateUser) {
            user = await tx.user.update({
              where: {
                guildId_id: {
                  guildId,
                  id: userId,
                },
              },
              data: {
                lastActivity: Date.now(),
                ...userData,
                // Update related records if they exist and if non-default values provided
                ...(economy && Object.values(economy).some((v) => v !== 0)
                  ? {
                      economy: {
                        upsert: {
                          create: {
                            balance: DEFAULT_VALUES.economy.balance,
                            bankBalance: DEFAULT_VALUES.economy.bankBalance,
                            bankRate: DEFAULT_VALUES.economy.bankRate,
                            bankStartTime: DEFAULT_VALUES.economy.bankStartTime,
                            ...economy,
                          },
                          update: {
                            ...economy,
                          },
                        },
                      },
                    }
                  : {}),
                ...(stats && Object.values(stats).some((v) => v !== 0)
                  ? {
                      stats: {
                        upsert: {
                          create: {
                            totalEarned: 0,
                            messageCount: DEFAULT_VALUES.stats.messageCount,
                            commandCount: DEFAULT_VALUES.stats.commandCount,
                            lastUpdated: Date.now(),
                            gameRecords: JSON.stringify({
                              2048: { highScore: 0 },
                              snake: { highScore: 0 },
                            }),
                            ...stats,
                          },
                          update: {
                            ...stats,
                          },
                        },
                      },
                    }
                  : {}),
                ...(level && level.xp > 0
                  ? {
                      Level: {
                        upsert: {
                          create: {
                            xp: 0,
                            ...level,
                          },
                          update: {
                            ...level,
                          },
                        },
                      },
                    }
                  : {}),
                ...(cooldowns && Object.keys(cooldowns).length > 0
                  ? {
                      cooldowns: {
                        upsert: {
                          create: {
                            data: JSON.stringify(DEFAULT_VALUES.cooldowns),
                            ...cooldowns,
                          },
                          update: {
                            ...cooldowns,
                          },
                        },
                      },
                    }
                  : {}),
              },
              include: {
                economy: true,
                stats: true,
                Level: true,
                cooldowns: true,
                upgrades: true,
              },
            });
          } else {
            // Just fetch the user with relationships if no updates needed
            user = await tx.user.findUnique({
              where: {
                guildId_id: {
                  guildId,
                  id: userId,
                },
              },
              include: {
                economy: true,
                stats: true,
                Level: true,
                cooldowns: true,
                upgrades: true,
              },
            });
          }

          // Handle upgrades separately if non-default values are provided
          if (
            upgrades &&
            Object.values(upgrades).some((upgrade) => upgrade.level > 1)
          ) {
            await this.updateUpgrades(guildId, userId, upgrades);
          }

          return user;
        } else {
          // User doesn't exist in this guild, create a new entry
          // Only include non-default related records
          const hasNonDefaultEconomy =
            economy && Object.values(economy).some((v) => v !== 0);
          const hasNonDefaultStats =
            stats && Object.values(stats).some((v) => v !== 0);
          const hasNonDefaultLevel = level && level.xp > 0;
          const hasNonDefaultCooldowns =
            cooldowns && Object.keys(cooldowns).length > 0;
          const hasNonDefaultUpgrades =
            upgrades &&
            Object.values(upgrades).some((upgrade) => upgrade.level > 1);

          const createData = {
            id: userId,
            guildId,
            lastActivity: Date.now(),
            ...userData,
          };

          // Only add related records if they have non-default values
          if (hasNonDefaultEconomy) {
            createData.economy = {
              create: {
                balance: DEFAULT_VALUES.economy.balance,
                bankBalance: DEFAULT_VALUES.economy.bankBalance,
                bankRate: DEFAULT_VALUES.economy.bankRate,
                bankStartTime: DEFAULT_VALUES.economy.bankStartTime,
                ...economy,
              },
            };
          }

          if (hasNonDefaultStats) {
            createData.stats = {
              create: {
                totalEarned: 0,
                messageCount: DEFAULT_VALUES.stats.messageCount,
                commandCount: DEFAULT_VALUES.stats.commandCount,
                lastUpdated: Date.now(),
                gameRecords: JSON.stringify({
                  2048: { highScore: 0 },
                  snake: { highScore: 0 },
                }),
                ...stats,
              },
            };
          }

          if (hasNonDefaultLevel) {
            createData.Level = {
              create: {
                xp: 0,
                ...level,
              },
            };
          }

          if (hasNonDefaultCooldowns) {
            createData.cooldowns = {
              create: {
                data: JSON.stringify(DEFAULT_VALUES.cooldowns),
                ...cooldowns,
              },
            };
          }

          if (hasNonDefaultUpgrades) {
            createData.upgrades = {
              create: Object.entries(upgrades)
                .filter(([_, data]) => data.level > 1)
                .map(([type, data]) => ({
                  type,
                  level: data.level,
                })),
            };
          }

          try {
            const user = await tx.user.create({
              data: createData,
              include: {
                economy: true,
                stats: true,
                Level: true,
                cooldowns: true,
                upgrades: true,
              },
            });
            return user;
          } catch (error) {
            // Handle potential race condition where user was created in the meantime
            if (error.code === "P2002") {
              console.warn(
                `User ${userId} was created concurrently, fetching instead`
              );
              return await tx.user.findUnique({
                where: {
                  guildId_id: {
                    guildId,
                    id: userId,
                  },
                },
                include: {
                  economy: true,
                  stats: true,
                  Level: true,
                  cooldowns: true,
                  upgrades: true,
                },
              });
            }
            throw error;
          }
        }
      });
    } catch (error) {
      console.error(
        `Error in createUser for userId ${userId} in guild ${guildId}:`,
        error
      );
      // Fallback: try to get the user if creation failed but they might already exist
      const existingUser = await this.client.user.findUnique({
        where: {
          guildId_id: {
            guildId,
            id: userId,
          },
        },
        include: {
          economy: true,
          stats: true,
          Level: true,
          cooldowns: true,
          upgrades: true,
        },
      });

      if (existingUser) {
        return existingUser;
      }

      // If all else fails, rethrow the error
      throw error;
    }
  }

  async updateUser(guildId, userId, data) {
    // Ensure user exists first
    const existingUser = await this.getUser(guildId, userId); // This uses the cache-aware getUser
    if (!existingUser) {
      return this.createUser(guildId, userId, data);
    }

    const { economy, level, cooldowns, upgrades, ...userData } = data;
    const updateData = {
      lastActivity: Date.now(),
      ...userData,
    };

    if (economy) {
      updateData.economy = {
        upsert: {
          create: { ...economy },
          update: { ...economy },
        },
      };
    }

    if (level) {
      updateData.Level = {
        upsert: {
          create: { ...level },
          update: { ...level },
        },
      };
    }

    if (cooldowns) {
      updateData.cooldowns = {
        upsert: {
          create: { data: JSON.stringify(cooldowns) },
          update: { data: JSON.stringify(cooldowns) },
        },
      };
    }

    if (upgrades) {
      // Handle upgrades differently since it's a one-to-many relation
      await this.updateUpgrades(guildId, userId, upgrades);
    }

    // Perform the database update
    const updatedUser = await this.client.user.update({
      where: {
        guildId_id: {
          guildId,
          id: userId,
        },
      },
      data: updateData,
      include: {
        economy: true,
        Level: true,
        cooldowns: true,
        upgrades: true,
      },
    });

    // Invalidate Redis cache after successful DB update
    if (this.redisClient) {
      const cacheKeyFull = this._cacheKeyUser(guildId, userId, true);
      const cacheKeyBasic = this._cacheKeyUser(guildId, userId, false);
      try {
        const deletedCount = await this._redisDel([
          cacheKeyFull,
          cacheKeyBasic,
        ]);
        if (deletedCount > 0) {
          this._logRedis(
            "DEL",
            `${cacheKeyFull}, ${cacheKeyBasic}`,
            `Invalidated user cache on update (${deletedCount} keys)`
          );
        } else {
          // Log if keys weren't found, might indicate they already expired
          this._logRedis(
            "DEL_MISS",
            `${cacheKeyFull}, ${cacheKeyBasic}`,
            "User cache keys not found for invalidation"
          );
        }
      } catch (err) {
        console.error(
          `Redis DEL Error during user update invalidation for key ${cacheKeyFull}/${cacheKeyBasic}:`,
          err
        );
        // Don't throw, update succeeded, cache will expire eventually
      }
    }

    return updatedUser; // Return the updated user data from the DB
  }

  // Helper method to ensure user exists
  async ensureUser(guildId, userId) {
    const user = await this.getUser(guildId, userId);
    if (!user) {
      return this.createUser(guildId, userId);
    }
    return user;
  }

  // Helper method to ensure guild exists
  async ensureGuild(guildId) {
    return this.client.guild.upsert({
      where: { id: guildId },
      create: { id: guildId, settings: {} },
      update: {},
    });
  }

  async ensureGuildUser(guildId, userId) {
    try {
      // First check if the user already exists to avoid unnecessary operations
      const existingUser = await this.client.user.findUnique({
        where: {
          guildId_id: {
            guildId,
            id: userId,
          },
        },
      });

      if (existingUser) {
        // User exists, check if we need to update lastActivity
        const currentTime = Date.now();
        const lastActivityTime = Number(existingUser.lastActivity || 0);
        const lastActivityAge = currentTime - lastActivityTime;

        // Only update if the last activity was more than 5 minutes ago
        // This avoids excessive database updates for frequent operations
        if (lastActivityAge > 5 * 60 * 1000) {
          return await this.client.user.update({
            where: {
              guildId_id: {
                guildId,
                id: userId,
              },
            },
            data: {
              lastActivity: Date.now(),
            },
          });
        }

        // Return existing user without updating if recently active
        return existingUser;
      }

      // If user doesn't exist, use a transaction to ensure atomicity
      return await this.client.$transaction(async (prisma) => {
        // Ensure guild exists first
        await prisma.guild.upsert({
          where: { id: guildId },
          create: { id: guildId, settings: {} },
          update: {},
        });

        // Try to create the user, handling potential race conditions
        try {
          return await prisma.user.create({
            data: {
              id: userId,
              guildId,
              lastActivity: Date.now(),
            },
          });
        } catch (error) {
          // If another process created the user in the meantime (P2002 = unique constraint violation)
          if (error.code === "P2002") {
            // If there's a duplicate key error, try to fetch the existing user
            try {
              return await prisma.user.findUnique({
                where: {
                  guildId_id: {
                    guildId,
                    id: userId,
                  },
                },
              });
            } catch (findError) {
              console.error("Error finding existing user:", findError);
              // If the error is about duplicate Discord user ID, try with a composite ID
              if (error.meta?.target?.includes("user_id")) {
                const compositeId = `${userId}_${guildId}`;
                return await prisma.user.create({
                  data: {
                    id: compositeId,
                    guildId,
                    lastActivity: Date.now(),
                  },
                });
              }
              throw findError;
            }
          }
          throw error;
        }
      });
    } catch (error) {
      console.error(
        `Error in ensureGuildUser for userId ${userId} in guild ${guildId}:`,
        error
      );

      // Last resort fallback - try one more time with a simpler approach
      try {
        await this.client.guild.upsert({
          where: { id: guildId },
          create: { id: guildId, settings: {} },
          update: {},
        });

        return await this.client.user.upsert({
          where: {
            guildId_id: {
              guildId,
              id: userId,
            },
          },
          create: {
            id: userId,
            guildId,
            lastActivity: Date.now(),
          },
          update: {
            lastActivity: Date.now(),
          },
        });
      } catch (secondError) {
        console.error(
          `Final fallback failed for userId ${userId} in guild ${guildId}:`,
          secondError
        );
        throw secondError;
      }
    }
  }

  // Guild Operations
  async getGuild(guildId) {
    const cacheKey = this._cacheKeyGuild(guildId);

    // 1. Check cache
    if (this.redisClient) {
      try {
        const cachedData = await this._redisGet(cacheKey);
        if (cachedData) {
          return deserializeWithBigInt(cachedData);
        }
      } catch (err) {
        this._logRedis("get", cacheKey, err);
      }
    }

    // 2. Fetch from DB
    const guild = await this.client.guild.findUnique({
      where: { id: guildId },
      include: { users: true },
    });

    // 3. Store in cache
    if (guild && this.redisClient) {
      try {
        const serializedData = serializeWithBigInt(guild);
        await this._redisSet(cacheKey, serializedData, { EX: CACHE_TTL.GUILD });
        this._logRedis("set", cacheKey, true);
      } catch (err) {
        this._logRedis("set", cacheKey, err);
      }
    }
    return guild;
  }

  async upsertGuild(guildId, data = {}) {
    const result = await this.client.guild.upsert({
      where: { id: guildId },
      create: { id: guildId, ...data },
      update: data,
    });

    // Invalidate Guild cache
    const cacheKey = this._cacheKeyGuild(guildId);
    if (this.redisClient) {
      try {
        await this._redisDel(cacheKey);
        this._logRedis("del", cacheKey, true);
      } catch (err) {
        this._logRedis("del", cacheKey, err);
      }
    }

    return result;
  }

  async getGameRecords(guildId, userId) {
    // Game records are part of Statistics, rely on getUser/getStats caching
    // Fetch stats data first
    const stats = await this._getStatsData(guildId, userId);
    if (!stats) {
      return { 2048: { highScore: 0 }, snake: { highScore: 0 } };
    }

    return {
      2048: { highScore: Number(stats?.["2048"]?.highScore || 0) },
      snake: { highScore: Number(stats?.snake?.highScore || 0) },
    };
  }

  async updateGameHighScore(guildId, userId, gameId, newScore) {
    try {
      // Ensure user exists
      await this.ensureGuildUser(guildId, userId);

      // Get current game records
      const stats = await this.client.statistics.findUnique({
        where: { userId_guildId: { userId, guildId } },
      });

      // Process existing game records - handle all possible formats
      let currentRecords = {
        2048: { highScore: 0 },
        snake: { highScore: 0 },
      };

      if (stats?.gameRecords) {
        try {
          if (
            typeof stats.gameRecords === "object" &&
            !Array.isArray(stats.gameRecords)
          ) {
            // It's already an object
            currentRecords = stats.gameRecords;
          } else if (typeof stats.gameRecords === "string") {
            // It's a JSON string, parse it
            currentRecords = JSON.parse(stats.gameRecords);
            // Handle double-stringified JSON
            if (typeof currentRecords === "string") {
              currentRecords = JSON.parse(currentRecords);
            }
          }
        } catch (error) {
          console.warn(
            `Failed to parse game records for ${userId} in guild ${guildId}: ${error.message}`
          );
        }
      }

      // Ensure we have clean numeric values
      const cleanRecords = {
        2048: { highScore: Number(currentRecords?.["2048"]?.highScore || 0) },
        snake: { highScore: Number(currentRecords?.snake?.highScore || 0) },
      };

      const currentHighScore = cleanRecords[gameId]?.highScore || 0;
      const isNewRecord = newScore > currentHighScore;

      // Only update database if there's a new record
      if (isNewRecord) {
        cleanRecords[gameId].highScore = newScore;

        // Execute the update in a transaction to prevent race conditions
        await this.client.$transaction(async (tx) => {
          // Update user activity
          await tx.user.update({
            where: {
              guildId_id: { guildId, id: userId },
            },
            data: {
              lastActivity: Date.now(),
            },
          });

          // Update the statistics record directly with the object
          await tx.statistics.upsert({
            where: { userId_guildId: { userId, guildId } },
            create: {
              userId,
              guildId,
              gameRecords: cleanRecords, // Store as object directly
              lastUpdated: Date.now(),
            },
            update: {
              gameRecords: cleanRecords, // Store as object directly
              lastUpdated: Date.now(),
            },
          });
        });
      }

      return {
        newHighScore: isNewRecord ? newScore : null,
        previousHighScore: currentHighScore,
        isNewRecord,
      };
    } catch (error) {
      console.error("Error updating game high score:", error);
      return { isNewRecord: false, error: error.message };
    }
  }

  async addXP(guildId, userId, amount, type = "chat") {
    // Don't create a record if adding 0 XP
    if (amount <= 0) {
      return {
        level: {
          userId,
          guildId,
          xp: 0n,
          seasonXp: 0n,
        },
        stats: {
          userId,
          guildId,
          xpStats: { [type]: 0 },
        },
        levelUp: null,
      };
    }

    return await this.client.$transaction(async (prisma) => {
      // Check and update season if needed
      await this.checkAndUpdateSeason();

      // Check if level record exists
      const existingLevel = await prisma.level.findUnique({
        where: {
          userId_guildId: {
            userId,
            guildId,
          },
        },
      });

      // Get the current XP before adding more
      const currentXp = existingLevel?.xp || 0n;

      // Update XP and season XP for the user
      const updatedLevel = await prisma.level.upsert({
        where: {
          userId_guildId: {
            userId,
            guildId,
          },
        },
        create: {
          userId,
          guildId,
          xp: amount,
          seasonXp: amount,
        },
        update: {
          xp: { increment: amount },
          seasonXp: { increment: amount },
        },
      });

      // Check for level up
      const levelUp = this.checkLevelUp(currentXp, updatedLevel.xp);

      // Check if stats record exists
      const existingStats = await prisma.statistics.findUnique({
        where: {
          userId_guildId: {
            userId,
            guildId,
          },
        },
      });

      // Update detailed XP stats only if needed
      let stats;
      if (existingStats) {
        stats = await prisma.statistics.update({
          where: {
            userId_guildId: {
              userId,
              guildId,
            },
          },
          data: {
            xpStats: {
              updateMode: "merge",
              value: {
                [type]: {
                  increment: amount,
                },
              },
            },
          },
        });
      } else {
        stats = await prisma.statistics.create({
          data: {
            userId,
            guildId,
            xpStats: { [type]: amount },
            user: {
              connect: {
                guildId_id: { guildId, id: userId },
              },
            },
          },
        });
      }

      return { level: updatedLevel, stats, levelUp, type: "chat" };
    });
  }

  async addGameXP(guildId, userId, amount, gameType) {
    // Don't create a record if adding 0 XP
    if (amount <= 0) {
      return {
        level: {
          userId,
          guildId,
          gameXp: 0n,
          seasonXp: 0n,
        },
        stats: {
          userId,
          guildId,
          gameXpStats: { [gameType]: 0 },
        },
        levelUp: null,
      };
    }

    // Start a transaction to update both Level and Statistics
    return await this.client.$transaction(async (prisma) => {
      // Check and update season if needed
      await this.checkAndUpdateSeason();

      // Check if level record exists
      const existingLevel = await prisma.level.findUnique({
        where: {
          userId_guildId: {
            userId,
            guildId,
          },
        },
      });

      // Get the current game XP before adding more
      const currentGameXp = existingLevel?.gameXp || 0n;

      // Update total game XP and season XP in Level model
      const level = await prisma.level.upsert({
        where: {
          userId_guildId: {
            userId,
            guildId,
          },
        },
        create: {
          userId,
          guildId,
          gameXp: amount,
          seasonXp: amount, // Add to season XP for new users
        },
        update: {
          gameXp: { increment: amount },
          seasonXp: { increment: amount }, // Also increment season XP
        },
      });

      // Check for level up
      const levelUp = this.checkLevelUp(currentGameXp, level.gameXp);

      // Check if stats record exists
      const existingStats = await prisma.statistics.findUnique({
        where: {
          userId_guildId: {
            userId,
            guildId,
          },
        },
      });

      // Update detailed game XP stats only if needed
      let stats;
      if (existingStats) {
        stats = await prisma.statistics.update({
          where: {
            userId_guildId: {
              userId,
              guildId,
            },
          },
          data: {
            gameXpStats: {
              updateMode: "merge",
              value: {
                [gameType]: {
                  increment: amount,
                },
              },
            },
          },
        });
      } else {
        stats = await prisma.statistics.create({
          data: {
            userId,
            guildId,
            gameXpStats: { [gameType]: amount },
            user: {
              connect: {
                guildId_id: { guildId, id: userId },
              },
            },
          },
        });
      }

      return { level, stats, levelUp, type: gameType };
    });
  }

  async getLevel(guildId, userId, isGame = false) {
    // Use the internal helper which includes caching
    const levelData = await this._getLevelData(guildId, userId);

    if (!levelData) {
      // Should not happen if ensureUser works, but handle defensively
      return this.calculateLevel(0n);
    }

    return this.calculateLevel(isGame ? levelData.gameXp : levelData.xp);
  }

  async getAllLevels(guildId, userId) {
    // Use cached helpers for level and stats data
    const [level, stats] = await Promise.all([
      this._getLevelData(guildId, userId),
      this._getStatsData(guildId, userId),
    ]);

    if (!level) {
      // Should be handled by _getLevelData, return default if still null
      return {
        activity: this.calculateLevel(0n),
        gaming: this.calculateLevel(0n),
        season: this.calculateLevel(0n),
        details: {
          activity: {},
          gaming: {},
        },
      };
    }

    const activityDetails = stats?.xpStats || {};
    const gamingDetails = stats?.gameXpStats || {};

    const result = {
      activity: this.calculateLevel(level.xp),
      gaming: this.calculateLevel(level.gameXp),
      season: this.calculateLevel(level.seasonXp),
      details: { activity: activityDetails, gaming: gamingDetails },
    };

    return result;
  }

  calculateLevel(xp) {
    const xpNumber = typeof xp === "bigint" ? Number(xp) : xp;

    console.log(`calculateLevel input XP: ${xpNumber}`);

    const level = Math.floor(Math.sqrt(xpNumber / 100)) + 1;
    const currentLevelXP = Math.pow(level - 1, 2) * 100;
    const nextLevelXP = Math.pow(level, 2) * 100;

    const actualLevel = xpNumber < 100 ? 1 : level;

    const result = {
      level: actualLevel,
      currentXP: xpNumber - currentLevelXP,
      requiredXP: nextLevelXP - currentLevelXP,
      totalXP: xpNumber,
    };

    console.log(`calculateLevel result: ${JSON.stringify(result)}`);

    return result;
  }

  checkLevelUp(oldXp, newXp) {
    const oldXpNumber = typeof oldXp === "bigint" ? Number(oldXp) : oldXp;
    const newXpNumber = typeof newXp === "bigint" ? Number(newXp) : newXp;

    // Calculate old level using the same formula
    const oldLevelCalc = Math.floor(Math.sqrt(oldXpNumber / 100)) + 1;
    const oldLevel = oldXpNumber < 100 ? 1 : oldLevelCalc;

    // Calculate new level using the same formula
    const newLevelCalc = Math.floor(Math.sqrt(newXpNumber / 100)) + 1;
    const newLevel = newXpNumber < 100 ? 1 : newLevelCalc;

    console.log(
      `checkLevelUp: old XP ${oldXpNumber} (level ${oldLevel}), new XP ${newXpNumber} (level ${newLevel})`
    );

    if (newLevel > oldLevel) {
      return {
        oldLevel,
        newLevel,
        levelUp: true,
      };
    }

    return null;
  }

  async savePlayer(player) {
    try {
      if (!player || !player.guildId) {
        console.log("No player or invalid player provided to savePlayer");
        return null;
      }

      // Don't save if there's nothing to save
      if (
        !player.queue?.current &&
        (!player.queue?.tracks || player.queue.tracks.length === 0)
      ) {
        console.log(`No content to save for player ${player.guildId}`);
        return null;
      }

      // Helper function to safely extract avatar URL
      const getAvatarUrl = (requester) => {
        if (!requester) return null;

        // If avatarURL is a function, call it
        if (typeof requester.avatarURL === "function") {
          try {
            return requester.avatarURL();
          } catch (error) {
            console.error("Error getting avatar URL:", error);
            return null;
          }
        }

        // If it's already a string, return it
        if (typeof requester.avatarURL === "string") {
          return requester.avatarURL;
        }

        // Try displayAvatarURL as fallback
        if (typeof requester.displayAvatarURL === "function") {
          try {
            return requester.displayAvatarURL();
          } catch (error) {
            console.error("Error getting display avatar URL:", error);
            return null;
          }
        }

        return null;
      };

      // Prepare player data with safeguards against invalid data
      const playerData = {
        id: player.guildId,
        voiceChannelId: player.voiceChannelId || null,
        textChannelId: player.textChannelId || null,
        queue:
          player.queue?.tracks?.map((track) => ({
            encoded: track?.encoded || "",
            info: track?.info || {},
            requesterData: track?.requester
              ? {
                  id: track.requester.id,
                  username: track.requester.username || "Unknown",
                  displayName:
                    track.requester.displayName ||
                    track.requester.username ||
                    "Unknown",
                  avatarURL: getAvatarUrl(track.requester),
                  locale: track.requester.locale || "en",
                }
              : null,
          })) || [],
        currentTrack: player.queue?.current
          ? {
              encoded: player.queue.current.encoded || "",
              info: player.queue.current.info || {},
              requesterData: player.queue.current.requester
                ? {
                    id: player.queue.current.requester.id,
                    username:
                      player.queue.current.requester.username || "Unknown",
                    displayName:
                      player.queue.current.requester.displayName ||
                      player.queue.current.requester.username ||
                      "Unknown",
                    avatarURL: getAvatarUrl(player.queue.current.requester),
                    locale: player.queue.current.requester.locale || "en",
                  }
                : null,
            }
          : null,
        position: Math.max(0, Math.floor(player.position)) || 0,
        volume: player.volume || 100,
        repeatMode: player.repeatMode || "off",
        autoplay: !!player.get("autoplay_enabled"),
        filters: player.filters || {},
      };

      // Use a transaction for better reliability
      const result = await this.client.$transaction(
        async (tx) => {
          return await tx.musicPlayer.upsert({
            where: {
              id: playerData.id,
            },
            create: playerData,
            update: playerData,
          });
        },
        {
          timeout: 10000, // 10 second timeout
          isolationLevel: "ReadCommitted", // Less strict isolation level for better performance
        }
      );

      // Invalidate Player Cache
      const cacheKey = this._cacheKeyPlayer(player.guildId);
      if (this.redisClient) {
        try {
          await this._redisDel(cacheKey);
          this._logRedis("del", cacheKey, true);
        } catch (err) {
          this._logRedis("del", cacheKey, err);
        }
      }

      return result;
    } catch (error) {
      console.error(
        `Failed to save player for guild ${player?.guildId || "unknown"}:`,
        error
      );
      return null;
    }
  }

  async getPlayer(guildId) {
    if (!guildId) {
      console.error("Guild ID is required");
      return null;
    }

    const cacheKey = this._cacheKeyPlayer(guildId);

    // 1. Check Cache
    if (this.redisClient) {
      try {
        const cachedData = await this._redisGet(cacheKey);
        if (cachedData) {
          return deserializeWithBigInt(cachedData); // Assuming player data needs deserialization
        }
      } catch (err) {
        this._logRedis("get", cacheKey, err);
      }
    }

    // 2. Fetch from DB
    try {
      const player = await this.client.musicPlayer.findUnique({
        where: { id: guildId },
      });

      // 3. Store in Cache
      if (this.redisClient) {
        try {
          const serializedData = serializeWithBigInt(player); // Serialize even if null
          await this.redisClient.set(cacheKey, serializedData, {
            EX: CACHE_TTL.PLAYER,
          });
          this._logRedis("set", cacheKey, true);
        } catch (err) {
          this._logRedis("set", cacheKey, err);
        }
      }
      return player;
    } catch (error) {
      console.error(`Error getting player ${guildId}:`, error);
      return null;
    }
  }

  async loadPlayers() {
    try {
      console.log("Attempting to load music players from database...");
      let players = await this.client.musicPlayer.findMany({
        where: {},
        select: {
          id: true,
          voiceChannelId: true,
          textChannelId: true,
          queue: true,
          currentTrack: true,
          position: true,
          volume: true,
          repeatMode: true,
          autoplay: true,
          filters: true,
        },
      });

      console.log("Database query completed");
      console.log("Found players:", {
        count: players?.length || 0,
        players: players,
      });
      return players || [];
    } catch (error) {
      console.error("Error loading music players:", error);
      return [];
    }
  }

  async deletePlayer(guildId) {
    if (!guildId) {
      console.log("No guild ID provided for deletion");
      return null;
    }

    try {
      const result = await this.client.musicPlayer.delete({
        where: { id: guildId },
      });

      // Invalidate Player Cache
      const cacheKey = this._cacheKeyPlayer(guildId);
      if (this.redisClient) {
        try {
          await this.redisClient.del(cacheKey);
          this._logRedis("del", cacheKey, true);
        } catch (err) {
          this._logRedis("del", cacheKey, err);
        }
      }

      return result;
    } catch (error) {
      if (error.code === "P2025") {
        console.log(`No music player found for guild ${guildId}`);
        return null;
      }
      console.error(`Error deleting player ${guildId}:`, error);
      throw error;
    }
  }

  async ensurePlayer(guildId, data = {}) {
    if (!guildId) {
      console.error("Guild ID is required");
      return null;
    }

    try {
      // Delete any existing record first
      try {
        await this.client.musicPlayer.delete({
          where: { id: guildId },
        });
      } catch (error) {
        // Ignore deletion errors
        console.log(`No existing record found for ${guildId}`);
      }

      // Create new record
      return await this.client.musicPlayer.create({
        data: {
          id: guildId,
          voiceChannelId: "",
          textChannelId: "",
          queue: [],
          currentTrack: null,
          position: 0,
          volume: 100,
          repeatMode: "off",
          autoplay: false,
          filters: {},
          ...data,
        },
      });
    } catch (error) {
      console.error(`Error ensuring player ${guildId}:`, error);
      throw error;
    }
  }

  async updatePlayer(guildId, data) {
    if (!guildId) {
      console.error("Guild ID is required");
      return null;
    }

    try {
      // Check if player exists first
      const exists = await this.client.musicPlayer.findUnique({
        where: { id: guildId },
        select: { id: true },
      });

      if (!exists) {
        // If it doesn't exist, create it
        return await this.client.musicPlayer.create({
          data: {
            id: guildId,
            ...data,
          },
        });
      }

      // If it exists, update it
      const result = await this.client.musicPlayer.update({
        where: { id: guildId },
        data,
      });

      // Invalidate Player Cache after successful operation
      const cacheKey = this._cacheKeyPlayer(guildId);
      if (this.redisClient) {
        try {
          await this.redisClient.del(cacheKey);
          this._logRedis("del", cacheKey, true);
        } catch (err) {
          this._logRedis("del", cacheKey, err);
        }
      }

      return result;
    } catch (error) {
      console.error(`Error updating player ${guildId}:`, error);
      throw error;
    }
  }

  async getGameRecords(guildId, userId) {
    try {
      await this.ensureGuildUser(guildId, userId);

      // First check if the statistics record exists
      const existingStats = await this.client.statistics.findUnique({
        where: {
          userId_guildId: { userId, guildId },
        },
        select: { gameRecords: true },
      });

      // If no record exists, return default values without creating a record
      if (!existingStats) {
        return {
          2048: { highScore: 0 },
          snake: { highScore: 0 },
        };
      }

      // Process the game records into a clean object
      let gameRecords = {};

      // Handle all possible data formats
      if (existingStats.gameRecords) {
        try {
          if (
            typeof existingStats.gameRecords === "object" &&
            !Array.isArray(existingStats.gameRecords)
          ) {
            // It's already an object
            gameRecords = existingStats.gameRecords;
          } else if (typeof existingStats.gameRecords === "string") {
            // It's a JSON string, parse it
            gameRecords = JSON.parse(existingStats.gameRecords);
            // Handle double-stringified JSON (happens sometimes)
            if (typeof gameRecords === "string") {
              gameRecords = JSON.parse(gameRecords);
            }
          }
        } catch (error) {
          console.warn(
            `Failed to parse game records for ${userId} in guild ${guildId}: ${error.message}`
          );
          // Reset to default if we can't parse
          gameRecords = {
            2048: { highScore: 0 },
            snake: { highScore: 0 },
          };
        }
      } else {
        // If gameRecords is null or undefined, use defaults
        gameRecords = {
          2048: { highScore: 0 },
          snake: { highScore: 0 },
        };
      }

      // Clean and validate data
      const cleanRecords = {
        2048: { highScore: Number(gameRecords?.["2048"]?.highScore || 0) },
        snake: { highScore: Number(gameRecords?.snake?.highScore || 0) },
      };

      // Fix data if it was corrupted
      if (
        JSON.stringify(cleanRecords) !==
        JSON.stringify(existingStats.gameRecords)
      ) {
        await this.client.statistics.update({
          where: { userId_guildId: { userId, guildId } },
          data: { gameRecords: cleanRecords }, // Store as object directly
        });
      }

      return cleanRecords;
    } catch (error) {
      console.error("Error getting game records:", error);
      return {
        2048: { highScore: 0 },
        snake: { highScore: 0 },
      };
    }
  }

  async updateGameHighScore(guildId, userId, gameType, score) {
    try {
      // First ensure user exists to avoid foreign key errors
      await this.ensureGuildUser(guildId, userId);

      // Get current game records
      const stats = await this.client.statistics.findUnique({
        where: { userId_guildId: { userId, guildId } },
        select: { gameRecords: true },
      });

      // Process existing game records - handle all possible formats
      let currentRecords = {
        2048: { highScore: 0 },
        snake: { highScore: 0 },
      };

      if (stats?.gameRecords) {
        try {
          if (
            typeof stats.gameRecords === "object" &&
            !Array.isArray(stats.gameRecords)
          ) {
            // It's already an object
            currentRecords = stats.gameRecords;
          } else if (typeof stats.gameRecords === "string") {
            // It's a JSON string, parse it
            currentRecords = JSON.parse(stats.gameRecords);
            // Handle double-stringified JSON
            if (typeof currentRecords === "string") {
              currentRecords = JSON.parse(currentRecords);
            }
          }
        } catch (error) {
          console.warn(
            `Failed to parse game records for ${userId} in guild ${guildId}: ${error.message}`
          );
        }
      }

      // Ensure we have clean numeric values
      const cleanRecords = {
        2048: { highScore: Number(currentRecords?.["2048"]?.highScore || 0) },
        snake: { highScore: Number(currentRecords?.snake?.highScore || 0) },
      };

      const currentHighScore = cleanRecords[gameType]?.highScore || 0;
      const isNewRecord = score > currentHighScore;

      // Only update database if there's a new record
      if (isNewRecord) {
        cleanRecords[gameType].highScore = score;

        // Execute the update in a transaction to prevent race conditions
        await this.client.$transaction(async (tx) => {
          // Update user activity
          await tx.user.update({
            where: {
              guildId_id: { guildId, id: userId },
            },
            data: {
              lastActivity: Date.now(),
            },
          });

          // Update the statistics record directly with the object
          await tx.statistics.upsert({
            where: { userId_guildId: { userId, guildId } },
            create: {
              userId,
              guildId,
              gameRecords: cleanRecords, // Store as object directly
              lastUpdated: Date.now(),
            },
            update: {
              gameRecords: cleanRecords, // Store as object directly
              lastUpdated: Date.now(),
            },
          });
        });
      }

      return {
        newHighScore: isNewRecord ? score : null,
        previousHighScore: currentHighScore,
        isNewRecord,
      };
    } catch (error) {
      console.error("Error updating game high score:", error);
      return { isNewRecord: false, error: error.message };
    }
  }

  async getInteractionStats(guildId, userId) {
    try {
      const stats = await this.client.statistics.findUnique({
        where: {
          userId_guildId: { userId, guildId },
        },
        select: { interactionStats: true },
      });

      if (!stats) return null;

      // Process interactionStats into a clean object
      let interactionStats = {
        commands: {},
        buttons: {},
        selectMenus: {},
        modals: {},
      };

      // Handle all possible data formats
      if (stats.interactionStats) {
        try {
          if (
            typeof stats.interactionStats === "object" &&
            !Array.isArray(stats.interactionStats)
          ) {
            // It's already an object
            interactionStats = stats.interactionStats;
          } else if (typeof stats.interactionStats === "string") {
            // It's a JSON string, parse it
            interactionStats = JSON.parse(stats.interactionStats);
            // Handle double-stringified JSON
            if (typeof interactionStats === "string") {
              interactionStats = JSON.parse(interactionStats);
            }
          }
        } catch (error) {
          console.warn(
            `Failed to parse interaction stats for ${userId} in guild ${guildId}: ${error.message}`
          );
        }
      }

      // Ensure we have the correct structure
      return {
        commands: interactionStats.commands || {},
        buttons: interactionStats.buttons || {},
        selectMenus: interactionStats.selectMenus || {},
        modals: interactionStats.modals || {},
      };
    } catch (error) {
      console.error("Error getting interaction stats:", error);
      return null;
    }
  }

  async getMostUsedInteractions(guildId, userId, type, limit = 5) {
    const stats = await this.getInteractionStats(guildId, userId);
    if (!stats || !stats[type]) return [];

    return Object.entries(stats[type])
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([name, count]) => ({ name, count }));
  }

  async transaction(fn) {
    return this.client.$transaction(fn);
  }

  // Universal data access
  async get(path) {
    if (!path || typeof path !== "string") {
      throw new Error("Invalid path: must be a non-empty string");
    }

    const parts = path.split(".");

    // Handle guild and user paths (main functionality)
    if (parts[0]) {
      // Check if this is a guild-related path
      if ((await this.client.guild.count({ where: { id: parts[0] } })) > 0) {
        const guildId = parts[0];

        // Get guild data with necessary relations
        const guild = await this.client.guild.findUnique({
          where: { id: guildId },
          include: {
            users: {
              include: {
                economy: true,
                level: true,
                cooldowns: true,
                upgrades: true,
                stats: true,
              },
            },
          },
        });

        // If no guild found, return default values
        if (!guild && parts.length === 1) {
          return DEFAULT_VALUES.guild;
        }

        // Handle user data
        if (parts.length > 1) {
          const userId = parts[1];
          let user = guild?.users.find((u) => u.id === userId);

          // If no user found, return default values
          if (!user) {
            user = {
              ...DEFAULT_VALUES.user,
              id: userId,
              guildId,
              economy: {
                balance: DEFAULT_VALUES.economy.balance,
                bankBalance: DEFAULT_VALUES.economy.bankBalance,
                bankRate: DEFAULT_VALUES.economy.bankRate,
                bankStartTime: DEFAULT_VALUES.economy.bankStartTime,
              },
              level: { xp: 0 },
              cooldowns: { data: {} }, // Use object directly, not stringified
              upgrades: Object.entries(DEFAULT_VALUES.upgrades).map(
                ([type, data]) => ({
                  type,
                  level: data.level,
                })
              ),
            };
          }

          // Return specific field if requested
          if (parts.length > 2) {
            const field = parts[2];
            switch (field) {
              case "balance":
                return user.economy?.balance ?? DEFAULT_VALUES.economy.balance;
              case "bankBalance":
                return (
                  user.economy?.bankBalance ??
                  DEFAULT_VALUES.economy.bankBalance
                );
              case "bankRate":
                return (
                  user.economy?.bankRate ?? DEFAULT_VALUES.economy.bankRate
                );
              case "bankStartTime":
                return (
                  user.economy?.bankStartTime ??
                  DEFAULT_VALUES.economy.bankStartTime
                );
              case "messageCount":
                return (
                  user.stats?.messageCount ?? DEFAULT_VALUES.stats.messageCount
                );
              case "commandCount":
                return (
                  user.stats?.commandCount ?? DEFAULT_VALUES.stats.commandCount
                );
              case "totalEarned":
                return (
                  user.stats?.totalEarned ?? DEFAULT_VALUES.stats.totalEarned
                );
              case "xp":
                return user.level?.xp ?? 0;
              case "cooldowns":
                // Handle different cooldown data formats
                if (!user.cooldowns) return {};

                try {
                  if (
                    typeof user.cooldowns.data === "object" &&
                    !Array.isArray(user.cooldowns.data)
                  ) {
                    return user.cooldowns.data;
                  } else if (typeof user.cooldowns.data === "string") {
                    return JSON.parse(user.cooldowns.data || "{}");
                  }
                  return {};
                } catch (error) {
                  console.warn(
                    `Failed to parse cooldown data: ${error.message}`
                  );
                  return {};
                }
              case "upgrades":
                return (
                  user.upgrades?.reduce(
                    (acc, u) => ({
                      ...acc,
                      [u.type]: { level: u.level },
                    }),
                    {}
                  ) ?? DEFAULT_VALUES.upgrades
                );
              default:
                return user[field] ?? DEFAULT_VALUES.user[field];
            }
          }

          // Return full user data
          const cooldownsData = user.cooldowns?.data;
          let parsedCooldowns = {};

          try {
            if (
              typeof cooldownsData === "object" &&
              !Array.isArray(cooldownsData)
            ) {
              parsedCooldowns = cooldownsData;
            } else if (typeof cooldownsData === "string") {
              parsedCooldowns = JSON.parse(cooldownsData || "{}");
            }
          } catch (error) {
            console.warn(
              `Failed to parse cooldown data for ${userId} in guild ${guildId}: ${error.message}`
            );
          }

          return {
            ...user,
            balance: user.economy?.balance ?? DEFAULT_VALUES.economy.balance,
            bankBalance:
              user.economy?.bankBalance ?? DEFAULT_VALUES.economy.bankBalance,
            bankRate: user.economy?.bankRate ?? DEFAULT_VALUES.economy.bankRate,
            bankStartTime:
              user.economy?.bankStartTime ??
              DEFAULT_VALUES.economy.bankStartTime,
            messageCount:
              user.stats?.messageCount ?? DEFAULT_VALUES.stats.messageCount,
            commandCount:
              user.stats?.commandCount ?? DEFAULT_VALUES.stats.commandCount,
            totalEarned:
              user.stats?.totalEarned ?? DEFAULT_VALUES.stats.totalEarned,
            xp: user.level?.xp ?? 0,
            cooldowns: parsedCooldowns,
            upgrades:
              user.upgrades?.reduce(
                (acc, u) => ({
                  ...acc,
                  [u.type]: { level: u.level },
                }),
                {}
              ) ?? DEFAULT_VALUES.upgrades,
          };
        }

        // Return full guild data
        return guild || DEFAULT_VALUES.guild;
      }

      // Handle custom paths (non-guild related)
      const customData = await this.client.analytics.findFirst({
        where: { type: parts[0] },
        orderBy: { timestamp: "desc" },
      });

      if (!customData) return null;

      // Navigate through the path to get the specific value
      let value = customData.data;
      for (let i = 1; i < parts.length; i++) {
        value = value?.[parts[i]];
        if (value === undefined) return null;
      }

      return value;
    }

    throw new Error("Invalid path");
  }

  async updateUpgrades(guildId, userId, upgrades) {
    const updatePromises = Object.entries(upgrades).map(([type, data]) => {
      // Only store upgrades that differ from default level 1
      if (data.level === 1) {
        // If level is 1 (default), try to delete the record if it exists
        return this.client.upgrade.deleteMany({
          where: {
            userId,
            guildId,
            type,
          },
        });
      } else {
        // Otherwise, upsert the upgrade
        return this.client.upgrade.upsert({
          where: {
            userId_guildId_type: {
              userId,
              guildId,
              type,
            },
          },
          create: {
            userId,
            guildId,
            type,
            level: data.level,
          },
          update: {
            level: data.level,
          },
        });
      }
    });

    return Promise.all(updatePromises);
  }

  // Get info about an upgrade based on type and level
  async getUpgradeInfo(type, level) {
    if (!UPGRADES[type]) {
      throw new Error(`Invalid upgrade type: ${type}`);
    }

    // Calculate the price for this level
    const basePrice = UPGRADES[type].basePrice;
    const priceMultiplier = UPGRADES[type].priceMultiplier;

    // Price increases exponentially with level
    // Level 1 is the base level, levels start at 2
    const price = Math.floor(basePrice * Math.pow(priceMultiplier, level - 1));

    // Calculate effect for this level
    let effect;
    if (UPGRADES[type].effectMultiplier) {
      // For percentage-based effects
      effect = 1 + (level - 1) * UPGRADES[type].effectMultiplier;
    } else if (UPGRADES[type].effectValue) {
      // For absolute value effects
      effect = (level - 1) * UPGRADES[type].effectValue;
    } else {
      // Default
      effect = level;
    }

    return {
      type,
      level,
      price,
      effect,
      basePrice: UPGRADES[type].basePrice,
      priceMultiplier: UPGRADES[type].priceMultiplier,
    };
  }

  // Purchase an upgrade
  async purchaseUpgrade(guildId, userId, type) {
    // Get current upgrade level
    const upgrade = await this.client.upgrade.findUnique({
      where: {
        userId_guildId_type: {
          userId,
          guildId,
          type,
        },
      },
    });

    const currentLevel = upgrade?.level || 1;

    // Get upgrade info to calculate price
    const upgradeInfo = await this.getUpgradeInfo(type, currentLevel);

    // Get user's economy data
    const economy = await this.client.economy.findUnique({
      where: {
        userId_guildId: {
          userId,
          guildId,
        },
      },
    });

    if (!economy) {
      throw new Error("User economy data not found");
    }

    // Get user's discount if any
    const discountPercent = Number(economy.upgradeDiscount || 0);

    // Apply discount to the price if applicable
    let finalPrice = upgradeInfo.price;
    if (discountPercent > 0) {
      finalPrice = Math.max(
        1,
        Math.floor(finalPrice * (1 - discountPercent / 100))
      );
    }

    // Check if user has enough balance
    if (Number(economy.balance) < finalPrice) {
      throw new Error("Insufficient balance");
    }

    // Start transaction
    return this.client.$transaction(async (tx) => {
      // Deduct the price from user's balance
      await tx.economy.update({
        where: {
          userId_guildId: {
            userId,
            guildId,
          },
        },
        data: {
          balance: {
            decrement: finalPrice,
          },
        },
      });

      // Reset discount if used
      if (discountPercent > 0) {
        await tx.economy.update({
          where: {
            userId_guildId: {
              userId,
              guildId,
            },
          },
          data: {
            upgradeDiscount: 0,
          },
        });
      }

      // Update or create the upgrade
      return tx.upgrade.upsert({
        where: {
          userId_guildId_type: {
            userId,
            guildId,
            type,
          },
        },
        create: {
          userId,
          guildId,
          type,
          level: 2, // First purchase means level 2 (since level 1 is default)
        },
        update: {
          level: {
            increment: 1,
          },
        },
      });
    });
  }

  // Get all upgrades for a user
  async getUserUpgrades(guildId, userId) {
    // Upgrades are included in the 'full' user object cache.
    // Fetch the user with relations.
    const user = await this.getUser(guildId, userId, true); // This uses caching
    return user?.upgrades || [];
  }

  // Revert an upgrade (decrease level by 1 and refund 85% of the price)
  async revertUpgrade(guildId, userId, type) {
    // Check if there's a cooldown for upgrade reverts
    const revertCooldown = await this.getCooldown(
      guildId,
      userId,
      "upgraderevert"
    );
    if (revertCooldown > 0) {
      throw new Error(`Cooldown active: ${revertCooldown}`);
    }

    // Get current upgrade level
    const upgrade = await this.client.upgrade.findUnique({
      where: {
        userId_guildId_type: {
          userId,
          guildId,
          type,
        },
      },
    });

    const currentLevel = upgrade?.level || 1;

    // Cannot revert level 1 upgrades (they are the default)
    if (currentLevel <= 1) {
      throw new Error("Cannot revert a level 1 upgrade");
    }

    // Get upgrade info to calculate refund amount
    const upgradeInfo = await this.getUpgradeInfo(type, currentLevel);
    const refundAmount = Math.floor(upgradeInfo.price * 0.85); // 85% refund

    // Start transaction
    return this.client.$transaction(async (tx) => {
      // Add the refund to user's balance
      await tx.economy.update({
        where: {
          userId_guildId: {
            userId,
            guildId,
          },
        },
        data: {
          balance: {
            increment: refundAmount,
          },
        },
      });

      // Decrease the upgrade level or delete if going back to level 1
      if (currentLevel === 2) {
        // If reverting to level 1, delete the upgrade record
        await tx.upgrade.delete({
          where: {
            userId_guildId_type: {
              userId,
              guildId,
              type,
            },
          },
        });
      } else {
        // Otherwise, decrease the level
        await tx.upgrade.update({
          where: {
            userId_guildId_type: {
              userId,
              guildId,
              type,
            },
          },
          data: {
            level: {
              decrement: 1,
            },
          },
        });
      }

      // Set cooldown for upgrade reverts
      await this.updateCooldown(guildId, userId, "upgraderevert");

      return {
        previousLevel: currentLevel,
        newLevel: currentLevel - 1,
        refundAmount,
      };
    });
  }

  async createVoiceSession(guildId, userId, channelId, joinedAt) {
    return await this.client.voiceSession.upsert({
      where: {
        userId_guildId: { userId, guildId },
      },
      create: {
        channelId,
        joinedAt: BigInt(joinedAt),
        user: {
          connect: {
            guildId_id: { guildId, id: userId },
          },
        },
      },
      update: {
        channelId,
        joinedAt: BigInt(joinedAt),
      },
    });
  }

  async removeVoiceSession(guildId, userId) {
    // Invalidate Voice Session cache *before* delete
    const cacheKey = this._cacheKeyVoiceSession(guildId, userId);
    let oldSession = null;
    if (this.redisClient) {
      try {
        // Get old session first to know which list cache to potentially clear
        const cachedData = await this.redisClient.get(cacheKey);
        if (cachedData) oldSession = deserializeWithBigInt(cachedData);

        await this.redisClient.del(cacheKey);
        this._logRedis("del", cacheKey, true);
      } catch (err) {
        this._logRedis("del", cacheKey, err);
      }
    }

    const result = await this.client.voiceSession.delete({
      where: {
        userId_guildId: { userId, guildId },
      },
    });

    // Invalidate list cache if old session data was found
    if (oldSession?.channelId) {
      const listCacheKey = this._cacheKeyAllVoiceSessions(
        guildId,
        oldSession.channelId
      );
      if (this.redisClient) {
        try {
          await this.redisClient.del(listCacheKey);
          this._logRedis("del", listCacheKey, true);
        } catch (err) {
          this._logRedis("del", listCacheKey, err);
        }
      }
    }

    return result;
  }

  async getVoiceSession(guildId, userId) {
    const cacheKey = this._cacheKeyVoiceSession(guildId, userId);

    // 1. Check Cache
    if (this.redisClient) {
      try {
        const cachedData = await this.redisClient.get(cacheKey);
        this._logRedis("get", cacheKey, cachedData);
        if (cachedData) {
          return deserializeWithBigInt(cachedData);
        }
      } catch (err) {
        this._logRedis("get", cacheKey, err);
      }
    }

    // 2. Fetch from DB
    const session = await this.client.voiceSession.findUnique({
      where: {
        userId_guildId: { userId, guildId },
      },
    });

    // 3. Store in Cache
    if (this.redisClient) {
      try {
        const serializedData = serializeWithBigInt(session); // Handles null
        await this.redisClient.set(cacheKey, serializedData, {
          EX: CACHE_TTL.VOICE_SESSION,
        });
        this._logRedis("set", cacheKey, true);
      } catch (err) {
        this._logRedis("set", cacheKey, err);
      }
    }

    return session;
  }

  async getAllVoiceSessions(guildId, channelId) {
    // Caching lists can be tricky due to invalidation.
    // Simple approach: cache the list result.
    const cacheKey = this._cacheKeyAllVoiceSessions(guildId, channelId);

    // 1. Check Cache
    if (this.redisClient) {
      try {
        const cachedData = await this.redisClient.get(cacheKey);
        this._logRedis("get", cacheKey, cachedData);
        if (cachedData) {
          return deserializeWithBigInt(cachedData);
        }
      } catch (err) {
        this._logRedis("get", cacheKey, err);
      }
    }

    // 2. Fetch from DB
    const sessions = await this.client.voiceSession.findMany({
      where: {
        guildId,
        channelId,
      },
    });

    // 3. Store in Cache
    if (this.redisClient) {
      try {
        const serializedData = serializeWithBigInt(sessions);
        // Use a shorter TTL for lists as they change more often? Or rely on individual session invalidation to clear this?
        // For simplicity, let's use a default TTL here. More complex invalidation could be added.
        await this.redisClient.set(cacheKey, serializedData, {
          EX: CACHE_TTL.DEFAULT,
        });
        this._logRedis("set", cacheKey, true);
      } catch (err) {
        this._logRedis("set", cacheKey, err);
      }
    }
    return sessions;
  }

  async calculateAndAddVoiceXP(guildId, userId, session) {
    const timeSpent = Date.now() - Number(session.joinedAt);

    // Get guild settings for XP amount
    const guildSettings = await this.client.guild.findUnique({
      where: { id: guildId },
      select: { settings: true },
    });

    const xpPerMinute = guildSettings?.settings?.xp_per_voice_minute || 1;
    const xpAmount = Math.floor((timeSpent / 60000) * xpPerMinute);

    if (xpAmount > 0) {
      await this.addXP(guildId, userId, xpAmount, "voice");

      // Update voice time in statistics
      await this.client.statistics.update({
        where: {
          userId_guildId: { userId, guildId },
        },
        data: {
          voiceTime: {
            increment: timeSpent,
          },
        },
      });
    }

    return { timeSpent, xpAmount };
  }

  // --- Cache Key Helper Methods ---
  _cacheKeyUser(guildId, userId, full = true) {
    return `user:${guildId}:${userId}${full ? ":full" : ""}`;
  }

  _cacheKeyUserLocale(guildId, userId) {
    return `user:${guildId}:${userId}:locale`;
  }

  _cacheKeyCooldown(guildId, userId) {
    return `cooldown:${guildId}:${userId}`;
  }
  _cacheKeyLevel(guildId, userId) {
    return `level:${guildId}:${userId}`;
  }
  _cacheKeyStats(guildId, userId) {
    return `stats:${guildId}:${userId}`;
  }
  _cacheKeyCrates(guildId, userId) {
    return `crates:${guildId}:${userId}`; // For list of crates
  }
  _cacheKeyCrate(guildId, userId, type) {
    return `crate:${guildId}:${userId}:${type}`; // Specific crate
  }
  _cacheKeyGuild(guildId) {
    return `guild:${guildId}`;
  }
  _cacheKeyPlayer(guildId) {
    return `player:${guildId}`;
  }
  _cacheKeySeason() {
    return `season:current`;
  }
  _cacheKeyVoiceSession(guildId, userId) {
    return `voice_session:${guildId}:${userId}`;
  }
  _cacheKeyAllVoiceSessions(guildId, channelId) {
    return `voicesessions:${guildId}:${channelId}`;
  }

  // --- Logging Helper ---
  _logRedis(operation, key, value) {
    if (process.env.REDIS_LOG) {
      console.log(`Redis ${operation}: ${key} = ${value}`);
    }
  }

  // Internal helper to get cooldown data with caching
  async _getCooldownData(guildId, userId) {
    const cacheKey = this._cacheKeyCooldown(guildId, userId);
    let cooldowns = {};

    // 1. Try fetching from Redis first
    if (this.redisClient) {
      try {
        const cachedData = await this.redisClient.get(cacheKey);
        this._logRedis("get", cacheKey, cachedData);
        if (cachedData) {
          cooldowns = deserializeWithBigInt(cachedData); // Use your deserializer
          return cooldowns; // Return cached data
        } else {
          // Cache miss, proceed to fetch from DB (will be done below)
          cooldowns = null; // Mark as null to fetch from DB
        }
      } catch (err) {
        this._logRedis("get", cacheKey, err);
        cooldowns = null; // Fallback to DB on error
      }
    }

    // 2. Fetch from DB if not found in cache or Redis unavailable/error
    if (cooldowns === null) {
      const cooldownRecord = await this.client.cooldown.findUnique({
        where: { userId_guildId: { userId, guildId } },
      });

      if (cooldownRecord?.data) {
        if (
          typeof cooldownRecord.data === "object" &&
          !Array.isArray(cooldownRecord.data)
        ) {
          cooldowns = cooldownRecord.data;
        } else if (typeof cooldownRecord.data === "string") {
          try {
            cooldowns = JSON.parse(cooldownRecord.data);
          } catch (error) {
            console.warn(
              `Failed to parse cooldown data for ${userId} in guild ${guildId}: ${error.message}`
            );
            cooldowns = {};
          }
        }
      } else {
        cooldowns = {}; // Default to empty object if no record
      }

      // 3. Store fetched data in Redis (if available)
      if (this.redisClient) {
        try {
          await this.redisClient.set(
            cacheKey,
            serializeWithBigInt(cooldowns), // Use your serializer
            { EX: CACHE_TTL.COOLDOWN } // Use defined TTL (node-redis syntax)
          );
          this._logRedis("set", cacheKey, true);
        } catch (err) {
          this._logRedis("set", cacheKey, err);
        }
      }
    }

    return cooldowns;
  }

  // --- Redis Command Wrappers with Retry ---
  async _redisGet(key) {
    if (!this.redisClient || !this.redisClient.isReady) {
      this._logRedis("get", key, new Error("Redis client not ready"));
      return null; // Or throw? Returning null allows fallback to DB.
    }

    let retries = 0;
    while (retries < MAX_RETRIES) {
      try {
        const result = await this.redisClient.get(key);
        this._logRedis("get", key, result);
        return result;
      } catch (error) {
        // Check if it's a connection error (e.g., ECONNRESET, TIMEOUT)
        const isConnectionError =
          error.code === "ECONNRESET" ||
          error.code === "ETIMEDOUT" ||
          error.message.toLowerCase().includes("connection");
        retries++;
        if (!isConnectionError || retries >= MAX_RETRIES) {
          this._logRedis("get", key, error);
          return null; // Return null on non-connection error or max retries
        }
        const delayMs = Math.min(
          INITIAL_DELAY_MS * Math.pow(2, retries - 1),
          MAX_DELAY_MS
        );
        console.warn(
          `Redis GET failed for ${key} (Attempt ${retries}/${MAX_RETRIES}). Retrying in ${delayMs}ms...`
        );
        await delay(delayMs);
        // Ensure client is reconnected if needed (node-redis might handle this automatically)
        if (!this.redisClient.isReady) {
          try {
            await this.redisClient.connect();
          } catch {}
        }
      }
    }
    return null; // Failed after retries
  }

  async _redisSet(key, value, options) {
    if (!this.redisClient || !this.redisClient.isReady) {
      this._logRedis("set", key, new Error("Redis client not ready"));
      return false;
    }

    let retries = 0;
    while (retries < MAX_RETRIES) {
      try {
        await this.redisClient.set(key, value, options);
        this._logRedis("set", key, true);
        return true;
      } catch (error) {
        const isConnectionError =
          error.code === "ECONNRESET" ||
          error.code === "ETIMEDOUT" ||
          error.message.toLowerCase().includes("connection");
        retries++;
        if (!isConnectionError || retries >= MAX_RETRIES) {
          this._logRedis("set", key, error);
          return false;
        }
        const delayMs = Math.min(
          INITIAL_DELAY_MS * Math.pow(2, retries - 1),
          MAX_DELAY_MS
        );
        console.warn(
          `Redis SET failed for ${key} (Attempt ${retries}/${MAX_RETRIES}). Retrying in ${delayMs}ms...`
        );
        await delay(delayMs);
        if (!this.redisClient.isReady) {
          try {
            await this.redisClient.connect();
          } catch {}
        }
      }
    }
    return false;
  }

  async _redisDel(keys) {
    if (!this.redisClient || !this.redisClient.isReady) {
      this._logRedis(
        "del",
        Array.isArray(keys) ? keys.join(", ") : keys,
        new Error("Redis client not ready")
      );
      return false;
    }
    const keysToDelete = Array.isArray(keys) ? keys : [keys];
    if (keysToDelete.length === 0) return true;

    let retries = 0;
    while (retries < MAX_RETRIES) {
      try {
        await this.redisClient.del(keysToDelete);
        this._logRedis("del", keysToDelete.join(", "), true);
        return true;
      } catch (error) {
        const isConnectionError =
          error.code === "ECONNRESET" ||
          error.code === "ETIMEDOUT" ||
          error.message.toLowerCase().includes("connection");
        retries++;
        if (!isConnectionError || retries >= MAX_RETRIES) {
          this._logRedis("del", keysToDelete.join(", "), error);
          return false;
        }
        const delayMs = Math.min(
          INITIAL_DELAY_MS * Math.pow(2, retries - 1),
          MAX_DELAY_MS
        );
        console.warn(
          `Redis DEL failed for ${keysToDelete.join(
            ", "
          )} (Attempt ${retries}/${MAX_RETRIES}). Retrying in ${delayMs}ms...`
        );
        await delay(delayMs);
        if (!this.redisClient.isReady) {
          try {
            await this.redisClient.connect();
          } catch {}
        }
      }
    }
    return false;
  }
}

// Export the Database class instance without initializing
const instance = new Database();
export default instance;
