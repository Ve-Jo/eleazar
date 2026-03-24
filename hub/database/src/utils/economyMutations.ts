import { Prisma } from "@prisma/client";
import { UPGRADES } from "../constants/database.ts";
import { getEconomyTuningConfig } from "../../../shared/src/economyTuning.ts";

// Bank constants
const BASE_BANK_MAX_INACTIVE_MS = 2 * 60 * 60 * 1000; // 2 hours base
const MAX_BANK_MAX_INACTIVE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days cap

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
  voiceXp?: unknown;
  gameXp?: unknown;
};

type UserEconomyShape = {
  balance: Prisma.Decimal;
  bankBalance: Prisma.Decimal;
  bankDistributed?: Prisma.Decimal | null;
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

function clampDecimalNonNegative(value: Prisma.Decimal): Prisma.Decimal {
  return value.lessThan(0) ? new Prisma.Decimal(0) : value;
}

function clampBankRate(value: Prisma.Decimal): Prisma.Decimal {
  const tuning = getEconomyTuningConfig();
  const maxRate = new Prisma.Decimal(
    Math.max(1, Number(tuning.bank.maxAnnualRatePercent || 50))
  );

  if (value.lessThan(0)) {
    return new Prisma.Decimal(0);
  }

  if (value.greaterThan(maxRate)) {
    return maxRate;
  }

  return value;
}

function calculateCycleDurationMs(bankVaultLevel: number): number {
  const tuning = getEconomyTuningConfig();
  const maxInactiveMs =
    BASE_BANK_MAX_INACTIVE_MS +
    Math.max(0, bankVaultLevel - 1) * UPGRADES.bank_vault.effectValue;
  const rolloutCycleCapMs = Math.max(
    BASE_BANK_MAX_INACTIVE_MS,
    Number(tuning.bank.maxCycleDurationMs || MAX_BANK_MAX_INACTIVE_MS)
  );
  const effectiveCycleCapMs = Math.min(MAX_BANK_MAX_INACTIVE_MS, rolloutCycleCapMs);

  return Math.min(effectiveCycleCapMs, maxInactiveMs);
}

function getElapsedWithinCycle(
  bankStartTime: number | bigint | string,
  cycleDurationMs: number
): number {
  const startTimeNumber = Number(bankStartTime);
  if (!Number.isFinite(startTimeNumber) || startTimeNumber <= 0) {
    return 0;
  }

  const elapsed = Math.max(0, Date.now() - startTimeNumber);
  return Math.min(elapsed, cycleDurationMs);
}

function calculateActivityBankRate(
  calculateLevel: CalculateLevelFn,
  levelData: UserLevelShape | null | undefined
): Prisma.Decimal {
  const tuning = getEconomyTuningConfig();
  const chatLevel = levelData ? calculateLevel(levelData.xp).level : 1;
  const voiceLevel = levelData ? calculateLevel(levelData.voiceXp).level : 1;
  const gameLevel = levelData ? calculateLevel(levelData.gameXp).level : 1;

  // 1% base + level bonuses (chat +1%, voice +1%, game +0.5% per level after level 1).
  const baseRate = new Prisma.Decimal(
    1 +
      (chatLevel - 1) +
      (voiceLevel - 1) +
      (gameLevel - 1) * 0.5
  );
  const rawRate = baseRate.times(
    Math.max(0.1, Number(tuning.faucets.bankInterestRateMultiplier || 1))
  );

  return clampBankRate(rawRate);
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
  const tuning = getEconomyTuningConfig();
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

    const userUpgrades = (await tx.upgrade.findMany({
      where: { guildId, userId },
    })) as UpgradeRecord[];
    const bankVaultLevel =
      userUpgrades.find((upgrade) => upgrade.type === "bank_vault")?.level || 1;
    const cycleDurationMs = calculateCycleDurationMs(bankVaultLevel);

    let currentBankBalance = user.economy.bankBalance;
    console.log(`Initial bank balance: ${currentBankBalance}`);

    if (
      Number(user.economy.bankStartTime) > 0 &&
      user.economy.bankRate.greaterThan(0)
    ) {
      const elapsedWithinCycle = getElapsedWithinCycle(
        user.economy.bankStartTime,
        cycleDurationMs
      );
      console.log(`Time elapsed in active cycle: ${elapsedWithinCycle}ms`);
      currentBankBalance = calculateInterestDecimal(
        currentBankBalance,
        user.economy.bankRate,
        elapsedWithinCycle
      );
      console.log(`Bank balance after cycle-capped interest: ${currentBankBalance}`);
    }

    const newBankRate = calculateActivityBankRate(calculateLevel, user.Level);
    console.log(`New bank rate calculated: ${newBankRate}`);

    // vault_guard provides fee reduction
    const vaultGuardLevel =
      userUpgrades.find((upgrade) => upgrade.type === "vault_guard")?.level || 1;
    const feeReduction = Math.min(
      0.5,
      (vaultGuardLevel - 1) * (UPGRADES.vault_guard.effectFees || 0)
    );
    const baseFeeRate = Math.min(
      0.3,
      Math.max(0.005, 0.05 * Number(tuning.sinks.bankFeeMultiplier || 1))
    );
    const feeRate = new Prisma.Decimal(baseFeeRate * (1 - feeReduction));
    const feeAmount = depositAmount.times(feeRate);
    const finalDepositAmount = depositAmount.minus(feeAmount);
    console.log(
      `Deposit fee (5%): ${feeAmount}, final deposit amount: ${finalDepositAmount}`
    );

    const finalBankBalance = currentBankBalance.plus(finalDepositAmount);
    console.log(`Final bank balance after deposit: ${finalBankBalance}`);

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
  const tuning = getEconomyTuningConfig();
  await ensureUser(guildId, userId);

  const requestAll = typeof amount === "string" && amount.trim().toLowerCase() === "all";
  let withdrawAmount = requestAll ? new Prisma.Decimal(0) : new Prisma.Decimal(amount);

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

    const userUpgrades = (await tx.upgrade.findMany({
      where: { guildId, userId },
    })) as UpgradeRecord[];
    const bankVaultLevel =
      userUpgrades.find((upgrade) => upgrade.type === "bank_vault")?.level || 1;
    const cycleDurationMs = calculateCycleDurationMs(bankVaultLevel);

    let currentBankBalance = user.economy.bankBalance;
    if (
      Number(user.economy.bankStartTime) > 0 &&
      user.economy.bankRate.greaterThan(0)
    ) {
      const timeElapsed = getElapsedWithinCycle(
        user.economy.bankStartTime,
        cycleDurationMs
      );
      currentBankBalance = calculateInterestDecimal(
        currentBankBalance,
        user.economy.bankRate,
        timeElapsed
      );
    }

    const bankDistributed = user.economy.bankDistributed || new Prisma.Decimal(0);
    const totalBankBalance = currentBankBalance.plus(bankDistributed);
    const epsilon = new Prisma.Decimal(0.00001);

    if (requestAll) {
      withdrawAmount = totalBankBalance;
    } else if (withdrawAmount.greaterThanOrEqualTo(totalBankBalance)) {
      withdrawAmount = totalBankBalance;
    } else if (totalBankBalance.minus(withdrawAmount).abs().lessThanOrEqualTo(epsilon)) {
      withdrawAmount = totalBankBalance;
    }

    if (withdrawAmount.lessThanOrEqualTo(0)) {
      throw new Error("Amount must be greater than zero");
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
    const isWithdrawingAll =
      requestAll || totalRemainingBalance.abs().lessThanOrEqualTo(epsilon);

    let newBankRate = new Prisma.Decimal(0);
    let newBankStartTime = 0;

    if (!isWithdrawingAll && newBankBalance.greaterThan(0)) {
      newBankRate = calculateActivityBankRate(calculateLevel, user.Level);
      newBankStartTime = Date.now();
    }

    // vault_guard provides fee reduction
    const vaultGuardLevel =
      userUpgrades.find((upgrade) => upgrade.type === "vault_guard")?.level || 1;
    const feeReduction = Math.min(
      0.5,
      (vaultGuardLevel - 1) * (UPGRADES.vault_guard.effectFees || 0)
    );
    const baseFeeRate = Math.min(
      0.3,
      Math.max(0.005, 0.05 * Number(tuning.sinks.bankFeeMultiplier || 1))
    );
    const feeRate = new Prisma.Decimal(baseFeeRate * (1 - feeReduction));
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
