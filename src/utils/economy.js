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
      // First test basic connection
      await EconomyService.testConnection();

      // Then test full functionality with a test user
      await EconomyService.get(`${testGuildId}.${testUserId}`);

      console.log(
        "Successfully connected to the database and initialized tables"
      );

      // Clean up test data
      await EconomyService.cleanupTestData(testGuildId, testUserId);
      console.log("Successfully cleaned up test data");

      return true;
    } catch (error) {
      // Try to clean up even if test failed
      try {
        await EconomyService.cleanupTestData(testGuildId, testUserId);
      } catch (cleanupError) {
        console.error("Failed to cleanup test data:", cleanupError);
      }

      console.error("Failed to connect to the database:", error);
      throw error;
    }
  }

  static async get(path) {
    return await EconomyService.get(path);
  }

  static async set(path, value) {
    return await EconomyService.set(path, value);
  }

  static async remove(path) {
    return await EconomyService.remove(path);
  }

  static async math(path, operator, number) {
    return await EconomyService.math(path, operator, number);
  }

  static async listGuilds() {
    return await EconomyService.listGuilds();
  }

  static async search(prefix) {
    return await EconomyService.search(prefix);
  }

  static async getCooldownTime(guildId, userId, type) {
    return await EconomyService.getCooldownTime(guildId, userId, type);
  }

  static async isCooldownActive(guildId, userId, type) {
    return await EconomyService.isCooldownActive(guildId, userId, type);
  }

  static getUpgradeInfo(type, level) {
    return EconomyService.getUpgradeInfo(type, level);
  }

  static async getUpgrades(guildId, userId) {
    return await EconomyService.getUpgrades(guildId, userId);
  }

  static async purchaseUpgrade(guildId, userId, type) {
    return await EconomyService.purchaseUpgrade(guildId, userId, type);
  }

  static calculateLevel(
    totalXp,
    multiplier = DEFAULT_VALUES.guild.settings.multiplier
  ) {
    return EconomyService.calculateLevel(totalXp, multiplier);
  }

  static async addXP(guildId, userId, amount) {
    return await EconomyService.addXP(guildId, userId, amount);
  }

  static async getGuildLevels(guildId) {
    return await EconomyService.getGuildLevels(guildId);
  }

  static async setGuildLevels(guildId, settings) {
    return await EconomyService.setGuildLevels(guildId, settings);
  }

  static async calculateBankBalance(bankData, latestActivity, guildId, userId) {
    return await EconomyService.calculateBankBalance(
      bankData,
      latestActivity,
      guildId,
      userId
    );
  }

  static async updateBankOnInactivity(guildId, userId) {
    return await EconomyService.updateBankOnInactivity(guildId, userId);
  }

  static async updateCooldown(guildId, userId, type) {
    return await EconomyService.updateCooldown(guildId, userId, type);
  }

  static async getGuildUsers(guildId) {
    return await EconomyService.getGuildUsers(guildId);
  }
}

export default EconomyEZ;
