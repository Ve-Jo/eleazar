import { serializeWithBigInt, deserializeWithBigInt } from "./client.js";

export default {
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
  },

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
  },

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
  },

  async getMostUsedInteractions(guildId, userId, type, limit = 5) {
    const stats = await this.getInteractionStats(guildId, userId);
    if (!stats || !stats[type]) return [];

    return Object.entries(stats[type])
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([name, count]) => ({ name, count }));
  },
};
