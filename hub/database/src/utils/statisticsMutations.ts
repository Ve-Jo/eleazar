type StatisticsMutationsClient = {
  statistics: {
    findUnique: (args: unknown) => Promise<unknown>;
    upsert: (args: unknown) => Promise<unknown>;
  };
  $transaction: <T>(callback: (tx: StatisticsTransaction) => Promise<T>) => Promise<T>;
};

type StatisticsTransaction = {
  user: {
    update: (args: unknown) => Promise<unknown>;
  };
  statistics: {
    upsert: (args: unknown) => Promise<unknown>;
  };
};

type EnsureGuildUserFn = (
  guildId: string,
  userId: string
) => Promise<unknown>;

type UpdateStatisticsFn = (
  userId: string,
  guildId: string,
  updateData: Record<string, unknown>
) => Promise<unknown>;

type StatisticsRecord = {
  gameRecords?: unknown;
  [key: string]: unknown;
};

type GameRecordsResult = {
  "2048": { highScore: number };
  snake: { highScore: number };
};

const validFields = [
  "totalEarned",
  "messageCount",
  "commandCount",
  "gameRecords",
  "xpStats",
  "gameXpStats",
  "interactionStats",
  "voiceTime",
  "crypto2DisclaimerSeen",
] as const;

const incrementableFields = ["messageCount", "commandCount", "voiceTime"] as const;

async function updateStatistics(
  client: StatisticsMutationsClient,
  ensureGuildUser: EnsureGuildUserFn,
  userId: string,
  guildId: string,
  updateData: Record<string, unknown>
): Promise<unknown> {
  try {
    await ensureGuildUser(guildId, userId);

    const filteredUpdateData = Object.fromEntries(
      Object.entries(updateData).filter(([key]) =>
        validFields.includes(key as (typeof validFields)[number])
      )
    );

    return await client.statistics.upsert({
      where: {
        guildId_userId: { guildId, userId },
      },
      create: {
        guildId,
        userId,
        lastUpdated: Date.now(),
        ...filteredUpdateData,
      },
      update: {
        lastUpdated: Date.now(),
        ...filteredUpdateData,
      },
    });
  } catch (error) {
    console.error("Error updating statistics:", error);
    throw error;
  }
}

async function incrementStatistic(
  client: StatisticsMutationsClient,
  ensureGuildUser: EnsureGuildUserFn,
  updateStatisticsFn: UpdateStatisticsFn,
  userId: string,
  guildId: string,
  field: string,
  amount = 1
): Promise<unknown> {
  try {
    if (!incrementableFields.includes(field as (typeof incrementableFields)[number])) {
      throw new Error(
        `Field '${field}' is not incrementable. Valid fields: ${incrementableFields.join(", ")}`
      );
    }

    await ensureGuildUser(guildId, userId);

    const currentStats = (await client.statistics.findUnique({
      where: {
        guildId_userId: { guildId, userId },
      },
    })) as StatisticsRecord | null;

    const currentValue = currentStats ? Number(currentStats[field] || 0) : 0;
    const newValue = currentValue + Number(amount);

    return await updateStatisticsFn(userId, guildId, {
      [field]: newValue,
    });
  } catch (error) {
    console.error(`Error incrementing statistic '${field}':`, error);
    throw error;
  }
}

async function updateGameHighScore(
  client: StatisticsMutationsClient,
  ensureGuildUser: EnsureGuildUserFn,
  guildId: string,
  userId: string,
  gameId: "2048" | "snake",
  newScore: number
): Promise<
  | { newHighScore: number | null; previousHighScore: number; isNewRecord: boolean }
  | { isNewRecord: false; error: string }
> {
  try {
    await ensureGuildUser(guildId, userId);

    const stats = (await client.statistics.findUnique({
      where: { guildId_userId: { guildId, userId } },
    })) as StatisticsRecord | null;

    let currentRecords: GameRecordsResult = {
      "2048": { highScore: 0 },
      snake: { highScore: 0 },
    };

    if (stats?.gameRecords) {
      try {
        if (
          typeof stats.gameRecords === "object" &&
          !Array.isArray(stats.gameRecords)
        ) {
          currentRecords = stats.gameRecords as GameRecordsResult;
        } else if (typeof stats.gameRecords === "string") {
          const parsed = JSON.parse(stats.gameRecords);
          currentRecords =
            typeof parsed === "string"
              ? (JSON.parse(parsed) as GameRecordsResult)
              : (parsed as GameRecordsResult);
        }
      } catch (error) {
        const typedError = error as Error;
        console.warn(
          `Failed to parse game records for ${userId} in guild ${guildId}: ${typedError.message}`
        );
      }
    }

    const cleanRecords: GameRecordsResult = {
      "2048": { highScore: Number(currentRecords?.["2048"]?.highScore || 0) },
      snake: { highScore: Number(currentRecords?.snake?.highScore || 0) },
    };

    const currentHighScore = cleanRecords[gameId]?.highScore || 0;
    const isNewRecord = newScore > currentHighScore;

    if (isNewRecord) {
      cleanRecords[gameId].highScore = newScore;

      await client.$transaction(async (tx) => {
        await tx.user.update({
          where: {
            guildId_id: { guildId, id: userId },
          },
          data: {
            lastActivity: Date.now(),
          },
        });

        await tx.statistics.upsert({
          where: { guildId_userId: { guildId, userId } },
          create: {
            guildId,
            userId,
            gameRecords: cleanRecords,
            lastUpdated: Date.now(),
          },
          update: {
            gameRecords: cleanRecords,
            lastUpdated: Date.now(),
          },
        });
      });
    }

    return {
      newHighScore: isNewRecord ? newScore : null,
      previousHighScore: currentHighScore,
      isNewRecord,
    };
  } catch (error) {
    const typedError = error as Error;
    console.error("Error updating game high score:", error);
    return { isNewRecord: false, error: typedError.message };
  }
}

export { updateStatistics, incrementStatistic, updateGameHighScore };
