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

    if (currentRSS > lastRSS) {
      console.log(
        `RSS increased: ${filesize(lastRSS)} -> ${filesize(
          currentRSS
        )} (uptime: ${process.uptime()}s)`
      );
      //other ram usage
      const heapUsed = process.memoryUsage().heapUsed;
      console.log(`Heap used: ${filesize(heapUsed)}`);
      lastRSS = currentRSS;
    } else if (currentRSS < lastRSS) {
      console.log(
        `RSS decreased: ${filesize(lastRSS)} -> ${filesize(
          currentRSS
        )} (uptime: ${process.uptime()}s)`
      );
      lastRSS = currentRSS;
    }

    if (client) {
      const currentCacheStats = getCacheStats(client);

      Object.keys(currentCacheStats).forEach((key) => {
        if (currentCacheStats[key] > lastCacheStats[key]) {
          console.log(
            `${key} cache increased: ${lastCacheStats[key]} -> ${currentCacheStats[key]}`
          );
          lastCacheStats[key] = currentCacheStats[key];
        }
      });
    }
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
