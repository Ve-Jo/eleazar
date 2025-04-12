import { COOLDOWNS, CRATE_TYPES } from "./client.js";

export default {
  // Crate types and their cooldowns
  // No longer need to define CRATE_TYPES here since we're importing it

  // Get all available crates for a user
  async getUserCrates(guildId, userId) {
    await this.ensureUser(guildId, userId);

    return this.client.crate.findMany({
      where: {
        userId,
        guildId,
      },
    });
  },

  // Get a specific crate or create it if not exists
  async getUserCrate(guildId, userId, type) {
    await this.ensureUser(guildId, userId);

    return this.client.crate.upsert({
      where: {
        userId_guildId_type: {
          userId,
          guildId,
          type,
        },
      },
      create: {
        userId,
        guildId,
        type,
        count: 0,
        acquired: 0,
      },
      update: {},
    });
  },

  // Add a crate to user's inventory
  async addCrate(guildId, userId, type, count = 1, properties = {}) {
    await this.ensureUser(guildId, userId);

    return this.client.crate.upsert({
      where: {
        userId_guildId_type: {
          userId,
          guildId,
          type,
        },
      },
      create: {
        userId,
        guildId,
        type,
        count,
        properties: JSON.stringify(properties),
        acquired: Date.now(),
      },
      update: {
        count: {
          increment: count,
        },
        acquired: Date.now(),
      },
    });
  },

  // Remove a crate from user's inventory
  async removeCrate(guildId, userId, type, count = 1) {
    const crate = await this.client.crate.findUnique({
      where: {
        userId_guildId_type: {
          userId,
          guildId,
          type,
        },
      },
    });

    if (!crate || crate.count < count) {
      throw new Error("Not enough crates");
    }

    if (crate.count === count) {
      return this.client.crate.delete({
        where: {
          userId_guildId_type: {
            userId,
            guildId,
            type,
          },
        },
      });
    }

    return this.client.crate.update({
      where: {
        userId_guildId_type: {
          userId,
          guildId,
          type,
        },
      },
      data: {
        count: {
          decrement: count,
        },
      },
    });
  },

  // Check if a cooldown for a specific crate type is active
  async getCrateCooldown(guildId, userId, type) {
    const user = await this.getUser(guildId, userId, { cooldowns: true });
    if (!user?.cooldowns) return 0;

    // Make sure we're working with a proper object
    let cooldowns = {};

    // Handle all possible data formats
    if (user.cooldowns.data) {
      try {
        if (
          typeof user.cooldowns.data === "object" &&
          !Array.isArray(user.cooldowns.data)
        ) {
          // It's already an object
          cooldowns = user.cooldowns.data;
        } else if (typeof user.cooldowns.data === "string") {
          // It's a JSON string, parse it
          cooldowns = JSON.parse(user.cooldowns.data);
        }
      } catch (error) {
        console.warn(
          `Failed to parse cooldown data for ${userId} in guild ${guildId}: ${error.message}`
        );
        // Reset to empty object if we can't parse
        cooldowns = {};
      }
    }

    const crateKey = `crate_${type}`;
    const lastUsed = cooldowns[crateKey] || 0;

    // Get the base cooldown time for this crate type
    const baseTime = CRATE_TYPES[type]?.cooldown || COOLDOWNS.daily;

    // Apply any cooldown reductions user might have
    // For daily crates, we'll reuse the existing daily_cooldown reduction logic
    if (type === "daily") {
      const userUpgrades = await this.client.upgrade.findMany({
        where: { userId, guildId },
      });
      const dailyCooldownUpgrade = userUpgrades.find(
        (u) => u.type === "daily_cooldown"
      );
      const dailyCooldownLevel = dailyCooldownUpgrade?.level || 1;

      // Calculate cooldown reduction (30 minutes per level starting from level 2)
      const cooldownReduction = (dailyCooldownLevel - 1) * (30 * 60 * 1000);

      return Math.max(0, lastUsed + baseTime - cooldownReduction - Date.now());
    }

    return Math.max(0, lastUsed + baseTime - Date.now());
  },

  // Update cooldown for a crate type
  async updateCrateCooldown(guildId, userId, type) {
    // Ensure user exists first
    await this.ensureUser(guildId, userId);

    const cooldown = await this.client.cooldown.findUnique({
      where: {
        userId_guildId: {
          userId,
          guildId,
        },
      },
    });

    // Make sure we're working with a proper object
    let cooldowns = {};

    // Handle all possible data formats
    if (cooldown?.data) {
      try {
        if (
          typeof cooldown.data === "object" &&
          !Array.isArray(cooldown.data)
        ) {
          // It's already an object
          cooldowns = cooldown.data;
        } else if (typeof cooldown.data === "string") {
          // It's a JSON string, parse it
          cooldowns = JSON.parse(cooldown.data);
        }
      } catch (error) {
        console.warn(
          `Failed to parse cooldown data for ${userId} in guild ${guildId}: ${error.message}`
        );
      }
    }

    const crateKey = `crate_${type}`;
    cooldowns[crateKey] = Date.now();

    return this.client.cooldown.upsert({
      where: {
        userId_guildId: {
          userId,
          guildId,
        },
      },
      create: {
        userId,
        guildId,
        data: cooldowns, // Store as object directly
      },
      update: {
        data: cooldowns, // Store as object directly
      },
    });
  },

  // Reduce cooldown for a specific type
  async reduceCooldown(guildId, userId, type, amount) {
    const cooldown = await this.client.cooldown.findUnique({
      where: {
        userId_guildId: {
          userId,
          guildId,
        },
      },
    });

    if (!cooldown) return null;

    // Make sure we're working with a proper object
    let cooldowns = {};

    // Handle all possible data formats
    try {
      if (typeof cooldown.data === "object" && !Array.isArray(cooldown.data)) {
        // It's already an object
        cooldowns = cooldown.data;
      } else if (typeof cooldown.data === "string") {
        // It's a JSON string, parse it
        cooldowns = JSON.parse(cooldown.data);
      }
    } catch (error) {
      console.warn(
        `Failed to parse cooldown data for ${userId} in guild ${guildId}: ${error.message}`
      );
      return null;
    }

    if (!cooldowns[type]) return null;

    // Reduce the cooldown timestamp
    cooldowns[type] = Math.max(0, cooldowns[type] - amount);

    return this.client.cooldown.update({
      where: {
        userId_guildId: {
          userId,
          guildId,
        },
      },
      data: {
        data: cooldowns, // Store as object directly
      },
    });
  },

  // Get user's upgrade discounts
  async getUpgradeDiscount(guildId, userId) {
    const economy = await this.client.economy.findUnique({
      where: {
        userId_guildId: {
          userId,
          guildId,
        },
      },
    });

    if (!economy) return 0;
    return Number(economy.upgradeDiscount || 0);
  },

  // Add discount for upgrades
  async addUpgradeDiscount(guildId, userId, discountPercent) {
    await this.ensureUser(guildId, userId);

    const economy = await this.client.economy.findUnique({
      where: {
        userId_guildId: {
          userId,
          guildId,
        },
      },
    });

    const currentDiscount = Number(economy?.upgradeDiscount || 0);
    const newDiscount = currentDiscount + discountPercent;

    return this.client.economy.upsert({
      where: {
        userId_guildId: {
          userId,
          guildId,
        },
      },
      create: {
        userId,
        guildId,
        upgradeDiscount: newDiscount,
      },
      update: {
        upgradeDiscount: newDiscount,
      },
    });
  },

  // Reset discount after any upgrade purchase
  async resetUpgradeDiscount(guildId, userId) {
    const economy = await this.client.economy.findUnique({
      where: {
        userId_guildId: {
          userId,
          guildId,
        },
      },
    });

    if (!economy) return null;

    return this.client.economy.update({
      where: {
        userId_guildId: {
          userId,
          guildId,
        },
      },
      data: {
        upgradeDiscount: 0,
      },
    });
  },

  // Open a crate and get rewards
  async openCrate(guildId, userId, type) {
    const crate = await this.client.crate.findUnique({
      where: {
        userId_guildId_type: {
          userId,
          guildId,
          type,
        },
      },
    });

    // For standard crates like daily/weekly, we check cooldowns
    if (["daily", "weekly"].includes(type)) {
      const cooldown = await this.getCrateCooldown(guildId, userId, type);
      if (cooldown > 0) {
        throw new Error(`Cooldown active: ${cooldown}`);
      }

      // Update cooldown for standard crates
      await this.updateCrateCooldown(guildId, userId, type);
    } else {
      // For special crates, we check if user has them
      if (!crate || crate.count <= 0) {
        throw new Error("No crates available");
      }

      // Remove one crate from inventory
      await this.removeCrate(guildId, userId, type, 1);
    }

    // Generate rewards based on crate type
    const rewards = await this.generateCrateRewards(guildId, userId, type);

    // Process and apply the rewards
    await this.processCrateRewards(guildId, userId, rewards);

    return rewards;
  },

  // Generate rewards for a crate
  async generateCrateRewards(guildId, userId, type) {
    const crateConfig = CRATE_TYPES[type];
    if (!crateConfig) {
      throw new Error(`Unknown crate type: ${type}`);
    }

    const rewards = {
      type,
      coins: 0,
      xp: 0,
      seasonXp: 0,
      discount: 0,
      cooldownReductions: {},
    };

    // Generate coins reward
    rewards.coins = Math.floor(
      Math.random() *
        (crateConfig.rewards.max_coins - crateConfig.rewards.min_coins + 1) +
        crateConfig.rewards.min_coins
    );

    // XP reward (chance-based)
    if (Math.random() < crateConfig.rewards.xp_chance) {
      rewards.xp = crateConfig.rewards.xp_amount;
      rewards.seasonXp = crateConfig.rewards.xp_amount;
    }

    // Discount reward (chance-based)
    if (Math.random() < crateConfig.rewards.discount_chance) {
      rewards.discount = crateConfig.rewards.discount_amount;
    }

    // Cooldown reducer (chance-based)
    if (Math.random() < crateConfig.rewards.cooldown_reducer_chance) {
      // Select a random cooldown to reduce
      const cooldownTypes = ["daily", "work", "crime", "message"];
      const randomCooldown =
        cooldownTypes[Math.floor(Math.random() * cooldownTypes.length)];
      rewards.cooldownReductions[randomCooldown] =
        crateConfig.rewards.cooldown_reducer_amount;
    }

    return rewards;
  },

  // Process and apply crate rewards
  async processCrateRewards(guildId, userId, rewards) {
    await this.client.$transaction(async (tx) => {
      // Add coins
      if (rewards.coins > 0) {
        await this.addBalance(guildId, userId, rewards.coins);
      }

      // Add XP
      if (rewards.xp > 0) {
        await this.addXP(guildId, userId, rewards.xp);
      }

      // Add discount
      if (rewards.discount > 0) {
        await this.addUpgradeDiscount(guildId, userId, rewards.discount);
      }

      // Apply cooldown reductions
      for (const [cooldownType, reduction] of Object.entries(
        rewards.cooldownReductions
      )) {
        await this.reduceCooldown(guildId, userId, cooldownType, reduction);
      }
    });

    return rewards;
  },
};
