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
  voiceXp?: number | bigint;
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
  type: string = "activity"
): Promise<ReturnType<CalculateLevelFn>> {
  const levelData = (await getLevelData(guildId, userId)) as LevelDataShape | null;

  if (!levelData) {
    return calculateLevel(0n);
  }

  const normalizedType = String(type || "activity").toLowerCase();
  if (normalizedType === "gaming" || normalizedType === "game") {
    return calculateLevel(levelData.gameXp);
  }

  if (normalizedType === "voice") {
    return calculateLevel(levelData.voiceXp || 0n);
  }

  return calculateLevel(levelData.xp);
}

async function getAllLevels(
  getLevelData: GetLevelDataFn,
  getStatsData: GetStatsDataFn,
  calculateLevel: CalculateLevelFn,
  guildId: string,
  userId: string
): Promise<{
  text: ReturnType<CalculateLevelFn>;
  voice: ReturnType<CalculateLevelFn>;
  gaming: ReturnType<CalculateLevelFn>;
  season: ReturnType<CalculateLevelFn>;
  details: {
    text: Record<string, unknown>;
    voice: Record<string, unknown>;
    gaming: Record<string, unknown>;
  };
}> {
  const [level, stats] = (await Promise.all([
    getLevelData(guildId, userId),
    getStatsData(guildId, userId),
  ])) as [LevelDataShape | null, StatsDataShape | null];

  if (!level) {
    return {
      text: calculateLevel(0n),
      voice: calculateLevel(0n),
      gaming: calculateLevel(0n),
      season: calculateLevel(0n),
      details: {
        text: {},
        voice: {},
        gaming: {},
      },
    };
  }

  const textDetails = stats?.xpStats || {};
  const voiceDetails = stats?.xpStats || {};
  const gamingDetails = stats?.gameXpStats || {};

  return {
    text: calculateLevel(level.xp),
    voice: calculateLevel(level.voiceXp || 0n),
    gaming: calculateLevel(level.gameXp),
    season: calculateLevel(level.seasonXp),
    details: { text: textDetails, voice: voiceDetails, gaming: gamingDetails },
  };
}

export { getLevel, getAllLevels };
