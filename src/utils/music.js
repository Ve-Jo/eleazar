import { LavalinkManager } from "lavalink-client";
/*import { HttpsProxyAgent } from "https-proxy-agent";*/
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import autoPlayFunction from "../handlers/MusicAutoplay";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LAVALINK_SERVERS = [
  /*{
    id: "localhost",
    host: "127.0.0.1",
    port: 2333,
    authorization: "youshallnotpass",
    secure: false,
  },*/
  {
    id: "lavahatry4",
    host: "lavahatry4.techbyte.host",
    port: 3000,
    authorization: "NAIGLAVA-dash.techbyte.host",
    secure: false,
  },
  {
    id: "lavalink4",
    host: "lavalink4.lightsout.in",
    port: 40069,
    authorization: "LightsoutOwnsElves",
    secure: false,
  },
  {
    id: "jirayu",
    host: "lavalink.jirayu.net",
    port: 13592,
    authorization: "youshallnotpass",
    secure: false,
  },
  // Add more servers here
];

async function testServerConnection(node) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const response = await fetch(
      `http${node.secure ? "s" : ""}://${node.host}:${node.port}/version`,
      {
        headers: {
          Authorization: node.authorization,
        },
        signal: controller.signal,
      }
    );

    clearTimeout(timeout);
    return response.ok;
  } catch {
    return false;
  }
}

async function init(client) {
  try {
    console.log("Initializing Lavalink Manager...");

    // Test all servers and find the first working one
    console.log("Testing Lavalink servers...");
    let workingServer = null;

    for (const server of LAVALINK_SERVERS) {
      console.log(`Testing server ${server.id}...`);
      const isWorking = await testServerConnection(server);

      if (isWorking) {
        console.log(`Server ${server.id} is available`);
        workingServer = server;
        break;
      } else {
        console.log(`Server ${server.id} is not responding`);
      }
    }

    if (!workingServer) {
      throw new Error("No working Lavalink servers found!");
    }

    client.lavalink = new LavalinkManager({
      nodes: [workingServer],
      sendToShard: (guildId, payload) =>
        client.guilds.cache.get(guildId)?.shard?.send(payload),
      client: {
        id: client.user.id,
        username: client.user.username,
      },
      autoSkip: true,
      playerOptions: {
        clientBasedPositionUpdateInterval: 1000,
        defaultSearchPlatform: "ytmsearch",
        volumeDecrementer: 0.75,
        minAutoPlayMs: 10_000,
        onDisconnect: {
          autoReconnect: false,
          destroyPlayer: true,
        },
        onEmptyQueue: {
          destroyAfterMs: 30_000,
          autoPlayFunction: async (player) => {
            try {
              console.log("Autoplay triggered from onEmptyQueue");

              const lastPlayedTrack = player.get("lastPlayedTrack");
              console.log(
                "Last played track:",
                lastPlayedTrack ? lastPlayedTrack.info.title : "None"
              );

              if (!lastPlayedTrack) {
                console.log("No last played track found, cannot autoplay");
                return null;
              }

              const result = await autoPlayFunction(player, lastPlayedTrack);
              if (!result || result.length === 0) {
                console.log("No tracks found for autoplay");
                return null;
              }
              console.log("Autoplay found tracks:", result.length);

              // Add all found tracks to the queue
              await player.queue.add(result);
              console.log("Added autoplay tracks to queue");

              // Return the first track to start playing
              return result[0];
            } catch (error) {
              console.error("Error in autoplay function:", error);
              return null;
            }
          },
        },
      },
      queueOptions: {
        maxPreviousTracks: 1, // Reduce to a smaller number
        cleanupThreshold: 1000 * 60 * 1, // Clean up tracks older than 1 minute
      },
    });

    client.lavalink.nodeManager.on("connect", (node) => {
      console.log(`Node ${node.id} connected successfully!`);
    });

    client.lavalink.nodeManager.on("disconnect", async (node, reason) => {
      console.error(`Node ${node.id} disconnected. Reason:`, reason);

      // Try to find another working server
      console.log("Attempting to connect to alternative server...");

      for (const server of LAVALINK_SERVERS) {
        // Skip the current disconnected server
        if (server.id === node.id) continue;

        const isWorking = await testServerConnection(server);
        if (isWorking) {
          console.log(`Connecting to alternative server ${server.id}`);
          await client.lavalink.nodeManager.createNode(server);
          return;
        }
      }

      console.error("No alternative servers available!");
    });

    client.lavalink.nodeManager.on("error", (node, error) => {
      console.error(`Error on node ${node.id}:`, error);
    });

    try {
      await client.lavalink.init({ ...client.user, shards: "auto" });
    } catch (error) {
      console.error("Error initializing Lavalink connection:", error);
      client.lavalink.isInitialized = false;
      return;
    }

    client.lavalink.isInitialized = true;

    client.lavalink.on("trackStart", async (player, track) => {
      console.log("Track started, storing track info");
      player.set("lastPlayedTrack", track);

      // Execute trackStart event
      const eventModule = await import("../events/music/trackStart.js");
      if (
        eventModule.default &&
        typeof eventModule.default.execute === "function"
      ) {
        await eventModule.default.execute(client, player, track);

        // Verify message was stored
        console.log("After trackStart execution, nowPlayingMessage:", {
          exists: !!player.nowPlayingMessage,
          messageId: player.nowPlayingMessage?.id,
        });
      }
    });

    client.lavalink.on("queueEnd", (player) => {
      console.log("Queue ended, triggering autoplay");
    });

    // Add specific playerUpdate handler
    client.lavalink.on("playerUpdate", async ({ guildId, state }) => {
      const player = client.lavalink.getPlayer(guildId);
      if (player) {
        console.log("Player state in playerUpdate:", {
          guildId,
          hasMessage: !!player.nowPlayingMessage,
          messageId: player.nowPlayingMessage?.id,
        });

        const eventModule = await import("../events/music/playerUpdate.js");
        if (
          eventModule.default &&
          typeof eventModule.default.execute === "function"
        ) {
          await eventModule.default.execute(client, player);
        }
      }
    });

    // Remove the generic event loader for these specific events
    const eventsPath = path.join(__dirname, "../events/music");
    const eventFiles = fs
      .readdirSync(eventsPath)
      .filter(
        (file) =>
          file.endsWith(".js") &&
          !["trackStart.js", "playerUpdate.js"].includes(file)
      );

    // Load other events normally
    for (const file of eventFiles) {
      const filePath = path.join(eventsPath, file);
      const eventModule = await import(filePath);

      if (
        eventModule.default &&
        typeof eventModule.default.execute === "function"
      ) {
        const eventName = path.parse(file).name;
        console.log(`Loaded event: ${eventName} (music player)`);
        client.lavalink.on(eventName, (...args) => {
          console.log(`Executing event: ${eventName}`);
          eventModule.default.execute(client, ...args);
        });
      } else {
        console.log(`Invalid event file: ${file}`);
      }
    }

    console.log("Lavalink initialization completed successfully.");

    client.on("raw", (d) => client.lavalink.sendRawData(d));

    client.lavalink.on("playerDestroy", (player) => {
      if (player) {
        player.cleanup && player.cleanup();
      }
    });
  } catch (error) {
    console.error("Error in Lavalink setup:", error);
    client.lavalink.isInitialized = false;
  }
}

export default init;
