type InteractionStatsClient = {
  statistics: {
    findUnique: (args: unknown) => Promise<unknown>;
  };
};

type InteractionCategory = Record<string, number>;

type InteractionStatsShape = {
  commands?: InteractionCategory;
  buttons?: InteractionCategory;
  selectMenus?: InteractionCategory;
  modals?: InteractionCategory;
};

type StatisticsRecord = {
  interactionStats?: unknown;
};

async function getInteractionStats(
  client: InteractionStatsClient,
  guildId: string,
  userId: string
): Promise<InteractionStatsShape | null> {
  try {
    const stats = (await client.statistics.findUnique({
      where: {
        guildId_userId: { guildId, userId },
      },
      select: { interactionStats: true },
    })) as StatisticsRecord | null;

    if (!stats) {
      return null;
    }

    let interactionStats: InteractionStatsShape = {
      commands: {},
      buttons: {},
      selectMenus: {},
      modals: {},
    };

    if (stats.interactionStats) {
      try {
        if (
          typeof stats.interactionStats === "object" &&
          !Array.isArray(stats.interactionStats)
        ) {
          interactionStats = stats.interactionStats as InteractionStatsShape;
        } else if (typeof stats.interactionStats === "string") {
          const parsed = JSON.parse(stats.interactionStats);
          interactionStats =
            typeof parsed === "string"
              ? (JSON.parse(parsed) as InteractionStatsShape)
              : (parsed as InteractionStatsShape);
        }
      } catch (error) {
        const typedError = error as Error;
        console.warn(
          `Failed to parse interaction stats for ${userId} in guild ${guildId}: ${typedError.message}`
        );
      }
    }

    return {
      commands: interactionStats.commands || {},
      buttons: interactionStats.buttons || {},
      selectMenus: interactionStats.selectMenus || {},
      modals: interactionStats.modals || {},
    };
  } catch (error) {
    console.error("Error getting interaction stats:", error);
    return null;
  }
}

async function getMostUsedInteractions(
  getInteractionStatsFn: (
    guildId: string,
    userId: string
  ) => Promise<InteractionStatsShape | null>,
  guildId: string,
  userId: string,
  type: keyof InteractionStatsShape,
  limit = 5
): Promise<Array<{ name: string; count: number }>> {
  const stats = await getInteractionStatsFn(guildId, userId);
  const interactionBucket = stats?.[type];

  if (!interactionBucket) {
    return [];
  }

  return Object.entries(interactionBucket)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));
}

export { getInteractionStats, getMostUsedInteractions };
