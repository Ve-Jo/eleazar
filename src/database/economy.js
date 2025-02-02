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
    // Ensure precise decimal handling with 5 decimal places
    const formattedAmount = (
      Math.round(parseFloat(amount) * 100000) / 100000
    ).toFixed(5);
    const formattedRate = (
      Math.round(parseFloat(rate) * 100000) / 100000
    ).toFixed(5);

    // Get current bank data
    const currentBank = await this.client.economy.findUnique({
      where: {
        userId_guildId: {
          userId,
          guildId,
        },
      },
    });

    // If withdrawing all money, reset bank data
    const isEmptyingBank = currentBank && parseFloat(formattedAmount) <= 0;

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
        balance: "0.00000",
        bankBalance: formattedAmount,
        bankRate: formattedRate,
        bankStartTime: rate > 0 ? Date.now() : 0,
      },
      update: {
        bankBalance: formattedAmount,
        bankRate: isEmptyingBank ? "0.00000" : formattedRate,
        bankStartTime: isEmptyingBank ? 0 : rate > 0 ? Date.now() : 0,
      },
    });
  },

  async calculateBankBalance(user) {
    if (!user.economy?.bankBalance) return "0.00000";

    const inactiveTime = Date.now() - Number(user.lastActivity);
    const currentTime = Date.now();

    // Helper function to calculate interest
    const calculateInterest = (principal, annualRate, timeMs) => {
      // Convert time to years (milliseconds to years)
      const timeInYears = timeMs / (365 * 24 * 60 * 60 * 1000);

      // Calculate interest using simple annual percentage
      // If annual rate is 300%, after one year balance should be 4x initial (original + 300%)
      const multiplier = 1 + (annualRate / 100) * timeInYears;
      const finalAmount = principal * multiplier;

      return finalAmount.toFixed(5);
    };

    // If user is inactive for more than 2 days
    if (inactiveTime > BANK_MAX_INACTIVE_MS) {
      // Calculate interest only for the max allowed inactive period
      const principal = parseFloat(user.economy.bankBalance);
      const annualRate = parseFloat(user.economy.bankRate);
      const formattedBalance = calculateInterest(
        principal,
        annualRate,
        BANK_MAX_INACTIVE_MS
      );

      // Update the bank balance and reset bank data
      await this.client.economy.update({
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

    // For active users, calculate interest for the actual elapsed time
    const timeElapsed = currentTime - Number(user.economy.bankStartTime);
    const principal = parseFloat(user.economy.bankBalance);
    const annualRate = parseFloat(user.economy.bankRate);
    const formattedBalance = calculateInterest(
      principal,
      annualRate,
      timeElapsed
    );

    // Update the bank balance while keeping the rate and start time
    await this.client.economy.update({
      where: {
        userId_guildId: {
          userId: user.id,
          guildId: user.guildId,
        },
      },
      data: {
        bankBalance: formattedBalance,
      },
    });

    return formattedBalance;
  },
};
