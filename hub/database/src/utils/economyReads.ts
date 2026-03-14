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

async function getBalance(
  getUser: GetUserFn,
  guildId: string,
  userId: string
): Promise<Prisma.Decimal> {
  try {
    const user = (await getUser(guildId, userId)) as UserWithEconomy | null;
    return user?.economy?.balance || new Prisma.Decimal(0);
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

    const bankBalance = user.economy.bankBalance || new Prisma.Decimal(0);
    const bankDistributed = user.economy.bankDistributed || new Prisma.Decimal(0);

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
