import { Client, GatewayIntentBits, Options, Partials } from "discord.js";
import { loadCommands } from "./src/utils/loadCommands.js";
import { loadEvents } from "./src/utils/loadEvents.js";
import { Memer } from "memer.ts";
import { AutomaticSpeechRecognition, TextToImage } from "deepinfra";
import Groq from "groq-sdk";
import hubClient from "./src/api/hubClient.js";
import Replicate from "replicate";
import dotenv from "dotenv";
import { startResourceMonitor } from "./src/runners/resourseMonitor.js";

// Load environment variables
dotenv.config();

// Import preview server if enabled
/*const previewApp =
  process.env.PREVIEW === "true"
    ? (await import("./src/render-server/preview.js")).default
    : null;*/

//startResourceMonitor(process.env.NODE_ENV === "production" ? 300000 : 100);
console.log("Starting bot...");

const forceGc = () => {
  if (global.gc) {
    global.gc();
    console.log("Forced garbage collection completed");
  }
};

if (process.env.NODE_ENV === "production" && global.gc) {
  setInterval(forceGc, 600000);
}

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
  partials: [Partials.Message, Partials.Channel, Partials.GuildMember],
  sweepers: {
    messages: {
      interval: process.env.NODE_ENV === "production" ? 15000 : 30000,
      lifetime: process.env.NODE_ENV === "production" ? 30000 : 60000,
      filter: () => (message) => message.author.id !== client.user.id,
    },
    users: {
      interval: process.env.NODE_ENV === "production" ? 15000 : 30000,
      filter: () => (user) =>
        !client.guilds.cache.some((guild) => guild.members.cache.has(user.id)),
    },
    guildMembers: {
      interval: process.env.NODE_ENV === "production" ? 15000 : 30000,
      filter: () => () => true,
    },
  },
  makeCache: Options.cacheWithLimits({
    // Set stricter limits in production
    MessageManager: {
      maxSize: process.env.NODE_ENV === "production" ? 50 : 200,
      keepOverLimit: (message) => message.author.id === client.user.id,
    },
    UserManager: {
      maxSize: process.env.NODE_ENV === "production" ? 100 : 1000,
    },
    GuildMemberManager: {
      maxSize: process.env.NODE_ENV === "production" ? 50 : 200,
    },
  }),
});

// Initialize the map to store music player messages
client.musicMessageMap = new Map();

setInterval(
  () => {
    const now = Date.now();
    client.channels.cache.forEach((channel) => {
      if (channel.messages) {
        channel.messages.cache.sweep((message) => {
          const lifetime =
            message.author?.id === client.user.id ? 60 * 1000 : 60 * 1000;
          return now - message.createdTimestamp > lifetime;
        });
      }
    });
    console.log("Manual message sweep completed");
  },
  process.env.NODE_ENV === "production" ? 30 * 1000 : 60 * 1000,
);

console.log("Loading commands...");
await loadCommands(client);
console.log("Commands loaded successfully");

const commandCount = client.commands.size;
console.log(`Loaded ${commandCount} commands:`);
client.commands.forEach((cmd, name) => {
  const subcommandCount = cmd.subcommands
    ? Object.keys(cmd.subcommands).length
    : 0;
  console.log(`- ${name} (${subcommandCount} subcommands)`);
});

console.log("Loading events...");
await loadEvents(client);
console.log("Events loaded successfully");

client.memer = new Memer();

client.groq = new Groq({
  apiKey: process.env.GROQ_API,
});

client.replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

client.deepinfra = {
  whisper: new AutomaticSpeechRecognition(
    "openai/whisper-large-v3-turbo",
    process.env.DEEPINFRA_API_KEY,
  ),
  flux_schnell: new TextToImage(
    "black-forest-labs/FLUX-1-schnell",
    process.env.DEEPINFRA_API_KEY,
  ),
};

console.log("Hub client ready");

// Check database health
try {
  await hubClient.checkDatabaseHealth();
  console.log("Database health check passed");
} catch (error) {
  console.error("Database health check failed:", error);
}

// Check and reinitialize voice sessions for existing voice users
async function initializeVoiceSessions() {
  try {
    // TODO: Implement voice session cleanup in hub services
    // await hubClient.cleanupVoiceSessions();
    console.log("Voice session cleanup will be handled by hub services");
  } catch (error) {
    console.error("Error cleaning up voice sessions:", error);
  }
}

await client.login(process.env.DISCORD_TOKEN);
await initializeVoiceSessions();

// Start the Client API Server
//startApiClientServer();

// Check for season transition every hour
/*setInterval(async () => {
  await Database.checkAndUpdateSeason();
}, 60 * 60 * 1000);*

Database.startPingCollection(client);*/

// Start preview server if enabled
/*if (previewApp) {
  const port = 2333;
  const server = previewApp.app.listen(port, () => {
    console.log(`Preview server running at http://localhost:${port}`);
  });

  // Handle WebSocket upgrades
  server.on("upgrade", (request, socket, head) => {
    previewApp.handleUpgrade(request, socket, head);
  });
}*/

/*startResourceMonitor(5000);*/

/*function clearCaches() {
  client.users.cache.sweep(() => true);
  client.guilds.cache.forEach((guild) => {
    guild.roles.cache.sweep(() => true);
    guild.channels.cache.sweep(() => true);
  });
  console.log("Caches cleared");
}

setInterval(clearCaches, 30000);*/

// Handle process errors
process.on("unhandledRejection", (error) => {
  console.error("Unhandled promise rejection:", error);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
});

process.on("SIGINT", async () => {
  console.log("Shutting down...");
  try {
    console.log("Bot shutdown complete");
    process.exit(0);
  } catch (error) {
    console.error("Error during shutdown:", error);
    process.exit(1);
  }
});
