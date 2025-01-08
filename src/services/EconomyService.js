import DatabaseService from "./DatabaseService.js";
import CacheService from "./CacheService.js";
import { COOLDOWNS, UPGRADES, DEFAULT_VALUES } from "../utils/economy.js";

class EconomyService {
  // Test database connection
  static async testConnection() {
    try {
      await DatabaseService.testConnection();
      return true;
    } catch (error) {
      console.error("Failed to connect to the database:", error);
      throw error;
    }
  }

  // Cleanup test data
  static async cleanupTestData(guildId, userId) {
    try {
      await DatabaseService.cleanupTestData(guildId, userId);
      await CacheService.invalidateUser(guildId, userId);
      await CacheService.invalidateGuild(guildId);
      return true;
    } catch (error) {
      console.error("Failed to cleanup test data:", error);
      throw error;
    }
  }

  static async get(path) {
    if (!path || typeof path !== "string") {
      throw new Error("Invalid path: must be a non-empty string");
    }

    const [guildId, userId, ...rest] = path.split(".");
    if (!guildId || !userId) {
      throw new Error("Invalid path: must include guildId and userId");
    }

    try {
      // Try to get from cache first
      let user = await CacheService.getUser(guildId, userId);

      if (!user) {
        // If not in cache, get from database
        user = await DatabaseService.getUser(guildId, userId);
        if (!user) return null;

        // Cache the user data
        await CacheService.setUser(guildId, userId, user);
      }

      // Format upgrades into the expected structure
      if (user.upgrades) {
        const formattedUpgrades = {};
        for (const upgrade of user.upgrades) {
          formattedUpgrades[upgrade.upgradeType] = {
            level: upgrade.level,
          };
        }
        user.upgrades = formattedUpgrades;
      }

      // Navigate through the path to get the specific value
      let value = user;
      for (const key of rest) {
        value = value[key];
        if (value === undefined) return null;
      }

      return value;
    } catch (error) {
      console.error("Error in get:", error);
      throw error;
    }
  }

  static async set(path, value) {
    const [guildId, userId, ...rest] = path.split(".");

    try {
      const result = await DatabaseService.transaction(
        async (tx) => {
          // Handle bank updates in a special way
          if (value.bank) {
            const bankUpdate = { ...value.bank };
            delete value.bank;

            if (Object.keys(bankUpdate).length > 0) {
              const updateData = {};

              if (bankUpdate.amount !== undefined) {
                updateData.amount = DatabaseService.safeDecimal(
                  bankUpdate.amount
                );
              }

              if (bankUpdate.holdingPercentage !== undefined) {
                updateData.holdingPercentage = DatabaseService.safeNumber(
                  bankUpdate.holdingPercentage
                );
                updateData.startedToHold = DatabaseService.safeBigInt(
                  Date.now()
                );
              }

              await tx.userBank.update({
                where: { guildId_userId: { guildId, userId } },
                data: updateData,
              });
            }
          }

          const result = await tx.user.update({
            where: { guildId_userId: { guildId, userId } },
            data: {
              ...value,
              latestActivity: DatabaseService.safeBigInt(Date.now()),
            },
            include: {
              bank: true,
              cooldowns: true,
              upgrades: true,
            },
          });

          const processedResult = DatabaseService.processUserData(result);

          // Invalidate cache after update
          await CacheService.invalidateUser(guildId, userId);

          return processedResult;
        },
        {
          maxAttempts: 3,
          timeout: 10000,
        }
      );

      return result;
    } catch (error) {
      console.error("Error in set:", error);
      throw error;
    }
  }

  static async math(path, operator, number) {
    const [guildId, userId, ...rest] = path.split(".");
    const field = rest.join(".");

    const result = await DatabaseService.withErrorHandling(
      "math",
      `${field} ${operator} ${number}`,
      async () => {
        const result = await DatabaseService.mathOperation(
          guildId,
          userId,
          field,
          operator,
          number
        );

        // Invalidate cache after math operation
        await CacheService.invalidateUser(guildId, userId);

        return result;
      }
    );

    return result;
  }

  static async listGuilds() {
    try {
      const guilds = await DatabaseService.listGuilds();
      return guilds.map((guild) => guild.id);
    } catch (error) {
      console.error("Error in listGuilds:", error);
      throw error;
    }
  }

