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
          level: true,
          cooldowns: true,
          upgrades: true,
          stats: true,
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
      // Create base user
      const user = await tx.user.create({
        data: {
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
              ...stats,
            },
          },
          level: {
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
        include: {
          economy: true,
          stats: true,
          level: true,
          cooldowns: true,
          upgrades: true,
        },
      });

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
      updateData.level = {
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
        level: true,
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
};
