import { PrismaClient } from "@prisma/client";

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
    database: { averageSpeed: 0, ping: 0 },
  },
  guild: {
    settings: {},
  },
};

class Database {
  constructor() {
    this.client = new PrismaClient({
      log:
        process.env.NODE_ENV === "production" ? ["error"] : ["query", "error"],
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    });

    // Performance monitoring middleware
    this.client.$use(async (params, next) => {
      const start = Date.now();

      try {
        const result = await next(params);
        const duration = Date.now() - start;

        if (duration > 500) {
          console.warn(`Slow operation (${duration}ms):`, {
            model: params.model,
            action: params.action,
            args: params.args,
          });
        }

        return result;
      } catch (error) {
        const duration = Date.now() - start;
        console.error(
          `Operation ${params.model}.${params.action} failed after ${duration}ms`,
          {
            error: error.message,
            stack: error.stack,
            params,
          }
        );
        throw error;
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

  async initialize() {
    try {
      await this.client.$connect();
      console.log("Database connection initialized successfully");
      await this.initializeModules();
      await this.initializeSeason();
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
    try {
      const now = new Date();
      const currentSeason = await this.client.seasons.findUnique({
        where: { id: "current" },
      });

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
    }
  }

  async getCurrentSeason() {
    try {
      const season = await this.client.seasons.findUnique({
        where: { id: "current" },
      });

      if (!season) {
        // Initialize first season if not exists
        const nextMonth = new Date(
          new Date().getFullYear(),
          new Date().getMonth() + 1,
          1
        );
        return await this.client.seasons.create({
          data: {
            id: "current",
            seasonEnds: nextMonth.getTime() - 1,
            seasonNumber: 1,
          },
        });
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
      console.log("Database connection closed successfully");
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
  }
}

// Export the Database class instance without initializing
const instance = new Database();
export default instance;
