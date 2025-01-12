// Constants
export const COOLDOWNS = {
  crime: {
    base: 8 * 60 * 60 * 1000, // 8 hours
    min: 2 * 60 * 60 * 1000, // 2 hours minimum
    reduction: 20 * 60 * 1000, // 20 minutes per level
  },
  daily: 24 * 60 * 60 * 1000, // 24 hours
  message: 60 * 1000, // 1 minute
};

export const UPGRADES = {
  daily: {
    id: 0,
    emoji: "💰",
    basePrice: 20,
    priceMultiplier: 1.5,
    effectMultiplier: 0.15, // 15% increase per level
  },
  crime: {
    id: 1,
    emoji: "⏳",
    basePrice: 50,
    priceMultiplier: 1.2,
    effectValue: 20 * 60 * 1000, // 20 minutes reduction per level
  },
};

export const DEFAULT_VALUES = {
  guild: {
    settings: {
      xp_per_message: 1,
      message_cooldown: 60,
      multiplier: 100,
    },
    counting: {
      channel_id: "0",
      message: 1,
      pinoneach: 0,
      pinnedrole: "0",
      only_numbers: false,
      lastpinnedmember: "0",
      no_same_user: false,
      no_unique_role: false,
      lastwritter: "0",
    },
  },
  user: {
    balance: 0,
    totalXp: 0,
    bannerUrl: null,
    latestActivity: Date.now(),
    totalMessages: 0,
    commandsUsed: 0,
    totalEarned: 0,
  },
  bank: {
    amount: 0,
    startedToHold: 0,
    holdingPercentage: 0,
  },
  cooldowns: {
    daily: 0,
    work: 0,
    crime: 0,
    message: 0,
  },
  upgrades: {
    daily: {
      level: 1,
    },
    crime: {
      level: 1,
    },
  },
};

import EconomyService from "../services/EconomyService.js";

class EconomyEZ {
  static async testDatabaseConnection() {
    const testGuildId = "test_guild";
    const testUserId = "test_user";

    try {
      await EconomyService.get(`${testGuildId}.${testUserId}`);
      console.log("Successfully connected to the database");
      return true;
    } catch (error) {
      console.error("Database connection test failed:", {
        error: error.message,
        stack: error.stack,
        cause: error.cause,
      });
      throw error;
    }
  }

  static async get(path) {
    try {
      if (!path) {
        throw new Error("Path is required for get operation");
      }
      const [guildId, userId] = path.split(".");
      if (!guildId || !userId) {
        throw new Error(
          `Invalid path format: ${path}. Expected format: guildId.userId.field`
        );
      }

      return await EconomyService.get(path);
    } catch (error) {
      console.error("Error in EconomyEZ.get:", {
        path,
        error: error.message,
        stack: error.stack,
        cause: error.cause,
      });
      throw error;
    }
  }

  static async set(path, value) {
    try {
      if (!path) {
        throw new Error("Path is required for set operation");
      }
      const [guildId, userId] = path.split(".");
      if (!guildId || !userId) {
        throw new Error(
          `Invalid path format: ${path}. Expected format: guildId.userId.field`
        );
      }

      return await EconomyService.set(path, value);
    } catch (error) {
      console.error("Error in EconomyEZ.set:", {
        path,
        value,
        error: error.message,
        stack: error.stack,
        cause: error.cause,
      });
      throw error;
    }
  }

  static async math(path, operator, number) {
    try {
      if (!path) {
        throw new Error("Path is required for math operation");
      }
      if (!["+", "-", "*", "/"].includes(operator)) {
        throw new Error(`Invalid operator: ${operator}`);
      }
      if (isNaN(number)) {
        throw new Error(`Invalid number: ${number}`);
      }

      return await EconomyService.math(path, operator, number);
    } catch (error) {
      console.error("Error in EconomyEZ.math:", {
        path,
        operator,
        number,
        error: error.message,
        stack: error.stack,
        cause: error.cause,
      });
      throw error;
    }
  }

  static async getCooldownTime(guildId, userId, type) {
    try {
      if (!guildId || !userId) {
        throw new Error("Both guildId and userId are required");
      }
      if (!type || !COOLDOWNS[type]) {
        throw new Error(`Invalid cooldown type: ${type}`);
      }

      return await EconomyService.getCooldownTime(guildId, userId, type);
    } catch (error) {
      console.error("Error in EconomyEZ.getCooldownTime:", {
        guildId,
        userId,
        type,
        error: error.message,
        stack: error.stack,
        cause: error.cause,
      });
      throw error;
    }
  }

  static async isCooldownActive(guildId, userId, type) {
    try {
      const remainingTime = await this.getCooldownTime(guildId, userId, type);
      return remainingTime > 0;
    } catch (error) {
      console.error("Error in EconomyEZ.isCooldownActive:", {
        guildId,
        userId,
        type,
        error: error.message,
        stack: error.stack,
        cause: error.cause,
      });
      throw error;
    }
  }