  static async getGuildUsers(guildId) {
    try {
      // Try to get from cache first
      const cachedLeaderboard = await CacheService.getLeaderboard(guildId);
      if (cachedLeaderboard) {
        return cachedLeaderboard;
      }

      const users = await DatabaseService.prisma.user.findMany({
        where: {
          guildId,
          OR: [{ balance: { gt: 0 } }, { bank: { amount: { gt: 0 } } }],
        },
        select: {
          userId: true,
          balance: true,
          bank: {
            select: {
              amount: true,
              holdingPercentage: true,
              startedToHold: true,
            },
          },
        },
        orderBy: {
          balance: "desc",
        },
        take: 100,
      });

      const processedUsers = users.map((user) => ({
        userId: user.userId,
        balance: DatabaseService.safeDecimal(user.balance),
        bank: user.bank
          ? {
              amount: DatabaseService.safeDecimal(user.bank.amount),
              holdingPercentage: user.bank.holdingPercentage,
              startedToHold: user.bank.startedToHold,
            }
          : null,
      }));

      // Cache the leaderboard data
      await CacheService.setLeaderboard(guildId, processedUsers);

      return processedUsers;
    } catch (error) {
      console.error("Error in getGuildUsers:", error);
      throw error;
    }
  }

  static async getCooldownTime(guildId, userId, type) {
    try {
      // Try to get from cache first
      const cachedCooldown = await CacheService.getCooldown(
        guildId,
        userId,
        type
      );
      if (cachedCooldown) {
        return cachedCooldown;
      }

      const timestamp = await DatabaseService.getCooldown(
        guildId,
        userId,
        type
      );

      if (!timestamp) return 0;

      const cooldownTime = COOLDOWNS[type];
      if (!cooldownTime) return 0;

      const now = Date.now();
      const expiresAt =
        timestamp +
        (type === "crime"
          ? cooldownTime.base
          : typeof cooldownTime === "object"
          ? cooldownTime.base
          : cooldownTime);

      if (now >= expiresAt) return 0;

      if (type === "crime") {
        const upgrades = await this.getUpgrades(guildId, userId);
        const crimeUpgrade = upgrades[type];
        const level = crimeUpgrade?.level || 1;
        const reduction = level * COOLDOWNS.crime.reduction;
        const adjustedCooldown = Math.max(
          COOLDOWNS.crime.min,
          cooldownTime.base - reduction
        );

        const adjustedExpiresAt = timestamp + adjustedCooldown;
        const remainingTime = Math.max(0, adjustedExpiresAt - now);

        // Cache the cooldown
        await CacheService.setCooldown(guildId, userId, type, remainingTime);

        return remainingTime;
      }

      const remainingTime = Math.max(0, expiresAt - now);

      // Cache the cooldown
      await CacheService.setCooldown(guildId, userId, type, remainingTime);

      return remainingTime;
    } catch (error) {
      console.error("Error in getCooldownTime:", error);
      throw error;
    }
  }

  static async isCooldownActive(guildId, userId, type) {
    try {
      const remainingTime = await this.getCooldownTime(guildId, userId, type);
      return remainingTime > 0;
    } catch (error) {
      console.error("Error in isCooldownActive:", error);
      throw error;
    }
  }

  static getUpgradeInfo(type, level) {
    const upgrade = UPGRADES[type];
    if (!upgrade) return null;

    const price = Math.floor(
      upgrade.basePrice * Math.pow(upgrade.priceMultiplier, level - 1)
    );

    let effect;
    if (type === "daily") {
      // For daily, calculate percentage increase
      effect = Math.floor(100 * (1 + upgrade.effectMultiplier * (level - 1)));
    } else if (type === "crime") {
      // For crime, calculate cooldown reduction in minutes
      effect = Math.floor((upgrade.effectValue * level) / (60 * 1000));
    }

    return { price, effect };
  }

  static async getUpgrades(guildId, userId) {
    try {
      const upgrades = await DatabaseService.getUpgrades(guildId, userId);
      const result = {};

      for (const type of Object.keys(UPGRADES)) {
        const upgrade = upgrades.find((u) => u.upgradeType === type) || {
          level: 1,
        };
        const info = this.getUpgradeInfo(type, upgrade.level);

        result[type] = {
          level: upgrade.level,
          price: info.price,
          effect: info.effect,
          emoji: UPGRADES[type].emoji,
        };
      }

      return result;
    } catch (error) {
      console.error("Error in getUpgrades:", error);
      throw error;
    }
  }

  static async purchaseUpgrade(guildId, userId, type) {
    try {
      return await DatabaseService.transaction(
        async (tx) => {
          const user = await DatabaseService.getUser(guildId, userId);
          if (!user) return false;

          const currentLevel =
            user.upgrades.find((u) => u.upgradeType === type)?.level || 1;
          const upgradeInfo = this.getUpgradeInfo(type, currentLevel);

          if (user.balance < upgradeInfo.price) return false;

          // Perform both operations atomically
          await Promise.all([
            DatabaseService.mathOperation(
              guildId,
              userId,
              "balance",
              "-",
              upgradeInfo.price
            ),
            DatabaseService.updateUpgrade(
              guildId,
              userId,
              type,
              currentLevel + 1
            ),
          ]);

          return true;
        },
        {
          maxAttempts: 3,
          timeout: 5000,
        }
      );
    } catch (error) {
      console.error("Error in purchaseUpgrade:", error);
      throw error;
    }
  }

