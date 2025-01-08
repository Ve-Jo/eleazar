import prisma from "../database/prisma.js";
import { DEFAULT_VALUES } from "../utils/economy.js";

class DatabaseService {
  // Utility methods for type conversion and validation
  static safeNumber(value) {
    if (value === null || value === undefined) return 0;
    if (typeof value === "bigint") return Number(value);
    if (typeof value === "string") return Number(value);
    if (typeof value === "number") return value;
    return 0;
  }

  static safeBigInt(value) {
    if (value === null || value === undefined) return BigInt(0);
    if (typeof value === "bigint") return value;
    if (typeof value === "string") return BigInt(value);
    if (typeof value === "number") return BigInt(Math.floor(value));
    return BigInt(0);
  }

  static safeDecimal(value) {
    if (value === null || value === undefined) return 0;
    return Number(parseFloat(value).toFixed(5));
  }

  // Enhanced transaction handling
  static async transaction(
    callback,
    options = {
      maxAttempts: 3,
      timeout: 5000,
      isolationLevel: "Serializable",
    }
  ) {
    let attempt = 0;
    let lastError = null;

    while (attempt < options.maxAttempts) {
      try {
        const result = await prisma.$transaction(
          async (tx) => {
            return await callback(tx);
          },
          {
            timeout: options.timeout,
            isolationLevel: options.isolationLevel,
            maxWait: 5000, // Maximum time to wait for a transaction slot
          }
        );

        return result;
      } catch (error) {
        lastError = error;
        attempt++;

        // Log the error with attempt information
        console.error(
          `Transaction attempt ${attempt}/${options.maxAttempts} failed:`,
          error
        );

        if (attempt < options.maxAttempts) {
          // Exponential backoff with jitter
          const baseDelay = Math.pow(2, attempt) * 100;
          const jitter = Math.floor(Math.random() * 100);
          await new Promise((resolve) =>
            setTimeout(resolve, baseDelay + jitter)
          );
        }
      }
    }

    throw new Error(
      `Transaction failed after ${options.maxAttempts} attempts. Last error: ${lastError.message}`
    );
  }

  // Enhanced error handling wrapper
  static async withErrorHandling(operation, context, callback) {
    try {
      return await callback();
    } catch (error) {
      if (error instanceof prisma.PrismaClientKnownRequestError) {
        switch (error.code) {
          case "P2002":
            throw new Error(
              `Unique constraint violation in ${context}: ${error.meta?.target?.join(
                ", "
              )}`
            );
          case "P2025":
            throw new Error(`Record not found in ${context}`);
          case "P2003":
            throw new Error(`Foreign key constraint failed in ${context}`);
          default:
            throw new Error(
              `Database error in ${context}: ${error.code} - ${error.message}`
            );
        }
      }
      console.error(`Error in ${context}:`, error);
      throw new Error(`Unexpected error in ${context}: ${error.message}`);
    }
  }

  // Test database connection
  static async testConnection() {
    try {
      // Test the connection by running a simple query
      await prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      console.error("Database connection test failed:", error);
      throw error;
    }
  }

  // Cleanup test data
  static async cleanupTestData(guildId, userId) {
    try {
      // Delete in correct order due to foreign key constraints
      await prisma.userUpgrade.deleteMany({
        where: { guildId, userId },
      });

      await prisma.userBank
        .delete({
          where: { guildId_userId: { guildId, userId } },
        })
        .catch(() => {}); // Ignore if doesn't exist

      await prisma.userCooldowns
        .delete({
          where: { guildId_userId: { guildId, userId } },
        })
        .catch(() => {}); // Ignore if doesn't exist

      await prisma.user
        .delete({
          where: { guildId_userId: { guildId, userId } },
        })
        .catch(() => {}); // Ignore if doesn't exist

      await prisma.guild
        .delete({
          where: { id: guildId },
        })
        .catch(() => {}); // Ignore if doesn't exist

      return true;
    } catch (error) {
      console.error("Error cleaning up test data:", error);
      throw error;
    }
  }

  // Helper method for nested updates
  static createNestedUpdateData(path, value) {
    const parts = path.split(".");
    const updateData = {};
    let current = updateData;

    for (let i = 0; i < parts.length - 1; i++) {
      current[parts[i]] = {
        update: {},
      };
      current = current[parts[i]].update;
    }
    current[parts[parts.length - 1]] = value;

    return updateData;
  }

  // Input validation helper
  static validateInput(guildId, userId) {
    if (!guildId || typeof guildId !== "string") {
      throw new Error("Invalid guildId: must be a non-empty string");
    }
    if (!userId || typeof userId !== "string") {
      throw new Error("Invalid userId: must be a non-empty string");
    }
  }

  // Guild Operations
  static async getGuild(guildId) {
    if (!guildId || typeof guildId !== "string") {
      throw new Error("Invalid guildId: must be a non-empty string");
    }

    try {
      return await prisma.guild.upsert({
        where: { id: guildId },
        create: {
          id: guildId,
          settings: DEFAULT_VALUES.guild.settings,
          counting: DEFAULT_VALUES.guild.counting,
          updatedAt: BigInt(Date.now()),
        },
        update: {
          updatedAt: BigInt(Date.now()),
        },
      });
    } catch (error) {
      console.error("Error in getGuild:", error);
      throw error;
    }
  }

