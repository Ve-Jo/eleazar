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

  // Get info about an upgrade based on type and level
  async getUpgradeInfo(type, level) {
    if (!UPGRADES[type]) {
      throw new Error(`Invalid upgrade type: ${type}`);
    }

    // Calculate the price for this level
    const basePrice = UPGRADES[type].basePrice;
    const priceMultiplier = UPGRADES[type].priceMultiplier;

    // Price increases exponentially with level
    // Level 1 is the base level, levels start at 2
    const price = Math.floor(basePrice * Math.pow(priceMultiplier, level - 1));

    // Calculate effect for this level
    let effect;
    if (UPGRADES[type].effectMultiplier) {
      // For percentage-based effects
      effect = 1 + (level - 1) * UPGRADES[type].effectMultiplier;
    } else if (UPGRADES[type].effectValue) {
      // For absolute value effects
      effect = (level - 1) * UPGRADES[type].effectValue;
    } else {
      // Default
      effect = level;
    }

    return {
      type,
      level,
      price,
      effect,
      basePrice: UPGRADES[type].basePrice,
      priceMultiplier: UPGRADES[type].priceMultiplier,
    };
  },

  // Purchase an upgrade
  async purchaseUpgrade(guildId, userId, type) {
    // Get current upgrade level
    const upgrade = await this.client.upgrade.findUnique({
      where: {
        userId_guildId_type: {
          userId,
          guildId,
          type,
        },
      },
    });

    const currentLevel = upgrade?.level || 1;

    // Get upgrade info to calculate price
    const upgradeInfo = await this.getUpgradeInfo(type, currentLevel);

    // Get user's economy data
    const economy = await this.client.economy.findUnique({
      where: {
        userId_guildId: {
          userId,
          guildId,
        },
      },
    });

    if (!economy) {
      throw new Error("User economy data not found");
    }

    // Get user's discount if any
    const discountPercent = Number(economy.upgradeDiscount || 0);

    // Apply discount to the price if applicable
    let finalPrice = upgradeInfo.price;
    if (discountPercent > 0) {
      finalPrice = Math.max(
        1,
        Math.floor(finalPrice * (1 - discountPercent / 100))
      );
    }

    // Check if user has enough balance
    if (Number(economy.balance) < finalPrice) {
      throw new Error("Insufficient balance");
    }

    // Start transaction
    return this.client.$transaction(async (tx) => {
      // Deduct the price from user's balance
      await tx.economy.update({
        where: {
          userId_guildId: {
            userId,
            guildId,
          },
        },
        data: {
          balance: {
            decrement: finalPrice,
          },
        },
      });

      // Reset discount if used
      if (discountPercent > 0) {
        await tx.economy.update({
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
      }

      // Update or create the upgrade
      return tx.upgrade.upsert({
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
          level: 2, // First purchase means level 2 (since level 1 is default)
        },
        update: {
          level: {
            increment: 1,
          },
        },
      });
    });
  },

  // Get all upgrades for a user
  async getUserUpgrades(guildId, userId) {
    return this.client.upgrade.findMany({
      where: {
        userId,
        guildId,
      },
    });
  },

  // Revert an upgrade (decrease level by 1 and refund 85% of the price)
  async revertUpgrade(guildId, userId, type) {
    // Check if there's a cooldown for upgrade reverts
    const revertCooldown = await this.getCooldown(
      guildId,
      userId,
      "upgraderevert"
    );
    if (revertCooldown > 0) {
      throw new Error(`Cooldown active: ${revertCooldown}`);
    }

    // Get current upgrade level
    const upgrade = await this.client.upgrade.findUnique({
      where: {
        userId_guildId_type: {
          userId,
          guildId,
          type,
        },
      },
    });

    const currentLevel = upgrade?.level || 1;

    // Cannot revert level 1 upgrades (they are the default)
    if (currentLevel <= 1) {
      throw new Error("Cannot revert a level 1 upgrade");
    }

    // Get upgrade info to calculate refund amount
    const upgradeInfo = await this.getUpgradeInfo(type, currentLevel);
    const refundAmount = Math.floor(upgradeInfo.price * 0.85); // 85% refund

    // Start transaction
    return this.client.$transaction(async (tx) => {
      // Add the refund to user's balance
      await tx.economy.update({
        where: {
          userId_guildId: {
            userId,
            guildId,
          },
        },
        data: {
          balance: {
            increment: refundAmount,
          },
        },
      });

      // Decrease the upgrade level or delete if going back to level 1
      if (currentLevel === 2) {
        // If reverting to level 1, delete the upgrade record
        await tx.upgrade.delete({
          where: {
            userId_guildId_type: {
              userId,
              guildId,
              type,
            },
          },
        });
      } else {
        // Otherwise, decrease the level
        await tx.upgrade.update({
          where: {
            userId_guildId_type: {
              userId,
              guildId,
              type,
            },
          },
          data: {
            level: {
              decrement: 1,
            },
          },
        });
      }

      // Set cooldown for upgrade reverts
      await this.updateCooldown(guildId, userId, "upgraderevert");

      return {
        previousLevel: currentLevel,
        newLevel: currentLevel - 1,
        refundAmount,
      };
    });
  },
};
