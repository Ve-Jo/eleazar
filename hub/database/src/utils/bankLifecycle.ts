import { Prisma } from "@prisma/client";
import { UPGRADES } from "../constants/database.ts";

// Bank constants
const BASE_BANK_MAX_INACTIVE_MS = 2 * 60 * 60 * 1000; // 2 hours base
const MAX_BANK_MAX_INACTIVE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days cap
const BASE_ANNUAL_RATE = 0.01; // 1% base annual rate
const MAX_ANNUAL_RATE = 0.50; // 50% cap
const CHAT_LEVEL_RATE_BONUS = 0.01; // +1% per chat level
const VOICE_LEVEL_RATE_BONUS = 0.01; // +1% per voice level
const GAME_LEVEL_RATE_BONUS = 0.005; // +0.5% per game level

type CalculateInterestDecimalFn = (
  principal: Prisma.Decimal,
  annualRate: Prisma.Decimal,
  timeMs: number
) => Prisma.Decimal;

type BankLifecycleClient = {
  $transaction: <T>(callback: (tx: BankLifecycleTransaction) => Promise<T>) => Promise<T>;
  economy: {
    findUnique: (args: unknown) => Promise<unknown>;
    update: (args: unknown) => Promise<unknown>;
  };
  upgrade: {
    findMany: (args: unknown) => Promise<unknown[]>;
  };
};

type BankLifecycleTransaction = {
  economy: {
    findUnique: (args: unknown) => Promise<unknown>;
    update: (args: unknown) => Promise<unknown>;
  };
  user: {
    update: (args: unknown) => Promise<unknown>;
  };
};

type CurrentBankRecord = {
  bankBalance: Prisma.Decimal;
  bankRate: Prisma.Decimal;
  bankStartTime: number | bigint | string;
  bankCycle: number;
  user: {
    lastActivity: number | bigint | string;
    Level?: {
      xp: number | bigint;
      voiceXp: number | bigint;
      gameXp: number | bigint;
    } | null;
  };
};

type BankUserShape = {
  guildId: string;
  id: string;
  lastActivity: number | bigint | string;
  economy?: {
    bankBalance?: Prisma.Decimal | null;
  } | null;
};

type EconomyBankRecord = {
  bankBalance: Prisma.Decimal;
  bankRate: Prisma.Decimal;
  bankStartTime: number | bigint | string;
  bankCycle: number;
};

type UpgradeRecord = {
  type: string;
  level: number;
};

type BankResult = {
  balance: Prisma.Decimal;
  cycleComplete: boolean;
  cycleCount: number;
  maxInactiveMs: number;
  timeIntoCycle: number;
  annualRate: number;
};

/**
 * Calculate level from XP: level = floor(sqrt(xp/100)) + 1
 */
function calculateLevelFromXp(xp: number | bigint): number {
  const xpNumber = typeof xp === "bigint" ? Number(xp) : xp;
  if (xpNumber < 100) return 1;
  return Math.floor(Math.sqrt(xpNumber / 100)) + 1;
}

/**
 * Calculate bank annual interest rate based on activity levels
 */
function calculateBankRateFromLevels(
  chatLevel: number,
  voiceLevel: number,
  gameLevel: number
): number {
  const rate =
    BASE_ANNUAL_RATE +
    (chatLevel - 1) * CHAT_LEVEL_RATE_BONUS +
    (voiceLevel - 1) * VOICE_LEVEL_RATE_BONUS +
    (gameLevel - 1) * GAME_LEVEL_RATE_BONUS;
  return Math.min(MAX_ANNUAL_RATE, rate);
}

/**
 * Calculate max inactive time (cycle duration) based on bank_vault upgrade level
 */
function calculateMaxInactiveMs(bankVaultLevel: number): number {
  const maxInactive =
    BASE_BANK_MAX_INACTIVE_MS +
    (bankVaultLevel - 1) * UPGRADES.bank_vault.effectValue;
  return Math.min(MAX_BANK_MAX_INACTIVE_MS, maxInactive);
}

/**
 * Continue bank interest - resets timer for next cycle without changing balance
 * Returns true if a cycle was completed and interest added
 */
