type LevelRole = {
  roleId: string;
  requiredLevel: number;
  mode?: string;
  replaceLowerRoles?: boolean;
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
  voiceXp?: bigint;
  gameXp?: bigint;
};

const MODE_TEXT = "text";
const MODE_VOICE = "voice";
const MODE_GAMING = "gaming";
const MODE_COMBINED_ACTIVITY = "combined_activity";
const MODE_COMBINED_ALL = "combined_all";

type LevelByMode = {
  text: number;
  voice: number;
  gaming: number;
};

function calculateLevelFromXpValue(xp: bigint): number {
  const xpNumber = Number(xp);
  if (xpNumber < 100) {
    return 1;
  }
  return Math.floor(Math.sqrt(xpNumber / 100)) + 1;
}

function getLevelForRoleMode(mode: string, levels: LevelByMode): number {
  switch (mode) {
    case MODE_TEXT:
      return levels.text;
    case MODE_VOICE:
      return levels.voice;
    case MODE_GAMING:
      return levels.gaming;
    case MODE_COMBINED_ACTIVITY:
      return levels.text + levels.voice;
    case MODE_COMBINED_ALL:
      return levels.text + levels.voice + levels.gaming;
    default:
      return levels.text;
  }
}

function shouldEvaluateModeForProgressType(mode: string, progressType: string): boolean {
  if (progressType === MODE_TEXT) {
    return mode === MODE_TEXT || mode === MODE_COMBINED_ACTIVITY || mode === MODE_COMBINED_ALL;
  }

  if (progressType === MODE_VOICE) {
    return mode === MODE_VOICE || mode === MODE_COMBINED_ACTIVITY || mode === MODE_COMBINED_ALL;
  }

  if (progressType === MODE_GAMING) {
    return mode === MODE_GAMING || mode === MODE_COMBINED_ALL;
  }

  return false;
}

type ExistingStatsRecord = {
  xpStats?: Record<string, number> & { updateMode?: unknown };
  gameXpStats?: Record<string, number> & { updateMode?: unknown };
};

async function resolveLevelRoleChanges(
  tx: XpTransaction,
  getLevelRoles: GetLevelRolesFn,
  guildId: string,
  userId: string,
  levelUpInfo: LevelUpInfo | null,
  currentLevels: LevelByMode,
  progressType: string
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

      const eligibleByMode = allLevelRoles
        .filter((role) => shouldEvaluateModeForProgressType(String(role.mode || MODE_TEXT), progressType))
        .filter((role) => {
          const mode = String(role.mode || MODE_TEXT);
          const modeLevel = getLevelForRoleMode(mode, currentLevels);
          return Number(role.requiredLevel || 0) <= modeLevel;
        })
        .sort((a, b) => Number(b.requiredLevel || 0) - Number(a.requiredLevel || 0));

      const highestEligibleRole = eligibleByMode[0];

      if (highestEligibleRole) {
        assignedRole = highestEligibleRole.roleId;
        if (highestEligibleRole.replaceLowerRoles !== false) {
          const targetMode = String(highestEligibleRole.mode || MODE_TEXT);
          removedRoles = allLevelRoles
            .filter((role) => String(role.mode || MODE_TEXT) === targetMode)
            .filter((role) => Number(role.requiredLevel || 0) < Number(highestEligibleRole.requiredLevel || 0))
            .map((role) => role.roleId);
        }
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
    const currentVoiceXp = existingLevel?.voiceXp || 0n;
    const currentGameXp = existingLevel?.gameXp || 0n;

    const shouldTrackVoice = String(type || "").toLowerCase() === MODE_VOICE;

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
        xp: shouldTrackVoice ? 0 : amount,
        voiceXp: shouldTrackVoice ? amount : 0,
        seasonXp: amount,
      },
      update: {
        ...(shouldTrackVoice
          ? { voiceXp: { increment: amount } }
          : { xp: { increment: amount } }),
        seasonXp: { increment: amount },
      },
    });

    const updatedLevelTyped = updatedLevel as { xp: bigint; voiceXp?: bigint; gameXp?: bigint };
    const updatedVoiceXp = updatedLevelTyped.voiceXp || 0n;
    const updatedGameXp = updatedLevelTyped.gameXp || 0n;

    const previousLevels: LevelByMode = {
      text: calculateLevelFromXpValue(currentXp),
      voice: calculateLevelFromXpValue(currentVoiceXp),
      gaming: calculateLevelFromXpValue(currentGameXp),
    };
    const newLevels: LevelByMode = {
      text: calculateLevelFromXpValue(updatedLevelTyped.xp),
      voice: calculateLevelFromXpValue(updatedVoiceXp),
      gaming: calculateLevelFromXpValue(updatedGameXp),
    };

    let levelUpInfo = shouldTrackVoice
      ? checkLevelUp(currentVoiceXp, updatedVoiceXp)
      : checkLevelUp(currentXp, updatedLevelTyped.xp);

    const didTextAdvance = newLevels.text > previousLevels.text;
    const didVoiceAdvance = newLevels.voice > previousLevels.voice;
    const progressType = didVoiceAdvance ? MODE_VOICE : didTextAdvance ? MODE_TEXT : MODE_TEXT;

    const resolvedLevelUpInfo = levelUpInfo;
    levelUpInfo = await resolveLevelRoleChanges(
      tx,
      getLevelRoles,
      guildId,
      userId,
      resolvedLevelUpInfo,
      newLevels,
      progressType
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

    return {
      level: updatedLevel,
      stats,
      levelUp: levelUpInfo,
      type: shouldTrackVoice ? MODE_VOICE : MODE_TEXT,
    };
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

    const currentXp = existingLevel?.xp || 0n;
    const currentVoiceXp = existingLevel?.voiceXp || 0n;
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

    const levelTyped = level as { xp?: bigint; voiceXp?: bigint; gameXp: bigint };
    const previousLevels: LevelByMode = {
      text: calculateLevelFromXpValue(currentXp),
      voice: calculateLevelFromXpValue(currentVoiceXp),
      gaming: calculateLevelFromXpValue(currentGameXp),
    };
    const newLevels: LevelByMode = {
      text: calculateLevelFromXpValue(levelTyped.xp || 0n),
      voice: calculateLevelFromXpValue(levelTyped.voiceXp || 0n),
      gaming: calculateLevelFromXpValue(levelTyped.gameXp),
    };

    let levelUp = checkLevelUp(currentGameXp, levelTyped.gameXp);
    levelUp = await resolveLevelRoleChanges(
      tx,
      getLevelRoles,
      guildId,
      userId,
      levelUp,
      newLevels,
      newLevels.gaming > previousLevels.gaming ? MODE_GAMING : MODE_GAMING
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
