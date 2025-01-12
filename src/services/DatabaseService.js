import prisma from "../database/prisma.js";
import { DEFAULT_VALUES, UPGRADES } from "../utils/economy.js";
import EconomyService from "./EconomyService.js";

class DatabaseService {
  static prisma = prisma;

  // Utility Methods
  static safeNumber(value, defaultValue = 0) {
    try {
      if (value === null || value === undefined || typeof value === "object")
        return defaultValue;
      if (typeof value === "bigint") return Number(value);
      if (typeof value === "string") {
        const num = Number(value);
        if (isNaN(num)) throw new Error(`Invalid number string: ${value}`);
        return num;
      }
      if (typeof value !== "number")
        throw new Error(`Invalid value type: ${typeof value}`);
      if (isNaN(value)) throw new Error("Value is NaN");
      return value;
    } catch (error) {
      console.error("Error in safeNumber:", {
        value,
        defaultValue,
        error: error.message,
      });
      return defaultValue;
    }
  }

  static safeBigInt(value) {
    try {
      if (value === null || value === undefined) return BigInt(0);
      if (typeof value === "bigint") return value;
      const num = Number(value);
      if (isNaN(num))
        throw new Error(`Invalid number for BigInt conversion: ${value}`);
      return BigInt(Math.floor(num));
    } catch (error) {
      console.error("Error in safeBigInt:", {
        value,
        error: error.message,
      });
      return BigInt(0);
    }
  }

  static safeDecimal(value) {
    try {
      if (value === null || value === undefined) return 0;

      // Handle string values that might be Prisma Decimal
      if (typeof value === "string") {
        const num = parseFloat(value);
        if (isNaN(num)) throw new Error(`Invalid decimal string: ${value}`);
        return Number(num.toFixed(5));
      }

      // Handle numbers
      if (typeof value === "number") {
        if (isNaN(value)) throw new Error("Value is NaN");
        return Number(value.toFixed(5));
      }

      // Handle BigInt
      if (typeof value === "bigint") {
        return Number(value);
      }

      // Handle Prisma Decimal objects
      if (typeof value === "object" && value !== null) {
        const num = parseFloat(value.toString());
        if (isNaN(num)) throw new Error(`Invalid decimal object: ${value}`);
        return Number(num.toFixed(5));
      }

      throw new Error(`Unsupported value type: ${typeof value}`);
    } catch (error) {
      console.error("Error in safeDecimal:", {
        value,
        type: typeof value,
        error: error.message,
      });
      return 0;
    }
  }

  // Core Database Operations
  static async transaction(operation) {
    try {
      return await prisma.$transaction(operation, {
        timeout: 10000,
        isolationLevel: "ReadCommitted",
      });
    } catch (error) {
      console.error("Transaction failed:", {
        error: error.message,
        stack: error.stack,
        cause: error.cause,
      });
      throw error;
    }
  }

  // User Management
  static async findUser(guildId, userId) {
    if (!guildId || !userId) {
      throw new Error("Both guildId and userId are required");
    }

    try {
      return await prisma.user.findUnique({
        where: { guildId_userId: { guildId, userId } },
        include: {
          bank: true,
          cooldowns: true,
          upgrades: true,
        },
      });
    } catch (error) {
      console.error("Error in findUser:", {
        guildId,
        userId,
        error: error.message,
        stack: error.stack,
        cause: error.cause,
      });
      throw error;
    }
  }

  static async createNewUser(guildId, userId) {
    if (!guildId || !userId) {
      throw new Error("Both guildId and userId are required");
    }

    try {
      const now = BigInt(Date.now());
      console.log("Creating new user:", { guildId, userId });

      // Create user data dynamically from DEFAULT_VALUES
      const userData = {
        ...DEFAULT_VALUES.user,
        latestActivity: now,
      };

      return await prisma.user.create({
        data: {
          guild: {
            connectOrCreate: {
              where: { id: guildId },
              create: {
                id: guildId,
                settings: DEFAULT_VALUES.guild.settings,
                counting: DEFAULT_VALUES.guild.counting,
                updatedAt: now,
              },
            },
          },
          userId,
          ...userData,
          bank: {
            create: {
              amount: DEFAULT_VALUES.bank.amount,
              startedToHold: BigInt(0),
              holdingPercentage: DEFAULT_VALUES.bank.holdingPercentage,
            },
          },
          cooldowns: {
            create: Object.entries(DEFAULT_VALUES.cooldowns).reduce(
              (acc, [type, value]) => ({
                ...acc,
                [type]: BigInt(value),
              }),
              {}
            ),
          },
          upgrades: {
            create: Object.entries(DEFAULT_VALUES.upgrades).map(
              ([type, data]) => ({
                upgradeType: type,
                level: data.level,
              })
            ),
          },
        },
        include: {
          bank: true,
          cooldowns: true,
          upgrades: true,
        },
      });
    } catch (error) {
      console.error("Error in createNewUser:", {
        guildId,
        userId,
        error: error.message,
        stack: error.stack,
        cause: error.cause,
      });
      throw error;
    }
  }

