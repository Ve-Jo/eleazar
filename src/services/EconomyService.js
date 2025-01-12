import DatabaseService from "./DatabaseService.js";
import CacheService from "./CacheService.js";
import { COOLDOWNS, UPGRADES, DEFAULT_VALUES } from "../utils/economy.js";

class EconomyService {
  // Core Operations
  static async get(path) {
    if (!path || typeof path !== "string") {
      throw new Error("Invalid path: must be a non-empty string");
    }

    const [guildId, userId, ...rest] = path.split(".");
    if (!guildId || !userId) {
      throw new Error("Invalid path: must include guildId and userId");
    }

    try {
      console.log("Getting user data:", { guildId, userId, path });

      // Try to get from cache first
      let user = await CacheService.getUser(guildId, userId);
      console.log("Cache result:", { guildId, userId, hasData: !!user });

      if (!user) {
        // Get from database
        user = await DatabaseService.getUser(guildId, userId);
        console.log("Database result:", { guildId, userId, hasData: !!user });

        if (user) {
          // Cache the user data
          const cached = await CacheService.setUser(guildId, userId, user);
          console.log("Cache set result:", {
            guildId,
            userId,
            success: cached,
          });
        }
      }

      if (!user) return null;

      // Only calculate bank balance if we're specifically requesting bank or bank-related data
      const field = rest.join(".");
      if (field === "bank" || field.startsWith("bank.") || !field) {
        // Update bank balance if needed
        const newBalance = await this.calculateBankBalance(
          user.bank,
          user.latestActivity,
          guildId,
          userId
        );

        // Only update user object if balance changed
        if (Math.abs(newBalance - user.bank.amount) > 0.00001) {
          user.bank.amount = newBalance;
        }
      }

      // Navigate through the path to get the specific value
      let value = user;
      for (const key of rest) {
        value = value[key];
        if (value === undefined) return null;
      }

      return value;
    } catch (error) {
      console.error("Error in EconomyService.get:", {
        path,
        guildId,
        userId,
        rest,
        error: error.message,
        stack: error.stack,
        cause: error.cause,
      });
      throw error;
    }
  }

