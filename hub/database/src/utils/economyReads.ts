import { Prisma } from "@prisma/client";

type EconomyShape = {
  balance?: Prisma.Decimal | null;
  bankBalance?: Prisma.Decimal | null;
  bankDistributed?: Prisma.Decimal | null;
};

type UserWithEconomy = {
  economy?: EconomyShape | null;
};

type GetUserFn = (
  guildId: string,
  userId: string
) => Promise<unknown>;

function toDecimal(value: unknown): Prisma.Decimal {
  if (value instanceof Prisma.Decimal) {
    return value;
  }

  try {
    if (value === null || value === undefined || value === "") {
      return new Prisma.Decimal(0);
    }
    if (typeof value === "bigint") {
      return new Prisma.Decimal(value.toString());
    }
    return new Prisma.Decimal(value as string | number);
  } catch {
    return new Prisma.Decimal(0);
  }
}

async function getBalance(
  getUser: GetUserFn,
  guildId: string,
  userId: string
): Promise<Prisma.Decimal> {
  try {
    const user = (await getUser(guildId, userId)) as UserWithEconomy | null;
    return toDecimal(user?.economy?.balance);
  } catch (error) {
    console.error(
      `Error getting balance for user ${userId} in guild ${guildId}:`,
      error
    );
    return new Prisma.Decimal(0);
  }
}

async function getTotalBankBalance(
  getUser: GetUserFn,
  guildId: string,
  userId: string
): Promise<Prisma.Decimal> {
  try {
    const user = (await getUser(guildId, userId)) as UserWithEconomy | null;

    if (!user?.economy) {
      return new Prisma.Decimal(0);
    }

    const bankBalance = toDecimal(user.economy.bankBalance);
    const bankDistributed = toDecimal(user.economy.bankDistributed);

    return bankBalance.plus(bankDistributed);
  } catch (error) {
    console.error(
      `Error getting total bank balance for user ${userId} in guild ${guildId}:`,
      error
    );
    return new Prisma.Decimal(0);
  }
}

export { getBalance, getTotalBankBalance };