  static async getUser(guildId, userId) {
    if (!guildId || !userId) {
      throw new Error("Both guildId and userId are required");
    }

    try {
      console.log("Getting user:", { guildId, userId });
      let user = await this.findUser(guildId, userId);

      if (user) {
        // Just update activity timestamp
        await prisma.user.update({
          where: { guildId_userId: { guildId, userId } },
          data: { latestActivity: BigInt(Date.now()) },
        });
      } else {
        user = await this.createNewUser(guildId, userId);
      }

      return this.processUserData(user);
    } catch (error) {
      console.error("Error in getUser:", {
        guildId,
        userId,
        error: error.message,
        stack: error.stack,
        cause: error.cause,
      });
      throw error;
    }
  }

  // Bank Operations
  static async updateBank(guildId, userId, updates) {
    if (!guildId || !userId) {
      throw new Error("Both guildId and userId are required");
    }
    if (!updates || typeof updates !== "object") {
      throw new Error("Updates must be an object");
    }

    try {
      console.log("Updating bank:", { guildId, userId, updates });
      const updateData = {};

      // Only include defined fields in update
      if (updates.amount !== undefined) {
        updateData.amount = this.safeDecimal(updates.amount);
      }
      if (updates.startedToHold !== undefined) {
        updateData.startedToHold = this.safeBigInt(updates.startedToHold);
      }
      if (updates.holdingPercentage !== undefined) {
        if (
          typeof updates.holdingPercentage !== "number" ||
          isNaN(updates.holdingPercentage)
        ) {
          throw new Error(
            `Invalid holdingPercentage: ${updates.holdingPercentage}`
          );
        }
        updateData.holdingPercentage = updates.holdingPercentage;
      }

      if (Object.keys(updateData).length === 0) {
        throw new Error("No valid fields to update");
      }

      const result = await prisma.userBank.update({
        where: { guildId_userId: { guildId, userId } },
        data: updateData,
      });

      return {
        amount: this.safeDecimal(result.amount),
        startedToHold: this.safeNumber(result.startedToHold),
        holdingPercentage: result.holdingPercentage,
      };
    } catch (error) {
      console.error("Error in updateBank:", {
        guildId,
        userId,
        updates,
        error: error.message,
        stack: error.stack,
        cause: error.cause,
      });
      throw error;
    }
  }

