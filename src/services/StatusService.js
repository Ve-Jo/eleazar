import { ActivityType } from "discord.js";

let client = null;
let currentGuildCount = 0;
let interval = null;

const start = (discordClient) => {
  client = discordClient;
  console.log("Status service started");

  updateStatus();

  interval = setInterval(updateStatus, 30000);

  client.on("guildCreate", updateStatus);
  client.on("guildDelete", updateStatus);
};

const stop = () => {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
};

const updateStatus = () => {
  if (!client) return;

  const guildCount = client.guilds.cache.size;

  if (guildCount !== currentGuildCount) {
    currentGuildCount = guildCount;

    client.user.setActivity(`${guildCount} servers`, {
      type: ActivityType.Watching,
    });
    console.log(`Status updated: Now in ${guildCount} servers`);
  }
};

export default {
  start,
  stop,
  updateStatus,
};
