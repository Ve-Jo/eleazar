type EconomyRecord = {
  upgradeDiscount?: number | string | null;
};

type EconomyDiscountClient = {
  economy: {
    findUnique: (args: unknown) => Promise<unknown>;
    upsert: (args: unknown) => Promise<unknown>;
    update: (args: unknown) => Promise<unknown>;
  };
};

type EnsureUserFn = (guildId: string, userId: string) => Promise<unknown>;

const MAX_UPGRADE_DISCOUNT = 30;

function clampUpgradeDiscount(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  if (value < 0) {
    return 0;
  }

  if (value > MAX_UPGRADE_DISCOUNT) {
    return MAX_UPGRADE_DISCOUNT;
  }

  return value;
}

async function getUpgradeDiscount(
  client: EconomyDiscountClient,
  guildId: string,
  userId: string
): Promise<number> {
  const economy = (await client.economy.findUnique({
    where: {
      guildId_userId: {
        guildId,
        userId,
      },
    },
  })) as EconomyRecord | null;

  if (!economy) {
    return 0;
  }

  return clampUpgradeDiscount(Number(economy.upgradeDiscount || 0));
}

async function addUpgradeDiscount(
  client: EconomyDiscountClient,
  ensureUser: EnsureUserFn,
  guildId: string,
  userId: string,
  discountPercent: number
): Promise<unknown> {
  await ensureUser(guildId, userId);

  const economy = (await client.economy.findUnique({
    where: {
      guildId_userId: {
        guildId,
        userId,
      },
    },
  })) as EconomyRecord | null;

  const currentDiscount = clampUpgradeDiscount(Number(economy?.upgradeDiscount || 0));
  const newDiscount = clampUpgradeDiscount(currentDiscount + discountPercent);

  return client.economy.upsert({
    where: {
      guildId_userId: {
        guildId,
        userId,
      },
    },
    create: {
      guildId,
      userId,
      upgradeDiscount: newDiscount,
    },
    update: {
      upgradeDiscount: newDiscount,
    },
  });
}

async function resetUpgradeDiscount(
  client: EconomyDiscountClient,
  guildId: string,
  userId: string
): Promise<unknown> {
  const economy = (await client.economy.findUnique({
    where: {
      guildId_userId: {
        guildId,
        userId,
      },
    },
  })) as EconomyRecord | null;

  if (!economy) {
    return null;
  }

  return client.economy.update({
    where: {
      guildId_userId: {
        guildId,
        userId,
      },
    },
    data: {
      upgradeDiscount: 0,
    },
  });
}

export { getUpgradeDiscount, addUpgradeDiscount, resetUpgradeDiscount };
