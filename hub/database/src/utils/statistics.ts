type StatisticsClient = {
  statistics: {
    upsert: (args: unknown) => Promise<unknown>;
  };
};

function createStatisticsUpsertData(
  guildId: string,
  userId: string,
  field: "messageCount" | "commandCount"
) {
  const isMessage = field === "messageCount";

  return {
    where: {
      guildId_userId: { guildId, userId },
    },
    create: {
      user: {
        connectOrCreate: {
          where: {
            guildId_id: { guildId, id: userId },
          },
          create: {
            id: userId,
            guild: {
              connectOrCreate: {
                where: { id: guildId },
                create: { id: guildId },
              },
            },
            lastActivity: BigInt(Date.now()),
          },
        },
      },
      guildId,
      userId,
      messageCount: isMessage ? 1 : 0,
      commandCount: isMessage ? 0 : 1,
      totalEarned: 0,
      lastUpdated: Date.now(),
    },
    update: {
      [field]: { increment: 1 },
      lastUpdated: Date.now(),
    },
  };
}

async function incrementMessageCount(
  client: StatisticsClient,
  guildId: string,
  userId: string
): Promise<unknown> {
  return client.statistics.upsert(
    createStatisticsUpsertData(guildId, userId, "messageCount")
  );
}

async function incrementCommandCount(
  client: StatisticsClient,
  guildId: string,
  userId: string
): Promise<unknown> {
  return client.statistics.upsert(
    createStatisticsUpsertData(guildId, userId, "commandCount")
  );
}

export { incrementMessageCount, incrementCommandCount };
