let lastRSS = 0;
let lastCacheStats = {
  users: 0,
  guilds: 0,
  channels: 0,
  roles: 0,
  emojis: 0,
  messages: 0,
  members: 0,
};

let currentLabel = "";

const monitor = async (client) => {
  const used = process.memoryUsage();
  const currentRSS = Math.round(used.rss / (1024 * 1024));

  // Memory change tracking
  if (currentRSS !== lastRSS) {
    const diff = currentRSS - lastRSS;
    const labelInfo = currentLabel ? ` [${currentLabel}]` : "";
    console.log(
      `RSS ${
        diff > 0 ? "increased" : "decreased"
      }: ${lastRSS} MB -> ${currentRSS} MB ` +
        `(${diff > 0 ? "+" : ""}${diff} MB) ` +
        `(uptime: ${Math.round(process.uptime())}s)${labelInfo}`
    );
    lastRSS = currentRSS;
  }

  if (client) {
    const currentCacheStats = getCacheStats(client);
    const cacheChanges = {};
    let hasChanges = false;

    Object.keys(currentCacheStats).forEach((key) => {
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
        console.log(
          `${key}: ${value.old} -> ${value.new} (${value.diff > 0 ? "+" : ""}${
            value.diff
          })`
        );
      });
    }
  }
};

function getCacheStats(client) {
  let stats = {
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

// Add event listener for memory labels
process.on("memoryLabel", (label, client) => {
  currentLabel = label;
  monitor(client);
});

export function startResourceMonitor(interval = 500, client) {
  // Start monitoring
  monitor(client);
  return setInterval(monitor, interval);
}

process.on("unhandledRejection", (error) => {
  console.error("Unhandled promise rejection:", error);
});
