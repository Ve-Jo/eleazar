// @ts-nocheck
import dotenv from "dotenv";
import { PrismaClient, Prisma } from "@prisma/client"; // Added Prisma
import {
  serializeWithBigInt,
  deserializeWithBigInt,
} from "./utils/serialization.ts";
import {
  calculateInterest,
  calculateInterestDecimal,
  getUpgradeInfo,
} from "./utils/economy.ts";
import {
  initializeDatabaseConnection,
  disconnectDatabaseConnection,
} from "./utils/databaseLifecycle.ts";
import {
  getLevelRoles,
  getEligibleLevelRole,
  getNextLevelRole,
  addLevelRole,
  removeLevelRole,
} from "./utils/levelRoles.ts";
import {
  getGuildUsers,
  getSeasonLeaderboard,
} from "./utils/databaseReads.ts";
import {
  getUserCrates as getUserCratesHelper,
  getUserCrate as getUserCrateHelper,
  addCrate as addCrateHelper,
  removeCrate as removeCrateHelper,
  getCrateCooldown as getCrateCooldownHelper,
} from "./utils/crates.ts";
import {
  getFromCache as getFromCacheHelper,
  setCache as setCacheHelper,
  invalidateCache as invalidateCacheHelper,
  deleteFromCache as deleteFromCacheHelper,
} from "./utils/cache.ts";
import { getCurrentSeason as getCurrentSeasonHelper } from "./utils/seasons.ts";
import {
  ensureGuild as ensureGuildHelper,
  getGuild as getGuildHelper,
  upsertGuild as upsertGuildHelper,
} from "./utils/guilds.ts";
import {
  getUserLocale as getUserLocaleHelper,
  setUserLocale as setUserLocaleHelper,
} from "./utils/userLocale.ts";
import { ensureUser as ensureUserHelper } from "./utils/users.ts";
import { ensureGuildUser as ensureGuildUserHelper } from "./utils/ensureGuildUser.ts";
import {
  getCooldown as getCooldownHelper,
  updateCooldown as updateCooldownHelper,
  setCooldown as setCooldownHelper,
  updateCrateCooldown as updateCrateCooldownHelper,
  reduceCooldown as reduceCooldownHelper,
} from "./utils/cooldowns.ts";
import {
  incrementMessageCount as incrementMessageCountHelper,
  incrementCommandCount as incrementCommandCountHelper,
} from "./utils/statistics.ts";
import {
  getUpgradeDiscount as getUpgradeDiscountHelper,
  addUpgradeDiscount as addUpgradeDiscountHelper,
  resetUpgradeDiscount as resetUpgradeDiscountHelper,
} from "./utils/economyDiscounts.ts";
import {
  getBalance as getBalanceHelper,
  getTotalBankBalance as getTotalBankBalanceHelper,
} from "./utils/economyReads.ts";
import {
  openCrate as openCrateHelper,
  generateCrateRewards as generateCrateRewardsHelper,
  processCrateRewards as processCrateRewardsHelper,
} from "./utils/crateRewards.ts";
import {
  addBalance as addBalanceHelper,
  transferBalance as transferBalanceHelper,
  deposit as depositHelper,
  withdraw as withdrawHelper,
} from "./utils/economyMutations.ts";
import {
  updateBankBalance as updateBankBalanceHelper,
  calculateBankBalance as calculateBankBalanceHelper,
} from "./utils/bankLifecycle.ts";
import {
  getOrCreateGuildVault as getOrCreateGuildVaultHelper,
  distributeGuildVaultFunds as distributeGuildVaultFundsHelper,
  addToGuildVault as addToGuildVaultHelper,
  getGuildVaultDistributions as getGuildVaultDistributionsHelper,
  getUserVaultDistributions as getUserVaultDistributionsHelper,
} from "./utils/guildVault.ts";
import {
  proposeMarriage as proposeMarriageHelper,
  acceptMarriage as acceptMarriageHelper,
  rejectMarriage as rejectMarriageHelper,
  getMarriageStatus as getMarriageStatusHelper,
  dissolveMarriage as dissolveMarriageHelper,
} from "./utils/marriage.ts";
import {
  getLevelData as getLevelDataHelper,
  getStatsData as getStatsDataHelper,
  getStatistics as getStatisticsHelper,
  getGameRecords as getGameRecordsHelper,
} from "./utils/statisticsReads.ts";
import {
  updateStatistics as updateStatisticsHelper,
  incrementStatistic as incrementStatisticHelper,
  updateGameHighScore as updateGameHighScoreHelper,
} from "./utils/statisticsMutations.ts";
import {
  buildDailyCrateStatus,
  registerDailyCrateOpen,
  markDailyCrateReminderSent,
  getGameDailyStatusFromDb,
  awardGameDailyEarningsAtomic,
} from "./utils/economyMeta.ts";
import {
  savePlayer as savePlayerHelper,
  getPlayer as getPlayerHelper,
  loadPlayers as loadPlayersHelper,
  deletePlayer as deletePlayerHelper,
} from "./utils/musicPlayers.ts";
import {
  getInteractionStats as getInteractionStatsHelper,
  getMostUsedInteractions as getMostUsedInteractionsHelper,
} from "./utils/interactionStats.ts";
import { getUser as getUserHelper } from "./utils/userReads.ts";
import {
  updateUser as updateUserHelper,
  createUser as createUserHelper,
} from "./utils/userMutations.ts";
import {
  calculateLevel as calculateLevelHelper,
  checkLevelUp as checkLevelUpHelper,
} from "./utils/levels.ts";
import {
  getLevel as getLevelHelper,
  getAllLevels as getAllLevelsHelper,
} from "./utils/levelReads.ts";
import { addXP as addXPHelper, addGameXP as addGameXPHelper } from "./utils/xpMutations.ts";
import {
  createVoiceSession as createVoiceSessionHelper,
  removeVoiceSession as removeVoiceSessionHelper,
  getVoiceSession as getVoiceSessionHelper,
  getAllVoiceSessions as getAllVoiceSessionsHelper,
  calculateAndAddVoiceXP as calculateAndAddVoiceXPHelper,
} from "./utils/voiceSessions.ts";
import {
  createCryptoPosition as createCryptoPositionHelper,
  getUserCryptoPositions as getUserCryptoPositionsHelper,
  getCryptoPositionById as getCryptoPositionByIdHelper,
  updateCryptoPosition as updateCryptoPositionHelper,
  deleteCryptoPosition as deleteCryptoPositionHelper,
  getAllActiveCryptoPositions as getAllActiveCryptoPositionsHelper,
} from "./utils/cryptoPositions.ts";
import {
  updateUpgrades as updateUpgradesHelper,
  purchaseUpgrade as purchaseUpgradeHelper,
  getUserUpgrades as getUserUpgradesHelper,
  revertUpgrade as revertUpgradeHelper,
} from "./utils/upgrades.ts";
import { get as genericGetHelper } from "./utils/genericGet.ts";
import {
  COOLDOWNS,
  CRATE_TYPES,
  UPGRADES,
  DEFAULT_VALUES,
  COLLECTION_INTERVAL,
  CLEANUP_INTERVAL,
  DEFAULT_RETENTION_DAYS,
  BANK_MAX_INACTIVE_DAYS,
  BANK_MAX_INACTIVE_MS,
  MAX_RETRIES,
  INITIAL_DELAY_MS,
  MAX_DELAY_MS,
  delay,
} from "./constants/database.ts";
// Redis functionality completely disabled

