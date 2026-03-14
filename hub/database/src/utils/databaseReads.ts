type ReadClient = {
  user: {
    findMany: (args: unknown) => Promise<unknown>;
  };
  seasonStats: {
    findMany: (args: unknown) => Promise<unknown>;
  };
};

async function getGuildUsers(client: ReadClient, guildId: string): Promise<unknown> {
  return client.user.findMany({
    where: { guildId },
    include: {
      economy: true,
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

export { getGuildUsers, getSeasonLeaderboard };
