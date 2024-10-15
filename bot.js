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
  messageCacheMaxSize: 10, // Reduced from 50
  makeCache: Options.cacheWithLimits({
    MessageManager: {
      maxSize: 10, // Reduced from 50
      sweepInterval: 300,
      sweepFilter: (message) =>
        Date.now() - message.createdTimestamp > 60 * 1000, // Only keep messages older than a minute
    },
    // Optionally reduce other caches
    PresenceManager: {
      maxSize: 50,
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

// Clear caches regularly to free up memory
function clearCaches() {
  client.users.cache.sweep(() => true);
  client.guilds.cache.forEach((guild) => {
    guild.roles.cache.sweep(() => true);
    guild.channels.cache.sweep(() => true);
  });
  console.log("Caches cleared");
}

setInterval(clearCaches, 30000);