async function continueBankBalance(
  client: BankLifecycleClient,
  calculateInterestDecimal: CalculateInterestDecimalFn,
  guildId: string,
  userId: string
): Promise<{ success: boolean; interestAdded: Prisma.Decimal; newCycle: number }> {
  return client.$transaction(async (db) => {
    const currentBank = (await db.economy.findUnique({
      where: {
        guildId_userId: {
          guildId,
          userId,
        },
      },
      include: {
        user: {
          include: {
            Level: true,
          },
        },
      },
    })) as CurrentBankRecord | null;

    if (!currentBank || currentBank.bankBalance.lessThanOrEqualTo(0)) {
      return { success: false, interestAdded: new Prisma.Decimal(0), newCycle: 0 };
    }

    // Calculate activity-based bank rate
    const chatLevel = calculateLevelFromXp(currentBank.user.Level?.xp || 0);
    const voiceLevel = calculateLevelFromXp(currentBank.user.Level?.voiceXp || 0);
    const gameLevel = calculateLevelFromXp(currentBank.user.Level?.gameXp || 0);
    const annualRate = calculateBankRateFromLevels(chatLevel, voiceLevel, gameLevel);
    const bankRate = new Prisma.Decimal(annualRate);

    // Get bank_vault upgrade for cycle duration
    const upgrades = (await client.upgrade.findMany({
      where: { userId, guildId },
    })) as UpgradeRecord[];
    const bankVaultLevel =
      upgrades.find((u) => u.type === "bank_vault")?.level || 1;
    const cycleDuration = calculateMaxInactiveMs(bankVaultLevel);

    const now = Date.now();
    const cycleStartTime = Number(currentBank.bankStartTime);
    let interestAdded = new Prisma.Decimal(0);
    let newCycle = currentBank.bankCycle;

    // If timer was running, calculate and add interest for completed cycle(s)
    if (cycleStartTime > 0) {
      const timeElapsed = now - cycleStartTime;
      const completedCycles = Math.floor(timeElapsed / cycleDuration);
      
      if (completedCycles > 0) {
        // Add interest for each completed cycle
        let balance = currentBank.bankBalance;
        for (let i = 0; i < completedCycles; i++) {
          balance = calculateInterestDecimal(balance, bankRate, cycleDuration);
        }
        interestAdded = balance.minus(currentBank.bankBalance);
        newCycle = currentBank.bankCycle + completedCycles;
        
        await db.economy.update({
          where: {
            guildId_userId: {
              guildId,
              userId,
            },
          },
          data: {
            bankBalance: balance,
            bankCycle: newCycle,
            bankStartTime: now, // Start fresh cycle
          },
        });
        
        return { success: true, interestAdded, newCycle };
      }
    }

    // No cycles completed - just reset timer to continue
    await db.economy.update({
      where: {
        guildId_userId: {
          guildId,
          userId,
        },
      },
      data: {
        bankStartTime: now, // Reset timer to start fresh cycle
      },
    });

    return { success: true, interestAdded: new Prisma.Decimal(0), newCycle };
  });
}

