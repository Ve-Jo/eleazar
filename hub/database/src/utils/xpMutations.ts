type LevelRole = {
  roleId: string;
  requiredLevel: number;
};

type LevelUpInfo = {
  oldLevel: number;
  newLevel: number;
  levelUp: true;
  assignedRole?: string | null;
  removedRoles?: string[];
};

type CheckLevelUpFn = (
  oldXp: number | bigint,
  newXp: number | bigint
) => LevelUpInfo | null;

type GetLevelRolesFn = (guildId: string) => Promise<LevelRole[]>;

type CheckAndUpdateSeasonFn = () => Promise<unknown>;

type XpClient = {
  $transaction: <T>(callback: (tx: XpTransaction) => Promise<T>) => Promise<T>;
};

type XpTransaction = {
  level: {
    findUnique: (args: unknown) => Promise<unknown>;
    upsert: (args: unknown) => Promise<unknown>;
  };
  guild: {
    findUnique: (args: unknown) => Promise<unknown>;
  };
  statistics: {
    findUnique: (args: unknown) => Promise<unknown>;
    update: (args: unknown) => Promise<unknown>;
    create: (args: unknown) => Promise<unknown>;
  };
};

type ExistingLevelRecord = {
  xp?: bigint;
  gameXp?: bigint;
};

type ExistingStatsRecord = {
  xpStats?: Record<string, number> & { updateMode?: unknown };
  gameXpStats?: Record<string, number> & { updateMode?: unknown };
};

async function resolveLevelRoleChanges(
  tx: XpTransaction,
  getLevelRoles: GetLevelRolesFn,
  guildId: string,
  userId: string,
  levelUpInfo: LevelUpInfo | null
): Promise<LevelUpInfo | null> {
  if (!levelUpInfo) {
    return null;
  }

  let assignedRole: string | null = null;
  let removedRoles: string[] = [];

  try {
    const guild = await tx.guild.findUnique({
      where: { id: guildId },
      select: { id: true },
    });

    if (guild) {
      const allLevelRoles = await getLevelRoles(guildId);
      const highestEligibleRole = allLevelRoles
        .filter((role) => role.requiredLevel <= levelUpInfo.newLevel)
        .sort((a, b) => b.requiredLevel - a.requiredLevel)[0];

      if (highestEligibleRole) {
        assignedRole = highestEligibleRole.roleId;
        removedRoles = allLevelRoles
          .filter((role) => role.requiredLevel < highestEligibleRole.requiredLevel)
          .map((role) => role.roleId);
      }
    }
  } catch (roleError) {
    console.error(
      `Error fetching/determining level roles for ${userId} in ${guildId}:`,
      roleError
    );
  }

  levelUpInfo.assignedRole = assignedRole;
  levelUpInfo.removedRoles = removedRoles;
  return levelUpInfo;
}

