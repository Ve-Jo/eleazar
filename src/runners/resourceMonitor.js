import { filesize } from "filesize";
import os from "os";

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

export function startResourceMonitor(interval = 500, client) {
  const monitor = async () => {
    const used = process.memoryUsage();
    const currentRSS = used.rss;

    // Detailed memory breakdown
    console.log("\nMemory Usage Breakdown:");
    console.log(`RSS (Total): ${filesize(used.rss)}`);
    console.log(`Heap Total: ${filesize(used.heapTotal)}`);
    console.log(`Heap Used: ${filesize(used.heapUsed)}`);
    console.log(`External: ${filesize(used.external)}`);
    console.log(`ArrayBuffers: ${filesize(used.arrayBuffers)}`);

    // Calculate actual application memory
    const actualMemory = used.heapUsed + used.external + used.arrayBuffers;
    console.log(`Actual Application Memory: ${filesize(actualMemory)}`);

    // Memory change tracking
    if (currentRSS !== lastRSS) {
      const diff = currentRSS - lastRSS;
      console.log(
        `RSS ${diff > 0 ? "increased" : "decreased"}: ${filesize(
          lastRSS
        )} -> ${filesize(currentRSS)} ` +
          `(${diff > 0 ? "+" : ""}${filesize(diff)}) ` +
          `(uptime: ${process.uptime()}s)`
      );
      lastRSS = currentRSS;
    }

    // Cache monitoring
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
            `${key}: ${value.old} -> ${value.new} (${
              value.diff > 0 ? "+" : ""
            }${value.diff})`
          );
        });
      }
    }

    // System memory info
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    console.log("\nSystem Memory:");
    console.log(`Total: ${filesize(totalMem)}`);
    console.log(
      `Used: ${filesize(usedMem)} (${Math.round((usedMem / totalMem) * 100)}%)`
    );
    console.log(
      `Free: ${filesize(freeMem)} (${Math.round((freeMem / totalMem) * 100)}%)`
    );
  };

  // Start monitoring
  monitor();
  return setInterval(monitor, interval);
}

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

process.on("unhandledRejection", (error) => {
  console.error("Unhandled promise rejection:", error);
});
