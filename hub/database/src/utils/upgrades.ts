type GetUserFn = (
  guildId: string,
  userId: string,
  includeRelations?: boolean
) => Promise<unknown>;

type GetUpgradeInfoFn = (type: string, level: number) => Promise<{ price: number }>;

type GetCooldownFn = (
  guildId: string,
  userId: string,
  type: string
) => Promise<number>;

type UpdateCooldownFn = (
  guildId: string,
  userId: string,
  type: string
) => Promise<unknown>;

type UpgradeClient = {
  upgrade: {
    deleteMany: (args: unknown) => Promise<unknown>;
    upsert: (args: unknown) => Promise<unknown>;
    findUnique: (args: unknown) => Promise<unknown>;
  };
  economy: {
    findUnique: (args: unknown) => Promise<unknown>;
  };
  $transaction: <T>(callback: (tx: UpgradeTransaction) => Promise<T>) => Promise<T>;
};

type UpgradeTransaction = {
  economy: {
    update: (args: unknown) => Promise<unknown>;
  };
  upgrade: {
    upsert: (args: unknown) => Promise<unknown>;
    delete: (args: unknown) => Promise<unknown>;
    update: (args: unknown) => Promise<unknown>;
  };
};

type UpgradeInput = Record<string, { level: number }>;

type UpgradeRecord = {
  level?: number;
};

type EconomyRecord = {
  balance?: number | string | bigint;
  upgradeDiscount?: number | string | bigint;
};

type UserWithUpgrades = {
  upgrades?: unknown;
};

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

async function updateUpgrades(
  client: UpgradeClient,
  guildId: string,
  userId: string,
  upgrades: UpgradeInput
): Promise<unknown[]> {
  const updatePromises = Object.entries(upgrades).map(([type, data]) => {
    if (data.level === 1) {
      return client.upgrade.deleteMany({
        where: {
          userId,
          guildId,
          type,
        },
      });
    }

    return client.upgrade.upsert({
      where: {
        guildId_userId_type: {
          guildId,
          userId,
          type,
        },
      },
      create: {
        userId,
        guildId,
        type,
        level: data.level,
      },
      update: {
        level: data.level,
      },
    });
  });

  return Promise.all(updatePromises);
}

async function purchaseUpgrade(
  client: UpgradeClient,
  getUpgradeInfo: GetUpgradeInfoFn,
  guildId: string,
  userId: string,
  type: string
): Promise<unknown> {
  const upgrade = (await client.upgrade.findUnique({
    where: {
      guildId_userId_type: {
        guildId,
        userId,
        type,
      },
    },
  })) as UpgradeRecord | null;

  const currentLevel = upgrade?.level || 1;
  const upgradeInfo = await getUpgradeInfo(type, currentLevel);

  const economy = (await client.economy.findUnique({
    where: {
      guildId_userId: {
        guildId,
        userId,
      },
    },
  })) as EconomyRecord | null;

  if (!economy) {
    throw new Error("User economy data not found");
  }

  const discountPercent = clampUpgradeDiscount(Number(economy.upgradeDiscount || 0));
  let finalPrice = upgradeInfo.price;

  if (discountPercent > 0) {
    finalPrice = Math.max(1, Math.floor(finalPrice * (1 - discountPercent / 100)));
  }

  if (Number(economy.balance) < finalPrice) {
    throw new Error("Insufficient balance");
  }

  return client.$transaction(async (tx) => {
    await tx.economy.update({
      where: {
        guildId_userId: {
          guildId,
          userId,
        },
      },
      data: {
        balance: {
          decrement: finalPrice,
        },
      },
    });

    if (discountPercent > 0) {
      await tx.economy.update({
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

    return tx.upgrade.upsert({
      where: {
        guildId_userId_type: {
          guildId,
          userId,
          type,
        },
      },
      create: {
        userId,
        guildId,
        type,
        level: 2,
      },
      update: {
        level: {
          increment: 1,
        },
      },
    });
  });
}

async function getUserUpgrades(
  getUser: GetUserFn,
  guildId: string,
  userId: string
): Promise<unknown> {
  const user = (await getUser(guildId, userId, true)) as UserWithUpgrades | null;
  return user?.upgrades || [];
}

async function revertUpgrade(
  client: UpgradeClient,
  getCooldown: GetCooldownFn,
  getUpgradeInfo: GetUpgradeInfoFn,
  updateCooldown: UpdateCooldownFn,
  guildId: string,
  userId: string,
  type: string
): Promise<{ previousLevel: number; newLevel: number; refundAmount: number }> {
  const revertCooldown = await getCooldown(guildId, userId, "upgraderevert");
  if (revertCooldown > 0) {
    throw new Error(`Cooldown active: ${revertCooldown}`);
  }

  const upgrade = (await client.upgrade.findUnique({
    where: {
      guildId_userId_type: {
        guildId,
        userId,
        type,
      },
    },
  })) as UpgradeRecord | null;

  const currentLevel = upgrade?.level || 1;
  if (currentLevel <= 1) {
    throw new Error("Cannot revert a level 1 upgrade");
  }

  // Refund is based on the most recently purchased tier price.
  const lastPaidTierLevel = Math.max(1, currentLevel - 1);
  const upgradeInfo = await getUpgradeInfo(type, lastPaidTierLevel);
  const refundAmount = Math.floor(upgradeInfo.price * 0.85);

  return client.$transaction(async (tx) => {
    await tx.economy.update({
      where: {
        guildId_userId: {
          guildId,
          userId,
        },
      },
      data: {
        balance: {
          increment: refundAmount,
        },
      },
    });

    if (currentLevel === 2) {
      await tx.upgrade.delete({
        where: {
          guildId_userId_type: {
            guildId,
            userId,
            type,
          },
        },
      });
    } else {
      await tx.upgrade.update({
        where: {
          guildId_userId_type: {
            guildId,
            userId,
            type,
          },
        },
        data: {
          level: {
            decrement: 1,
          },
        },
      });
    }

    await updateCooldown(guildId, userId, "upgraderevert");

    return {
      previousLevel: currentLevel,
      newLevel: currentLevel - 1,
      refundAmount,
    };
  });
}

export { updateUpgrades, purchaseUpgrade, getUserUpgrades, revertUpgrade };
