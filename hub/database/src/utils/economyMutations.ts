import { Prisma } from "@prisma/client";
import { UPGRADES } from "../constants/database.ts";

// Bank constants
const BASE_BANK_MAX_INACTIVE_MS = 2 * 60 * 60 * 1000; // 2 hours base

type EconomyMutationClient = {
  $transaction: <T>(callback: (tx: EconomyMutationTransaction) => Promise<T>) => Promise<T>;
};

type EconomyMutationTransaction = {
  economy: {
    findUnique: (args: unknown) => Promise<unknown>;
    upsert: (args: unknown) => Promise<unknown>;
    update: (args: unknown) => Promise<unknown>;
    updateMany: (args: unknown) => Promise<{ count: number }>;
  };
  statistics: {
    upsert: (args: unknown) => Promise<unknown>;
  };
  user: {
    findUnique: (args: unknown) => Promise<unknown>;
    update: (args: unknown) => Promise<unknown>;
  };
  upgrade: {
    findMany: (args: unknown) => Promise<unknown>;
  };
};

type EnsureUserFn = (guildId: string, userId: string) => Promise<unknown>;

type CalculateInterestDecimalFn = (
  principal: Prisma.Decimal,
  annualRate: Prisma.Decimal,
  timeMs: number
) => Prisma.Decimal;

type CalculateLevelFn = (xp: unknown) => { level: number };

type AddToGuildVaultFn = (
  guildId: string,
  amount: Prisma.Decimal,
  userId: string,
  operationType: string
) => Promise<unknown>;

type EconomyRecord = {
  balance: Prisma.Decimal;
};

type UserLevelShape = {
  xp?: unknown;
  gameXp?: unknown;
};

type UserEconomyShape = {
  balance: Prisma.Decimal;
  bankBalance: Prisma.Decimal;
  bankRate: Prisma.Decimal;
  bankStartTime: number | bigint | string;
};

type UserWithEconomyAndLevel = {
  economy?: UserEconomyShape | null;
  Level?: UserLevelShape | null;
};

type UpgradeRecord = {
  type?: string;
  level?: number;
};

const MAX_EFFECTIVE_BANK_RATE = new Prisma.Decimal(45);

function clampDecimalNonNegative(value: Prisma.Decimal): Prisma.Decimal {
  return value.lessThan(0) ? new Prisma.Decimal(0) : value;
}

function clampBankRate(value: Prisma.Decimal): Prisma.Decimal {
  if (value.lessThan(0)) {
    return new Prisma.Decimal(0);
  }

  if (value.greaterThan(MAX_EFFECTIVE_BANK_RATE)) {
    return MAX_EFFECTIVE_BANK_RATE;
  }

  return value;
}