  static async updateGuild(guildId, data) {
    return await prisma.guild.update({
      where: { id: guildId },
      data: {
        ...data,
        updatedAt: BigInt(Date.now()),
      },
    });
  }

  static async listGuilds() {
    return await prisma.guild.findMany({
      select: { id: true },
    });
  }

  // User Operations
  static async getUser(guildId, userId) {
    try {
      this.validateInput(guildId, userId);
      const now = BigInt(Date.now());

      // First try to find the existing user
      let user = await prisma.user.findUnique({
        where: {
          guildId_userId: { guildId, userId },
        },
        include: {
          bank: true,
          cooldowns: true,
          upgrades: true,
        },
      });

      // If user exists, just update latestActivity
      if (user) {
        await prisma.user.update({
          where: {
            guildId_userId: { guildId, userId },
          },
          data: {
            latestActivity: now,
          },
        });
        return this.processUserData(user);
      }

      // If user doesn't exist, create with all relations
      user = await prisma.user.create({
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
          balance: DEFAULT_VALUES.user.balance,
          totalXp: DEFAULT_VALUES.user.totalXp,
          bannerUrl: DEFAULT_VALUES.user.bannerUrl,
          latestActivity: now,
          totalMessages: DEFAULT_VALUES.user.totalMessages,
          commandsUsed: DEFAULT_VALUES.user.commandsUsed,
          totalEarned: DEFAULT_VALUES.user.totalEarned,
          bank: {
            create: {
              amount: DEFAULT_VALUES.bank.amount,
              startedToHold: now,
              holdingPercentage: DEFAULT_VALUES.bank.holdingPercentage,
            },
          },
          cooldowns: {
            create: {
              daily: BigInt(DEFAULT_VALUES.cooldowns.daily),
              work: BigInt(DEFAULT_VALUES.cooldowns.work),
              crime: BigInt(DEFAULT_VALUES.cooldowns.crime),
              message: BigInt(DEFAULT_VALUES.cooldowns.message),
            },
          },
          upgrades: {
            create: [
              {
                upgradeType: "daily",
                level: DEFAULT_VALUES.upgrades.daily.level,
              },
              {
                upgradeType: "crime",
                level: DEFAULT_VALUES.upgrades.crime.level,
              },
            ],
          },
        },
        include: {
          bank: true,
          cooldowns: true,
          upgrades: true,
        },
      });

      return this.processUserData(user);
    } catch (error) {
      console.error("Error in getUser:", error);
      throw error;
    }
  }

  // Helper method to convert numeric strings to numbers
  static processUserData(data) {
    if (!data) return null;

    return {
      ...data,
      balance: this.safeDecimal(data.balance),
      totalXp: this.safeNumber(data.totalXp),
      latestActivity: this.safeNumber(data.latestActivity),
      totalEarned: this.safeDecimal(data.totalEarned),
      bank: data.bank
        ? {
            amount: this.safeDecimal(data.bank.amount),
            startedToHold: this.safeNumber(data.bank.startedToHold),
            holdingPercentage: this.safeNumber(data.bank.holdingPercentage),
          }
        : null,
      cooldowns: data.cooldowns
        ? {
            daily: this.safeNumber(data.cooldowns.daily),
            work: this.safeNumber(data.cooldowns.work),
            crime: this.safeNumber(data.cooldowns.crime),
            message: this.safeNumber(data.cooldowns.message),
          }
        : null,
      upgrades: data.upgrades || [],
    };
  }

  static async updateUser(guildId, userId, data) {
    try {
      // First ensure user exists
      await this.getUser(guildId, userId);

      return await this.transaction(async (tx) => {
        // Prepare update data
        const updateData = {};

        // Handle simple fields
        if (data.balance !== undefined) {
          updateData.balance = this.safeDecimal(data.balance);
        }
        if (data.totalXp !== undefined) {
          updateData.totalXp = this.safeBigInt(data.totalXp);
        }
        if (data.bannerUrl !== undefined) {
          updateData.bannerUrl = data.bannerUrl;
        }
        if (data.totalMessages !== undefined) {
          updateData.totalMessages = this.safeNumber(data.totalMessages);
        }
        if (data.commandsUsed !== undefined) {
          updateData.commandsUsed = this.safeNumber(data.commandsUsed);
        }
        if (data.totalEarned !== undefined) {
          updateData.totalEarned = this.safeDecimal(data.totalEarned);
        }

        // Always update latestActivity
        updateData.latestActivity = this.safeBigInt(Date.now());

        // Handle bank updates
        if (data.bank) {
          updateData.bank = {
            update: {
              amount: this.safeDecimal(data.bank.amount),
              startedToHold: this.safeBigInt(data.bank.startedToHold),
              holdingPercentage: this.safeNumber(data.bank.holdingPercentage),
            },
          };
        }

        // Update main user data
        const result = await tx.user.update({
          where: {
            guildId_userId: { guildId, userId },
          },
          data: updateData,
          include: {
            bank: true,
            cooldowns: true,
            upgrades: true,
          },
        });

        return this.processUserData(result);
      });
    } catch (error) {
      console.error("Error in updateUser:", error);
      throw error;
    }
  }

  // Bank Operations
  static async updateBank(guildId, userId, data) {
    const result = await prisma.userBank.update({
      where: {
        guildId_userId: { guildId, userId },
      },
      data,
    });

    return {
      ...result,
      amount: Number(result.amount),
      startedToHold: Number(result.startedToHold),
    };
  }

  // Cooldown Operations
  static async updateCooldown(guildId, userId, type) {
    return await this.transaction(async (tx) => {
      await tx.userCooldowns.upsert({
        where: {
          guildId_userId: {
            guildId,
            userId,
          },
        },
        create: {
          guildId,
          userId,
          [type]: this.safeBigInt(Date.now()),
        },
        update: {
          [type]: this.safeBigInt(Date.now()),
        },
      });
    });
  }

  static async getCooldown(guildId, userId, type) {
    try {
      const result = await prisma.userCooldowns.findUnique({
        where: {
          guildId_userId: { guildId, userId },
        },
        select: {
          [type]: true,
        },
      });

      if (!result) return 0;
      return this.safeNumber(result[type]);
    } catch (error) {
      console.error("Error getting cooldown:", error);
      throw error;
    }
  }

  static async resetCooldown(guildId, userId, type) {
    return await this.transaction(async (tx) => {
      await tx.userCooldowns.upsert({
        where: {
          guildId_userId: {
            guildId,
            userId,
          },
        },
        create: {
          guildId,
          userId,
          [type]: 0n,
        },
        update: {
          [type]: 0n,
        },
      });
    });
  }

  // Upgrade Operations
  static async getUpgrades(guildId, userId) {
    return await prisma.userUpgrade.findMany({
      where: {
        guildId,
        userId,
      },
    });
  }

  static async updateUpgrade(guildId, userId, type, level) {
    return await prisma.userUpgrade.update({
      where: {
        guildId_userId_upgradeType: {
          guildId,
          userId,
          upgradeType: type,
        },
      },
      data: { level },
    });
  }

  // Improved math operation with transaction safety
  static async mathOperation(guildId, userId, field, operator, number) {
    return await this.withErrorHandling(
      "mathOperation",
      `${field} ${operator} ${number}`,
      async () => {
        return await this.transaction(async (tx) => {
          // Validate the operator
          if (!["+", "-", "*", "/"].includes(operator)) {
            throw new Error(`Invalid operator: ${operator}`);
          }

          // Validate the number
          const safeNumber = this.safeDecimal(number);
          if (isNaN(safeNumber)) {
            throw new Error(`Invalid number: ${number}`);
          }

          if (field.startsWith("bank.")) {
            const bankField = field.split(".")[1];
            const currentBank = await tx.userBank.findUnique({
              where: { guildId_userId: { guildId, userId } },
            });

            if (!currentBank) {
              throw new Error("Bank account not found");
            }

            const currentAmount = this.safeDecimal(currentBank[bankField]);
            let newAmount;

            switch (operator) {
              case "+":
                newAmount = currentAmount + safeNumber;
                break;
              case "-":
                newAmount = currentAmount - safeNumber;
                break;
              case "*":
                newAmount = currentAmount * safeNumber;
                break;
              case "/":
                newAmount = currentAmount / safeNumber;
                break;
            }

            // Prevent negative amounts
            if (newAmount < 0) {
              throw new Error("Operation would result in negative amount");
            }

            const result = await tx.userBank.update({
              where: { guildId_userId: { guildId, userId } },
              data: { [bankField]: newAmount },
            });

            return {
              ...result,
              amount: this.safeDecimal(result.amount),
              startedToHold: this.safeBigInt(result.startedToHold),
            };
          } else {
            const currentUser = await tx.user.findUnique({
              where: { guildId_userId: { guildId, userId } },
              include: {
                bank: true,
                cooldowns: true,
                upgrades: true,
              },
            });

            if (!currentUser) {
              throw new Error("User not found");
            }

            const currentAmount = this.safeDecimal(currentUser[field]);
            let newAmount;

            switch (operator) {
              case "+":
                newAmount = currentAmount + safeNumber;
                break;
              case "-":
                newAmount = currentAmount - safeNumber;
                break;
              case "*":
                newAmount = currentAmount * safeNumber;
                break;
              case "/":
                newAmount = currentAmount / safeNumber;
                break;
            }

            // Prevent negative amounts for balance
            if (field === "balance" && newAmount < 0) {
              throw new Error("Operation would result in negative balance");
            }

            const result = await tx.user.update({
              where: { guildId_userId: { guildId, userId } },
              data: { [field]: newAmount },
              include: {
                bank: true,
                cooldowns: true,
                upgrades: true,
              },
            });

            return this.processUserData(result);
          }
        });
      }
    );
  }
}

export default DatabaseService;
