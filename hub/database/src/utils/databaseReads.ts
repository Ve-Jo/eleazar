type ReadClient = {
  user: {
    findMany: (args: unknown) => Promise<unknown>;
  };
  seasonStats: {
    findMany: (args: unknown) => Promise<unknown>;
  };
  statistics: {
    findMany: (args: unknown) => Promise<unknown>;
  };
};

type GameLeaderboardCategory = "games" | "2048" | "snake";
type GameLeaderboardScope = "local" | "global";

type GameRecordsShape = {
  "2048"?: { highScore?: number | string | null };
  snake?: { highScore?: number | string | null };
};

type StatisticsRow = {
  userId: string;
  guildId: string;
  gameRecords?: GameRecordsShape | null;
};

type GameLeaderboardEntry = {
  id: string;
  userId: string;
  guildId?: string;
  score: number;
  stats: {
    gameRecords: {
      "2048": { highScore: number };
      snake: { highScore: number };
    };
  };
};

function getGameScores(records: GameRecordsShape | null | undefined): {
  score2048: number;
  scoreSnake: number;
  totalScore: number;
} {
  const score2048 = Number(records?.["2048"]?.highScore || 0);
  const scoreSnake = Number(records?.snake?.highScore || 0);
  return {
    score2048,
    scoreSnake,
    totalScore: score2048 + scoreSnake,
  };
}

function getCategoryScore(
  category: GameLeaderboardCategory,
  records: GameRecordsShape | null | undefined
): number {
  const { score2048, scoreSnake, totalScore } = getGameScores(records);
  if (category === "2048") return score2048;
  if (category === "snake") return scoreSnake;
  return totalScore;
}

async function getGuildUsers(client: ReadClient, guildId: string): Promise<unknown> {
  return client.user.findMany({
    where: { guildId },
    include: {
      economy: true,
      Level: true,
    },
  });
}

async function getSeasonLeaderboard(
  client: ReadClient,
  seasonId: number,
  limit = 100
): Promise<unknown> {
  return client.seasonStats.findMany({
    where: { seasonId },
    include: {
      user: true,
    },
    orderBy: {
      totalXp: "desc",
    },
    take: limit,
  });
}

async function getGameLeaderboard(
  client: ReadClient,
  category: GameLeaderboardCategory,
  scope: GameLeaderboardScope,
  guildId?: string,
  limit = 100
): Promise<GameLeaderboardEntry[]> {
  const rows = (await client.statistics.findMany({
    where: scope === "local" ? { guildId } : {},
    select: {
      userId: true,
      guildId: true,
      gameRecords: true,
    },
  })) as StatisticsRow[];

  const normalizedRows = rows.map((row) => {
    const score = getCategoryScore(category, row.gameRecords);
    const { score2048, scoreSnake } = getGameScores(row.gameRecords);
    return {
      id: row.userId,
      userId: row.userId,
      guildId: row.guildId,
      score,
      stats: {
        gameRecords: {
          "2048": { highScore: score2048 },
          snake: { highScore: scoreSnake },
        },
      },
    } as GameLeaderboardEntry;
  });

  if (scope === "local") {
    return normalizedRows
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.max(1, limit));
  }

  const perUserBest = new Map<string, GameLeaderboardEntry>();
  for (const entry of normalizedRows) {
    const currentBest = perUserBest.get(entry.userId);
    if (!currentBest || entry.score > currentBest.score) {
      perUserBest.set(entry.userId, entry);
    }
  }

  return Array.from(perUserBest.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, limit));
}

export { getGuildUsers, getSeasonLeaderboard, getGameLeaderboard };
