import { LavalinkManager } from "lavalink-client";
/*import { HttpsProxyAgent } from "https-proxy-agent";*/
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import autoPlayFunction from "../handlers/MusicAutoplay";
import music from "../database/music.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LAVALINK_SERVERS = [
  {
    id: "localhost",
    host: "127.0.0.1",
    port: 8080,
    authorization: "youshallnotpass",
    secure: false,
  },
  {
    id: "Catfein DE",
    authorization: "catfein",
    host: "lavalink.alfari.id",
    port: 443,
    secure: true,
  },
  {
    id: "ChalresNaig Node",
    authorization: "NAIGLAVA-dash.techbyte.host",
    host: "lavahatry4.techbyte.host",
    port: 3000,
    secure: false,
  },
  {
    id: "INZEWORLD.COM (DE)",
    authorization: "saher.inzeworld.com",
    host: "lava.inzeworld.com",
    port: 3128,
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
    id: "Muzykant v4 SSL",
    authorization: "https://discord.gg/v6sdrD9kPh",
    host: "lavalink_v4.muzykant.xyz",
    port: 443,
    secure: true,
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

    if (!response.ok) {
      console.error(`Server ${node.id} returned status ${response.status}`);
      return false;
    }

    // Try to parse version to ensure the response is valid
    const version = await response.text();
    if (!version) {
      console.error(`Server ${node.id} returned empty version`);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`Failed to connect to server ${node.id}:`, error.message);
    return false;
  }
}

async function loadMusicPlayers(client) {
  try {
    // Get all saved players
    const savedPlayers = await music.loadPlayers();

    if (!savedPlayers?.length) {
      console.log("No saved music players found");
      return;
    }

    console.log(`Found ${savedPlayers.length} saved music players`);

    // Restore each player
    for (const data of savedPlayers) {
      try {
        // Create new player
        const player = await client.lavalink.createPlayer({
          guildId: data.id,
          voiceChannelId: data.voiceChannelId,
          textChannelId: data.textChannelId,
        });

        try {
          // Update existing player data
          await music.updatePlayer(data.id, {
            voiceChannelId: data.voiceChannelId,
            textChannelId: data.textChannelId,
            queue: data.queue,
            currentTrack: data.currentTrack,
            position: data.position,
            volume: data.volume,
            repeatMode: data.repeatMode,
            autoplay: data.autoplay,
            filters: data.filters,
          });

          // Restore settings
          await player.setVolume(data.volume);
          player.repeatMode = data.repeatMode;
          player.set("autoplay", data.autoplay);
          if (Object.keys(data.filters).length) {
            await player.setFilters(data.filters);
          }

          // Add tracks to queue
          if (data.queue.length) {
            for (const track of data.queue) {
              const resolvedTrack = await client.lavalink.decodeTrack(
                track.encoded
              );
              Object.assign(resolvedTrack, { info: track.info });
              player.queue.add(resolvedTrack);
            }
          }

          // Play current track if exists
          if (data.currentTrack) {
            const currentTrack = await client.lavalink.decodeTrack(
              data.currentTrack.encoded
            );
            Object.assign(currentTrack, { info: data.currentTrack.info });
            await player.play({
              track: currentTrack,
              options: { startTime: data.position },
            });
          }

          console.log(`Restored music player for guild ${data.id}`);
        } catch (restoreError) {
          console.error(
            `Failed to restore player state for guild ${data.id}:`,
            restoreError
          );
          // Try to clean up the partially restored player
          await player.destroy();
          await music.deletePlayer(data.id);
        }
      } catch (createError) {
        console.error(
          `Failed to create player for guild ${data.id}:`,
          createError
        );
        await music.deletePlayer(data.id);
      }
    }
  } catch (error) {
    console.error("Failed to load music players:", error);
  }
}

