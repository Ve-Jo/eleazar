import { Client, GatewayIntentBits, Options, Partials } from "discord.js";
import { loadCommands } from "./src/utils/loadCommands.ts";
import { loadEvents } from "./src/utils/loadEvents.ts";
import { Memer } from "memer.ts";
import { AutomaticSpeechRecognition, TextToImage } from "deepinfra";
import Groq from "groq-sdk";
import hubClient from "./src/api/hubClient.ts";
import Replicate from "replicate";
import dotenv from "dotenv";
import { startResourceMonitor } from "./src/runners/resourseMonitor.ts";

type CoverageMap = Record<string, unknown>;
const globalAny = globalThis as any;
const hubClientAny = hubClient as any;

// Enable coverage collection if running under c8 or babel-plugin-istanbul
if (
  process.env.NODE_V8_COVERAGE ||
  process.env.COVERAGE ||
  process.env.BABEL_COVERAGE
) {
  console.log("🎯 Coverage collection enabled");

  // Ensure global coverage object exists
  if (typeof globalAny.__coverage__ === "undefined") {
    globalAny.__coverage__ = {};
  }

  // Force V8 coverage collection (Node.js only)
  if (globalAny.v8debug) {
    globalAny.v8debug.collectCoverage();
  }

  // Hook into dynamic imports for ES modules
  const originalImport = globalAny.import;
  if (originalImport) {
    globalAny.import = function (specifier: string) {
      console.log(`📊 ES Module loading: ${specifier}`);
      return originalImport.apply(this, arguments).then((module: unknown) => {
        if (globalAny.__coverage__) {
          console.log(`✅ ES Module loaded: ${specifier}`);
        }
        return module;
      });
    };
  }

  // Hook into module loading for CommonJS (if available)
  const originalRequire = globalAny.require;
  if (originalRequire) {
    globalAny.require = function (id: string) {
      console.log(`📊 CommonJS Module loading: ${id}`);
      const result = originalRequire.apply(this, arguments as any);
      if (globalAny.__coverage__) {
        console.log(`✅ CommonJS Module loaded: ${id}`);
      }
      return result;
    };
  }

  // Add coverage flush on exit
  process.on("exit", () => {
    if (globalAny.__coverage__) {
      console.log(
        `💾 Coverage data collected: ${
          Object.keys(globalAny.__coverage__).length
        } files`
      );
    }
  });

  // Log babel-plugin-istanbul detection
  if (process.env.BABEL_COVERAGE) {
    console.log("🔧 Running with babel-plugin-istanbul instrumentation");
  }
}

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

const client: any = new Client({
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
    messages: ({
      interval: process.env.NODE_ENV === "production" ? 15000 : 30000,
      lifetime: process.env.NODE_ENV === "production" ? 30000 : 60000,
      filter: () => (message: any) => message.author.id !== client.user.id,
    } as any),
    users: {
      interval: process.env.NODE_ENV === "production" ? 15000 : 30000,
      filter: () => (user: any) =>
        !client.guilds.cache.some((guild: any) => guild.members.cache.has(user.id)),
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
      keepOverLimit: (message: any) => message.author.id === client.user.id,
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
    client.channels.cache.forEach((channel: any) => {
      if (channel.messages) {
        channel.messages.cache.sweep((message: any) => {
          const lifetime =
            message.author?.id === client.user.id ? 60 * 1000 : 60 * 1000;
          return now - message.createdTimestamp > lifetime;
        });
      }
    });
    console.log("Manual message sweep completed");
  },
  process.env.NODE_ENV === "production" ? 30 * 1000 : 60 * 1000
);

console.log("Loading commands...");
await loadCommands(client);
console.log("Commands loaded successfully");

const commandCount = client.commands.size;
console.log(`Loaded ${commandCount} commands:`);
client.commands.forEach((cmd: any, name: any) => {
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
    process.env.DEEPINFRA_API_KEY
  ),
  flux_schnell: new TextToImage(
    "black-forest-labs/FLUX-1-schnell",
    process.env.DEEPINFRA_API_KEY
  ),
};

console.log("Hub client ready");

// Check database health
try {
  await hubClientAny.checkDatabaseHealth();
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

  console.log("🧹 Сохраняю покрытие перед выходом...");

  // Enhanced cumulative coverage collection
  if (globalAny.__coverage__) {
    try {
      const fs = await import("fs");
      const path = await import("path");

      // Ensure coverage directory exists
      const coverageDir = "./coverage";
      if (!fs.existsSync(coverageDir)) {
        fs.mkdirSync(coverageDir, { recursive: true });
      }

      // Load existing coverage data if it exists
      const coverageFile = path.join(coverageDir, "coverage-final.json");
      let existingCoverage: CoverageMap = {};

      if (fs.existsSync(coverageFile)) {
        try {
          existingCoverage = JSON.parse(fs.readFileSync(coverageFile, "utf8"));
          console.log(
            `📊 Found existing coverage data for ${
              Object.keys(existingCoverage).length
            } files`
          );
        } catch (e) {
          console.log("⚠️  Could not read existing coverage, starting fresh");
        }
      }

      // Merge new coverage with existing coverage
      const mergedCoverage: CoverageMap = { ...existingCoverage };

      Object.entries(globalAny.__coverage__).forEach(
        ([filePath, coverage]) => {
          if (mergedCoverage[filePath]) {
            // Merge coverage data for existing files
            console.log(`🔄 Merging coverage for: ${filePath}`);
            // For now, we'll keep the newer coverage data
            // In a more sophisticated implementation, you could merge the actual coverage counts
            mergedCoverage[filePath] = coverage;
          } else {
            // Add new files
            console.log(`➕ Adding new coverage for: ${filePath}`);
            mergedCoverage[filePath] = coverage;
          }
        }
      );

      // Save merged coverage data
      const coverageData = JSON.stringify(mergedCoverage, null, 2);
      fs.writeFileSync(coverageFile, coverageData);

      console.log(`✅ Coverage data saved to ${coverageFile}`);
      console.log(
        `📊 Total files tracked: ${Object.keys(mergedCoverage).length}`
      );
      console.log(
        `🔄 New files in this run: ${
          Object.keys(globalAny.__coverage__).length
        }`
      );

      // Also save a timestamped backup for safety
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const backupFile = path.join(coverageDir, `coverage-${timestamp}.json`);
      fs.writeFileSync(backupFile, coverageData);
      console.log(`💾 Backup saved to ${backupFile}`);

      // Generate cumulative coverage report
      try {
        const { execSync } = await import("child_process");
        console.log("🔄 Generating cumulative coverage report...");
        execSync(
          "npx c8 report --reporter=text --reporter=html --temp-directory=coverage/tmp --reports-dir=coverage",
          {
            stdio: "inherit",
            cwd: process.cwd(),
          }
        );
        console.log("✅ Cumulative coverage report generated");
      } catch (reportError) {
        console.log("⚠️  Could not generate c8 report (this is optional)");
      }
    } catch (error) {
      console.error("❌ Error saving coverage data:", error);
    }
  }

  try {
    console.log("Bot shutdown complete");
    process.exit(0);
  } catch (error) {
    console.error("Error during shutdown:", error);
    process.exit(1);
  }
});
