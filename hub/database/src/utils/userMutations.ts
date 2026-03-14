import { DEFAULT_VALUES } from "../constants/database.ts";

type UserMutationClient = {
  guild: {
    upsert: (args: unknown) => Promise<unknown>;
  };
  user: {
    findUnique: (args: unknown) => Promise<unknown>;
    update: (args: unknown) => Promise<unknown>;
  };
  $transaction: <T>(callback: (tx: UserMutationTransaction) => Promise<T>) => Promise<T>;
};

type UserMutationTransaction = {
  user: {
    findUnique: (args: unknown) => Promise<unknown>;
    update: (args: unknown) => Promise<unknown>;
    create: (args: unknown) => Promise<unknown>;
  };
};

type GetUserFn = (
  guildId: string,
  userId: string
) => Promise<unknown>;

type CreateUserFn = (
  guildId: string,
  userId: string,
  data: Record<string, unknown>
) => Promise<unknown>;

type UpdateUpgradesFn = (
  guildId: string,
  userId: string,
  upgrades: unknown
) => Promise<unknown>;

type ErrorWithCode = {
  code?: string;
};

type UserDataInput = Record<string, unknown> & {
  economy?: Record<string, unknown>;
  level?: Record<string, unknown> & { xp?: number };
  cooldowns?: Record<string, unknown>;
  upgrades?: Record<string, { level?: number }>;
  stats?: Record<string, unknown>;
  lastActivity?: unknown;
};

function hasNonZeroValues(record: Record<string, unknown> | undefined): boolean {
  return !!record && Object.values(record).some((value) => value !== 0);
}

async function updateUser(
  client: UserMutationClient,
  getUser: GetUserFn,
  createUser: CreateUserFn,
  updateUpgrades: UpdateUpgradesFn,
  guildId: string,
  userId: string,
  data: Record<string, unknown>
): Promise<unknown> {
  const existingUser = await getUser(guildId, userId);
  if (!existingUser) {
    return createUser(guildId, userId, data);
  }

  const { economy, level, cooldowns, upgrades, ...userData } = data;
  const updateData: Record<string, unknown> = {
    lastActivity: Date.now(),
    ...userData,
  };

  if (economy) {
    updateData.economy = {
      upsert: {
        create: { ...(economy as Record<string, unknown>) },
        update: { ...(economy as Record<string, unknown>) },
      },
    };
  }

  if (level) {
    updateData.Level = {
      upsert: {
        create: { ...(level as Record<string, unknown>) },
        update: { ...(level as Record<string, unknown>) },
      },
    };
  }

  if (cooldowns) {
    updateData.cooldowns = {
      upsert: {
        create: { data: JSON.stringify(cooldowns) },
        update: { data: JSON.stringify(cooldowns) },
      },
    };
  }

  if (upgrades) {
    await updateUpgrades(guildId, userId, upgrades);
  }

  return client.user.update({
    where: {
      guildId_id: {
        guildId,
        id: userId,
      },
    },
    data: updateData,
    include: {
      economy: true,
      Level: true,
      cooldowns: true,
      upgrades: true,
    },
  });
}

