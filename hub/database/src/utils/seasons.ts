type SeasonsClient = {
  seasons: {
    findFirst: (args: unknown) => Promise<unknown>;
  };
};

async function getCurrentSeason(client: SeasonsClient): Promise<unknown> {
  return client.seasons.findFirst({
    orderBy: {
      seasonEnds: "desc",
    },
  });
}

export { getCurrentSeason };
