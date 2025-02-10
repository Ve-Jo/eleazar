export default {
  async addXP(guildId, userId, amount, type = "chat") {
    return await this.client.$transaction(async (prisma) => {
      // Check and update season if needed
      await this.checkAndUpdateSeason();

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

      // Update detailed XP stats
      const stats = await prisma.statistics.upsert({
        where: {
          userId_guildId: {
            userId,
            guildId,
          },
        },
        create: {
          userId,
          guildId,
          xpStats: { [type]: amount },
        },
        update: {
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

      return { level: updatedLevel, stats };
    });
  },

  async addGameXP(guildId, userId, amount, gameType) {
    // Start a transaction to update both Level and Statistics
    return await this.client.$transaction(async (prisma) => {
      // Check and update season if needed
      await this.checkAndUpdateSeason();

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

      // Update detailed game XP stats
      const stats = await prisma.statistics.upsert({
        where: {
          userId_guildId: {
            userId,
            guildId,
          },
        },
        create: {
          userId,
          guildId,
          gameXpStats: { [gameType]: amount },
        },
        update: {
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

      return { level, stats };
    });
  },

  async getLevel(guildId, userId, isGame = false) {
    const level = await this.client.level.findUnique({
      where: {
        userId_guildId: {
          userId,
          guildId,
        },
      },
    });

    if (!level) return this.calculateLevel(0);

    return this.calculateLevel(isGame ? level.gameXp : level.xp);
  },

  async getAllLevels(guildId, userId) {
    const [level, stats] = await Promise.all([
      this.client.level.findUnique({
        where: {
          userId_guildId: {
            userId,
            guildId,
          },
        },
        select: {
          xp: true,
          gameXp: true,
          seasonXp: true,
        },
      }),
      this.client.statistics.findUnique({
        where: {
          userId_guildId: {
            userId,
            guildId,
          },
        },
        select: {
          xpStats: true,
          gameXpStats: true,
        },
      }),
    ]);

    if (!level) return {};

    const result = {
      activity: this.calculateLevel(level.xp),
      gaming: this.calculateLevel(level.gameXp),
      season: this.calculateLevel(level.seasonXp), // Add season level calculation
    };

    if (stats) {
      result.details = {
        activity: stats.xpStats,
        gaming: stats.gameXpStats,
      };
    }

    return result;
  },

  calculateLevel(xp) {
    // Convert BigInt to number for calculations
    const xpNumber = typeof xp === "bigint" ? Number(xp) : xp;
    const level = Math.floor(Math.sqrt(xpNumber / 100));
    const currentLevelXP = Math.pow(level, 2) * 100;
    const nextLevelXP = Math.pow(level + 1, 2) * 100;

    return {
      level: Math.max(1, level),
      currentXP: xpNumber - currentLevelXP,
      requiredXP: nextLevelXP - currentLevelXP,
      totalXP: xpNumber,
    };
  },
};