async function createUser(
  client: UserMutationClient,
  updateUpgrades: UpdateUpgradesFn,
  guildId: string,
  userId: string,
  data: UserDataInput = {}
): Promise<unknown> {
  await client.guild.upsert({
    where: { id: guildId },
    create: { id: guildId, settings: {} },
    update: {},
  });

  const { economy, level, cooldowns, upgrades, stats, ...userData } = data;

  try {
    return await client.$transaction(async (tx) => {
      const existingUser = await tx.user.findUnique({
        where: {
          guildId_id: {
            guildId,
            id: userId,
          },
        },
      });

      if (existingUser) {
        const shouldUpdateUser =
          Object.keys(userData).length > 0 || Boolean(userData.lastActivity);

        let user;

        if (shouldUpdateUser) {
          user = await tx.user.update({
            where: {
              guildId_id: {
                guildId,
                id: userId,
              },
            },
            data: {
              lastActivity: Date.now(),
              ...userData,
              ...(hasNonZeroValues(economy)
                ? {
                    economy: {
                      upsert: {
                        create: {
                          balance: DEFAULT_VALUES.economy.balance,
                          bankBalance: DEFAULT_VALUES.economy.bankBalance,
                          bankRate: DEFAULT_VALUES.economy.bankRate,
                          bankStartTime: DEFAULT_VALUES.economy.bankStartTime,
                          ...economy,
                        },
                        update: {
                          ...economy,
                        },
                      },
                    },
                  }
                : {}),
              ...(hasNonZeroValues(stats)
                ? {
                    stats: {
                      upsert: {
                        create: {
                          totalEarned: 0,
                          messageCount: DEFAULT_VALUES.stats.messageCount,
                          commandCount: DEFAULT_VALUES.stats.commandCount,
                          lastUpdated: Date.now(),
                          gameRecords: JSON.stringify({
                            2048: { highScore: 0 },
                            snake: { highScore: 0 },
                          }),
                          ...stats,
                        },
                        update: {
                          ...stats,
                        },
                      },
                    },
                  }
                : {}),
              ...(level && Number(level.xp || 0) > 0
                ? {
                    Level: {
                      upsert: {
                        create: {
                          xp: 0,
                          ...level,
                        },
                        update: {
                          ...level,
                        },
                      },
                    },
                  }
                : {}),
              ...(cooldowns && Object.keys(cooldowns).length > 0
                ? {
                    cooldowns: {
                      upsert: {
                        create: {
                          data: JSON.stringify(DEFAULT_VALUES.cooldowns),
                          ...cooldowns,
                        },
                        update: {
                          ...cooldowns,
                        },
                      },
                    },
                  }
                : {}),
            },
            include: {
              economy: true,
              stats: true,
              Level: true,
              cooldowns: true,
              upgrades: true,
            },
          });
        } else {
          user = await tx.user.findUnique({
            where: {
              guildId_id: {
                guildId,
                id: userId,
              },
            },
            include: {
              economy: true,
              stats: true,
              Level: true,
              cooldowns: true,
              upgrades: true,
            },
          });
        }

        if (
          upgrades &&
          Object.values(upgrades).some((upgrade) => Number(upgrade.level || 0) > 1)
        ) {
          await updateUpgrades(guildId, userId, upgrades);
        }

        return user;
      }

      const hasNonDefaultEconomy = hasNonZeroValues(economy);
      const hasNonDefaultStats = hasNonZeroValues(stats);
      const hasNonDefaultLevel = !!level && Number(level.xp || 0) > 0;
      const hasNonDefaultCooldowns = !!cooldowns && Object.keys(cooldowns).length > 0;
      const hasNonDefaultUpgrades =
        !!upgrades &&
        Object.values(upgrades).some((upgrade) => Number(upgrade.level || 0) > 1);

      const createData: Record<string, unknown> = {
        id: userId,
        guildId,
        lastActivity: Date.now(),
        ...userData,
      };

      if (hasNonDefaultEconomy) {
        createData.economy = {
          create: {
            balance: DEFAULT_VALUES.economy.balance,
            bankBalance: DEFAULT_VALUES.economy.bankBalance,
            bankRate: DEFAULT_VALUES.economy.bankRate,
            bankStartTime: DEFAULT_VALUES.economy.bankStartTime,
            ...economy,
          },
        };
      }

      if (hasNonDefaultStats) {
        createData.stats = {
          create: {
            totalEarned: 0,
            messageCount: DEFAULT_VALUES.stats.messageCount,
            commandCount: DEFAULT_VALUES.stats.commandCount,
            lastUpdated: Date.now(),
            gameRecords: JSON.stringify({
              2048: { highScore: 0 },
              snake: { highScore: 0 },
            }),
            ...stats,
          },
        };
      }

      if (hasNonDefaultLevel) {
        createData.Level = {
          create: {
            xp: 0,
            ...level,
          },
        };
      }

      if (hasNonDefaultCooldowns) {
        createData.cooldowns = {
          create: {
            data: JSON.stringify(DEFAULT_VALUES.cooldowns),
            ...cooldowns,
          },
        };
      }

      if (hasNonDefaultUpgrades) {
        createData.upgrades = {
          create: Object.entries(upgrades || {})
            .filter(([, upgradeData]) => Number(upgradeData.level || 0) > 1)
            .map(([type, upgradeData]) => ({
              type,
              level: upgradeData.level,
            })),
        };
      }

      try {
        return await tx.user.create({
          data: createData,
          include: {
            economy: true,
            stats: true,
            Level: true,
            cooldowns: true,
            upgrades: true,
          },
        });
      } catch (error) {
        const typedError = error as ErrorWithCode;
        if (typedError.code === "P2002") {
          console.warn(`User ${userId} was created concurrently, fetching instead`);
          return tx.user.findUnique({
            where: {
              guildId_id: {
                guildId,
                id: userId,
              },
            },
            include: {
              economy: true,
              stats: true,
              Level: true,
              cooldowns: true,
              upgrades: true,
            },
          });
        }

        throw error;
      }
    });
  } catch (error) {
    console.error(
      `Error in createUser for userId ${userId} in guild ${guildId}:`,
      error
    );

    const existingUser = await client.user.findUnique({
      where: {
        guildId_id: {
          guildId,
          id: userId,
        },
      },
      include: {
        economy: true,
        stats: true,
        Level: true,
        cooldowns: true,
        upgrades: true,
      },
    });

    if (existingUser) {
      return existingUser;
    }

    throw error;
  }
}

export { updateUser, createUser };