  // Cooldown Management
  static async getCooldown(guildId, userId, type) {
    if (!guildId || !userId) {
      throw new Error("Both guildId and userId are required");
    }
    if (!type) {
      throw new Error("Cooldown type is required");
    }

    try {
      const cooldown = await prisma.userCooldowns.findUnique({
        where: { guildId_userId: { guildId, userId } },
        select: { [type]: true },
      });

      return this.safeNumber(cooldown?.[type]);
    } catch (error) {
      console.error("Error in getCooldown:", {
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

  static async updateCooldown(guildId, userId, type) {
    if (!guildId || !userId) {
      throw new Error("Both guildId and userId are required");
    }
    if (!type) {
      throw new Error("Cooldown type is required");
    }

    try {
      await prisma.userCooldowns.upsert({
        where: { guildId_userId: { guildId, userId } },
        create: {
          guildId,
          userId,
          [type]: this.safeBigInt(Date.now()),
        },
        update: { [type]: this.safeBigInt(Date.now()) },
      });
    } catch (error) {
      console.error("Error in updateCooldown:", {
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

  static async resetCooldown(guildId, userId, type) {
    if (!guildId || !userId) {
      throw new Error("Both guildId and userId are required");
    }
    if (!type) {
      throw new Error("Cooldown type is required");
    }

    try {
      await prisma.userCooldowns.upsert({
        where: { guildId_userId: { guildId, userId } },
        create: {
          guildId,
          userId,
          [type]: BigInt(0),
        },
        update: { [type]: BigInt(0) },
      });
    } catch (error) {
      console.error("Error in resetCooldown:", {
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

  // Data Processing
  static processUserData(data) {
    if (!data) return null;

    try {
      // Convert upgrades array to object
      const upgradesObject = {};
      if (Array.isArray(data.upgrades)) {
        data.upgrades.forEach((upgrade) => {
          upgradesObject[upgrade.upgradeType] = {
            level: upgrade.level,
          };
        });
      } else if (data.upgrades) {
        // Handle case where upgrades might be an object
        Object.entries(data.upgrades).forEach(([type, upgrade]) => {
          if (typeof upgrade === "object" && upgrade.upgradeType) {
            upgradesObject[upgrade.upgradeType] = {
              level: upgrade.level,
            };
          }
        });
      }

      // Create upgrades object dynamically from DEFAULT_VALUES
      const upgrades = {};
      Object.keys(DEFAULT_VALUES.upgrades).forEach((type) => {
        upgrades[type] = upgradesObject[type] || {
          level: DEFAULT_VALUES.upgrades[type].level,
        };
      });

      // Create cooldowns object dynamically from DEFAULT_VALUES
      const cooldowns = {};
      Object.keys(DEFAULT_VALUES.cooldowns).forEach((type) => {
        cooldowns[type] = this.safeNumber(
          data.cooldowns?.[type],
          DEFAULT_VALUES.cooldowns[type]
        );
      });

      // Process all user fields dynamically from DEFAULT_VALUES
      const processedUser = {};
      Object.entries(DEFAULT_VALUES.user).forEach(([key, defaultValue]) => {
        const value = data[key];
        if (key === "balance" || key === "totalEarned") {
          // Handle Decimal fields
          processedUser[key] = this.safeDecimal(value ?? defaultValue);
        } else if (typeof defaultValue === "number") {
          processedUser[key] = this.safeNumber(value ?? defaultValue);
        } else if (typeof defaultValue === "boolean") {
          processedUser[key] = value ?? defaultValue;
        } else {
          processedUser[key] = value ?? defaultValue;
        }
      });

      // Add banner_url field if it exists
      if ("bannerUrl" in data) {
        processedUser.banner_url = data.bannerUrl ?? null;
      }

      // Process bank data dynamically from DEFAULT_VALUES
      const bank = data.bank
        ? {
            amount: this.safeDecimal(
              data.bank.amount ?? DEFAULT_VALUES.bank.amount
            ),
            startedToHold: this.safeNumber(
              data.bank.startedToHold ?? DEFAULT_VALUES.bank.startedToHold
            ),
            holdingPercentage:
              data.bank.holdingPercentage ??
              DEFAULT_VALUES.bank.holdingPercentage,
          }
        : null;

      // Return processed data
      const { guildId, userId } = data;
      return {
        guildId,
        userId,
        ...processedUser,
        bank,
        cooldowns,
        upgrades,
      };
    } catch (error) {
      console.error("Error in processUserData:", {
        data,
        error: error.message,
        stack: error.stack,
        rawUpgrades: data.upgrades,
      });
      throw error;
    }
  }

  // Math Operations
  static async mathOperation(guildId, userId, field, operator, number) {
    if (!guildId || !userId) {
      throw new Error("Both guildId and userId are required");
    }
    if (!field) {
      throw new Error("Field is required");
    }
    if (!["+", "-", "*", "/"].includes(operator)) {
      throw new Error(`Invalid operator: ${operator}`);
    }

    try {
      console.log("Starting math operation:", {
        guildId,
        userId,
        field,
        operator,
        number,
      });

      const safeNumber = this.safeDecimal(number);
      if (isNaN(safeNumber)) {
        throw new Error(`Invalid number: ${number}`);
      }

      // Extract the actual field name from the path
      const actualField = field.split(".").pop();
      console.log("Extracted field:", actualField);

      return await this.transaction(async (tx) => {
        if (field.startsWith("bank.")) {
          return await this.handleBankMathOperation(
            tx,
            guildId,
            userId,
            actualField,
            operator,
            safeNumber
          );
        } else {
          const result = await this.handleUserMathOperation(
            tx,
            guildId,
            userId,
            actualField,
            operator,
            safeNumber
          );
          console.log("Math operation result:", result);
          return result;
        }
      });
    } catch (error) {
      console.error("Error in mathOperation:", {
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

  static async handleBankMathOperation(
    tx,
    guildId,
    userId,
    field,
    operator,
    number
  ) {
    try {
      const bankField = field.split(".")[1];
      if (!bankField) {
        throw new Error("Invalid bank field");
      }

      const currentBank = await tx.userBank.findUnique({
        where: { guildId_userId: { guildId, userId } },
      });

      if (!currentBank) {
        throw new Error("Bank account not found");
      }

      const currentAmount = this.safeDecimal(currentBank[bankField]);
      const newAmount = this.calculateNewAmount(
        currentAmount,
        operator,
        number
      );

      if (newAmount < 0) {
        throw new Error("Operation would result in negative amount");
      }

      const result = await tx.userBank.update({
        where: { guildId_userId: { guildId, userId } },
        data: { [bankField]: newAmount },
      });

      return {
        amount: this.safeDecimal(result.amount),
        startedToHold: this.safeNumber(result.startedToHold),
        holdingPercentage: result.holdingPercentage,
      };
    } catch (error) {
      console.error("Error in handleBankMathOperation:", {
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

  static async handleUserMathOperation(
    tx,
    guildId,
    userId,
    field,
    operator,
    number
  ) {
    try {
      console.log("Starting handleUserMathOperation:", {
        guildId,
        userId,
        field,
        operator,
        number,
      });

      const user = await tx.user.findUnique({
        where: { guildId_userId: { guildId, userId } },
        include: { bank: true, cooldowns: true, upgrades: true },
      });

      if (!user) {
        throw new Error("User not found");
      }

      if (!(field in user)) {
        throw new Error(`Invalid field: ${field}`);
      }

      console.log("Current user data:", {
        field,
        currentValue: user[field],
      });

      const currentAmount = this.safeDecimal(user[field]);
      const newAmount = this.calculateNewAmount(
        currentAmount,
        operator,
        number
      );

      console.log("Calculated amounts:", {
        currentAmount,
        newAmount,
      });

      if (field === "balance" && newAmount < 0) {
        throw new Error("Operation would result in negative balance");
      }

      // Convert to string for Prisma Decimal
      const updateData = { [field]: newAmount.toString() };
      console.log("Update data:", updateData);

      const result = await tx.user.update({
        where: { guildId_userId: { guildId, userId } },
        data: updateData,
        include: { bank: true, cooldowns: true, upgrades: true },
      });

      console.log("Database update result:", {
        field,
        updatedValue: result[field],
      });

      // Process the result before returning
      const processed = this.processUserData(result);

      // Ensure the math operation is reflected in the processed data
      if (field in processed) {
        processed[field] = this.safeDecimal(newAmount);
      }

      console.log("Final processed result:", {
        field,
        processedValue: processed[field],
      });

      return processed;
    } catch (error) {
      console.error("Error in handleUserMathOperation:", {
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

  static calculateNewAmount(current, operator, number) {
    try {
      const safeNumber = this.safeDecimal(number);
      const safeCurrent = this.safeDecimal(current);

      let result;
      switch (operator) {
        case "+":
          result = safeCurrent + safeNumber;
          break;
        case "-":
          result = safeCurrent - safeNumber;
          break;
        case "*":
          result = safeCurrent * safeNumber;
          break;
        case "/":
          if (safeNumber === 0) throw new Error("Division by zero");
          result = safeCurrent / safeNumber;
          break;
        default:
          throw new Error(`Unsupported operator: ${operator}`);
      }

      // Ensure the result is properly formatted as a decimal
      return this.safeDecimal(result);
    } catch (error) {
      console.error("Error in calculateNewAmount:", {
        current,
        operator,
        number,
        error: error.message,
      });
      throw error;
    }
  }

  static async getGuildUsers(guildId) {
    if (!guildId) {
      throw new Error("GuildId is required");
    }

    try {
      const users = await prisma.user.findMany({
        where: { guildId },
        include: {
          bank: true,
          cooldowns: true,
          upgrades: true,
        },
      });

      return users.map((user) => this.processUserData(user));
    } catch (error) {
      console.error("Error in DatabaseService.getGuildUsers:", {
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
      const upgrade = await prisma.userUpgrade.upsert({
        where: {
          guildId_userId_upgradeType: {
            guildId,
            userId,
            upgradeType: type,
          },
        },
        update: {
          level: {
            increment: 1,
          },
        },
        create: {
          guildId,
          userId,
          upgradeType: type,
          level: 2, // Start at level 2 since default is 1
        },
      });

      return {
        type,
        level: upgrade.level,
        info: EconomyService.getUpgradeInfo(type, upgrade.level),
      };
    } catch (error) {
      console.error("Error in DatabaseService.upgradeLevel:", {
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
}

export default DatabaseService;
