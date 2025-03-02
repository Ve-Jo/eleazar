export default {
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

      return { level: updatedLevel, stats };
    });
  },

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
