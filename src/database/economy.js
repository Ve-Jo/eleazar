const BANK_MAX_INACTIVE_DAYS = 2;
const BANK_MAX_INACTIVE_MS = BANK_MAX_INACTIVE_DAYS * 24 * 60 * 60 * 1000;

export default {
  // Economy Operations
  async addBalance(guildId, userId, amount) {
    // Ensure user exists first
    await this.ensureUser(guildId, userId);

    const formattedAmount = parseFloat(amount).toFixed(5);

    return this.client.$transaction(async (tx) => {
      const economy = await tx.economy.upsert({
        where: {
          userId_guildId: {
            userId,
            guildId,
          },
        },
        create: {
          userId,
          guildId,
          balance: formattedAmount,
          bankBalance: "0.00000",
          bankRate: "0.00000",
          bankStartTime: 0,
        },
        update: {
          balance: {
            increment: parseFloat(formattedAmount),
          },
        },
      });

      if (parseFloat(amount) > 0) {
        await tx.statistics.upsert({
          where: {
            userId_guildId: {
              userId,
              guildId,
            },
          },
          create: {
            userId,
            guildId,
            totalEarned: formattedAmount,
            messageCount: 0,
            commandCount: 0,
            lastUpdated: Date.now(),
          },
          update: {
            totalEarned: {
              increment: parseFloat(formattedAmount),
            },
            lastUpdated: Date.now(),
          },
        });
      }

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

      return economy;
    });
  },

  async transferBalance(guildId, fromUserId, toUserId, amount) {
    const formattedAmount = parseFloat(amount).toFixed(5);
    return this.client.$transaction([
      this.addBalance(guildId, fromUserId, -formattedAmount),
      this.addBalance(guildId, toUserId, formattedAmount),
    ]);
  },

  // Bank Operations
  async updateBankBalance(guildId, userId, amount, rate = 0) {
    return this.client.$transaction(async (tx) => {
      // Always calculate current balance first within the transaction
      const currentBank = await tx.economy.findUnique({
        where: {
          userId_guildId: {
            userId,
            guildId,
          },
        },
        include: {
          user: true, // Include user for activity check
        },
      });

      let currentBalance = "0.00000";
      if (currentBank) {
        // Calculate interest if there's an existing balance
        const inactiveTime = Date.now() - Number(currentBank.user.lastActivity);
        if (inactiveTime > BANK_MAX_INACTIVE_MS) {
          currentBalance = this.calculateInterest(
            parseFloat(currentBank.bankBalance),
            parseFloat(currentBank.bankRate),
            BANK_MAX_INACTIVE_MS
          );
        } else if (currentBank.bankStartTime > 0) {
          const timeElapsed = Date.now() - Number(currentBank.bankStartTime);
          currentBalance = this.calculateInterest(
            parseFloat(currentBank.bankBalance),
            parseFloat(currentBank.bankRate),
            timeElapsed
          );
        }
      }

      // Ensure precise decimal handling
      const formattedAmount = (
        Math.round(parseFloat(amount) * 100000) / 100000
      ).toFixed(5);
      const formattedRate = (
        Math.round(parseFloat(rate) * 100000) / 100000
      ).toFixed(5);

      // If withdrawing all money, reset bank data
      const isEmptyingBank = parseFloat(formattedAmount) <= 0;

      // For deposits, add to current balance. For withdrawals, use the provided amount
      const finalBalance = isEmptyingBank
        ? formattedAmount
        : (parseFloat(currentBalance) + parseFloat(formattedAmount)).toFixed(5);

      const result = await tx.economy.upsert({
        where: {
          userId_guildId: {
            userId,
            guildId,
          },
        },
        create: {
          userId,
          guildId,
          balance: "0.00000",
          bankBalance: finalBalance,
          bankRate: formattedRate,
          bankStartTime: rate > 0 ? Date.now() : 0,
        },
        update: {
          bankBalance: finalBalance,
          bankRate: isEmptyingBank ? "0.00000" : formattedRate,
          bankStartTime: isEmptyingBank ? 0 : rate > 0 ? Date.now() : 0,
        },
      });

      // Update user activity
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

      return result;
    });
  },

  calculateInterest(principal, annualRate, timeMs) {
    // Convert milliseconds to years with proper precision
    const MS_PER_YEAR = 365 * 24 * 60 * 60 * 1000; // milliseconds in a year
    const timeInYears = Number((timeMs / MS_PER_YEAR).toFixed(10)); // limit decimal precision
    const rate = annualRate / 100;

    // Calculate simple interest for the elapsed time period
    // I = P * r * t where:
    // P = principal
    // r = interest rate (as decimal)
    // t = time in years
    const interest = Number((principal * rate * timeInYears).toFixed(10));

    // Return principal plus earned interest with 5 decimal places
    return (principal + interest).toFixed(5);
  },

  async calculateBankBalance(user) {
    if (!user.economy?.bankBalance) return "0.00000";

    const inactiveTime = Date.now() - Number(user.lastActivity);
    const currentTime = Date.now();

    return this.client.$transaction(async (tx) => {
      const currentBank = await tx.economy.findUnique({
        where: {
          userId_guildId: {
            userId: user.id,
            guildId: user.guildId,
          },
        },
      });

      if (!currentBank) return "0.00000";

      // Just return current balance if bank is not active
      if (!currentBank.bankStartTime || !currentBank.bankRate) {
        return currentBank.bankBalance;
      }

      // If user is inactive for more than 2 days, calculate final balance and reset bank
      if (inactiveTime > BANK_MAX_INACTIVE_MS) {
        const formattedBalance = this.calculateInterest(
          parseFloat(currentBank.bankBalance),
          parseFloat(currentBank.bankRate),
          BANK_MAX_INACTIVE_MS
        );

        // Update the bank balance and reset bank data
        await tx.economy.update({
          where: {
            userId_guildId: {
              userId: user.id,
              guildId: user.guildId,
            },
          },
          data: {
            bankBalance: formattedBalance,
            bankRate: "0.00000",
            bankStartTime: 0,
          },
        });

        return formattedBalance;
      }

      // For active users, display current balance with projected interest
      const timeElapsed = currentTime - Number(currentBank.bankStartTime);
      return this.calculateInterest(
        parseFloat(currentBank.bankBalance),
        parseFloat(currentBank.bankRate),
        timeElapsed
      );
    });
  },
};