  static calculateLevel(
    totalXp,
    multiplier = DEFAULT_VALUES.guild.settings.multiplier
  ) {
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
  }

  static async addXP(guildId, userId, amount) {
    try {
      return await DatabaseService.transaction(
        async (tx) => {
          const user = await DatabaseService.mathOperation(
            guildId,
            userId,
            "totalXp",
            "+",
            amount
          );
          return this.calculateLevel(user.totalXp);
        },
        {
          maxAttempts: 3,
          timeout: 5000,
        }
      );
    } catch (error) {
      console.error("Error in addXP:", error);
      throw error;
    }
  }

  static async calculateBankBalance(bankData, latestActivity, guildId, userId) {
    const now = Date.now();
    const hoursSinceLastActivity = (now - latestActivity) / (60 * 60 * 1000);
    const minutesSinceLastActivity = (now - latestActivity) / (60 * 1000);
    const MAX_INACTIVE_HOURS = 48; // 2 days maximum inactivity

    // Log time until auto-removal
    const hoursRemaining = MAX_INACTIVE_HOURS - hoursSinceLastActivity;
    const minutesRemaining = hoursRemaining * 60;
    console.log(
      `User ${userId} in guild ${guildId} has ${hoursRemaining.toFixed(
        2
      )} hours (${minutesRemaining.toFixed(
        2
      )} minutes) remaining until auto-removal from holding (${hoursSinceLastActivity.toFixed(
        2
      )} hours, ${minutesSinceLastActivity.toFixed(
        2
      )} minutes since last activity)`
    );

    // If inactive for more than 2 days, cap the interest and reset holding
    if (hoursSinceLastActivity > MAX_INACTIVE_HOURS) {
      try {
        // Calculate interest only for the maximum allowed time
        const annualInterestRate = bankData.holdingPercentage / 100 / 365;
        const maxDaysAllowed = MAX_INACTIVE_HOURS / 24;
        const interestMultiplier = 1 + annualInterestRate * maxDaysAllowed;

        const newAmount = DatabaseService.safeDecimal(
          bankData.amount * interestMultiplier
        );

        // Reset holding settings but keep money in bank
        await DatabaseService.transaction(async (tx) => {
          await tx.userBank.update({
            where: { guildId_userId: { guildId, userId } },
            data: {
              amount: newAmount,
              startedToHold: 0,
              holdingPercentage: 0,
            },
          });
        });

        return newAmount;
      } catch (error) {
        console.error("Error in calculateBankBalance (inactive reset):", error);
        throw error;
      }
    }

    // Normal interest calculation for active users
    const annualInterestRate = bankData.holdingPercentage / 100 / 365;
    const daysElapsed = hoursSinceLastActivity / 24;
    const interestMultiplier = 1 + annualInterestRate * daysElapsed;

    try {
      return await DatabaseService.transaction(async (tx) => {
        const newAmount = DatabaseService.safeDecimal(
          bankData.amount * interestMultiplier
        );

        // Only update the amount, keep startedToHold unchanged
        await tx.userBank.update({
          where: { guildId_userId: { guildId, userId } },
          data: {
            amount: newAmount,
          },
        });

        return newAmount;
      });
    } catch (error) {
      console.error("Error in calculateBankBalance:", error);
      throw error;
    }
  }

  static async updateBankOnInactivity(guildId, userId) {
    try {
      return await DatabaseService.transaction(async (tx) => {
        const user = await DatabaseService.getUser(guildId, userId);
        if (!user?.bank) return null;

        return await this.calculateBankBalance(
          user.bank,
          Number(user.latestActivity),
          guildId,
          userId
        );
      });
    } catch (error) {
      console.error("Error in updateBankOnInactivity:", error);
      throw error;
    }
  }

  static async updateCooldown(guildId, userId, type) {
    try {
      return await DatabaseService.transaction(
        async (tx) => {
          // Set the current timestamp
          await DatabaseService.updateCooldown(guildId, userId, type);
          return true;
        },
        {
          maxAttempts: 3,
          timeout: 5000,
        }
      );
    } catch (error) {
      console.error("Error in updateCooldown:", error);
      throw error;
    }
  }

  static async resetCooldown(guildId, userId, type) {
    try {
      await DatabaseService.resetCooldown(guildId, userId, type);
      return true;
    } catch (error) {
      console.error("Error in resetCooldown:", error);
      throw error;
    }
  }
}

export default EconomyService;