  static getUpgradeInfo(type, level) {
    try {
      if (!type || !UPGRADES[type]) {
        throw new Error(`Invalid upgrade type: ${type}`);
      }
      if (isNaN(level) || level < 1) {
        throw new Error(`Invalid level: ${level}`);
      }

      return EconomyService.getUpgradeInfo(type, level);
    } catch (error) {
      console.error("Error in EconomyEZ.getUpgradeInfo:", {
        type,
        level,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  static async getUpgrades(guildId, userId) {
    try {
      if (!guildId || !userId) {
        throw new Error("Both guildId and userId are required");
      }

      return await EconomyService.getUpgrades(guildId, userId);
    } catch (error) {
      console.error("Error in EconomyEZ.getUpgrades:", {
        guildId,
        userId,
        error: error.message,
        stack: error.stack,
        cause: error.cause,
      });
      throw error;
    }
  }

  static async updateBankOnInactivity(guildId, userId) {
    try {
      if (!guildId || !userId) {
        throw new Error("Both guildId and userId are required");
      }

      const user = await this.get(`${guildId}.${userId}`);
      if (!user) {
        throw new Error(`User not found: ${guildId}.${userId}`);
      }
      if (!user.bank) {
        throw new Error(
          `Bank account not found for user: ${guildId}.${userId}`
        );
      }

      console.log("Calculating bank balance for:", {
        guildId,
        userId,
        currentBank: user.bank,
        latestActivity: user.latestActivity,
      });

      const newBalance = await EconomyService.calculateBankBalance(
        user.bank,
        user.latestActivity,
        guildId,
        userId
      );

      if (newBalance !== user.bank.amount) {
        console.log("Updating bank balance:", {
          guildId,
          userId,
          oldBalance: user.bank.amount,
          newBalance,
        });

        await this.set(`${guildId}.${userId}.bank`, {
          amount: newBalance,
          startedToHold: user.bank.startedToHold,
          holdingPercentage: user.bank.holdingPercentage,
        });
      }

      return newBalance;
    } catch (error) {
      console.error("Error in EconomyEZ.updateBankOnInactivity:", {
        guildId,
        userId,
        error: error.message,
        stack: error.stack,
        cause: error.cause,
      });
      throw error;
    }
  }

  static calculateLevel(
    totalXp,
    multiplier = DEFAULT_VALUES.guild.settings.multiplier
  ) {
    try {
      if (isNaN(totalXp)) {
        throw new Error(`Invalid totalXp: ${totalXp}`);
      }
      if (isNaN(multiplier)) {
        throw new Error(`Invalid multiplier: ${multiplier}`);
      }

      const level = Math.max(1, Math.floor(Math.sqrt(totalXp / multiplier)));
      const xpForCurrentLevel = (level - 1) * (level - 1) * multiplier;
      const xpForNextLevel = level * level * multiplier;
      const remainingXp = totalXp - xpForCurrentLevel;

      return {
        level,
        currentXP: remainingXp,
        requiredXP: xpForNextLevel - xpForCurrentLevel,
        totalXP: totalXp,
      };
    } catch (error) {
      console.error("Error in EconomyEZ.calculateLevel:", {
        totalXp,
        multiplier,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  static async addXP(guildId, userId, amount) {
    try {
      if (!guildId || !userId) {
        throw new Error("Both guildId and userId are required");
      }
      if (isNaN(amount)) {
        throw new Error(`Invalid amount: ${amount}`);
      }

      await this.math(`${guildId}.${userId}.totalXp`, "+", amount);
      const user = await this.get(`${guildId}.${userId}`);
      if (!user) {
        throw new Error(`User not found after XP update: ${guildId}.${userId}`);
      }

      return this.calculateLevel(user.totalXp);
    } catch (error) {
      console.error("Error in EconomyEZ.addXP:", {
        guildId,
        userId,
        amount,
        error: error.message,
        stack: error.stack,
        cause: error.cause,
      });
      throw error;
    }
  }

  static async getGuildUsers(guildId) {
    try {
      if (!guildId) {
        throw new Error("GuildId is required");
      }

      return await EconomyService.getGuildUsers(guildId);
    } catch (error) {
      console.error("Error in EconomyEZ.getGuildUsers:", {
        guildId,
        error: error.message,
        stack: error.stack,
        cause: error.cause,
      });
      throw error;
    }
  }

  static async purchaseUpgrade(guildId, userId, type) {
    try {
      if (!guildId || !userId) {
        throw new Error("Both guildId and userId are required");
      }
      if (!type || !UPGRADES[type]) {
        throw new Error(`Invalid upgrade type: ${type}`);
      }

      const user = await this.get(`${guildId}.${userId}`);
      if (!user) {
        throw new Error(`User not found: ${guildId}.${userId}`);
      }

      const upgrades = await this.getUpgrades(guildId, userId);
      const currentLevel = upgrades[type]?.level || 1;
      const { price } = this.getUpgradeInfo(type, currentLevel);

      if (user.balance < price) {
        return { success: false, reason: "insufficient_funds" };
      }

      // Deduct the cost
      await this.math(`${guildId}.${userId}.balance`, "-", price);

      // Update the upgrade level
      return await EconomyService.upgradeLevel(guildId, userId, type);
    } catch (error) {
      console.error("Error in EconomyEZ.purchaseUpgrade:", {
        guildId,
        userId,
        type,
        error: error.message,
        stack: error.stack,
        cause: error.cause,
      });
      throw error;
    }
  }

  static async updateCooldown(guildId, userId, type) {
    try {
      if (!guildId || !userId) {
        throw new Error("Both guildId and userId are required");
      }
      if (!type || !COOLDOWNS[type]) {
        throw new Error(`Invalid cooldown type: ${type}`);
      }

      return await EconomyService.updateCooldown(guildId, userId, type);
    } catch (error) {
      console.error("Error in EconomyEZ.updateCooldown:", {
        guildId,
        userId,
        type,
        error: error.message,
        stack: error.stack,
        cause: error.cause,
      });
      throw error;
    }
  }

  static async remove(path) {
    try {
      if (!path) {
        throw new Error("Path is required for remove operation");
      }
      const [guildId, userId] = path.split(".");
      if (!guildId || !userId) {
        throw new Error(
          `Invalid path format: ${path}. Expected format: guildId.userId.field`
        );
      }

      return await EconomyService.remove(path);
    } catch (error) {
      console.error("Error in EconomyEZ.remove:", {
        path,
        error: error.message,
        stack: error.stack,
        cause: error.cause,
      });
      throw error;
    }
  }
}

export default EconomyEZ;
