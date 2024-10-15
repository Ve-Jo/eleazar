import { Client, GatewayIntentBits, Options } from "discord.js";
import { loadCommands } from "./src/utils/loadCommands.js";
import { loadEvents } from "./src/utils/loadEvents.js";
import { Memer } from "memer.ts";
import { startResourceMonitor } from "./src/runners/resourceMonitor.js";

console.log("Starting bot...");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  presence: { status: "online" },
  messageCacheMaxSize: 50,
  makeCache: Options.cacheWithLimits({
    MessageManager: {
      maxSize: 50,
      filter: (message) => message.author.id === client.user.id,
      sweepInterval: 300,
    },
  }),
});

client.commands = new Map();
client.events = new Map();

await loadCommands(client);
await loadEvents(client);

client.memer = new Memer();

await client.login(process.env.DISCORD_TOKEN);

/*startResourceMonitor(5000);*/

function clearCaches() {
  client.users.cache.clear();
  client.guilds.cache.forEach((guild) => {
    guild.roles.cache.clear();
    guild.channels.cache.clear();
  });
  console.log("Caches cleared");
}

setInterval(clearCaches, 30000);
