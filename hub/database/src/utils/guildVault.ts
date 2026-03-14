import { Prisma } from "@prisma/client";

type GuildVaultClient = {
  guildVault: {
    upsert: (args: unknown) => Promise<unknown>;
    update: (args: unknown) => Promise<unknown>;
  };
  guildVaultDistribution: {
    findMany: (args: unknown) => Promise<unknown>;
  };
  $transaction: <T>(callback: (tx: GuildVaultTransaction) => Promise<T>) => Promise<T>;
};

type GuildVaultTransaction = {
  guildVault: {
    upsert: (args: unknown) => Promise<unknown>;
    update: (args: unknown) => Promise<unknown>;
  };
  guildVaultDistribution: {
    create: (args: unknown) => Promise<unknown>;
  };
  user: {
    findMany: (args: unknown) => Promise<unknown>;
  };
  economy: {
    update: (args: unknown) => Promise<unknown>;
  };
};

type GuildUserRecord = {
  id: string;
  economy?: {
    bankBalance?: Prisma.Decimal | number | null;
  } | null;
};

async function getOrCreateGuildVault(
  client: GuildVaultClient,
  guildId: string
): Promise<unknown> {
  return client.guildVault.upsert({
    where: { guildId },
    create: { guildId, balance: 0, totalFees: 0 },
    update: {},
  });
}

async function distributeGuildVaultFunds(
  tx: GuildVaultTransaction,
  guildId: string,
  excludedUserId: string,
  distributionAmount: Prisma.Decimal
): Promise<void> {
  try {
    const guildUsers = (await tx.user.findMany({
      where: { guildId },
      include: { economy: true },
    })) as GuildUserRecord[];

    const usersWithBankBalance = guildUsers.filter(
      (user) =>
        user.id !== excludedUserId &&
        user.economy &&
        Number(user.economy.bankBalance || 0) > 0
    );

    if (usersWithBankBalance.length === 0) {
      console.log(
        `No users with bank balance found in guild ${guildId} for distribution`
      );
      return;
    }

    if (!distributionAmount || distributionAmount.lessThanOrEqualTo(0)) {
      console.log(`No distribution amount provided for guild ${guildId}`);
      return;
    }

    const totalBankBalance = usersWithBankBalance.reduce(
      (sum, user) => sum + Number(user.economy?.bankBalance || 0),
      0
    );

    if (totalBankBalance <= 0) {
      console.log(`Total bank balance is 0 in guild ${guildId}`);
      return;
    }

    for (const user of usersWithBankBalance) {
      const userBankBalance = Number(user.economy?.bankBalance || 0);
      const userShare = new Prisma.Decimal(userBankBalance)
        .dividedBy(totalBankBalance)
        .times(distributionAmount);

      if (userShare.greaterThan(0)) {
        await tx.economy.update({
          where: {
            guildId_userId: {
              guildId,
              userId: user.id,
            },
          },
          data: {
            bankDistributed: {
              increment: userShare,
            },
          },
        });

        await tx.guildVaultDistribution.create({
          data: {
            guildId,
            userId: user.id,
            amount: userShare,
            source: "automatic",
            triggeredBy: excludedUserId,
          },
        });
      }
    }

    await tx.guildVault.update({
      where: { guildId },
      data: {
        balance: {
          decrement: distributionAmount,
        },
        lastDistribution: new Date(),
      },
    });

    console.log(
      `Distributed ${distributionAmount} to ${usersWithBankBalance.length} users in guild ${guildId}`
    );
  } catch (error) {
    console.error(
      `Error distributing guild vault funds for guild ${guildId}:`,
      error
    );
  }
}

async function addToGuildVault(
  client: GuildVaultClient,
  guildId: string,
  amount: Prisma.Decimal,
  userId: string,
  _operationType: string
): Promise<unknown> {
  return client.$transaction(async (tx) => {
    await tx.guildVault.upsert({
      where: { guildId },
      create: { guildId, balance: 0, totalFees: 0 },
      update: {},
    });

    const distributableAmount = amount.times(0.5);

    const updatedVault = await tx.guildVault.update({
      where: { guildId },
      data: {
        balance: {
          increment: amount,
        },
        totalFees: {
          increment: amount,
        },
      },
    });

    await distributeGuildVaultFunds(tx, guildId, userId, distributableAmount);

    return updatedVault;
  });
}

async function getGuildVaultDistributions(
  client: GuildVaultClient,
  guildId: string,
  limit = 10
): Promise<unknown> {
  return client.guildVaultDistribution.findMany({
    where: { guildId },
    orderBy: { distributionDate: "desc" },
    take: limit,
  });
}

async function getUserVaultDistributions(
  client: GuildVaultClient,
  guildId: string,
  userId: string,
  limit = 10
): Promise<unknown> {
  return client.guildVaultDistribution.findMany({
    where: {
      guildId,
      userId,
    },
    orderBy: { distributionDate: "desc" },
    take: limit,
  });
}

export {
  getOrCreateGuildVault,
  distributeGuildVaultFunds,
  addToGuildVault,
  getGuildVaultDistributions,
  getUserVaultDistributions,
};