async function addBalance(
  client: EconomyMutationClient,
  ensureUser: EnsureUserFn,
  guildId: string,
  userId: string,
  amount: string | number | Prisma.Decimal
): Promise<unknown> {
  await ensureUser(guildId, userId);

  const decimalAmount = new Prisma.Decimal(amount);
  const isZero = decimalAmount.equals(0);
  const isPositive = decimalAmount.greaterThan(0);
  const decrementAmount = decimalAmount.abs();

  return client.$transaction(async (tx) => {
    if (isZero) {
      const existingEconomy = await tx.economy.findUnique({
        where: {
          guildId_userId: {
            guildId,
            userId,
          },
        },
      });

      if (!existingEconomy) {
        return {
          userId,
          guildId,
          balance: new Prisma.Decimal(0),
          bankBalance: new Prisma.Decimal(0),
          bankRate: new Prisma.Decimal(0),
          bankStartTime: 0,
        };
      }
    }

    if (isPositive) {
      await tx.economy.upsert({
        where: {
          guildId_userId: {
            guildId,
            userId,
          },
        },
        create: {
          guildId,
          userId,
          balance: decimalAmount,
          bankBalance: new Prisma.Decimal(0),
          bankRate: new Prisma.Decimal(0),
          bankStartTime: 0,
        },
        update: {
          balance: {
            increment: decimalAmount,
          },
        },
      });
    } else {
      const decrementResult = await tx.economy.updateMany({
        where: {
          guildId,
          userId,
          balance: {
            gte: decrementAmount,
          },
        },
        data: {
          balance: {
            decrement: decrementAmount,
          },
        },
      });

      if (decrementResult.count === 0) {
        throw new Error("Insufficient balance");
      }
    }

    const economy = await tx.economy.findUnique({
      where: {
        guildId_userId: {
          guildId,
          userId,
        },
      },
    });

    if (!economy) {
      throw new Error("User economy data not found");
    }

    if (isPositive) {
      await tx.statistics.upsert({
        where: {
          guildId_userId: {
            guildId,
            userId,
          },
        },
        create: {
          guildId,
          userId,
          totalEarned: decimalAmount,
          messageCount: 0,
          commandCount: 0,
          lastUpdated: Date.now(),
        },
        update: {
          totalEarned: {
            increment: decimalAmount,
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
}

async function transferBalance(
  client: EconomyMutationClient,
  ensureUser: EnsureUserFn,
  guildId: string,
  fromUserId: string,
  toUserId: string,
  amount: string | number | Prisma.Decimal
): Promise<unknown> {
  await ensureUser(guildId, fromUserId);
  await ensureUser(guildId, toUserId);

  const decimalAmount = new Prisma.Decimal(amount);

  return client.$transaction(async (tx) => {
    const senderEconomy = (await tx.economy.findUnique({
      where: {
        guildId_userId: {
          guildId,
          userId: fromUserId,
        },
      },
    })) as EconomyRecord | null;

    if (!senderEconomy || senderEconomy.balance.lessThan(decimalAmount)) {
      throw new Error("Insufficient balance");
    }

    await tx.economy.update({
      where: {
        guildId_userId: {
          guildId,
          userId: fromUserId,
        },
      },
      data: {
        balance: {
          decrement: decimalAmount,
        },
      },
    });

    await tx.economy.upsert({
      where: {
        guildId_userId: {
          guildId,
          userId: toUserId,
        },
      },
      create: {
        guildId,
        userId: toUserId,
        balance: decimalAmount,
        bankBalance: new Prisma.Decimal(0),
        bankRate: new Prisma.Decimal(0),
        bankStartTime: 0,
      },
      update: {
        balance: {
          increment: decimalAmount,
        },
      },
    });

    await tx.user.update({
      where: {
        guildId_id: {
          guildId,
          id: fromUserId,
        },
      },
      data: {
        lastActivity: Date.now(),
      },
    });

    await tx.user.update({
      where: {
        guildId_id: {
          guildId,
          id: toUserId,
        },
      },
      data: {
        lastActivity: Date.now(),
      },
    });

    return { success: true, amount: decimalAmount };
  });
}

async function deposit(
  client: EconomyMutationClient,
  ensureUser: EnsureUserFn,
  calculateInterestDecimal: CalculateInterestDecimalFn,
  calculateLevel: CalculateLevelFn,
  addToGuildVault: AddToGuildVaultFn,
  guildId: string,
  userId: string,
  amount: string | number | Prisma.Decimal
): Promise<unknown> {
  console.log(
    `Deposit initiated for user ${userId} in guild ${guildId} with amount ${amount}`
  );

  await ensureUser(guildId, userId);

  const depositAmount = new Prisma.Decimal(amount);
  console.log(`Converted deposit amount to Decimal: ${depositAmount}`);

  const result = await client.$transaction(async (tx) => {
    const user = (await tx.user.findUnique({
      where: {
        guildId_id: {
          guildId,
          id: userId,
        },
      },
      include: {
        economy: true,
        Level: true,
      },
    })) as UserWithEconomyAndLevel | null;

    if (!user || !user.economy) {
      console.error(`User economy data not found for user ${userId}`);
      throw new Error("User economy data not found");
    }

    console.log(`Current user balance: ${user.economy.balance}`);

    if (user.economy.balance.lessThan(depositAmount)) {
      console.error(
        `Insufficient balance for user ${userId}: has ${user.economy.balance}, needs ${depositAmount}`
      );
      throw new Error("Insufficient balance");
    }

    let currentBankBalance = user.economy.bankBalance;
    console.log(`Initial bank balance: ${currentBankBalance}`);

    if (
      Number(user.economy.bankStartTime) > 0 &&
      user.economy.bankRate.greaterThan(0)
    ) {
      const timeElapsed = Date.now() - Number(user.economy.bankStartTime);
      console.log(`Time elapsed since last bank update: ${timeElapsed}ms`);
      currentBankBalance = calculateInterestDecimal(
        currentBankBalance,
        user.economy.bankRate,
        timeElapsed
      );
      console.log(`Bank balance after interest: ${currentBankBalance}`);
    }

    const chattingLevel = user.Level ? calculateLevel(user.Level.xp).level : 1;
    const gamingLevel = user.Level ? calculateLevel(user.Level.gameXp).level : 1;
    console.log(
      `User levels - Chatting: ${chattingLevel}, Gaming: ${gamingLevel}`
    );

    const userUpgrades = (await tx.upgrade.findMany({
      where: { guildId, userId },
    })) as UpgradeRecord[];
    // Bank rate is now activity-based, not upgrade-based
    // Calculate rate from activity levels
    const rawBankRate = new Prisma.Decimal(
      5 * chattingLevel + 5 * gamingLevel
    );
    const newBankRate = clampBankRate(rawBankRate);
    console.log(`New bank rate calculated: ${newBankRate}`);

    // vault_guard provides fee reduction
    const vaultGuardLevel =
      userUpgrades.find((upgrade) => upgrade.type === "vault_guard")?.level || 1;
    const feeReduction = Math.min(
      0.5,
      (vaultGuardLevel - 1) * (UPGRADES.vault_guard.effectFees || 0)
    );
    const feeRate = new Prisma.Decimal(0.05 * (1 - feeReduction));
    const feeAmount = depositAmount.times(feeRate);
    const finalDepositAmount = depositAmount.minus(feeAmount);
    console.log(
      `Deposit fee (5%): ${feeAmount}, final deposit amount: ${finalDepositAmount}`
    );

    const finalBankBalance = currentBankBalance.plus(finalDepositAmount);
    console.log(`Final bank balance after deposit: ${finalBankBalance}`);

    // Get bank_vault upgrade for cycle duration
    const bankVaultLevel =
      userUpgrades.find((upgrade) => upgrade.type === "bank_vault")?.level || 1;
    const cycleDuration = BASE_BANK_MAX_INACTIVE_MS + (bankVaultLevel - 1) * UPGRADES.bank_vault.effectValue;

    const updatedEconomy = await tx.economy.update({
      where: {
        guildId_userId: {
          guildId,
          userId,
        },
      },
      data: {
        balance: {
          decrement: depositAmount,
        },
        bankBalance: finalBankBalance,
        bankRate: newBankRate,
        bankStartTime: Date.now(), // Reset timer for fresh cycle
      },
    });

    console.log(`Economy updated successfully for user ${userId}`);

    if (feeAmount.greaterThan(0)) {
      await addToGuildVault(guildId, feeAmount, userId, "deposit");
      console.log(`Added ${feeAmount} fee to guild vault for guild ${guildId}`);
    }

    console.log(`Economy updated successfully for user ${userId}`);

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

    console.log("User activity timestamp updated");
    return updatedEconomy;
  });

  console.log("Deposit transaction completed successfully");
  return result;
}

async function withdraw(
  client: EconomyMutationClient,
  ensureUser: EnsureUserFn,
  calculateInterestDecimal: CalculateInterestDecimalFn,
  calculateLevel: CalculateLevelFn,
  addToGuildVault: AddToGuildVaultFn,
  guildId: string,
  userId: string,
  amount: string | number | Prisma.Decimal
): Promise<unknown> {
  await ensureUser(guildId, userId);

  let withdrawAmount = new Prisma.Decimal(amount);

  return client.$transaction(async (tx) => {
    const user = (await tx.user.findUnique({
      where: {
        guildId_id: {
          guildId,
          id: userId,
        },
      },
      include: {
        economy: true,
        Level: true,
      },
    })) as UserWithEconomyAndLevel | null;

    if (!user || !user.economy) {
      throw new Error("User economy data not found");
    }

    let currentBankBalance = user.economy.bankBalance;
    if (
      Number(user.economy.bankStartTime) > 0 &&
      user.economy.bankRate.greaterThan(0)
    ) {
      const timeElapsed = Date.now() - Number(user.economy.bankStartTime);
      currentBankBalance = calculateInterestDecimal(
        currentBankBalance,
        user.economy.bankRate,
        timeElapsed
      );
    }

    const bankDistributed =
      (user.economy as UserEconomyShape & { bankDistributed?: Prisma.Decimal | null })
        .bankDistributed || new Prisma.Decimal(0);
    const totalBankBalance = currentBankBalance.plus(bankDistributed);
    const epsilon = new Prisma.Decimal(0.00001);

    if (withdrawAmount.greaterThanOrEqualTo(totalBankBalance)) {
      withdrawAmount = totalBankBalance;
    } else if (totalBankBalance.minus(withdrawAmount).abs().lessThanOrEqualTo(epsilon)) {
      withdrawAmount = totalBankBalance;
    }

    if (totalBankBalance.lessThan(withdrawAmount)) {
      throw new Error("Insufficient bank balance");
    }

    let newBankBalance = currentBankBalance;
    let newBankDistributed = bankDistributed;
    let remainingToWithdraw = withdrawAmount;

    if (bankDistributed.greaterThan(0)) {
      const distributedWithdrawal = Prisma.Decimal.min(
        bankDistributed,
        remainingToWithdraw
      );
      newBankDistributed = bankDistributed.minus(distributedWithdrawal);
      remainingToWithdraw = remainingToWithdraw.minus(distributedWithdrawal);
    }

    if (
      remainingToWithdraw.greaterThan(0) &&
      currentBankBalance.greaterThan(0)
    ) {
      const bankWithdrawal = Prisma.Decimal.min(
        currentBankBalance,
        remainingToWithdraw
      );
      newBankBalance = currentBankBalance.minus(bankWithdrawal);
      remainingToWithdraw = remainingToWithdraw.minus(bankWithdrawal);
    }

    newBankBalance = clampDecimalNonNegative(newBankBalance);
    newBankDistributed = clampDecimalNonNegative(newBankDistributed);

    const totalRemainingBalance = newBankBalance.plus(newBankDistributed);
    const isWithdrawingAll = totalRemainingBalance.lessThanOrEqualTo(0);

    const userUpgrades = (await tx.upgrade.findMany({
      where: { guildId, userId },
    })) as UpgradeRecord[];

    let newBankRate = new Prisma.Decimal(0);
    let newBankStartTime = 0;

    if (!isWithdrawingAll && newBankBalance.greaterThan(0)) {
      const chattingLevel = user.Level ? calculateLevel(user.Level.xp).level : 1;
      const gamingLevel = user.Level ? calculateLevel(user.Level.gameXp).level : 1;
      // Bank rate is now activity-based, not upgrade-based
      const rawBankRate = new Prisma.Decimal(
        5 * chattingLevel + 5 * gamingLevel
      );
      newBankRate = clampBankRate(rawBankRate);
      newBankStartTime = Date.now();
    }

    // vault_guard provides fee reduction
    const vaultGuardLevel =
      userUpgrades.find((upgrade) => upgrade.type === "vault_guard")?.level || 1;
    const feeReduction = Math.min(
      0.5,
      (vaultGuardLevel - 1) * (UPGRADES.vault_guard.effectFees || 0)
    );
    const feeRate = new Prisma.Decimal(0.05 * (1 - feeReduction));
    const feeAmount = withdrawAmount.times(feeRate);
    const finalWithdrawAmount = withdrawAmount.minus(feeAmount);
    console.log(
      `Withdraw fee (5%): ${feeAmount}, final withdraw amount: ${finalWithdrawAmount}`
    );

    const updatedEconomy = await tx.economy.update({
      where: {
        guildId_userId: {
          guildId,
          userId,
        },
      },
      data: {
        balance: {
          increment: finalWithdrawAmount,
        },
        bankBalance: isWithdrawingAll ? new Prisma.Decimal(0) : newBankBalance,
        bankDistributed: isWithdrawingAll
          ? new Prisma.Decimal(0)
          : newBankDistributed,
        bankRate: newBankRate,
        bankStartTime: newBankStartTime,
      },
    });

    if (feeAmount.greaterThan(0)) {
      await addToGuildVault(guildId, feeAmount, userId, "withdraw");
      console.log(`Added ${feeAmount} fee to guild vault for guild ${guildId}`);
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

    return updatedEconomy;
  });
}

export { addBalance, transferBalance, deposit, withdraw };