  static async set(path, value) {
    if (!path || typeof path !== "string") {
      throw new Error("Invalid path: must be a non-empty string");
    }

    const [guildId, userId, ...rest] = path.split(".");
    if (!guildId || !userId) {
      throw new Error("Invalid path: must include guildId and userId");
    }

    const field = rest.join(".");
    if (!field) {
      throw new Error("Invalid path: must include a field to update");
    }

    try {
      console.log("Setting user data:", { guildId, userId, field, value });

      // Special handling for non-numeric fields and objects
      if (
        field === "banner_url" ||
        field === "bannerUrl" ||
        field === "bank" ||
        typeof value === "object"
      ) {
        const user = await DatabaseService.findUser(guildId, userId);
        if (!user) {
          // Create user if doesn't exist
          await DatabaseService.createUser(guildId, userId);
        }

        let updateData = {};
        if (field === "banner_url" || field === "bannerUrl") {
          updateData = { bannerUrl: value };
        } else if (field === "bank") {
          // Update bank directly
          const result = await DatabaseService.updateBank(
            guildId,
            userId,
            value
          );
          return DatabaseService.processUserData({
            guildId,
            userId,
            bank: result,
          });
        } else {
          updateData = { [field]: value };
        }

        const result = await DatabaseService.prisma.user.update({
          where: { guildId_userId: { guildId, userId } },
          data: updateData,
          include: { bank: true, cooldowns: true, upgrades: true },
        });

        // Process and return the result, mapping bannerUrl to banner_url for consistency
        const processed = DatabaseService.processUserData(result);
        if (processed && "bannerUrl" in processed) {
          processed.banner_url = processed.bannerUrl;
          delete processed.bannerUrl;
        }
        return processed;
      }

      // For numeric fields, try to get current value
      const currentValue = await this.get(`${guildId}.${userId}.${field}`);

      // If field doesn't exist in the current data, create it with the value
      if (currentValue === null) {
        const user = await DatabaseService.findUser(guildId, userId);
        if (!user) {
          await DatabaseService.createUser(guildId, userId);
        }

        // For direct user fields
        const result = await DatabaseService.prisma.user.update({
          where: { guildId_userId: { guildId, userId } },
          data: { [field]: value },
          include: { bank: true, cooldowns: true, upgrades: true },
        });
        return DatabaseService.processUserData(result);
      }

      // If field exists, use math operation for the update
      const difference = value - currentValue;
      return await this.math(
        path,
        difference > 0 ? "+" : "-",
        Math.abs(difference)
      );
    } catch (error) {
      console.error("Error in EconomyService.set:", {
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
    if (!path || typeof path !== "string") {
      throw new Error("Invalid path: must be a non-empty string");
    }

    const [guildId, userId, ...rest] = path.split(".");
    if (!guildId || !userId) {
      throw new Error("Invalid path: must include guildId and userId");
    }

    const field = rest.join(".");
    if (!field) {
      throw new Error("Invalid path: must include a field to update");
    }

    if (!["+", "-", "*", "/"].includes(operator)) {
      throw new Error(`Invalid operator: ${operator}`);
    }

    if (typeof number !== "number" || isNaN(number)) {
      throw new Error(`Invalid number: ${number}`);
    }

    try {
      console.log("Math operation:", {
        path,
        guildId,
        userId,
        field,
        operator,
        number,
      });

      const result = await DatabaseService.mathOperation(
        guildId,
        userId,
        field,
        operator,
        number
      );
      await CacheService.invalidateUser(guildId, userId);
      return result;
    } catch (error) {
      console.error("Error in EconomyService.math:", {
        path,
        guildId,
        userId,
        field,
        operator,
        number,
        error: error.message,
        stack: error.stack,
        cause: error.cause,
      });
      throw error;
    }
  }

  // Cooldown Management
  static async getCooldownTime(guildId, userId, type) {
    if (!guildId || !userId) {
      throw new Error("Both guildId and userId are required");
    }
    if (!type || !COOLDOWNS[type]) {
      throw new Error(`Invalid cooldown type: ${type}`);
    }

    try {
      // Try cache first
      const cachedTime = await CacheService.getCooldown(guildId, userId, type);
      if (cachedTime) return cachedTime;

      const timestamp = await DatabaseService.getCooldown(
        guildId,
        userId,
        type
      );
      const cooldownTime = COOLDOWNS[type];

      // If no timestamp or cooldown time, user can perform the action
      if (!timestamp || !cooldownTime) return 0;

      const now = Date.now();
      const expiresAt =
        timestamp +
        (type === "crime"
          ? await this.calculateCrimeCooldown(guildId, userId, cooldownTime)
          : typeof cooldownTime === "object"
          ? cooldownTime.base
          : cooldownTime);

      const remainingTime = Math.max(0, expiresAt - now);
      await CacheService.setCooldown(guildId, userId, type, remainingTime);

      return remainingTime;
    } catch (error) {
      console.error("Error in EconomyService.getCooldownTime:", {
        guildId,
        userId,
        type,
        error: error.message,
        stack: error.stack,
        cause: error.cause,
      });
      return 0;
    }
  }

  static async calculateCrimeCooldown(guildId, userId, cooldownTime) {
    try {
      const upgrades = await this.getUpgrades(guildId, userId);
      const crimeUpgrade = upgrades.crime;
      const level = crimeUpgrade?.level || 1;
      const reduction = level * COOLDOWNS.crime.reduction;

      return Math.max(COOLDOWNS.crime.min, cooldownTime.base - reduction);
    } catch (error) {
      console.error("Error in EconomyService.calculateCrimeCooldown:", {
        guildId,
        userId,
        cooldownTime,
        error: error.message,
        stack: error.stack,
        cause: error.cause,
      });
      return cooldownTime.base;
    }
  }

  static async updateCooldown(guildId, userId, type) {
    if (!guildId || !userId) {
      throw new Error("Both guildId and userId are required");
    }
    if (!type || !COOLDOWNS[type]) {
      throw new Error(`Invalid cooldown type: ${type}`);
    }

    try {
      await DatabaseService.updateCooldown(guildId, userId, type);
      await CacheService.invalidateUser(guildId, userId);
      return true;
    } catch (error) {
      console.error("Error in EconomyService.updateCooldown:", {
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

  // Upgrade Management
  static getUpgradeInfo(type, level) {
    if (!type || !UPGRADES[type]) {
      throw new Error(`Invalid upgrade type: ${type}`);
    }
    if (typeof level !== "number" || isNaN(level) || level < 1) {
      throw new Error(`Invalid level: ${level}`);
    }

    try {
      const upgrade = UPGRADES[type];
      const price = Math.floor(
        upgrade.basePrice * Math.pow(upgrade.priceMultiplier, level - 1)
      );
      const effect =
        type === "daily"
          ? Math.floor(100 * (1 + upgrade.effectMultiplier * (level - 1)))
          : Math.floor((upgrade.effectValue * level) / (60 * 1000));

      return { price, effect };
    } catch (error) {
      console.error("Error in EconomyService.getUpgradeInfo:", {
        type,
        level,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  static async getUpgrades(guildId, userId) {
    if (!guildId || !userId) {
      throw new Error("Both guildId and userId are required");
    }

    try {
      console.log("Getting upgrades for user:", { guildId, userId });
      const user = await DatabaseService.getUser(guildId, userId);

      if (!user) {
        throw new Error(`User not found: ${guildId}.${userId}`);
      }

      const result = {};
      for (const [type, upgradeConfig] of Object.entries(UPGRADES)) {
        // Find user's upgrade level for this type
        const userUpgrade = user.upgrades[type] || { level: 1 };
        const level = userUpgrade.level;

        // Calculate price for next level
        const price = Math.floor(
          upgradeConfig.basePrice *
            Math.pow(upgradeConfig.priceMultiplier, level - 1)
        );

        // Calculate effect based on upgrade type
        let effect;
        if (type === "daily") {
          effect = Math.floor(
            100 * (1 + upgradeConfig.effectMultiplier * (level - 1))
          );
        } else if (type === "crime") {
          effect = Math.floor(
            (upgradeConfig.effectValue * level) / (60 * 1000)
          ); // Convert to minutes
        }

        result[type] = {
          level,
          price,
          effect,
          emoji: upgradeConfig.emoji,
        };
      }

      console.log("Calculated upgrades:", result);
      return result;
    } catch (error) {
      console.error("Error in EconomyService.getUpgrades:", {
        guildId,
        userId,
        error: error.message,
        stack: error.stack,
        cause: error.cause,
      });
      throw error;
    }
  }

  // Bank Management
  static async calculateBankBalance(bankData, latestActivity, guildId, userId) {
    if (!bankData || typeof bankData !== "object") {
      throw new Error("Invalid bank data");
    }
    if (!latestActivity || typeof latestActivity !== "number") {
      throw new Error("Invalid latest activity timestamp");
    }

    try {
      const now = Date.now();
      const hoursSinceLastActivity = (now - latestActivity) / (60 * 60 * 1000);
      const MAX_INACTIVE_HOURS = 48;

      console.log("Calculating bank balance:", {
        bankData,
        latestActivity,
        hoursSinceLastActivity,
        guildId,
        userId,
      });

      let newAmount;
      if (hoursSinceLastActivity > MAX_INACTIVE_HOURS) {
        newAmount = await this.handleInactiveBankBalance(
          bankData,
          MAX_INACTIVE_HOURS,
          guildId,
          userId
        );
      } else {
        newAmount = await this.calculateActiveBankBalance(
          bankData,
          hoursSinceLastActivity
        );
      }

      // Only update if the amount has changed significantly (more than 0.00001)
      if (Math.abs(newAmount - bankData.amount) > 0.00001) {
        console.log("Bank balance changed significantly:", {
          oldAmount: bankData.amount,
          newAmount,
          difference: newAmount - bankData.amount,
        });

        await DatabaseService.updateBank(guildId, userId, {
          amount: newAmount,
          startedToHold: bankData.startedToHold,
          holdingPercentage: bankData.holdingPercentage,
        });

        // Invalidate cache after bank update
        await CacheService.invalidateUser(guildId, userId);
      } else {
        console.log("Bank balance change too small, skipping update:", {
          oldAmount: bankData.amount,
          newAmount,
          difference: newAmount - bankData.amount,
        });
      }

      return newAmount;
    } catch (error) {
      console.error("Error in EconomyService.calculateBankBalance:", {
        bankData,
        latestActivity,
        guildId,
        userId,
        error: error.message,
        stack: error.stack,
        cause: error.cause,
      });
      throw error;
    }
  }

  static async handleInactiveBankBalance(bankData, maxHours, guildId, userId) {
    try {
      const annualInterestRate = bankData.holdingPercentage / 100 / 365;
      const maxDaysAllowed = maxHours / 24;
      const interestMultiplier = 1 + annualInterestRate * maxDaysAllowed;
      const newAmount = DatabaseService.safeDecimal(
        bankData.amount * interestMultiplier
      );

      console.log("Handling inactive bank balance:", {
        bankData,
        maxHours,
        guildId,
        userId,
        newAmount,
      });

      await DatabaseService.updateBank(guildId, userId, {
        amount: newAmount,
        startedToHold: 0,
        holdingPercentage: 0,
      });

      return newAmount;
    } catch (error) {
      console.error("Error in EconomyService.handleInactiveBankBalance:", {
        bankData,
        maxHours,
        guildId,
        userId,
        error: error.message,
        stack: error.stack,
        cause: error.cause,
      });
      throw error;
    }
  }

  static async calculateActiveBankBalance(bankData, hoursElapsed) {
    try {
      const annualInterestRate = bankData.holdingPercentage / 100 / 365;
      const daysElapsed = hoursElapsed / 24;
      const interestMultiplier = 1 + annualInterestRate * daysElapsed;

      const newAmount = DatabaseService.safeDecimal(
        bankData.amount * interestMultiplier
      );

      console.log("Calculated active bank balance:", {
        bankData,
        hoursElapsed,
        newAmount,
      });

      return newAmount;
    } catch (error) {
      console.error("Error in EconomyService.calculateActiveBankBalance:", {
        bankData,
        hoursElapsed,
        error: error.message,
        stack: error.stack,
        cause: error.cause,
      });
      throw error;
    }
  }

  static async getGuildUsers(guildId) {
    if (!guildId) {
      throw new Error("GuildId is required");
    }

    try {
      const users = await DatabaseService.getGuildUsers(guildId);
      return users.map((user) => DatabaseService.processUserData(user));
    } catch (error) {
      console.error("Error in EconomyService.getGuildUsers:", {
        guildId,
        error: error.message,
        stack: error.stack,
        cause: error.cause,
      });
      throw error;
    }
  }

  static async upgradeLevel(guildId, userId, type) {
    if (!guildId || !userId) {
      throw new Error("Both guildId and userId are required");
    }
    if (!type || !UPGRADES[type]) {
      throw new Error(`Invalid upgrade type: ${type}`);
    }

    try {
      const result = await DatabaseService.upgradeLevel(guildId, userId, type);
      await CacheService.invalidateUser(guildId, userId);
      return { success: true, ...result };
    } catch (error) {
      console.error("Error in EconomyService.upgradeLevel:", {
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
    if (!path || typeof path !== "string") {
      throw new Error("Invalid path: must be a non-empty string");
    }

    const [guildId, userId, ...rest] = path.split(".");
    if (!guildId || !userId) {
      throw new Error("Invalid path: must include guildId and userId");
    }

    const field = rest.join(".");
    if (!field) {
      throw new Error("Invalid path: must include a field to remove");
    }

    try {
      console.log("Removing user data:", { guildId, userId, field });

      // Special handling for non-numeric fields
      if (field === "banner_url" || field === "bannerUrl") {
        const user = await DatabaseService.findUser(guildId, userId);
        if (!user) {
          return null; // Nothing to remove
        }

        const result = await DatabaseService.prisma.user.update({
          where: { guildId_userId: { guildId, userId } },
          data: { bannerUrl: null },
          include: { bank: true, cooldowns: true, upgrades: true },
        });

        // Process and return the result
        const processed = DatabaseService.processUserData(result);
        if (processed) {
          processed.banner_url = null;
          if ("bannerUrl" in processed) delete processed.bannerUrl;
        }
        return processed;
      }

      // For other fields, set to default value from DEFAULT_VALUES
      const defaultValue = this.getDefaultValue(field);
      return await this.set(path, defaultValue);
    } catch (error) {
      console.error("Error in EconomyService.remove:", {
        path,
        error: error.message,
        stack: error.stack,
        cause: error.cause,
      });
      throw error;
    }
  }

  // Helper method to get default value for a field
  static getDefaultValue(field) {
    const parts = field.split(".");
    let value = DEFAULT_VALUES;

    for (const part of parts) {
      if (value && typeof value === "object" && part in value) {
        value = value[part];
      } else {
        return null;
      }
    }

    return value;
  }
}

export default EconomyService;
