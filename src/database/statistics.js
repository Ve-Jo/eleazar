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

      // If record exists, proceed with normal processing
      const stats = await this.client.statistics.upsert({
        where: {
          userId_guildId: { userId, guildId },
        },
        create: {
          gameRecords: {
            2048: { highScore: 0 },
            snake: { highScore: 0 },
          },
          user: {
            connect: {
              guildId_id: { guildId, id: userId },
            },
          },
        },
        update: {},
        select: { gameRecords: true },
      });

      let gameRecords = stats.gameRecords;

      // Handle potentially stringified data
      if (typeof gameRecords === "string") {
        try {
          gameRecords = JSON.parse(gameRecords);
          if (typeof gameRecords === "string") {
            gameRecords = JSON.parse(gameRecords);
          }
        } catch (e) {
          console.error("Error parsing game records:", e);
          gameRecords = {};
        }
      }

      // Clean and validate data
      const cleanRecords = {
        2048: { highScore: Number(gameRecords?.["2048"]?.highScore || 0) },
        snake: { highScore: Number(gameRecords?.["snake"]?.highScore || 0) },
      };

      // Update if data was corrupted
      if (JSON.stringify(cleanRecords) !== JSON.stringify(stats.gameRecords)) {
        await this.client.statistics.update({
          where: { userId_guildId: { userId, guildId } },
          data: { gameRecords: cleanRecords },
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
      // First check if the user exists in this guild
      const existingUser = await this.client.user.findUnique({
        where: {
          guildId_id: { guildId, id: userId },
        },
      });

      if (!existingUser) {
        // Create the user first to prevent duplicate records
        await this.client.user.create({
          data: {
            id: userId,
            guildId,
            lastActivity: Date.now(),
          },
        });
      }

      // Check if statistics record exists
      const stats = await this.client.statistics.findUnique({
        where: { userId_guildId: { userId, guildId } },
        select: { gameRecords: true },
      });

      let currentRecords = {};
      try {
        currentRecords =
          typeof stats?.gameRecords === "string"
            ? JSON.parse(stats.gameRecords)
            : stats?.gameRecords || {};

        if (typeof currentRecords === "string") {
          currentRecords = JSON.parse(currentRecords);
        }
      } catch (e) {
        console.error("Error parsing existing game records:", e);
      }

      const cleanRecords = {
        2048: { highScore: Number(currentRecords?.["2048"]?.highScore || 0) },
        snake: { highScore: Number(currentRecords?.["snake"]?.highScore || 0) },
      };

      const currentHighScore = cleanRecords[gameType]?.highScore || 0;
      const isNewRecord = score > currentHighScore;

      // Only update database if there's a new record
      if (isNewRecord) {
        cleanRecords[gameType].highScore = score;

        // Execute the update in a transaction to prevent race conditions
        await this.client.$transaction(async (tx) => {
          // Double-check if user still exists to prevent issues with concurrent deletions
          const userExists = await tx.user.findUnique({
            where: {
              guildId_id: { guildId, id: userId },
            },
          });

          if (!userExists) {
            // Create the user if it somehow disappeared
            await tx.user.create({
              data: {
                id: userId,
                guildId,
                lastActivity: Date.now(),
              },
            });
          } else {
            // Update user activity
            await tx.user.update({
              where: {
                guildId_id: { guildId, id: userId },
              },
              data: {
                lastActivity: Date.now(),
              },
            });
          }

          // Now safely update or create the statistics record
          await tx.statistics.upsert({
            where: { userId_guildId: { userId, guildId } },
            create: {
              userId,
              guildId,
              gameRecords: cleanRecords,
              lastUpdated: Date.now(),
            },
            update: {
              gameRecords: cleanRecords,
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

      let interactionStats = stats.interactionStats;
      if (typeof interactionStats === "string") {
        interactionStats = JSON.parse(interactionStats);
      }

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
