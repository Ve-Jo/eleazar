type StatisticsReadsClient = {
  level: {
    findUnique: (args: unknown) => Promise<unknown>;
  };
  statistics: {
    findUnique: (args: unknown) => Promise<unknown>;
  };
};

type GameRecordsShape = {
  "2048"?: {
    highScore?: number | string | null;
  };
  snake?: {
    highScore?: number | string | null;
  };
};

type StatisticsRecord = {
  gameRecords?: GameRecordsShape | null;
};

async function getLevelData(
  client: StatisticsReadsClient,
  guildId: string,
  userId: string
): Promise<unknown> {
  try {
    return await client.level.findUnique({
      where: {
        guildId_userId: { guildId, userId },
      },
    });
  } catch (error) {
    console.error("Error getting level data:", error);
    return null;
  }
}

async function getStatsData(
  client: StatisticsReadsClient,
  guildId: string,
  userId: string
): Promise<unknown> {
  try {
    return await client.statistics.findUnique({
      where: {
        guildId_userId: { guildId, userId },
      },
    });
  } catch (error) {
    console.error("Error getting statistics data:", error);
    return null;
  }
}

async function getStatistics(
  client: StatisticsReadsClient,
  userId: string,
  guildId: string
): Promise<unknown> {
  try {
    return await client.statistics.findUnique({
      where: {
        guildId_userId: { guildId, userId },
      },
    });
  } catch (error) {
    console.error("Error getting statistics:", error);
    return null;
  }
}

async function getGameRecords(
  getStatsDataFn: (guildId: string, userId: string) => Promise<unknown>,
  guildId: string,
  userId: string
): Promise<{ "2048": { highScore: number }; snake: { highScore: number } }> {
  const stats = (await getStatsDataFn(guildId, userId)) as StatisticsRecord | null;

  if (!stats) {
    return { "2048": { highScore: 0 }, snake: { highScore: 0 } };
  }

  return {
    "2048": { highScore: Number(stats?.gameRecords?.["2048"]?.highScore || 0) },
    snake: { highScore: Number(stats?.gameRecords?.snake?.highScore || 0) },
  };
}

export { getLevelData, getStatsData, getStatistics, getGameRecords };
