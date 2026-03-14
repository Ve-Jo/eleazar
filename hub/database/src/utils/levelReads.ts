type CalculateLevelFn = (xp: number | bigint) => {
  level: number;
  currentXP: number;
  requiredXP: number;
  totalXP: number;
};

type GetLevelDataFn = (
  guildId: string,
  userId: string
) => Promise<unknown>;

type GetStatsDataFn = (
  guildId: string,
  userId: string
) => Promise<unknown>;

type LevelDataShape = {
  xp: number | bigint;
  gameXp: number | bigint;
  seasonXp: number | bigint;
};

type StatsDataShape = {
  xpStats?: Record<string, unknown>;
  gameXpStats?: Record<string, unknown>;
};

async function getLevel(
  getLevelData: GetLevelDataFn,
  calculateLevel: CalculateLevelFn,
  guildId: string,
  userId: string,
  isGame = false
): Promise<ReturnType<CalculateLevelFn>> {
  const levelData = (await getLevelData(guildId, userId)) as LevelDataShape | null;

  if (!levelData) {
    return calculateLevel(0n);
  }

  return calculateLevel(isGame ? levelData.gameXp : levelData.xp);
}

async function getAllLevels(
  getLevelData: GetLevelDataFn,
  getStatsData: GetStatsDataFn,
  calculateLevel: CalculateLevelFn,
  guildId: string,
  userId: string
): Promise<{
  activity: ReturnType<CalculateLevelFn>;
  gaming: ReturnType<CalculateLevelFn>;
  season: ReturnType<CalculateLevelFn>;
  details: {
    activity: Record<string, unknown>;
    gaming: Record<string, unknown>;
  };
}> {
  const [level, stats] = (await Promise.all([
    getLevelData(guildId, userId),
    getStatsData(guildId, userId),
  ])) as [LevelDataShape | null, StatsDataShape | null];

  if (!level) {
    return {
      activity: calculateLevel(0n),
      gaming: calculateLevel(0n),
      season: calculateLevel(0n),
      details: {
        activity: {},
        gaming: {},
      },
    };
  }

  const activityDetails = stats?.xpStats || {};
  const gamingDetails = stats?.gameXpStats || {};

  return {
    activity: calculateLevel(level.xp),
    gaming: calculateLevel(level.gameXp),
    season: calculateLevel(level.seasonXp),
    details: { activity: activityDetails, gaming: gamingDetails },
  };
}

export { getLevel, getAllLevels };
