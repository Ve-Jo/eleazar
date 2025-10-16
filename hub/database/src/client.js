import dotenv from "dotenv";
import { PrismaClient, Prisma } from "@prisma/client"; // Added Prisma
// Redis functionality completely disabled

// Load environment variables
dotenv.config({ path: "../.env" });

export function serializeWithBigInt(data) {
  return JSON.stringify(data, (_, value) => {
    if (typeof value === "bigint") {
      return { type: "BigInt", value: value.toString() };
    }
    // Handle Prisma Decimal type
    if (value instanceof Prisma.Decimal) {
      return { type: "Decimal", value: value.toString() };
    }
    return value;
  });
}

export function deserializeWithBigInt(jsonString) {
  if (!jsonString) {
    return jsonString;
  }
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
        try {
          return new Prisma.Decimal(value.value);
        } catch {
          console.warn("Failed to parse Decimal:", value.value);
          return value.value;
        }
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
      seasonXp_chance: 0.5,
      seasonXp_amount: 50,
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
      seasonXp_chance: 0.5, // Reduced from 0.7
      seasonXp_amount: 100, // Reduced from 200
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

// Cache TTLs removed - Redis functionality disabled

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

    // Redis functionality completely disabled
    this.redisClient = null;
    console.log("Redis caching is completely disabled.");

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
                    include: {
                      economy: true,
                      stats: true,
                      Level: true,
                      cooldowns: true,
                      upgrades: true,
                    },
                  });

                  if (existingUser) {
                    console.log(
                      `User ${params.args.data.id} already exists in guild ${params.args.data.guildId}, returning existing record.`
                    );
                    // Return the existing user WITH relations
                    return existingUser;
                  }

                  // If user doesn't exist in *this* guild, the P2002 must be
                  // from a different constraint or a more complex issue.
                  // Let the original error propagate for now.
                  console.warn(
                    `P2002 error for user ${params.args.data.id} in guild ${params.args.data.guildId}, but user not found in this guild. Propagating error.`
                  );
                  // Remove composite ID logic
                  /*
                  const compositeId = `${params.args.data.id}_${params.args.data.guildId}`;
                  console.log(
                    `Creating user with composite ID: ${compositeId}`
                  );
                  const newArgs = {
                    ...params.args,
                    data: {
                      ...params.args.data,
                      id: compositeId,
                    },
                    // We would need to re-add relation creation logic here, which is complex
                  };
                  return await this.client[params.model][params.action](
                    newArgs
                  );
                  */
                } catch (innerError) {
                  console.error("Error during P2002 handling:", innerError);
                  // Fall through to re-throw original error if inner handling fails
                }
              }

              // Re-throw the original P2002 error if it wasn't handled above
              // or if it wasn't the specific User creation case we checked for.
              throw new Error(
                `Duplicate entry constraint violation (P2002) on ${error.meta?.target?.join(
                  ", "
                )}`
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
    // Redis caching disabled - fetch directly from database
    try {
      const season = await this.client.seasons.findUnique({
        where: { id: "current" },
      });

      return season;
    } catch (error) {
      console.error("Error getting current season:", error);
      throw error;
    }
  }

  async disconnect() {
    try {
      await this.client.$disconnect();
      console.log("Database connection closed successfully");
    } catch (error) {
      console.error("Error disconnecting from database:", error);
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
    let cooldowns = {};

    // Redis caching disabled
    cooldowns = null; // Fetch from DB

    // 2. Fetch from DB if not found in cache or Redis unavailable/error
    if (cooldowns === null) {
      const cooldownRecord = await this.client.cooldown.findUnique({
        where: { guildId_userId: { guildId, userId } },
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

      // Redis caching disabled
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

    // Redis cache invalidation disabled

    // Initialize a clean object to work with
    let cooldowns = {};

    // If data exists and it's an object, use it directly
    const cooldown = await this.client.cooldown.findUnique({
      where: { guildId_userId: { guildId, userId } },
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
            guildId_userId: {
              guildId,
              userId,
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
          guildId_userId: {
            guildId,
            userId,
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

  async setCooldown(guildId, userId, type, duration) {
    // First, make sure the user exists to avoid constraint errors
    await this.ensureUser(guildId, userId);

    // Initialize a clean object to work with
    let cooldowns = {};

    // If data exists and it's an object, use it directly
    const cooldown = await this.client.cooldown.findUnique({
      where: { guildId_userId: { guildId, userId } },
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

    // Set the cooldown timestamp to current time plus duration
    cooldowns[type] = Date.now() + duration;

    // Perform cleanup - remove expired cooldowns
    const now = Date.now();
    Object.entries(cooldowns).forEach(([cooldownType, timestamp]) => {
      // Skip cleanup for crate cooldowns
      if (cooldownType.startsWith("crate_")) return;

      const baseTime = COOLDOWNS[cooldownType];
      if (!baseTime || now >= timestamp) {
        delete cooldowns[cooldownType];
      }
    });

    // If no active cooldowns, delete the record ONLY if there are no crate cooldowns
    const hasCrateCooldowns = Object.keys(cooldowns).some((key) =>
      key.startsWith("crate_")
    );
    if (
      Object.keys(cooldowns).length === 0 ||
      (!hasCrateCooldowns &&
        Object.keys(cooldowns).every((key) => {
          const baseTime = COOLDOWNS[key];
          return !baseTime || now >= cooldowns[key];
        }))
    ) {
      if (cooldown) {
        return this.client.cooldown.delete({
          where: {
            guildId_userId: {
              guildId,
              userId,
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
          guildId_userId: {
            guildId,
            userId,
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
        `Error setting cooldown for ${userId} in guild ${guildId}:`,
        error
      );
      // If something went wrong, return a placeholder
      return { userId, guildId, data: {} };
    }
  }

  async incrementMessageCount(guildId, userId) {
    const result = await this.client.statistics.upsert({
      where: {
        guildId_userId: { guildId, userId },
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
        guildId,
        userId,
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

    // Redis cache invalidation disabled

    return result;
  }

  async incrementCommandCount(guildId, userId) {
    const result = await this.client.statistics.upsert({
      where: {
        guildId_userId: { guildId, userId },
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
        guildId,
        userId,
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

    // Redis cache invalidation disabled
    // Also invalidate full user cache as stats might be embedded
    // Redis cache invalidation disabled

    return result;
  }

  async getUserCrates(guildId, userId) {
    // Redis caching disabled - fetch directly from database
    await this.ensureUser(guildId, userId);
    const crates = await this.client.crate.findMany({
      where: {
        userId,
        guildId,
      },
    });

    return crates;
  }

  // Get a specific crate or create it if not exists
  async getUserCrate(guildId, userId, type) {
    // Redis caching disabled - fetch directly from database
    await this.ensureUser(guildId, userId);
    const crate = await this.client.crate.upsert({
      where: {
        guildId_userId_type: {
          guildId,
          userId,
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

    return crate;
  }

  // Add a crate to user's inventory
  async addCrate(guildId, userId, type, count = 1, properties = {}) {
    await this.ensureUser(guildId, userId);

    const result = await this.client.crate.upsert({
      where: {
        guildId_userId_type: {
          guildId,
          userId,
          type,
        },
      },
      create: {
        guildId,
        userId,
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

    // Redis cache invalidation disabled

    return result;
  }

  // Remove a crate from user's inventory

  // Update cooldown for a crate type
  async updateCrateCooldown(guildId, userId, type) {
    // Ensure user exists first
    await this.ensureUser(guildId, userId); // ensureUser uses cached getUser

    // Redis cache invalidation disabled

    // Make sure we're working with a proper object
    let cooldowns = {};

    // Fetch current data for merging
    const cooldown = await this.client.cooldown.findUnique({
      where: { guildId_userId: { guildId, userId } },
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
    const timestamp = Date.now();
    cooldowns[crateKey] = timestamp;
    console.log(
      `Setting cooldown for ${type}: ${timestamp} (key: ${crateKey})`
    );

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
        guildId_userId: {
          guildId,
          userId,
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
    // Redis cache invalidation disabled

    // Fetch current data for merging
    const cooldown = await this.client.cooldown.findUnique({
      where: { guildId_userId: { guildId, userId } },
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
        guildId_userId: {
          guildId,
          userId,
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
        guildId_userId: {
          guildId,
          userId,
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
        guildId_userId: {
          guildId,
          userId,
        },
      },
    });

    const currentDiscount = Number(economy?.upgradeDiscount || 0);
    const newDiscount = currentDiscount + discountPercent;

    return this.client.economy.upsert({
      where: {
        guildId_userId: {
          guildId,
          userId,
        },
      },
      create: {
        guildId,
        userId,
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
        guildId_userId: {
          guildId,
          userId,
        },
      },
    });

    if (!economy) return null;

    return this.client.economy.update({
      where: {
        guildId_userId: {
          guildId,
          userId,
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
        guildId_userId_type: {
          guildId,
          userId,
          type,
        },
      },
    });

    // For standard crates like daily/weekly, we check cooldowns
    if (["daily", "weekly"].includes(type)) {
      const cooldown = await this.getCrateCooldown(guildId, userId, type);
      if (cooldown && Date.now() < cooldown) {
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
      seasonXp: 0,
      discount: 0,
    };

    // Generate coins reward
    rewards.coins = Math.floor(
      Math.random() *
        (crateConfig.rewards.max_coins - crateConfig.rewards.min_coins + 1) +
        crateConfig.rewards.min_coins
    );

    // Season XP reward (chance-based)
    if (Math.random() < crateConfig.rewards.seasonXp_chance) {
      rewards.seasonXp = crateConfig.rewards.seasonXp_amount;
    }

    // Discount reward (chance-based)
    const discountRoll = Math.random();
    console.log(
      `Discount roll: ${discountRoll}, chance: ${crateConfig.rewards.discount_chance}`
    );
    if (discountRoll < crateConfig.rewards.discount_chance) {
      rewards.discount = crateConfig.rewards.discount_amount;
      console.log(`Discount awarded: ${rewards.discount}%`);
    } else {
      console.log("No discount awarded");
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

      // Season XP is handled separately (not implemented in this method)

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

    const decimalAmount = new Prisma.Decimal(amount);

    const result = await this.client.$transaction(async (tx) => {
      // Check if we're creating a default record with 0 balance
      if (decimalAmount.equals(0)) {
        // Check if an economy record exists
        const existingEconomy = await tx.economy.findUnique({
          where: {
            guildId_userId: {
              guildId,
              userId,
            },
          },
        });

        // If there's no existing record, no need to create one with all zeros
        if (!existingEconomy) {
          return {
            userId,
            guildId,
            balance: new Prisma.Decimal(0),
            bankBalance: new Prisma.Decimal(0),
            bankRate: new Prisma.Decimal(0),
            bankStartTime: 0,
          };
        }
      }

      const economy = await tx.economy.upsert({
        where: {
          guildId_userId: {
            guildId,
            userId,
          },
        },
        create: {
          guildId,
          userId,
          balance: decimalAmount,
          bankBalance: new Prisma.Decimal(0),
          bankRate: new Prisma.Decimal(0),
          bankStartTime: 0,
        },
        update: {
          balance: {
            increment: decimalAmount,
          },
        },
      });

      // Only update statistics if amount is positive
      if (decimalAmount.greaterThan(0)) {
        await tx.statistics.upsert({
          where: {
            guildId_userId: {
              guildId,
              userId,
            },
          },
          create: {
            guildId,
            userId,
            totalEarned: decimalAmount,
            messageCount: 0,
            commandCount: 0,
            lastUpdated: Date.now(),
          },
          update: {
            totalEarned: {
              increment: decimalAmount,
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

    return result;
  }

  async transferBalance(guildId, fromUserId, toUserId, amount) {
    // Ensure both users exist first
    await this.ensureUser(guildId, fromUserId);
    await this.ensureUser(guildId, toUserId);

    const decimalAmount = new Prisma.Decimal(amount);
    const result = await this.client.$transaction(async (tx) => {
      // Check sender's balance
      const senderEconomy = await tx.economy.findUnique({
        where: {
          guildId_userId: {
            guildId,
            userId: fromUserId,
          },
        },
      });

      if (!senderEconomy || senderEconomy.balance.lessThan(decimalAmount)) {
        throw new Error("Insufficient balance");
      }

      // Subtract from sender
      await tx.economy.update({
        where: {
          guildId_userId: {
            guildId,
            userId: fromUserId,
          },
        },
        data: {
          balance: {
            decrement: decimalAmount,
          },
        },
      });

      // Add to recipient (upsert in case they don't have an economy record)
      await tx.economy.upsert({
        where: {
          guildId_userId: {
            guildId,
            userId: toUserId,
          },
        },
        create: {
          guildId,
          userId: toUserId,
          balance: decimalAmount,
          bankBalance: new Prisma.Decimal(0),
          bankRate: new Prisma.Decimal(0),
          bankStartTime: 0,
        },
        update: {
          balance: {
            increment: decimalAmount,
          },
        },
      });

      // Update activity for both users
      await tx.user.update({
        where: {
          guildId_id: {
            guildId,
            id: fromUserId,
          },
        },
        data: {
          lastActivity: Date.now(),
        },
      });

      await tx.user.update({
        where: {
          guildId_id: {
            guildId,
            id: toUserId,
          },
        },
        data: {
          lastActivity: Date.now(),
        },
      });

      return { success: true, amount: decimalAmount };
    });

    return result;
  }

  async deposit(guildId, userId, amount) {
    console.log(
      `Deposit initiated for user ${userId} in guild ${guildId} with amount ${amount}`
    );

    // Ensure user exists first
    await this.ensureUser(guildId, userId);

    // Convert amount to Prisma Decimal for precise calculations
    const depositAmount = new Prisma.Decimal(amount);
    console.log(`Converted deposit amount to Decimal: ${depositAmount}`);

    const result = await this.client.$transaction(async (tx) => {
      // Get current user data with levels
      const user = await tx.user.findUnique({
        where: {
          guildId_id: {
            guildId,
            id: userId,
          },
        },
        include: {
          economy: true,
          Level: true,
        },
      });

      if (!user || !user.economy) {
        console.error(`User economy data not found for user ${userId}`);
        throw new Error("User economy data not found");
      }

      console.log(`Current user balance: ${user.economy.balance}`);

      // Check if user has enough balance to deposit using Decimal comparison
      if (user.economy.balance.lessThan(depositAmount)) {
        console.error(
          `Insufficient balance for user ${userId}: has ${user.economy.balance}, needs ${depositAmount}`
        );
        throw new Error("Insufficient balance");
      }

      // Calculate current bank balance with any accumulated interest
      let currentBankBalance = user.economy.bankBalance;
      console.log(`Initial bank balance: ${currentBankBalance}`);

      if (
        user.economy.bankStartTime > 0 &&
        user.economy.bankRate.greaterThan(0)
      ) {
        const timeElapsed = Date.now() - Number(user.economy.bankStartTime);
        console.log(`Time elapsed since last bank update: ${timeElapsed}ms`);
        currentBankBalance = this.calculateInterestDecimal(
          currentBankBalance,
          user.economy.bankRate,
          timeElapsed
        );
        console.log(`Bank balance after interest: ${currentBankBalance}`);
      }

      // Calculate new bank rate: 300 + (5 * chatting level) + (5 * gaming level)
      const chattingLevel = user.Level
        ? this.calculateLevel(user.Level.xp).level
        : 1;
      const gamingLevel = user.Level
        ? this.calculateLevel(user.Level.gameXp).level
        : 1;
      console.log(
        `User levels - Chatting: ${chattingLevel}, Gaming: ${gamingLevel}`
      );

      const newBankRate = new Prisma.Decimal(
        300 + 5 * chattingLevel + 5 * gamingLevel
      );
      console.log(`New bank rate calculated: ${newBankRate}`);

      // Calculate final bank balance after deposit using Decimal arithmetic
      const finalBankBalance = currentBankBalance.plus(depositAmount);
      console.log(`Final bank balance after deposit: ${finalBankBalance}`);

      // Update economy: subtract from balance, set calculated bank balance with new rate and reset timer
      const updatedEconomy = await tx.economy.update({
        where: {
          guildId_userId: {
            guildId,
            userId,
          },
        },
        data: {
          balance: {
            decrement: depositAmount,
          },
          bankBalance: finalBankBalance,
          bankRate: newBankRate,
          bankStartTime: Date.now(),
        },
      });

      console.log(`Economy updated successfully for user ${userId}`);

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

      console.log(`User activity timestamp updated`);
      return updatedEconomy;
    });

    // Redis cache invalidation disabled
    console.log(`Deposit transaction completed successfully`);

    return result;
  }

  async withdraw(guildId, userId, amount) {
    // Ensure user exists first
    await this.ensureUser(guildId, userId);

    // Convert amount to Prisma Decimal for precise calculations
    const withdrawAmount = new Prisma.Decimal(amount);

    const result = await this.client.$transaction(async (tx) => {
      // Get current user data with levels
      const user = await tx.user.findUnique({
        where: {
          guildId_id: {
            guildId,
            id: userId,
          },
        },
        include: {
          economy: true,
          Level: true,
        },
      });

      if (!user || !user.economy) {
        throw new Error("User economy data not found");
      }

      // Calculate current bank balance with any accumulated interest
      let currentBankBalance = user.economy.bankBalance;
      if (
        user.economy.bankStartTime > 0 &&
        user.economy.bankRate.greaterThan(0)
      ) {
        const timeElapsed = Date.now() - Number(user.economy.bankStartTime);
        currentBankBalance = this.calculateInterestDecimal(
          currentBankBalance,
          user.economy.bankRate,
          timeElapsed
        );
      }

      // Check if user has enough bank balance to withdraw using Decimal comparison
      if (currentBankBalance.lessThan(withdrawAmount)) {
        throw new Error("Insufficient bank balance");
      }

      // Calculate remaining balance after withdrawal using Decimal arithmetic
      const remainingBalance = currentBankBalance.minus(withdrawAmount);
      const isWithdrawingAll = remainingBalance.lessThanOrEqualTo(0);

      let newBankRate = new Prisma.Decimal(0);
      let newBankStartTime = 0;

      // If not withdrawing everything, calculate new bank rate and reset timer
      if (!isWithdrawingAll) {
        const chattingLevel = user.Level
          ? this.calculateLevel(user.Level.xp).level
          : 1;
        const gamingLevel = user.Level
          ? this.calculateLevel(user.Level.gameXp).level
          : 1;
        newBankRate = new Prisma.Decimal(
          300 + 5 * chattingLevel + 5 * gamingLevel
        );
        newBankStartTime = Date.now();
      }

      // Update economy: add to balance, set calculated bank balance
      const updatedEconomy = await tx.economy.update({
        where: {
          guildId_userId: {
            guildId,
            userId,
          },
        },
        data: {
          balance: {
            increment: withdrawAmount,
          },
          bankBalance: isWithdrawingAll
            ? new Prisma.Decimal(0)
            : remainingBalance,
          bankRate: newBankRate,
          bankStartTime: newBankStartTime,
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

      return updatedEconomy;
    });

    // Redis cache invalidation disabled

    return result;
  }

  // Bank Operations
  async updateBankBalance(guildId, userId, amount, rate = 0) {
    const result = await this.client.$transaction(async (tx) => {
      // Always calculate current balance first within the transaction
      const currentBank = await tx.economy.findUnique({
        where: {
          guildId_userId: {
            guildId,
            userId,
          },
        },
        include: {
          user: true, // Include user for activity check
        },
      });

      let currentBalance = new Prisma.Decimal(0);
      if (currentBank) {
        // Calculate interest if there's an existing balance
        const inactiveTime = Date.now() - Number(currentBank.user.lastActivity);
        if (inactiveTime > BANK_MAX_INACTIVE_MS) {
          currentBalance = this.calculateInterestDecimal(
            currentBank.bankBalance,
            currentBank.bankRate,
            BANK_MAX_INACTIVE_MS
          );
        } else if (currentBank.bankStartTime > 0) {
          const timeElapsed = Date.now() - Number(currentBank.bankStartTime);
          currentBalance = this.calculateInterestDecimal(
            currentBank.bankBalance,
            currentBank.bankRate,
            timeElapsed
          );
        } else {
          currentBalance = currentBank.bankBalance;
        }
      }

      // Convert amount and rate to Decimal for precise handling
      const decimalAmount = new Prisma.Decimal(amount);
      const decimalRate = new Prisma.Decimal(rate);

      // If withdrawing all money, reset bank data
      const isEmptyingBank = decimalAmount.lessThanOrEqualTo(0);

      // For deposits, add to current balance. For withdrawals, use the provided amount
      const finalBalance = isEmptyingBank
        ? decimalAmount
        : currentBalance.plus(decimalAmount);

      const result = await tx.economy.upsert({
        where: {
          guildId_userId: {
            guildId,
            userId,
          },
        },
        create: {
          guildId,
          userId,
          balance: new Prisma.Decimal(0),
          bankBalance: finalBalance,
          bankRate: decimalRate,
          bankStartTime: decimalRate.greaterThan(0) ? Date.now() : 0,
        },
        update: {
          bankBalance: finalBalance,
          bankRate: isEmptyingBank ? new Prisma.Decimal(0) : decimalRate,
          bankStartTime: isEmptyingBank
            ? 0
            : decimalRate.greaterThan(0)
            ? Date.now()
            : 0,
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

    // Redis cache invalidation disabled

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

  calculateInterestDecimal(principal, annualRate, timeMs) {
    // Convert milliseconds to years with proper precision using Decimal
    const MS_PER_YEAR = new Prisma.Decimal(365 * 24 * 60 * 60 * 1000); // milliseconds in a year
    const timeInYears = new Prisma.Decimal(timeMs).dividedBy(MS_PER_YEAR);
    const rate = annualRate.dividedBy(100);

    // Calculate simple interest for the elapsed time period using Decimal arithmetic
    // I = P * r * t where:
    // P = principal (Decimal)
    // r = interest rate (as Decimal)
    // t = time in years (Decimal)
    const interest = principal.times(rate).times(timeInYears);

    // Return principal plus earned interest as Decimal
    return principal.plus(interest);
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
        guildId_userId: {
          guildId: user.guildId,
          userId: user.id,
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
      const finalBalance = this.calculateInterestDecimal(
        currentBank.bankBalance,
        currentBank.bankRate,
        BANK_MAX_INACTIVE_MS
      );

      // Update the bank balance and reset bank data
      await dbClient.economy.update({
        where: {
          guildId_userId: {
            guildId: user.guildId,
            userId: user.id,
          },
        },
        data: {
          bankBalance: finalBalance,
          bankRate: new Prisma.Decimal(0),
          bankStartTime: 0,
        },
      });

      return finalBalance;
    }

    // For active users, display current balance with projected interest
    const timeElapsed = currentTime - Number(currentBank.bankStartTime);
    return this.calculateInterestDecimal(
      currentBank.bankBalance,
      currentBank.bankRate,
      timeElapsed
    );
  }

  async getUser(guildId, userId, includeRelations = true, tx = null) {
    const prisma = tx || this.client;

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

      // Redis caching disabled

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
    try {
      // Fetch only the necessary field
      const user = await this.client.user.findUnique({
        where: { guildId_id: { guildId, id: userId } },
        select: { locale: true },
      });

      const locale = user ? user.locale : null;

      // Redis caching disabled

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

      // Redis cache invalidation disabled
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

    // Redis cache invalidation disabled

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
              // If the error is about duplicate Discord user ID, just re-throw.
              // Manually creating a composite ID here is incorrect.
              // if (error.meta?.target?.includes("user_id")) {
              //   const compositeId = `${userId}_${guildId}`;
              //   return await prisma.user.create({
              //     data: {
              //       id: compositeId,
              //       guildId,
              //       lastActivity: Date.now(),
              //     },
              //   });
              // }
              throw findError; // Re-throw the find error
            }
          }
          // If it wasn't a P2002 error, re-throw the original error
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
    const guild = await this.client.guild.findUnique({
      where: { id: guildId },
      include: { users: true },
    });

    return guild;
  }

  async upsertGuild(guildId, data = {}) {
    const result = await this.client.guild.upsert({
      where: { id: guildId },
      create: { id: guildId, ...data },
      update: data,
    });
    return result;
  }

  async getGameRecords(guildId, userId) {
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
      await this.ensureGuildUser(guildId, userId);

      const stats = await this.client.statistics.findUnique({
        where: { guildId_userId: { guildId, userId } },
      });

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
            where: { guildId_userId: { guildId, userId } },
            create: {
              guildId,
              userId,
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
          guildId_userId: {
            guildId,
            userId,
          },
        },
      });

      // Get the current XP before adding more
      const currentXp = existingLevel?.xp || 0n;

      // Update XP and season XP for the user
      const updatedLevel = await prisma.level.upsert({
        where: {
          guildId_userId: {
            guildId,
            userId,
          },
        },
        create: {
          guildId,
          userId,
          xp: amount,
          seasonXp: amount,
        },
        update: {
          xp: { increment: amount },
          seasonXp: { increment: amount },
        },
      });

      // Check for level up
      const levelUpInfo = this.checkLevelUp(currentXp, updatedLevel.xp);

      // --- Handle Level Role Assignment --- //
      let assignedRole = null;
      let removedRoles = [];
      if (levelUpInfo) {
        try {
          const guild = await prisma.guild.findUnique({
            where: { id: guildId },
            select: { id: true },
          }); // Ensure guild exists
          if (guild) {
            // This check might be redundant if ensureGuild runs before, but good practice
            // Fetch all level roles for this guild
            const allLevelRoles = await this.getLevelRoles(guildId);
            const eligibleRole = allLevelRoles.find(
              (lr) => lr.requiredLevel <= levelUpInfo.newLevel
            );
            const highestEligibleRole = allLevelRoles
              .filter((lr) => lr.requiredLevel <= levelUpInfo.newLevel)
              .sort((a, b) => b.requiredLevel - a.requiredLevel)[0]; // Get the highest eligible role

            if (highestEligibleRole) {
              assignedRole = highestEligibleRole.roleId;

              // Find roles to remove (lower level roles from our system)
              removedRoles = allLevelRoles
                .filter(
                  (lr) => lr.requiredLevel < highestEligibleRole.requiredLevel
                )
                .map((lr) => lr.roleId);
            }
          }
        } catch (roleError) {
          console.error(
            `Error fetching/determining level roles for ${userId} in ${guildId}:`,
            roleError
          );
          // Don't prevent XP gain, just log the role error
        }

        // Add role information to levelUpInfo for the handler to use
        levelUpInfo.assignedRole = assignedRole;
        levelUpInfo.removedRoles = removedRoles;
      }
      // --- End Level Role Assignment --- //

      // Check if stats record exists
      const existingStats = await prisma.statistics.findUnique({
        where: {
          guildId_userId: {
            guildId,
            userId,
          },
        },
      });

      // Update detailed XP stats only if needed
      let stats;
      if (existingStats) {
        const currentXpStats =
          existingStats.xpStats &&
          typeof existingStats.xpStats === "object" &&
          !existingStats.xpStats.updateMode
            ? existingStats.xpStats
            : {};
        currentXpStats[type] = (currentXpStats[type] || 0) + amount;

        stats = await prisma.statistics.update({
          where: {
            guildId_userId: {
              guildId,
              userId,
            },
          },
          data: {
            xpStats: currentXpStats,
          },
        });
      } else {
        stats = await prisma.statistics.create({
          data: {
            guildId,
            userId,
            xpStats: { [type]: amount },
          },
        });
      }

      // Always return "chat" as the type, regardless of the input type
      return { level: updatedLevel, stats, levelUp: levelUpInfo, type: "chat" };
    });
  }

  async addGameXP(guildId, userId, gameType, amount) {
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
          guildId_userId: {
            guildId,
            userId,
          },
        },
      });

      // Get the current game XP before adding more
      const currentGameXp = existingLevel?.gameXp || 0n;

      // Update total game XP and season XP in Level model
      const level = await prisma.level.upsert({
        where: {
          guildId_userId: {
            guildId,
            userId,
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

      // --- Handle Level Role Assignment --- //
      let assignedRole = null;
      let removedRoles = [];
      if (levelUp) {
        try {
          const guild = await prisma.guild.findUnique({
            where: { id: guildId },
            select: { id: true },
          }); // Ensure guild exists
          if (guild) {
            // Fetch all level roles for this guild
            const allLevelRoles = await this.getLevelRoles(guildId);
            const highestEligibleRole = allLevelRoles
              .filter((lr) => lr.requiredLevel <= levelUp.newLevel)
              .sort((a, b) => b.requiredLevel - a.requiredLevel)[0]; // Get the highest eligible role

            if (highestEligibleRole) {
              assignedRole = highestEligibleRole.roleId;

              // Find roles to remove (lower level roles from our system)
              removedRoles = allLevelRoles
                .filter(
                  (lr) => lr.requiredLevel < highestEligibleRole.requiredLevel
                )
                .map((lr) => lr.roleId);
            }
          }
        } catch (roleError) {
          console.error(
            `Error fetching/determining level roles for ${userId} in ${guildId}:`,
            roleError
          );
          // Don't prevent XP gain, just log the role error
        }

        // Add role information to levelUp for the handler to use
        levelUp.assignedRole = assignedRole;
        levelUp.removedRoles = removedRoles;
      }
      // --- End Level Role Assignment --- //

      // Check if stats record exists
      const existingStats = await prisma.statistics.findUnique({
        where: {
          guildId_userId: {
            guildId,
            userId,
          },
        },
      });

      // Update detailed game XP stats only if needed
      let stats;
      if (existingStats) {
        const currentGameXpStats =
          existingStats.gameXpStats &&
          typeof existingStats.gameXpStats === "object" &&
          !existingStats.gameXpStats.updateMode
            ? existingStats.gameXpStats
            : {};
        currentGameXpStats[gameType] =
          (currentGameXpStats[gameType] || 0) + amount;

        stats = await prisma.statistics.update({
          where: {
            guildId_userId: {
              guildId,
              userId,
            },
          },
          data: {
            gameXpStats: currentGameXpStats,
          },
        });
      } else {
        stats = await prisma.statistics.create({
          data: {
            guildId,
            userId,
            gameXpStats: { [gameType]: amount },
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

      // Redis cache invalidation disabled

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

    try {
      const player = await this.client.musicPlayer.findUnique({
        where: { id: guildId },
      });

      // Redis caching disabled
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

      // Redis cache invalidation disabled

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

      // Redis cache invalidation disabled

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
          guildId_userId: { guildId, userId },
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
          where: { guildId_userId: { guildId, userId } },
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
        where: { guildId_userId: { guildId, userId } },
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
            where: { guildId_userId: { guildId, userId } },
            create: {
              guildId,
              userId,
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
          guildId_userId: { guildId, userId },
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
            guildId_userId_type: {
              guildId,
              userId,
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
        guildId_userId_type: {
          guildId,
          userId,
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
        guildId_userId: {
          guildId,
          userId,
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
          guildId_userId: {
            guildId,
            userId,
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
            guildId_userId: {
              guildId,
              userId,
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
          guildId_userId_type: {
            guildId,
            userId,
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
        guildId_userId_type: {
          guildId,
          userId,
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
          guildId_userId: {
            guildId,
            userId,
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
            guildId_userId_type: {
              guildId,
              userId,
              type,
            },
          },
        });
      } else {
        // Otherwise, decrease the level
        await tx.upgrade.update({
          where: {
            guildId_userId_type: {
              guildId,
              userId,
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
    await this.ensureGuildUser(guildId, userId); // Ensure user and guild exist
    return await this.client.voiceSession.upsert({
      where: {
        guildId_userId: { guildId, userId },
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
    // Redis cache invalidation disabled

    const result = await this.client.voiceSession.delete({
      where: {
        guildId_userId: { guildId, userId },
      },
    });

    // Redis cache invalidation disabled

    return result;
  }

  async getVoiceSession(guildId, userId) {
    const session = await this.client.voiceSession.findUnique({
      where: {
        guildId_userId: { guildId, userId },
      },
    });

    return session;
  }

  async getAllVoiceSessions(guildId, channelId) {
    const sessions = await this.client.voiceSession.findMany({
      where: {
        guildId,
        channelId,
      },
    });

    // Redis caching disabled
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
      // Use type "chat" to ensure voice XP contributes to the same level as chat XP
      const xpResult = await this.addXP(guildId, userId, xpAmount, "voice");

      // Update voice time in statistics
      await this.client.statistics.update({
        where: {
          guildId_userId: { guildId, userId },
        },
        data: {
          voiceTime: {
            increment: timeSpent,
          },
        },
      });

      return { timeSpent, xpAmount, levelUp: xpResult.levelUp };
    }

    return { timeSpent, xpAmount: 0, levelUp: null };
  }

  // Redis functionality completely removed

  // Internal helper to get cooldown data (Redis caching removed)
  async _getCooldownData(guildId, userId) {
    const cooldownRecord = await this.client.cooldown.findUnique({
      where: { guildId_userId: { guildId, userId } },
    });

    let cooldowns = {};
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
    }

    return cooldowns;
  }

  // Redis command wrappers removed - Redis functionality disabled

  // --- Crypto Game Methods ---

  /**
   * Creates a new crypto position for a user.
   * @param {string} guildId
   * @param {string} userId
   * @param {object} positionData - { symbol, direction, entryPrice, quantity, leverage, takeProfitPrice, stopLossPrice }
   * @returns {Promise<object>} The created position.
   */
  async createCryptoPosition(guildId, userId, positionData) {
    await this.ensureUser(guildId, userId); // Ensure user exists
    const {
      symbol,
      direction,
      entryPrice,
      quantity,
      leverage,
      takeProfitPrice,
      stopLossPrice,
    } = positionData;

    // Use Decimal for Prisma
    const entryPriceDecimal = new Prisma.Decimal(entryPrice);
    const quantityDecimal = new Prisma.Decimal(quantity);
    const takeProfitPriceDecimal = takeProfitPrice
      ? new Prisma.Decimal(takeProfitPrice)
      : null;
    const stopLossPriceDecimal = stopLossPrice
      ? new Prisma.Decimal(stopLossPrice)
      : null;

    return this.client.cryptoPosition.create({
      data: {
        userId,
        guildId,
        symbol,
        direction,
        entryPrice: entryPriceDecimal,
        quantity: quantityDecimal,
        leverage,
        takeProfitPrice: takeProfitPriceDecimal,
        stopLossPrice: stopLossPriceDecimal,
        // user relation is implicit via userId/guildId
      },
    });
  }

  /**
   * Fetches all active crypto positions for a user in a guild.
   * @param {string} guildId
   * @param {string} userId
   * @returns {Promise<Array<object>>} Array of positions.
   */
  async getUserCryptoPositions(guildId, userId) {
    return this.client.cryptoPosition.findMany({
      where: {
        userId,
        guildId,
      },
      orderBy: {
        createdAt: "asc", // Or sort by symbol, etc.
      },
    });
  }

  /**
   * Fetches a specific crypto position by its ID.
   * @param {string} positionId
   * @returns {Promise<object|null>} The position or null if not found.
   */
  async getCryptoPositionById(positionId) {
    return this.client.cryptoPosition.findUnique({
      where: { id: positionId },
    });
  }

  /**
   * Updates a specific crypto position.
   * @param {string} positionId
   * @param {object} updateData - Fields to update (e.g., { takeProfitPrice, stopLossPrice })
   * @returns {Promise<object>} The updated position.
   */
  async updateCryptoPosition(positionId, updateData) {
    // Convert numbers to Decimal where necessary
    const updates = { ...updateData };
    if (updates.takeProfitPrice !== undefined) {
      updates.takeProfitPrice = updates.takeProfitPrice
        ? new Prisma.Decimal(updates.takeProfitPrice)
        : null;
    }
    if (updates.stopLossPrice !== undefined) {
      updates.stopLossPrice = updates.stopLossPrice
        ? new Prisma.Decimal(updates.stopLossPrice)
        : null;
    }
    if (updates.entryPrice !== undefined) {
      updates.entryPrice = new Prisma.Decimal(updates.entryPrice);
    }
    if (updates.quantity !== undefined) {
      updates.quantity = new Prisma.Decimal(updates.quantity);
    }

    return this.client.cryptoPosition.update({
      where: { id: positionId },
      data: updates,
    });
  }

  /**
   * Deletes a specific crypto position by its ID.
   * @param {string} positionId
   * @returns {Promise<object>} The deleted position data.
   */
  async deleteCryptoPosition(positionId) {
    return this.client.cryptoPosition.delete({
      where: { id: positionId },
    });
  }

  /**
   * Fetches all active crypto positions across all users/guilds.
   * Use with caution, potentially large dataset.
   * @returns {Promise<Array<object>>} Array of all active positions.
   */
  async getAllActiveCryptoPositions() {
    return this.client.cryptoPosition.findMany();
  }

  // --- End Crypto Game Methods ---

  // --- Marriage Methods ---

  /**
   * Proposes marriage between two users.
   * @param {string} guildId
   * @param {string} userId1 - The proposer.
   * @param {string} userId2 - The proposed user.
   * @returns {Promise<object>} The created marriage record.
   * @throws {Error} If either user is already married or has a pending proposal.
   */
  async proposeMarriage(guildId, userId1, userId2) {
    await this.ensureUser(guildId, userId1);
    await this.ensureUser(guildId, userId2);

    // Check if either user is already involved in a marriage (pending or married)
    const existingMarriage = await this.getMarriageStatus(guildId, userId1);
    if (existingMarriage) {
      throw new Error("User 1 is already married or has a pending proposal.");
    }
    const existingMarriage2 = await this.getMarriageStatus(guildId, userId2);
    if (existingMarriage2) {
      throw new Error("User 2 is already married or has a pending proposal.");
    }

    return this.client.marriage.create({
      data: {
        guildId,
        userId1,
        userId2,
        status: "PENDING",
      },
    });
  }

  /**
   * Accepts a pending marriage proposal.
   * @param {string} guildId
   * @param {string} userId1 - The user who proposed.
   * @param {string} userId2 - The user accepting.
   * @returns {Promise<object>} The updated marriage record.
   * @throws {Error} If no matching pending proposal is found.
   */
  async acceptMarriage(guildId, userId1, userId2) {
    const pendingProposal = await this.client.marriage.findUnique({
      where: {
        guildId_userId1_userId2: {
          guildId,
          userId1,
          userId2,
        },
        status: "PENDING",
      },
    });

    if (!pendingProposal) {
      // Also check if the proposal might be in the other direction
      const reverseProposal = await this.client.marriage.findUnique({
        where: {
          guildId_userId1_userId2: {
            guildId,
            userId1: userId2, // Check reverse
            userId2: userId1,
          },
          status: "PENDING",
        },
      });
      if (!reverseProposal) {
        throw new Error("No pending marriage proposal found from this user.");
      }
      // If found in reverse, update that one
      return this.client.marriage.update({
        where: {
          id: reverseProposal.id,
        },
        data: {
          status: "MARRIED",
        },
      });
    }

    return this.client.marriage.update({
      where: {
        id: pendingProposal.id,
      },
      data: {
        status: "MARRIED",
      },
    });
  }

  /**
   * Rejects a pending marriage proposal.
   * @param {string} guildId
   * @param {string} userId1 - The user who proposed.
   * @param {string} userId2 - The user rejecting.
   * @returns {Promise<object>} The deleted marriage record.
   * @throws {Error} If no matching pending proposal is found.
   */
  async rejectMarriage(guildId, userId1, userId2) {
    const pendingProposal = await this.client.marriage.findUnique({
      where: {
        guildId_userId1_userId2: {
          guildId,
          userId1,
          userId2,
        },
        status: "PENDING",
      },
    });

    if (!pendingProposal) {
      // Also check if the proposal might be in the other direction
      const reverseProposal = await this.client.marriage.findUnique({
        where: {
          guildId_userId1_userId2: {
            guildId,
            userId1: userId2, // Check reverse
            userId2: userId1,
          },
          status: "PENDING",
        },
      });
      if (!reverseProposal) {
        throw new Error(
          "No pending marriage proposal found involving these users."
        );
      }
      // If found in reverse, delete that one
      return this.client.marriage.delete({ where: { id: reverseProposal.id } });
    }

    // If found in the primary direction, delete it
    return this.client.marriage.delete({ where: { id: pendingProposal.id } });
  }

  /**
   * Checks the marriage status of a user.
   * @param {string} guildId
   * @param {string} userId
   * @returns {Promise<object|null>} Returns { partnerId, status } or null if not married/pending.
   */
  async getMarriageStatus(guildId, userId) {
    const marriage = await this.client.marriage.findFirst({
      where: {
        guildId,
        OR: [{ userId1: userId }, { userId2: userId }],
        // status: { in: ["PENDING", "MARRIED"] } // Check for both
      },
    });

    if (!marriage) {
      return null;
    }

    const partnerId =
      marriage.userId1 === userId ? marriage.userId2 : marriage.userId1;
    return {
      partnerId,
      status: marriage.status,
      createdAt: marriage.createdAt,
    };
  }

  /**
   * Dissolves a marriage (divorce).
   * @param {string} guildId
   * @param {string} userId1
   * @param {string} userId2
   * @returns {Promise<object>} The deleted marriage record.
   * @throws {Error} If no active marriage found between the users.
   */
  async dissolveMarriage(guildId, userId1, userId2) {
    // Find the marriage record, regardless of who is userId1 or userId2
    const marriage = await this.client.marriage.findFirst({
      where: {
        guildId,
        OR: [
          { userId1: userId1, userId2: userId2 },
          { userId1: userId2, userId2: userId1 },
        ],
        status: "MARRIED",
      },
    });

    if (!marriage) {
      throw new Error("No active marriage found between these users.");
    }

    return this.client.marriage.delete({
      where: {
        id: marriage.id,
      },
    });
  }
  // --- End Marriage Methods ---

  // --- Statistics Methods ---

  /**
   * Helper method to get level data for a user
   * @param {string} guildId
   * @param {string} userId
   * @returns {Promise<object|null>} Level data or null if not found
   */
  async _getLevelData(guildId, userId) {
    try {
      const level = await this.client.level.findUnique({
        where: {
          guildId_userId: { guildId, userId },
        },
      });
      return level;
    } catch (error) {
      console.error("Error getting level data:", error);
      return null;
    }
  }

  /**
   * Helper method to get statistics data for a user
   * @param {string} guildId
   * @param {string} userId
   * @returns {Promise<object|null>} Statistics data or null if not found
   */
  async _getStatsData(guildId, userId) {
    try {
      const stats = await this.client.statistics.findUnique({
        where: {
          guildId_userId: { guildId, userId },
        },
      });
      return stats;
    } catch (error) {
      console.error("Error getting statistics data:", error);
      return null;
    }
  }

  /**
   * Get user statistics
   * @param {string} userId
   * @param {string} guildId
   * @returns {Promise<object|null>} User statistics or null if not found
   */
  async getStatistics(userId, guildId) {
    try {
      const stats = await this.client.statistics.findUnique({
        where: {
          guildId_userId: { guildId, userId },
        },
      });
      return stats;
    } catch (error) {
      console.error("Error getting statistics:", error);
      return null;
    }
  }

  /**
   * Update user statistics
   * @param {string} userId
   * @param {string} guildId
   * @param {object} updateData - Data to update (should contain valid Statistics model fields)
   * @returns {Promise<object>} Updated statistics
   */
  async updateStatistics(userId, guildId, updateData) {
    try {
      // Ensure user exists
      await this.ensureGuildUser(guildId, userId);

      // Filter out invalid fields and prepare update data
      const validFields = [
        "totalEarned",
        "messageCount",
        "commandCount",
        "gameRecords",
        "xpStats",
        "gameXpStats",
        "interactionStats",
        "voiceTime",
        "crypto2DisclaimerSeen",
      ];

      const filteredUpdateData = {};
      for (const [key, value] of Object.entries(updateData)) {
        if (validFields.includes(key)) {
          filteredUpdateData[key] = value;
        }
      }

      const stats = await this.client.statistics.upsert({
        where: {
          guildId_userId: { guildId, userId },
        },
        create: {
          guildId,
          userId,
          lastUpdated: Date.now(),
          ...filteredUpdateData,
        },
        update: {
          lastUpdated: Date.now(),
          ...filteredUpdateData,
        },
      });

      // Redis cache invalidation disabled

      return stats;
    } catch (error) {
      console.error("Error updating statistics:", error);
      throw error;
    }
  }

  /**
   * Increment a specific statistic field
   * @param {string} userId
   * @param {string} guildId
   * @param {string} field - Field to increment (messageCount, commandCount, etc.)
   * @param {number} amount - Amount to increment by (default: 1)
   * @returns {Promise<object>} Updated statistics
   */
  async incrementStatistic(userId, guildId, field, amount = 1) {
    try {
      // Validate field
      const incrementableFields = ["messageCount", "commandCount", "voiceTime"];
      if (!incrementableFields.includes(field)) {
        throw new Error(
          `Field '${field}' is not incrementable. Valid fields: ${incrementableFields.join(
            ", "
          )}`
        );
      }

      // Ensure user exists
      await this.ensureGuildUser(guildId, userId);

      // Get current stats or create default
      const currentStats = await this.client.statistics.findUnique({
        where: {
          guildId_userId: { guildId, userId },
        },
      });

      const currentValue = currentStats ? currentStats[field] || 0 : 0;
      const newValue = Number(currentValue) + Number(amount);

      const updateData = {
        [field]: newValue,
      };

      return await this.updateStatistics(userId, guildId, updateData);
    } catch (error) {
      console.error(`Error incrementing statistic '${field}':`, error);
      throw error;
    }
  }

  // --- End Statistics Methods ---

  // #region Level Roles
  async getLevelRoles(guildId) {
    return this.client.levelRole.findMany({
      where: { guildId },
      orderBy: { requiredLevel: "asc" },
    });
  }

  async getEligibleLevelRole(guildId, currentLevel) {
    // Find the highest level role the user meets the requirements for
    return this.client.levelRole.findFirst({
      where: {
        guildId,
        requiredLevel: {
          lte: currentLevel, // Less than or equal to current level
        },
      },
      orderBy: {
        requiredLevel: "desc", // Get the highest eligible level
      },
    });
  }

  async getNextLevelRole(guildId, currentLevel) {
    // Find the next role the user can achieve
    return this.client.levelRole.findFirst({
      where: {
        guildId,
        requiredLevel: {
          gt: currentLevel, // Greater than current level
        },
      },
      orderBy: {
        requiredLevel: "asc", // Get the lowest next level
      },
    });
  }

  async addLevelRole(guildId, roleId, requiredLevel) {
    // Validate level
    if (requiredLevel < 1) {
      throw new Error("Required level must be at least 1.");
    }

    // Use transaction to ensure uniqueness constraints are handled
    return this.client.$transaction(async (tx) => {
      // Check if a role already exists for this level
      const existingRoleForLevel = await tx.levelRole.findUnique({
        where: { guildId_requiredLevel: { guildId, requiredLevel } },
      });
      if (existingRoleForLevel && existingRoleForLevel.roleId !== roleId) {
        throw new Error(
          `A different role (${existingRoleForLevel.roleId}) is already assigned to level ${requiredLevel}.`
        );
      }

      // Check if this specific role is already assigned to a different level
      const existingLevelForRole = await tx.levelRole.findUnique({
        where: { guildId_roleId: { guildId, roleId } },
      });
      if (
        existingLevelForRole &&
        existingLevelForRole.requiredLevel !== requiredLevel
      ) {
        throw new Error(
          `This role (${roleId}) is already assigned to level ${existingLevelForRole.requiredLevel}. Remove it first.`
        );
      }

      // Upsert the level role
      const result = await tx.levelRole.upsert({
        where: { guildId_roleId: { guildId, roleId } }, // Use roleId unique constraint for upsert
        create: { guildId, roleId, requiredLevel },
        update: { requiredLevel }, // Update the level if the role already exists
      });

      return result;
    });
  }

  async removeLevelRole(guildId, roleId) {
    const result = await this.client.levelRole.deleteMany({
      where: { guildId, roleId },
    });

    // --- Invalidate Cache --- (Similar logic as addLevelRole)

    // Check if any role was actually deleted
    if (result.count === 0) {
      throw new Error(`Level role with ID ${roleId} not found for this guild.`);
    }
    return result;
  }
  // #endregion Level Roles

  // #region Guild Users
  /**
   * Get all users in a guild
   * @param {string} guildId
   * @returns {Promise<Array>} Array of guild users
   */
  async getGuildUsers(guildId) {
    try {
      const users = await this.client.user.findMany({
        where: { guildId },
        include: {
          economy: true,
        },
      });
      return users;
    } catch (error) {
      console.error("Error getting guild users:", error);
      throw error;
    }
  }
  // #endregion Guild Users

  // #region Seasons
  /**
   * Get the current active season
   * @returns {Promise<object|null>} Current season or null if no active season
   */
  async getCurrentSeason() {
    try {
      const currentSeason = await this.client.seasons.findFirst({
        orderBy: {
          seasonEnds: "desc",
        },
      });
      return currentSeason;
    } catch (error) {
      console.error("Error getting current season:", error);
      throw error;
    }
  }

  /**
   * Get season leaderboard
   * @param {number} seasonId
   * @param {number} limit - Number of users to return (default: 100)
   * @returns {Promise<Array>} Array of users with their season stats
   */
  async getSeasonLeaderboard(seasonId, limit = 100) {
    try {
      const leaderboard = await this.client.seasonStats.findMany({
        where: { seasonId },
        include: {
          user: true,
        },
        orderBy: {
          totalXp: "desc",
        },
        take: limit,
      });
      return leaderboard;
    } catch (error) {
      console.error("Error getting season leaderboard:", error);
      throw error;
    }
  }
  // #endregion Seasons

  // #region Crates
  /**
   * Get all crates for a user
   * @param {string} userId
   * @param {string} guildId
   * @returns {Promise<Array>} Array of user crates
   */
  async getUserCrates(guildId, userId) {
    try {
      // Redis caching disabled

      const crates = await this.client.crate.findMany({
        where: { userId, guildId },
      });

      // Redis caching disabled

      return crates;
    } catch (error) {
      console.error("Error getting user crates:", error);
      throw error;
    }
  }

  /**
   * Get a specific crate for a user
   * @param {string} userId
   * @param {string} guildId
   * @param {string} crateType
   * @returns {Promise<object>} User crate
   */
  async getUserCrate(guildId, userId, crateType) {
    try {
      // Redis caching disabled

      const crate = await this.client.crate.upsert({
        where: {
          guildId_userId_type: { guildId, userId, type: crateType },
        },
        create: {
          userId,
          guildId,
          type: crateType,
          count: 0,
        },
        update: {},
      });

      // Redis caching disabled

      return crate;
    } catch (error) {
      console.error("Error getting user crate:", error);
      throw error;
    }
  }

  /**
   * Add crates to a user
   * @param {string} userId
   * @param {string} guildId
   * @param {string} crateType
   * @param {number} amount
   * @returns {Promise<object>} Updated user crate
   */
  async addCrate(guildId, userId, crateType, amount = 1) {
    try {
      const crate = await this.client.crate.upsert({
        where: {
          guildId_userId_type: { guildId, userId, type: crateType },
        },
        create: {
          guildId,
          userId,
          type: crateType,
          count: amount,
        },
        update: {
          count: {
            increment: amount,
          },
        },
      });

      // Redis cache invalidation disabled

      return crate;
    } catch (error) {
      console.error("Error adding crate:", error);
      throw error;
    }
  }

  /**
   * Remove crates from a user
   * @param {string} userId
   * @param {string} guildId
   * @param {string} crateType
   * @param {number} amount
   * @returns {Promise<object>} Updated user crate
   */
  async removeCrate(guildId, userId, crateType, amount = 1) {
    try {
      const currentCrate = await this.getUserCrate(userId, guildId, crateType);

      if (currentCrate.count < amount) {
        throw new Error(
          `Insufficient crates. Has ${currentCrate.count}, trying to remove ${amount}`
        );
      }

      const crate = await this.client.crate.update({
        where: {
          guildId_userId_type: { guildId, userId, type: crateType },
        },
        data: {
          count: {
            decrement: amount,
          },
        },
      });

      // Redis cache invalidation disabled

      return crate;
    } catch (error) {
      console.error("Error removing crate:", error);
      throw error;
    }
  }

  /**
   * Get crate cooldown for a user
   * @param {string} userId
   * @param {string} guildId
   * @param {string} crateType
   * @returns {Promise<number|null>} Cooldown timestamp or null if no cooldown
   */
  async getCrateCooldown(guildId, userId, crateType) {
    try {
      const cooldown = await this.client.cooldown.findUnique({
        where: {
          guildId_userId: { guildId, userId },
        },
      });

      if (!cooldown || !cooldown.data) {
        return null;
      }

      const crateKey = `crate_${crateType}`;
      const crateCooldown = cooldown.data[crateKey];
      console.log(
        `Getting cooldown for ${crateType}: key=${crateKey}, value=${crateCooldown}, data=`,
        cooldown.data
      );

      return crateCooldown || null;
    } catch (error) {
      console.error("Error getting crate cooldown:", error);
      throw error;
    }
  }
  // #endregion Crates

  // #region Cache Methods (Redis disabled - stub implementations)
  /**
   * Get value from cache (Redis disabled - always returns null)
   * @param {string} key
   * @returns {Promise<null>}
   */
  async getFromCache(key) {
    // Redis functionality completely disabled
    return null;
  }

  /**
   * Set cache value (Redis disabled - no-op)
   * @param {string} key
   * @param {any} value
   * @param {number|null} ttl
   * @returns {Promise<boolean>}
   */
  async setCache(key, value, ttl = null) {
    // Redis functionality completely disabled
    return true;
  }

  /**
   * Invalidate cache keys (Redis disabled - no-op)
   * @param {Array<string>} keys
   * @returns {Promise<boolean>}
   */
  async invalidateCache(keys) {
    // Redis functionality completely disabled
    return true;
  }

  /**
   * Delete cache key (Redis disabled - no-op)
   * @param {string} key
   * @returns {Promise<boolean>}
   */
  async deleteFromCache(key) {
    // Redis functionality completely disabled
    return true;
  }
  // #endregion Cache Methods
}

// Export the Database class instance with proper initialization
const instance = new Database();

// Initialize the database connection
(async () => {
  try {
    await instance.client.$connect();
    console.log("Database connected successfully");
  } catch (error) {
    console.error("Failed to connect to database:", error);
  }
})();

export default instance;
