import { UPGRADES } from "./client.js";

export default {
  // Helper method for updating upgrades
  async updateUpgrades(guildId, userId, upgrades) {
    const updatePromises = Object.entries(upgrades).map(([type, data]) => {
      // Only store upgrades that differ from default level 1
      if (data.level === 1) {
        // If level is 1 (default), try to delete the record if it exists
        return this.client.upgrade.deleteMany({
          where: {
            userId,
            guildId,
            type,
          },
        });
      } else {
        // Otherwise, upsert the upgrade
        return this.client.upgrade.upsert({
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
            level: data.level,
          },
          update: {
            level: data.level,
          },
        });
      }
    });

    return Promise.all(updatePromises);
  },

  // Upgrade System
  async getUpgradeInfo(type, level) {
    const upgrade = UPGRADES[type];
    if (!upgrade) throw new Error("Invalid upgrade type");

    const price = Math.floor(
      upgrade.basePrice * Math.pow(upgrade.priceMultiplier, level - 1)
    );

    let effect;
    if (type === "daily_bonus") {
      effect = upgrade.effectMultiplier * (level - 1); // Start from 0% at level 1
    } else if (type === "daily_cooldown" || type === "crime") {
      effect = Math.floor((upgrade.effectValue * (level - 1)) / (60 * 1000)); // Convert ms to minutes
    } else if (type === "bank_rate") {
      effect = upgrade.effectValue * (level - 1); // Start from 0% at level 1
    } else if (type === "games_earning") {
      effect = upgrade.effectMultiplier * (level - 1); // Start from 0% at level 1
    }

    return { price, effect };
  },

  async purchaseUpgrade(guildId, userId, type) {
    return this.client.$transaction(async (tx) => {
      // Get user with economy and upgrades
      const user = await tx.user.findUnique({
        where: {
          guildId_id: {
            guildId,
            id: userId,
          },
        },
        include: {
          economy: true,
          upgrades: true,
        },
      });

      if (!user) throw new Error("User not found");

      // Get current upgrade level
      const currentUpgrade = user.upgrades.find((u) => u.type === type);
      const currentLevel = currentUpgrade?.level || 1;

      // Calculate price for next level
      const { price } = await this.getUpgradeInfo(type, currentLevel);

      // Check if user can afford the upgrade
      if (!user.economy || user.economy.balance < price) {
        throw new Error("Insufficient balance");
      }

      // Update economy
      const economy = await tx.economy.update({
        where: {
          userId_guildId: {
            userId,
            guildId,
          },
        },
        data: {
          balance: { decrement: price },
        },
      });

      // Update upgrade - only if level will be greater than 1
      let upgrade;
      const newLevel = currentLevel + 1;

      if (newLevel > 1) {
        upgrade = await tx.upgrade.upsert({
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
            level: newLevel,
          },
          update: {
            level: newLevel,
          },
        });
      } else {
        // This case shouldn't normally happen as we start at level 1,
        // but included for completeness
        upgrade = { type, level: newLevel };
      }

      // Update user's last activity
      await tx.user.update({
        where: {
          guildId_id: {
            guildId,
            id: userId,
          },
        },
        data: {
          lastActivity: Date.now(),
        },
      });

      return { economy, upgrade };
    });
  },
};