// Load environment variables
dotenv.config({ path: "../.env" });

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
      await initializeDatabaseConnection(this.client, {
        maxRetries: MAX_RETRIES,
        initialDelayMs: INITIAL_DELAY_MS,
        maxDelayMs: MAX_DELAY_MS,
        delay,
      });

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

  async disconnect() {
    try {
      await disconnectDatabaseConnection(this.client);
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
          file.endsWith(".ts") && file !== "client.ts" && !file.startsWith(".")
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
    return getCooldownHelper(this.client, guildId, userId, type);
  }

  async updateCooldown(guildId, userId, type) {
    return updateCooldownHelper(
      this.client,
      (targetGuildId, targetUserId) => this.ensureUser(targetGuildId, targetUserId),
      guildId,
      userId,
      type
    );
  }

  async setCooldown(guildId, userId, type, duration) {
    return setCooldownHelper(
      this.client,
      (targetGuildId, targetUserId) => this.ensureUser(targetGuildId, targetUserId),
      guildId,
      userId,
      type,
      duration
    );
  }

  async incrementMessageCount(guildId, userId) {
    return incrementMessageCountHelper(this.client, guildId, userId);
  }

  async incrementCommandCount(guildId, userId) {
    return incrementCommandCountHelper(this.client, guildId, userId);
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

  // Get user's balance (main balance, not bank)
  async getBalance(guildId, userId) {
    return getBalanceHelper(
      (targetGuildId, targetUserId) => this.getUser(targetGuildId, targetUserId),
      guildId,
      userId
    );
  }

  // Get user's total bank balance (bankBalance + bankDistributed)
  async getTotalBankBalance(guildId, userId) {
    return getTotalBankBalanceHelper(
      (targetGuildId, targetUserId) => this.getUser(targetGuildId, targetUserId),
      guildId,
      userId
    );
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
    return updateCrateCooldownHelper(
      this.client,
      (targetGuildId, targetUserId) => this.ensureUser(targetGuildId, targetUserId),
      guildId,
      userId,
      type
    );
  }

  // Reduce cooldown for a specific type
  async reduceCooldown(guildId, userId, type, amount) {
    return reduceCooldownHelper(this.client, guildId, userId, type, amount);
  }

  // Get user's upgrade discounts
  async getUpgradeDiscount(guildId, userId) {
    return getUpgradeDiscountHelper(this.client, guildId, userId);
  }

  // Add discount for upgrades
  async addUpgradeDiscount(guildId, userId, discountPercent) {
    return addUpgradeDiscountHelper(
      this.client,
      (targetGuildId, targetUserId) => this.ensureUser(targetGuildId, targetUserId),
      guildId,
      userId,
      discountPercent
    );
  }

  // Reset discount after any upgrade purchase
  async resetUpgradeDiscount(guildId, userId) {
    return resetUpgradeDiscountHelper(this.client, guildId, userId);
  }

  // Open a crate and get rewards
  async openCrate(guildId, userId, type) {
    const rewards = await openCrateHelper(
      this.client,
      (targetGuildId, targetUserId, targetType) =>
        this.getCrateCooldown(targetGuildId, targetUserId, targetType),
      (targetGuildId, targetUserId, targetType) =>
        this.updateCrateCooldown(targetGuildId, targetUserId, targetType),
      (targetGuildId, targetUserId, targetType, amount) =>
        this.removeCrate(targetGuildId, targetUserId, targetType, amount),
      (targetGuildId, targetUserId, targetType) =>
        this.generateCrateRewards(targetGuildId, targetUserId, targetType),
      (targetGuildId, targetUserId, rewards) =>
        this.processCrateRewards(targetGuildId, targetUserId, rewards),
      guildId,
      userId,
      type
    );
  }

  // Generate rewards for a crate
  async generateCrateRewards(guildId, userId, type) {
    return generateCrateRewardsHelper(guildId, userId, type);
  }

  // Process and apply crate rewards
  async processCrateRewards(guildId, userId, rewards) {
    return processCrateRewardsHelper(
      this.client,
      (targetGuildId, targetUserId, amount) =>
        this.addBalance(targetGuildId, targetUserId, amount),
      (targetGuildId, targetUserId, discount) =>
        this.addUpgradeDiscount(targetGuildId, targetUserId, discount),
      guildId,
      userId,
      rewards
    );
  }

  async addBalance(guildId, userId, amount) {
    return addBalanceHelper(
      this.client,
      (targetGuildId, targetUserId) => this.ensureUser(targetGuildId, targetUserId),
      guildId,
      userId,
      amount
    );
  }

  async transferBalance(guildId, fromUserId, toUserId, amount) {
    return transferBalanceHelper(
      this.client,
      (targetGuildId, targetUserId) => this.ensureUser(targetGuildId, targetUserId),
      guildId,
      fromUserId,
      toUserId,
      amount
    );
  }

  // === Guild Vault Methods ===

  /**
   * Получить или создать guild vault
   * @param {string} guildId
   * @returns {Promise<object>} Guild vault record
   */
  async getOrCreateGuildVault(guildId) {
    return getOrCreateGuildVaultHelper(this.client, guildId);
  }

  /**
   * Добавить сумму в guild vault и запустить автоматическое распределение
   * @param {string} guildId
   * @param {object} amount - Decimal сумма комиссии для добавления
   * @param {string} userId - ID пользователя, инициировавшего операцию
   * @param {string} operationType - 'deposit' или 'withdraw'
   * @returns {Promise<object>} Updated guild vault
   */
  async addToGuildVault(guildId, amount, userId, operationType) {
    return addToGuildVaultHelper(this.client, guildId, amount, userId, operationType);
  }

  /**
   * Автоматическое распределение средств из guild vault
   * Распределяет 50% от комиссии (2.5% от операции) всем участникам с банковскими балансами
   * @param {object} tx - Transaction instance
   * @param {string} guildId
   * @param {string} excludedUserId - ID пользователя для исключения из распределения
   * @param {object} distributionAmount - Decimal сумма для распределения (половина от комиссии)
   */
  async distributeGuildVaultFunds(
    tx,
    guildId,
    excludedUserId,
    distributionAmount
  ) {
    return distributeGuildVaultFundsHelper(
      tx,
      guildId,
      excludedUserId,
      distributionAmount
    );
  }

  /**
   * Получить историю распределений для гильдии
   * @param {string} guildId
   * @param {number} limit - Лимит записей
   * @returns {Promise<Array>} Массив записей о распределениях
   */
  async getGuildVaultDistributions(guildId, limit = 10) {
    return getGuildVaultDistributionsHelper(this.client, guildId, limit);
  }

  /**
   * Получить личные распределения пользователя
   * @param {string} guildId
   * @param {string} userId
   * @param {number} limit - Лимит записей
   * @returns {Promise<Array>} Массив личных распределений
   */
  async getUserVaultDistributions(guildId, userId, limit = 10) {
    return getUserVaultDistributionsHelper(this.client, guildId, userId, limit);
  }

  async deposit(guildId, userId, amount) {
    return depositHelper(
      this.client,
      (targetGuildId, targetUserId) => this.ensureUser(targetGuildId, targetUserId),
      (principal, annualRate, timeMs) =>
        this.calculateInterestDecimal(principal, annualRate, timeMs),
      (xp) => this.calculateLevel(xp),
      (targetGuildId, feeAmount, targetUserId, operationType) =>
        this.addToGuildVault(targetGuildId, feeAmount, targetUserId, operationType),
      guildId,
      userId,
      amount
    );
  }

  async withdraw(guildId, userId, amount) {
    return withdrawHelper(
      this.client,
      (targetGuildId, targetUserId) => this.ensureUser(targetGuildId, targetUserId),
      (principal, annualRate, timeMs) =>
        this.calculateInterestDecimal(principal, annualRate, timeMs),
      (xp) => this.calculateLevel(xp),
      (targetGuildId, feeAmount, targetUserId, operationType) =>
        this.addToGuildVault(targetGuildId, feeAmount, targetUserId, operationType),
      guildId,
      userId,
      amount
    );
  }

  // Bank Operations
  async updateBankBalance(guildId, userId, tx = null) {
    return updateBankBalanceHelper(
      tx || this.client,
      (principal, annualRate, timeMs) =>
        this.calculateInterestDecimal(principal, annualRate, timeMs),
      guildId,
      userId
    );
  }

  calculateInterest(principal, annualRate, timeMs) {
    return calculateInterest(principal, annualRate, timeMs);
  }

  calculateInterestDecimal(principal, annualRate, timeMs) {
    return calculateInterestDecimal(principal, annualRate, timeMs);
  }

  async calculateBankBalance(user, tx = null) {
    return calculateBankBalanceHelper(
      this.client,
      (principal, annualRate, timeMs) =>
        this.calculateInterestDecimal(principal, annualRate, timeMs),
      user,
      tx
    );
  }

  async getUser(guildId, userId, includeRelations = true, tx = null) {
    return getUserHelper(this.client, guildId, userId, includeRelations, tx);
  }

  /**
   * Gets the locale preference for a specific user.
   * @param {string} guildId - The guild ID.
   * @param {string} userId - The user ID.
   * @returns {Promise<string|null>} The user's locale string or null if not set/found.
   */
  async getUserLocale(guildId, userId) {
    try {
      return await getUserLocaleHelper(this.client, guildId, userId);
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
      await setUserLocaleHelper(
        (targetGuildId, targetUserId, data) =>
          this.updateUser(targetGuildId, targetUserId, data),
        guildId,
        userId,
        locale
      );
    } catch (error) {
      console.error(
        `Error setting locale for user ${userId} in guild ${guildId}:`,
        error
      );
      throw error; // Rethrow to indicate failure
    }
  }

  async createUser(guildId, userId, data = {}) {
    return createUserHelper(
      this.client,
      (targetGuildId, targetUserId, upgrades) =>
        this.updateUpgrades(targetGuildId, targetUserId, upgrades),
      guildId,
      userId,
      data
    );
  }

  async updateUser(guildId, userId, data) {
    return updateUserHelper(
      this.client,
      (targetGuildId, targetUserId) => this.getUser(targetGuildId, targetUserId),
      (targetGuildId, targetUserId, createData) =>
        this.createUser(targetGuildId, targetUserId, createData),
      (targetGuildId, targetUserId, upgrades) =>
        this.updateUpgrades(targetGuildId, targetUserId, upgrades),
      guildId,
      userId,
      data
    );
  }

  // Helper method to ensure user exists
  async ensureUser(guildId, userId) {
    return ensureUserHelper(
      (targetGuildId, targetUserId) => this.getUser(targetGuildId, targetUserId),
      (targetGuildId, targetUserId) =>
        this.createUser(targetGuildId, targetUserId),
      guildId,
      userId
    );
  }

  // Helper method to ensure guild exists
  async ensureGuild(guildId) {
    return ensureGuildHelper(this.client, guildId);
  }

  async ensureGuildUser(guildId, userId) {
    return ensureGuildUserHelper(this.client, guildId, userId);
  }

  // Guild Operations
  async getGuild(guildId) {
    return getGuildHelper(this.client, guildId);
  }

  async upsertGuild(guildId, data = {}) {
    return upsertGuildHelper(this.client, guildId, data);
  }

  async getGameRecords(guildId, userId) {
    return getGameRecordsHelper(
      (targetGuildId, targetUserId) => this._getStatsData(targetGuildId, targetUserId),
      guildId,
      userId
    );
  }

  async getDailyCrateStatus(guildId, userId) {
    const stats = await this.getStatistics(guildId, userId);
    const cooldownRemainingMs = await this.getCooldown(guildId, userId, "daily");
    return buildDailyCrateStatus(stats, cooldownRemainingMs, Date.now());
  }

  async markDailyCrateReminderSent(guildId, userId) {
    const stats = await this.getStatistics(guildId, userId);
    const interactionStats = markDailyCrateReminderSent(stats, Date.now());
    return this.updateStatistics(userId, guildId, {
      interactionStats,
    });
  }

  async getGameDailyStatus(guildId, userId, gameId) {
    const upgrades = await this.getUserUpgrades(guildId, userId);
    return getGameDailyStatusFromDb(
      this.client,
      guildId,
      userId,
      gameId,
      upgrades,
      Date.now()
    );
  }

  async awardGameDailyEarnings(guildId, userId, gameId, amount) {
    // First, get current status to know the cap
    const upgrades = await this.getUserUpgrades(guildId, userId);
    const status = await getGameDailyStatusFromDb(
      this.client,
      guildId,
      userId,
      gameId,
      upgrades,
      Date.now()
    );

    // Cap the amount to what's remaining
    const safeAmount = Math.max(0, Math.min(amount, status.remainingToday));
    const blockedAmount = Math.max(0, amount - safeAmount);

    if (safeAmount > 0) {
      // Atomic increment - this is the key fix for race conditions
      const awardResult = await awardGameDailyEarningsAtomic(
        this.client,
        guildId,
        userId,
        gameId,
        safeAmount,
        Date.now()
      );

      // Add balance
      await this.addBalance(guildId, userId, safeAmount);

      return {
        gameId,
        dateKey: status.dateKey,
        earnedToday: awardResult.earnedAfter,
        remainingToday: status.cap - awardResult.earnedAfter,
        baseCap: status.baseCap,
        cap: status.cap,
        upgradeLevel: status.upgradeLevel,
        multiplier: status.multiplier,
        requestedAmount: amount,
        awardedAmount: safeAmount,
        blockedAmount,
      };
    }

    // No amount to award (already at cap)
    return {
      gameId,
      dateKey: status.dateKey,
      earnedToday: status.earnedToday,
      remainingToday: status.remainingToday,
      baseCap: status.baseCap,
      cap: status.cap,
      upgradeLevel: status.upgradeLevel,
      multiplier: status.multiplier,
      requestedAmount: amount,
      awardedAmount: 0,
      blockedAmount: amount,
    };
  }

  async updateGameHighScore(guildId, userId, gameId, newScore) {
    return updateGameHighScoreHelper(
      this.client,
      (targetGuildId, targetUserId) => this.ensureGuildUser(targetGuildId, targetUserId),
      guildId,
      userId,
      gameId,
      newScore
    );
  }

  async addXP(guildId, userId, amount, type = "chat") {
    return addXPHelper(
      this.client,
      () => this.checkAndUpdateSeason(),
      (oldXp, newXp) => this.checkLevelUp(oldXp, newXp),
      (targetGuildId) => this.getLevelRoles(targetGuildId),
      guildId,
      userId,
      amount,
      type
    );
  }

  async addGameXP(guildId, userId, gameType, amount) {
    return addGameXPHelper(
      this.client,
      () => this.checkAndUpdateSeason(),
      (oldXp, newXp) => this.checkLevelUp(oldXp, newXp),
      (targetGuildId) => this.getLevelRoles(targetGuildId),
      guildId,
      userId,
      gameType,
      amount
    );
  }

  async getLevel(guildId, userId, isGame = false) {
    return getLevelHelper(
      (targetGuildId, targetUserId) => this._getLevelData(targetGuildId, targetUserId),
      (xp) => this.calculateLevel(xp),
      guildId,
      userId,
      isGame
    );
  }

  async getAllLevels(guildId, userId) {
    return getAllLevelsHelper(
      (targetGuildId, targetUserId) => this._getLevelData(targetGuildId, targetUserId),
      (targetGuildId, targetUserId) => this._getStatsData(targetGuildId, targetUserId),
      (xp) => this.calculateLevel(xp),
      guildId,
      userId
    );
  }

  calculateLevel(xp) {
    return calculateLevelHelper(xp);
  }

  checkLevelUp(oldXp, newXp) {
    return checkLevelUpHelper(oldXp, newXp);
  }

  async savePlayer(player) {
    return savePlayerHelper(this.client, player);
  }

  async getPlayer(guildId) {
    return getPlayerHelper(this.client, guildId);
  }

  async loadPlayers() {
    return loadPlayersHelper(this.client);
  }

  async deletePlayer(guildId) {
    return deletePlayerHelper(this.client, guildId);
  }

  async ensurePlayer(guildId, data = {}) {
    return ensurePlayerHelper(this.client, guildId, data);
  }

  async updatePlayer(guildId, data) {
    return updatePlayerHelper(this.client, guildId, data);
  }

  async getGameRecords(guildId, userId) {
    return getGameRecordsHelper(
      (targetGuildId, targetUserId) => this._getStatsData(targetGuildId, targetUserId),
      guildId,
      userId
    );
  }

  async updateGameHighScore(guildId, userId, gameType, score) {
    return updateGameHighScoreHelper(
      this.client,
      (targetGuildId, targetUserId) => this.ensureGuildUser(targetGuildId, targetUserId),
      guildId,
      userId,
      gameType,
      score
    );
  }

  async getInteractionStats(guildId, userId) {
    return getInteractionStatsHelper(this.client, guildId, userId);
  }

  async getMostUsedInteractions(guildId, userId, type, limit = 5) {
    return getMostUsedInteractionsHelper(
      (targetGuildId, targetUserId) =>
        this.getInteractionStats(targetGuildId, targetUserId),
      guildId,
      userId,
      type,
      limit
    );
  }

  async transaction(fn) {
    return this.client.$transaction(fn);
  }

  // Universal data access
  async get(path) {
    return genericGetHelper(this.client, path);
  }

  async updateUpgrades(guildId, userId, upgrades) {
    return updateUpgradesHelper(this.client, guildId, userId, upgrades);
  }

  // Get info about an upgrade based on type and level
  async getUpgradeInfo(type, level) {
    return getUpgradeInfo(type, level);
  }

  // Purchase an upgrade
  async purchaseUpgrade(guildId, userId, type) {
    return purchaseUpgradeHelper(
      this.client,
      (targetType, level) => this.getUpgradeInfo(targetType, level),
      guildId,
      userId,
      type
    );
  }

  // Get all upgrades for a user
  async getUserUpgrades(guildId, userId) {
    return getUserUpgradesHelper(
      (targetGuildId, targetUserId, includeRelations = true) =>
        this.getUser(targetGuildId, targetUserId, includeRelations),
      guildId,
      userId
    );
  }

  // Revert an upgrade (decrease level by 1 and refund 85% of the price)
  async revertUpgrade(guildId, userId, type) {
    return revertUpgradeHelper(
      this.client,
      (targetGuildId, targetUserId, cooldownType) =>
        this.getCooldown(targetGuildId, targetUserId, cooldownType),
      (targetType, level) => this.getUpgradeInfo(targetType, level),
      (targetGuildId, targetUserId, cooldownType) =>
        this.updateCooldown(targetGuildId, targetUserId, cooldownType),
      guildId,
      userId,
      type
    );
  }

  async createVoiceSession(guildId, userId, channelId, joinedAt) {
    return createVoiceSessionHelper(
      this.client,
      (targetGuildId, targetUserId) => this.ensureGuildUser(targetGuildId, targetUserId),
      guildId,
      userId,
      channelId,
      joinedAt
    );
  }

  async removeVoiceSession(guildId, userId) {
    return removeVoiceSessionHelper(this.client, guildId, userId);
  }

  async getVoiceSession(guildId, userId) {
    return getVoiceSessionHelper(this.client, guildId, userId);
  }

  async getAllVoiceSessions(guildId, channelId) {
    return getAllVoiceSessionsHelper(this.client, guildId, channelId);
  }

  async calculateAndAddVoiceXP(guildId, userId, session) {
    return calculateAndAddVoiceXPHelper(
      this.client,
      (targetGuildId, targetUserId, amount, type) =>
        this.addXP(targetGuildId, targetUserId, amount, type),
      guildId,
      userId,
      session
    );
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
    return createCryptoPositionHelper(
      this.client,
      (targetGuildId, targetUserId) => this.ensureUser(targetGuildId, targetUserId),
      guildId,
      userId,
      positionData
    );
  }

  /**
   * Fetches all active crypto positions for a user in a guild.
   * @param {string} guildId
   * @param {string} userId
   * @returns {Promise<Array<object>>} Array of positions.
   */
  async getUserCryptoPositions(guildId, userId) {
    return getUserCryptoPositionsHelper(this.client, guildId, userId);
  }

  /**
   * Fetches a specific crypto position by its ID.
   * @param {string} positionId
   * @returns {Promise<object|null>} The position or null if not found.
   */
  async getCryptoPositionById(positionId) {
    return getCryptoPositionByIdHelper(this.client, positionId);
  }

  /**
   * Updates a specific crypto position.
   * @param {string} positionId
   * @param {object} updateData - Fields to update (e.g., { takeProfitPrice, stopLossPrice })
   * @returns {Promise<object>} The updated position.
   */
  async updateCryptoPosition(positionId, updateData) {
    return updateCryptoPositionHelper(this.client, positionId, updateData);
  }

  /**
   * Deletes a specific crypto position by its ID.
   * @param {string} positionId
   * @returns {Promise<object>} The deleted position data.
   */
  async deleteCryptoPosition(positionId) {
    return deleteCryptoPositionHelper(this.client, positionId);
  }

  /**
   * Fetches all active crypto positions across all users/guilds.
   * Use with caution, potentially large dataset.
   * @returns {Promise<Array<object>>} Array of all active positions.
   */
  async getAllActiveCryptoPositions() {
    return getAllActiveCryptoPositionsHelper(this.client);
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
    return proposeMarriageHelper(
      this.client,
      (targetGuildId, targetUserId) => this.ensureUser(targetGuildId, targetUserId),
      (targetGuildId, targetUserId) =>
        this.getMarriageStatus(targetGuildId, targetUserId),
      guildId,
      userId1,
      userId2
    );
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
    return acceptMarriageHelper(this.client, guildId, userId1, userId2);
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
    return rejectMarriageHelper(this.client, guildId, userId1, userId2);
  }

  /**
   * Checks the marriage status of a user.
   * @param {string} guildId
   * @param {string} userId
   * @returns {Promise<object|null>} Returns { partnerId, status } or null if not married/pending.
   */
  async getMarriageStatus(guildId, userId) {
    return getMarriageStatusHelper(this.client, guildId, userId);
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
    return dissolveMarriageHelper(this.client, guildId, userId1, userId2);
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
    return getLevelDataHelper(this.client, guildId, userId);
  }

  /**
   * Helper method to get statistics data for a user
   * @param {string} guildId
   * @param {string} userId
   * @returns {Promise<object|null>} Statistics data or null if not found
   */
  async _getStatsData(guildId, userId) {
    return getStatsDataHelper(this.client, guildId, userId);
  }

  /**
   * Get user statistics
   * @param {string} userId
   * @param {string} guildId
   * @returns {Promise<object|null>} User statistics or null if not found
   */
  async getStatistics(userId, guildId) {
    return getStatisticsHelper(this.client, userId, guildId);
  }

  /**
   * Update user statistics
   * @param {string} userId
   * @param {string} guildId
   * @param {object} updateData - Data to update (should contain valid Statistics model fields)
   * @returns {Promise<object>} Updated statistics
   */
  async updateStatistics(userId, guildId, updateData) {
    return updateStatisticsHelper(
      this.client,
      (targetGuildId, targetUserId) => this.ensureGuildUser(targetGuildId, targetUserId),
      userId,
      guildId,
      updateData
    );
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
    return incrementStatisticHelper(
      this.client,
      (targetGuildId, targetUserId) => this.ensureGuildUser(targetGuildId, targetUserId),
      (targetUserId, targetGuildId, updateData) =>
        this.updateStatistics(targetUserId, targetGuildId, updateData),
      userId,
      guildId,
      field,
      amount
    );
  }

  // --- End Statistics Methods ---

  // #region Level Roles
  async getLevelRoles(guildId) {
    return getLevelRoles(this.client, guildId);
  }

  async getEligibleLevelRole(guildId, currentLevel) {
    return getEligibleLevelRole(this.client, guildId, currentLevel);
  }

  async getNextLevelRole(guildId, currentLevel) {
    return getNextLevelRole(this.client, guildId, currentLevel);
  }

  async addLevelRole(guildId, roleId, requiredLevel) {
    return addLevelRole(this.client, guildId, roleId, requiredLevel);
  }

  async removeLevelRole(guildId, roleId) {
    return removeLevelRole(this.client, guildId, roleId);
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
      return await getGuildUsers(this.client, guildId);
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
      return await getCurrentSeasonHelper(this.client);
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
      return await getSeasonLeaderboard(this.client, seasonId, limit);
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
      return await getUserCratesHelper(this.client, guildId, userId);
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
      return await getUserCrateHelper(this.client, guildId, userId, crateType);
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
      return await addCrateHelper(this.client, guildId, userId, crateType, amount);
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
      return await removeCrateHelper(this.client, guildId, userId, crateType, amount);
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
      return await getCrateCooldownHelper(this.client, guildId, userId, crateType);
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
    return getFromCacheHelper(key);
  }

  /**
   * Set cache value (Redis disabled - no-op)
   * @param {string} key
   * @param {any} value
   * @param {number|null} ttl
   * @returns {Promise<boolean>}
   */
  async setCache(key, value, ttl = null) {
    return setCacheHelper(key, value, ttl);
  }

  /**
   * Invalidate cache keys (Redis disabled - no-op)
   * @param {Array<string>} keys
   * @returns {Promise<boolean>}
   */
  async invalidateCache(keys) {
    return invalidateCacheHelper(keys);
  }

  /**
   * Delete cache key (Redis disabled - no-op)
   * @param {string} key
   * @returns {Promise<boolean>}
   */
  async deleteFromCache(key) {
    return deleteFromCacheHelper(key);
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
