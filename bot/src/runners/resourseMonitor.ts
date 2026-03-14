type CacheStats = {
  users: number;
  guilds: number;
  channels: number;
  roles: number;
  emojis: number;
  messages: number;
  members: number;
};

type ChannelWithMessages = {
  messages?: {
    cache: {
      size: number;
    };
  };
};

type GuildCacheShape = {
  channels: { cache: Map<string, ChannelWithMessages> };
  roles: { cache: { size: number } };
  emojis: { cache: { size: number } };
  members: { cache: { size: number } };
};

type ClientCacheShape = {
  users: { cache: { size: number } };
  guilds: { cache: Map<string, GuildCacheShape> };
};

let lastRSS = 0;
let lastCacheStats: CacheStats = {
  users: 0,
  guilds: 0,
  channels: 0,
  roles: 0,
  emojis: 0,
  messages: 0,
  members: 0,
};

let currentLabel = "";

const monitor = async (client?: ClientCacheShape): Promise<void> => {
  const used = process.memoryUsage();
  const currentRSS = Math.round(used.rss / (1024 * 1024));

  if (currentRSS !== lastRSS) {
    const diff = currentRSS - lastRSS;
    const labelInfo = currentLabel ? ` [${currentLabel}]` : "";
    console.log(
      `RSS ${diff > 0 ? "increased" : "decreased"}: ${lastRSS} MB -> ${currentRSS} MB ` +
        `(${diff > 0 ? "+" : ""}${diff} MB) ` +
        `(uptime: ${Math.round(process.uptime())}s)${labelInfo}`
    );
    lastRSS = currentRSS;
  }

  if (client) {
    const currentCacheStats = getCacheStats(client);
    const cacheChanges: Partial<
      Record<keyof CacheStats, { old: number; new: number; diff: number }>
    > = {};
    let hasChanges = false;

    (Object.keys(currentCacheStats) as Array<keyof CacheStats>).forEach((key) => {
      if (currentCacheStats[key] !== lastCacheStats[key]) {
        hasChanges = true;
        cacheChanges[key] = {
          old: lastCacheStats[key],
          new: currentCacheStats[key],
          diff: currentCacheStats[key] - lastCacheStats[key],
        };
        lastCacheStats[key] = currentCacheStats[key];
      }
    });

    if (hasChanges) {
      console.log("\nCache Changes:");
      Object.entries(cacheChanges).forEach(([key, value]) => {
        if (!value) {
          return;
        }
        console.log(
          `${key}: ${value.old} -> ${value.new} (${value.diff > 0 ? "+" : ""}${value.diff})`
        );
      });
    }
  }
};

function getCacheStats(client: ClientCacheShape): CacheStats {
  const stats: CacheStats = {
    users: client.users.cache.size,
    guilds: client.guilds.cache.size,
    channels: 0,
    roles: 0,
    emojis: 0,
    messages: 0,
    members: 0,
  };

  client.guilds.cache.forEach((guild) => {
    stats.channels += guild.channels.cache.size;
    stats.roles += guild.roles.cache.size;
    stats.emojis += guild.emojis.cache.size;
    stats.members += guild.members.cache.size;

    guild.channels.cache.forEach((channel) => {
      if (channel.messages) {
        stats.messages += channel.messages.cache.size;
      }
    });
  });

  return stats;
}

process.on("memoryLabel", (label: string, client?: ClientCacheShape) => {
  currentLabel = label;
  void monitor(client);
});

function startResourceMonitor(
  interval = 500,
  client?: ClientCacheShape
): ReturnType<typeof setInterval> {
  void monitor(client);
  return setInterval(() => {
    void monitor(client);
  }, interval);
}

process.on("unhandledRejection", (error) => {
  console.error("Unhandled promise rejection:", error);
});

export { startResourceMonitor };
