import { UPGRADES } from "./client.js";

export default {
  // Helper method for updating upgrades
  async updateUpgrades(guildId, userId, upgrades) {
    const updatePromises = Object.entries(upgrades).map(([type, data]) =>
      this.client.upgrade.upsert({
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
      })
    );

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
    if (type === "daily") {
      effect = upgrade.effectMultiplier * (level - 1); // Start from 0% at level 1
    } else if (type === "crime") {
      effect = Math.floor((upgrade.effectValue * (level - 1)) / (60 * 1000)); // Convert ms to minutes
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

      // Update economy and upgrade in transaction
      const [economy, upgrade] = await Promise.all([
        tx.economy.update({
          where: {
            userId_guildId: {
              userId,
              guildId,
            },
          },
          data: {
            balance: { decrement: price },
          },
        }),
        tx.upgrade.upsert({
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
            level: currentLevel + 1,
          },
          update: {
            level: { increment: 1 },
          },
        }),
      ]);

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