async function updateBankBalance(
  client: BankLifecycleClient,
  calculateInterestDecimal: CalculateInterestDecimalFn,
  guildId: string,
  userId: string
): Promise<unknown> {
  return client.$transaction(async (db) => {
    const currentBank = (await db.economy.findUnique({
      where: {
        guildId_userId: {
          guildId,
          userId,
        },
      },
      include: {
        user: {
          include: {
            Level: true,
          },
        },
      },
    })) as CurrentBankRecord | null;

    if (!currentBank) {
      return null;
    }

    let finalBalance = currentBank.bankBalance;
    let finalStartTime = currentBank.bankStartTime;
    let finalCycle = currentBank.bankCycle;

    if (finalBalance.lessThanOrEqualTo(0)) {
      finalBalance = new Prisma.Decimal(0);
      finalStartTime = 0;
      finalCycle = 0;
    }

    if (finalBalance.greaterThan(0) && Number(currentBank.bankStartTime) > 0) {
      // Calculate activity-based bank rate
      const chatLevel = calculateLevelFromXp(currentBank.user.Level?.xp || 0);
      const voiceLevel = calculateLevelFromXp(currentBank.user.Level?.voiceXp || 0);
      const gameLevel = calculateLevelFromXp(currentBank.user.Level?.gameXp || 0);
      const annualRate = calculateBankRateFromLevels(chatLevel, voiceLevel, gameLevel);
      const bankRate = new Prisma.Decimal(annualRate);

      // Get bank_vault upgrade for cycle duration
      const upgrades = (await client.upgrade.findMany({
        where: { userId, guildId },
      })) as UpgradeRecord[];
      const bankVaultLevel =
        upgrades.find((u) => u.type === "bank_vault")?.level || 1;
      const cycleDuration = calculateMaxInactiveMs(bankVaultLevel);

      const now = Date.now();
      const timeElapsed = now - Number(currentBank.bankStartTime);
      const completedCycles = Math.floor(timeElapsed / cycleDuration);

      if (completedCycles > 0) {
        // Add interest for completed cycles
        for (let i = 0; i < completedCycles; i++) {
          finalBalance = calculateInterestDecimal(finalBalance, bankRate, cycleDuration);
        }
        finalCycle = currentBank.bankCycle + completedCycles;
        finalStartTime = now;
      }
    }

    const updated = await db.economy.update({
      where: {
        guildId_userId: {
          guildId,
          userId,
        },
      },
      data: {
        bankBalance: finalBalance,
        bankStartTime: finalStartTime,
        bankCycle: finalCycle,
      },
    });

    await db.user.update({
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

    return updated;
  });
}

async function calculateBankBalance(
  client: BankLifecycleClient,
  calculateInterestDecimal: CalculateInterestDecimalFn,
  user: BankUserShape & { Level?: { xp: number | bigint; voiceXp: number | bigint; gameXp: number | bigint } | null },
  tx: BankLifecycleTransaction | null = null
): Promise<BankResult> {
  const defaultResult: BankResult = {
    balance: new Prisma.Decimal(0),
    cycleComplete: false,
    cycleCount: 0,
    maxInactiveMs: 0,
    timeIntoCycle: 0,
    annualRate: 0,
  };

  if (!user.economy?.bankBalance) {
    return defaultResult;
  }

  const bankBalance = new Prisma.Decimal(user.economy.bankBalance);

  if (bankBalance.lessThanOrEqualTo(0)) {
    return defaultResult;
  }

  const dbClient = tx || client;

  const currentBank = (await dbClient.economy.findUnique({
    where: {
      guildId_userId: {
        guildId: user.guildId,
        userId: user.id,
      },
    },
  })) as EconomyBankRecord | null;

  if (!currentBank) {
    return defaultResult;
  }

  if (!currentBank.bankStartTime) {
    return {
      balance: currentBank.bankBalance,
      cycleComplete: false,
      cycleCount: currentBank.bankCycle,
      maxInactiveMs: 0,
      timeIntoCycle: 0,
      annualRate: 0,
    };
  }

  // Calculate activity-based bank rate
  const chatLevel = calculateLevelFromXp(user.Level?.xp || 0);
  const voiceLevel = calculateLevelFromXp(user.Level?.voiceXp || 0);
  const gameLevel = calculateLevelFromXp(user.Level?.gameXp || 0);
  const annualRate = calculateBankRateFromLevels(chatLevel, voiceLevel, gameLevel);
  const bankRate = new Prisma.Decimal(annualRate);

  // Get bank_vault upgrade for cycle duration
  const upgrades = (await client.upgrade.findMany({
    where: { userId: user.id, guildId: user.guildId },
  })) as UpgradeRecord[];
  const bankVaultLevel =
    upgrades.find((u) => u.type === "bank_vault")?.level || 1;
  const cycleDuration = calculateMaxInactiveMs(bankVaultLevel);

  const now = Date.now();
  const timeElapsed = now - Number(currentBank.bankStartTime);
  const completedCycles = Math.floor(timeElapsed / cycleDuration);
  const timeIntoCycle = timeElapsed % cycleDuration;

  if (completedCycles > 0) {
    // Cycle(s) completed - calculate interest
    let finalBalance = currentBank.bankBalance;
    for (let i = 0; i < completedCycles; i++) {
      finalBalance = calculateInterestDecimal(finalBalance, bankRate, cycleDuration);
    }

    await dbClient.economy.update({
      where: {
        guildId_userId: {
          guildId: user.guildId,
          userId: user.id,
        },
      },
      data: {
        bankBalance: finalBalance,
        bankCycle: currentBank.bankCycle + completedCycles,
        bankStartTime: now,
      },
    });

    return {
      balance: finalBalance,
      cycleComplete: true,
      cycleCount: currentBank.bankCycle + completedCycles,
      maxInactiveMs: cycleDuration,
      timeIntoCycle: 0,
      annualRate,
    };
  }

  // Calculate current balance with partial interest
  const calculatedBalance = calculateInterestDecimal(
    currentBank.bankBalance,
    bankRate,
    timeElapsed
  );

  return {
    balance: calculatedBalance,
    cycleComplete: false,
    cycleCount: currentBank.bankCycle,
    maxInactiveMs: cycleDuration,
    timeIntoCycle,
    annualRate,
  };
}

export { updateBankBalance, calculateBankBalance, continueBankBalance };
