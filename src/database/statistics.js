import { serializeWithBigInt, deserializeWithBigInt } from "./client.js";

export default {
  async getGameRecords(guildId, userId) {
    try {
      await this.ensureGuildUser(guildId, userId);

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
      await this.ensureGuildUser(guildId, userId);

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

      if (isNewRecord) {
        cleanRecords[gameType].highScore = score;
        await this.client.statistics.update({
          where: { userId_guildId: { userId, guildId } },
          data: { gameRecords: cleanRecords },
        });
      }

      return isNewRecord;
    } catch (error) {
      console.error("Error updating game high score:", error);
      return false;
    }
  },
};
