import { Prisma } from "@prisma/client";
import { BANK_MAX_INACTIVE_MS } from "../constants/database.ts";

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
  user: {
    lastActivity: number | bigint | string;
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
};

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
        user: true,
      },
    })) as CurrentBankRecord | null;

    if (!currentBank) {
      return null;
    }

    let finalBalance = currentBank.bankBalance;
    let finalRate = currentBank.bankRate;
    let finalStartTime = currentBank.bankStartTime;

    if (finalBalance.lessThanOrEqualTo(0)) {
      finalBalance = new Prisma.Decimal(0);
      finalRate = new Prisma.Decimal(0);
      finalStartTime = 0;
    }

    if (
      finalBalance.greaterThan(0) &&
      Number(currentBank.bankStartTime) > 0 &&
      currentBank.bankRate.greaterThan(0)
    ) {
      const now = Date.now();
      const inactiveTime = now - Number(currentBank.user.lastActivity);

      if (inactiveTime > BANK_MAX_INACTIVE_MS) {
        finalBalance = calculateInterestDecimal(
          currentBank.bankBalance,
          currentBank.bankRate,
          BANK_MAX_INACTIVE_MS
        );
        finalRate = new Prisma.Decimal(0);
        finalStartTime = 0;
      } else {
        const timeElapsed = now - Number(currentBank.bankStartTime);
        finalBalance = calculateInterestDecimal(
          currentBank.bankBalance,
          currentBank.bankRate,
          timeElapsed
        );
        finalRate = currentBank.bankRate;
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
        bankRate: finalRate,
        bankStartTime: finalStartTime,
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
  user: BankUserShape,
  tx: BankLifecycleTransaction | null = null
): Promise<Prisma.Decimal | string> {
  if (!user.economy?.bankBalance) {
    return "0.00000";
  }

  const bankBalance = new Prisma.Decimal(user.economy.bankBalance);

  if (bankBalance.lessThanOrEqualTo(0)) {
    return "0.00000";
  }

  const inactiveTime = Date.now() - Number(user.lastActivity);
  const currentTime = Date.now();
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
    return "0.00000";
  }

  if (!currentBank.bankStartTime || !currentBank.bankRate) {
    return currentBank.bankBalance;
  }

  if (inactiveTime > BANK_MAX_INACTIVE_MS) {
    const finalBalance = calculateInterestDecimal(
      currentBank.bankBalance,
      currentBank.bankRate,
      BANK_MAX_INACTIVE_MS
    );

    await dbClient.economy.update({
      where: {
        guildId_userId: {
          guildId: user.guildId,
          userId: user.id,
        },
      },
      data: {
        bankBalance: finalBalance,
        bankRate: new Prisma.Decimal(0),
        bankStartTime: 0,
      },
    });

    return finalBalance;
  }

  const timeElapsed = currentTime - Number(currentBank.bankStartTime);
  return calculateInterestDecimal(
    currentBank.bankBalance,
    currentBank.bankRate,
    timeElapsed
  );
}

export { updateBankBalance, calculateBankBalance };