async function init(client) {
  try {
    console.log("Initializing Lavalink Manager...");

    // Set up player state save interval
    // Set up player state save interval
    const saveInterval = setInterval(async () => {
      try {
        console.log("Running save interval check for players...");
        for (const [guildId, player] of client.lavalink.players) {
          console.log(`Checking player ${guildId}:`, {
            hasQueue: !!player?.queue,
            currentTrack: !!player?.queue?.current,
            tracksInQueue: player?.queue?.tracks?.length || 0,
            queueSize: player?.queue?.size || 0,
          });

          await music.savePlayer(player).catch((error) => {
            console.error(
              `Failed to save player state for guild ${guildId}:`,
              error
            );
          });
        }
      } catch (error) {
        console.error("Failed to save player states:", error);
      }
    }, 30000); // Save every 30 seconds

    // Clean up interval on process exit
    process.on("beforeExit", () => {
      clearInterval(saveInterval);
    });

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
          autoReconnect: true,
          destroyPlayer: false,
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

    client.lavalink.nodeManager.on("connect", async (node) => {
      console.log(`Node ${node.id} connected successfully!`);
      await loadMusicPlayers(client);
    });

    client.lavalink.nodeManager.on("disconnect", async (node, reason) => {
      console.error(`Node ${node.id} disconnected. Reason:`, reason);

      // Get all players on the disconnected node
      const affectedPlayers = client.lavalink.players.filter(
        (p) => p.node.id === node.id
      );

      // Try to find another working server
      console.log("Attempting to connect to alternative server...");

      for (const server of LAVALINK_SERVERS) {
        // Skip the current disconnected server
        if (server.id === node.id) continue;

        const isWorking = await testServerConnection(server);
        if (isWorking) {
          console.log(`Connecting to alternative server ${server.id}`);
          const newNode = await client.lavalink.nodeManager.createNode(server);

          // Move all affected players to the new node
          for (const player of affectedPlayers.values()) {
            try {
              const currentState = player.playing;
              const currentPosition = player.position;
              const currentTrack = player.queue.current;

              await player.setNode(newNode.id);

              // Restore player state
              if (currentTrack && currentState) {
                await player.play({
                  track: currentTrack,
                  options: { startTime: currentPosition },
                });
              }

              console.log(
                `Successfully migrated player in guild ${player.guildId} to node ${newNode.id}`
              );
            } catch (error) {
              console.error(
                `Failed to migrate player in guild ${player.guildId}:`,
                error
              );
            }
          }
          return;
        }
      }

      console.error("No alternative servers available!");
      // If no alternative servers are available, we'll let the players reconnect automatically
      // when a node becomes available again due to autoReconnect: true
    });

    client.lavalink.nodeManager.on("error", async (node, error) => {
      console.error(`Error on node ${node.id}:`, error);

      // If the error is connection-related, try to switch to another node
      if (
        error.message.includes("connect") ||
        error.message.includes("timeout")
      ) {
        const affectedPlayers = client.lavalink.players.filter(
          (p) => p.node.id === node.id
        );

        // Try other nodes
        for (const server of LAVALINK_SERVERS) {
          if (server.id === node.id) continue;

          const isWorking = await testServerConnection(server);
          if (isWorking) {
            console.log(`Switching to backup node ${server.id} due to error`);
            const newNode = await client.lavalink.nodeManager.createNode(
              server
            );

            // Migrate players
            for (const player of affectedPlayers.values()) {
              try {
                await player.setNode(newNode.id);
              } catch (migrateError) {
                console.error(
                  `Failed to migrate player ${player.guildId}:`,
                  migrateError
                );
              }
            }
            break;
          }
        }
      }
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

    // Handle track errors
    client.lavalink.on("trackError", async (player, track, payload) => {
      console.error("Track error occurred:", {
        guild: player.guildId,
        track: track?.title || "Unknown",
        error: payload.error,
      });

      // If error is connection-related, try to recover
      if (
        payload.error.includes("connection") ||
        payload.error.includes("timeout")
      ) {
        try {
          // Try to restart the track
          if (track) {
            await player.play(track);
            return;
          }
        } catch (error) {
          console.error("Failed to recover from track error:", error);
        }
      }
    });

    console.log("Lavalink initialization completed successfully.");

    client.on("raw", (d) => client.lavalink.sendRawData(d));

    client.lavalink.on("playerDestroy", async (player) => {
      if (player) {
        try {
          await music.deletePlayer(player.guildId);
          player.cleanup && player.cleanup();
        } catch (error) {
          console.error(
            `Failed to cleanup player for guild ${player.guildId}:`,
            error
          );
        }
      }
    });
  } catch (error) {
    console.error("Error in Lavalink setup:", error);
    client.lavalink.isInitialized = false;
  }
}

export default init;