async function addXP(
  client: XpClient,
  checkAndUpdateSeason: CheckAndUpdateSeasonFn,
  checkLevelUp: CheckLevelUpFn,
  getLevelRoles: GetLevelRolesFn,
  guildId: string,
  userId: string,
  amount: number,
  type = "chat"
): Promise<unknown> {
  if (amount <= 0) {
    return {
      level: {
        userId,
        guildId,
        xp: 0n,
        seasonXp: 0n,
      },
      stats: {
        userId,
        guildId,
        xpStats: { [type]: 0 },
      },
      levelUp: null,
    };
  }

  return client.$transaction(async (tx) => {
    await checkAndUpdateSeason();

    const existingLevel = (await tx.level.findUnique({
      where: {
        guildId_userId: {
          guildId,
          userId,
        },
      },
    })) as ExistingLevelRecord | null;

    const currentXp = existingLevel?.xp || 0n;

    const updatedLevel = await tx.level.upsert({
      where: {
        guildId_userId: {
          guildId,
          userId,
        },
      },
      create: {
        guildId,
        userId,
        xp: amount,
        seasonXp: amount,
      },
      update: {
        xp: { increment: amount },
        seasonXp: { increment: amount },
      },
    });

    let levelUpInfo = checkLevelUp(currentXp, (updatedLevel as { xp: bigint }).xp);
    levelUpInfo = await resolveLevelRoleChanges(
      tx,
      getLevelRoles,
      guildId,
      userId,
      levelUpInfo
    );

    const existingStats = (await tx.statistics.findUnique({
      where: {
        guildId_userId: {
          guildId,
          userId,
        },
      },
    })) as ExistingStatsRecord | null;

    let stats;
    if (existingStats) {
      const currentXpStats =
        existingStats.xpStats &&
        typeof existingStats.xpStats === "object" &&
        !existingStats.xpStats.updateMode
          ? existingStats.xpStats
          : {};

      currentXpStats[type] = (currentXpStats[type] || 0) + amount;

      stats = await tx.statistics.update({
        where: {
          guildId_userId: {
            guildId,
            userId,
          },
        },
        data: {
          xpStats: currentXpStats,
        },
      });
    } else {
      stats = await tx.statistics.create({
        data: {
          guildId,
          userId,
          xpStats: { [type]: amount },
        },
      });
    }

    return { level: updatedLevel, stats, levelUp: levelUpInfo, type: "chat" };
  });
}

async function addGameXP(
  client: XpClient,
  checkAndUpdateSeason: CheckAndUpdateSeasonFn,
  checkLevelUp: CheckLevelUpFn,
  getLevelRoles: GetLevelRolesFn,
  guildId: string,
  userId: string,
  gameType: string,
  amount: number
): Promise<unknown> {
  if (amount <= 0) {
    return {
      level: {
        userId,
        guildId,
        gameXp: 0n,
        seasonXp: 0n,
      },
      stats: {
        userId,
        guildId,
        gameXpStats: { [gameType]: 0 },
      },
      levelUp: null,
    };
  }

  return client.$transaction(async (tx) => {
    await checkAndUpdateSeason();

    const existingLevel = (await tx.level.findUnique({
      where: {
        guildId_userId: {
          guildId,
          userId,
        },
      },
    })) as ExistingLevelRecord | null;

    const currentGameXp = existingLevel?.gameXp || 0n;

    const level = await tx.level.upsert({
      where: {
        guildId_userId: {
          guildId,
          userId,
        },
      },
      create: {
        userId,
        guildId,
        gameXp: amount,
        seasonXp: amount,
      },
      update: {
        gameXp: { increment: amount },
        seasonXp: { increment: amount },
      },
    });

    let levelUp = checkLevelUp(currentGameXp, (level as { gameXp: bigint }).gameXp);
    levelUp = await resolveLevelRoleChanges(
      tx,
      getLevelRoles,
      guildId,
      userId,
      levelUp
    );

    const existingStats = (await tx.statistics.findUnique({
      where: {
        guildId_userId: {
          guildId,
          userId,
        },
      },
    })) as ExistingStatsRecord | null;

    let stats;
    if (existingStats) {
      const currentGameXpStats =
        existingStats.gameXpStats &&
        typeof existingStats.gameXpStats === "object" &&
        !existingStats.gameXpStats.updateMode
          ? existingStats.gameXpStats
          : {};

      currentGameXpStats[gameType] = (currentGameXpStats[gameType] || 0) + amount;

      stats = await tx.statistics.update({
        where: {
          guildId_userId: {
            guildId,
            userId,
          },
        },
        data: {
          gameXpStats: currentGameXpStats,
        },
      });
    } else {
      stats = await tx.statistics.create({
        data: {
          guildId,
          userId,
          gameXpStats: { [gameType]: amount },
        },
      });
    }

    return { level, stats, levelUp, type: gameType };
  });
}

export { addXP, addGameXP };
