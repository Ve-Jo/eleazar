import { DEFAULT_VALUES } from "./client.js";

export default {
  async getUser(guildId, userId, includeRelations = true) {
    // Ensure guild exists first
    await this.client.guild.upsert({
      where: { id: guildId },
      create: { id: guildId, settings: {} },
      update: {},
    });

    const include = includeRelations
      ? {
          economy: true,
          Level: true,
          cooldowns: true,
          upgrades: true,
          stats: true, // Changed from statistics to stats to match schema
        }
      : {};

    // Try to get existing user
    const user = await this.client.user.findUnique({
      where: {
        guildId_id: {
          guildId,
          id: userId,
        },
      },
      include,
    });

    // If user doesn't exist, create it with default values
    if (!user) {
      return this.createUser(guildId, userId);
    }

    return user;
  },

  async createUser(guildId, userId, data = {}) {
    // Ensure guild exists first
    await this.client.guild.upsert({
      where: { id: guildId },
      create: { id: guildId, settings: {} },
      update: {},
    });

    const { economy, level, cooldowns, upgrades, stats, ...userData } = data;

    return this.client.$transaction(async (tx) => {
      // Upsert base user instead of create
      const user = await tx.user.upsert({
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
          ...userData,
          // Create related records
          economy: {
            create: {
              balance: DEFAULT_VALUES.economy.balance,
              bankBalance: DEFAULT_VALUES.economy.bankBalance,
              bankRate: DEFAULT_VALUES.economy.bankRate,
              bankStartTime: DEFAULT_VALUES.economy.bankStartTime,
              ...economy,
            },
          },
          stats: {
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
          },
          Level: {
            create: {
              xp: 0,
              ...level,
            },
          },
          cooldowns: {
            create: {
              data: JSON.stringify(DEFAULT_VALUES.cooldowns),
              ...cooldowns,
            },
          },
          upgrades: {
            create: Object.entries(DEFAULT_VALUES.upgrades).map(
              ([type, data]) => ({
                type,
                level: data.level,
              })
            ),
          },
        },
        update: {
          lastActivity: Date.now(),
          ...userData,
          // Update related records if they exist
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
        },
        include: {
          economy: true,
          stats: true,
          Level: true,
          cooldowns: true,
          upgrades: true,
        },
      });

      // Handle upgrades separately since they're a one-to-many relation
      if (!user.upgrades || user.upgrades.length === 0) {
        await tx.upgrade.createMany({
          data: Object.entries(DEFAULT_VALUES.upgrades).map(([type, data]) => ({
            userId,
            guildId,
            type,
            level: data.level,
          })),
        });
      }

      return user;
    });
  },

  async updateUser(guildId, userId, data) {
    // Ensure user exists first
    const existingUser = await this.getUser(guildId, userId);
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

    return this.client.user.update({
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
  },

  // Helper method to ensure user exists
  async ensureUser(guildId, userId) {
    const user = await this.getUser(guildId, userId);
    if (!user) {
      return this.createUser(guildId, userId);
    }
    return user;
  },

  // Helper method to ensure guild exists
  async ensureGuild(guildId) {
    return this.client.guild.upsert({
      where: { id: guildId },
      create: { id: guildId, settings: {} },
      update: {},
    });
  },

  async ensureGuildUser(guildId, userId) {
    return await this.client.$transaction(async (prisma) => {
      await prisma.guild.upsert({
        where: { id: guildId },
        create: { id: guildId, settings: {} },
        update: {},
      });

      return await prisma.user.upsert({
        where: {
          guildId_id: { guildId, id: userId },
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
    });
  },

  // Guild Operations
  async getGuild(guildId) {
    return this.client.guild.findUnique({
      where: { id: guildId },
      include: { users: true },
    });
  },

  async upsertGuild(guildId, data = {}) {
    return this.client.guild.upsert({
      where: { id: guildId },
      create: { id: guildId, ...data },
      update: data,
    });
  },

  async getGameRecords(guildId, userId) {
    const user = await this.getUser(guildId, userId);
    if (!user?.stats) {
      // Return default game records if no stats exist
      return {
        2048: { highScore: 0 },
        snake: { highScore: 0 },
      };
    }
    return JSON.parse(user.stats.gameRecords);
  },

  async updateGameHighScore(guildId, userId, gameId, newScore) {
    const user = await this.getUser(guildId, userId);
    if (!user?.stats) {
      return false;
    }

    try {
      const gameRecords = JSON.parse(user.stats.gameRecords);
      const currentHighScore = gameRecords[gameId]?.highScore || 0;

      // Only update if new score is higher
      if (newScore > currentHighScore) {
        gameRecords[gameId] = {
          ...gameRecords[gameId],
          highScore: newScore,
        };

        await this.client.statistics.update({
          where: {
            userId_guildId: {
              userId,
              guildId,
            },
          },
          data: {
            gameRecords: JSON.stringify(gameRecords),
          },
        });

        return true; // Indicates a new high score was set
      }

      return false; // No new high score
    } catch (error) {
      console.error("Error updating game high score:", error);
      return false;
    }
  },
};
