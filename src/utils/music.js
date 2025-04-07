import { LavalinkManager } from "lavalink-client";
import { fileURLToPath } from "url";
import autoPlayFunction from "../handlers/MusicAutoplay.js";
import music from "../database/music.js";
import { dirname, join } from "path";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const LAVALINK_SERVERS = [
  {
    id: "localhost",
    host: "127.0.0.1",
    port: 8080,
    authorization: "youshallnotpass",
    secure: false,
  },
  /*{
    id: "Catfein DE",
    authorization: "catfein",
    host: "lavalink.alfari.id",
    port: 443,
    secure: true,
  },*/
  {
    id: "Embotic",
    host: "46.202.82.164",
    port: 1027,
    authorization: "jmlitelavalink",
    secure: false,
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
    const savedPlayers = await music.loadPlayers();

    if (!savedPlayers?.length) {
      console.log("No saved music players found");
      return;
    }

    console.log(`Found ${savedPlayers.length} saved music players`);

    // Wait for node to be ready with timeout
    const nodeReadyPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("Timeout waiting for Lavalink node")),
        30000
      );
      const checkNode = setInterval(() => {
        const nodes = Array.from(client.lavalink.nodeManager.nodes.values());
        const readyNode = nodes.find((n) => n?.connected);
        if (readyNode) {
          clearInterval(checkNode);
          clearTimeout(timeout);
          resolve(readyNode);
        }
      }, 1000);
    });

    console.log("Waiting for Lavalink node to be ready...");
    const node = await nodeReadyPromise;
    console.log("Lavalink node ready, proceeding with player restoration");

    // Restore each player
    for (const data of savedPlayers) {
      try {
        // Verify the guild still exists
        const guild = await client.guilds.fetch(data.id);
        if (!guild) {
          console.log(
            `Guild ${data.id} no longer exists, skipping player restoration`
          );
          await music.deletePlayer(data.id);
          continue;
        }

        const voiceChannel = await guild.channels
          .fetch(data.voiceChannelId)
          .catch(() => null);
        if (!voiceChannel) {
          console.log(
            `Voice channel ${data.voiceChannelId} no longer exists in guild ${data.id}`
          );
          await music.deletePlayer(data.id);
          continue;
        }

        // Check if there are any non-bot users in the voice channel
        const nonBotMembers = voiceChannel.members.filter(
          (member) => !member.user.bot
        );
        if (nonBotMembers.size === 0) {
          console.log(
            `No users in voice channel ${data.voiceChannelId}, skipping restoration`
          );
          continue; // Don't delete the player, just skip restoration
        }

        // Check voice channel permissions
        const permissions = voiceChannel.permissionsFor(client.user);
        if (!permissions.has(["Connect", "Speak"])) {
          console.log(`Missing voice channel permissions in guild ${data.id}`);
          continue; // Don't delete the player, just skip restoration
        }

        console.log(
          `Creating player for guild ${data.id} with voice channel ${data.voiceChannelId}`
        );

        // Create new player
        const player = await client.lavalink.createPlayer({
          guildId: data.id,
          voiceChannelId: data.voiceChannelId,
          textChannelId: data.textChannelId,
          selfDeaf: true,
          node: node.id,
        });

        // Try to establish voice connection
        let connected = false;
        for (let attempt = 0; attempt < 3 && !connected; attempt++) {
          try {
            console.log(
              `Attempting to connect to voice channel (attempt ${
                attempt + 1
              }/3)`
            );

            // Verify channel still has non-bot users
            const currentNonBotMembers = voiceChannel.members.filter(
              (member) => !member.user.bot
            );
            if (currentNonBotMembers.size === 0) {
              throw new Error("No users in voice channel");
            }

            // Clear any existing voice state
            if (guild.members.me.voice.channelId) {
              await guild.members.me.voice.disconnect().catch(() => null);
              await new Promise((resolve) => setTimeout(resolve, 1000));
            }

            // Connect the player
            await player.connect();
            await new Promise((resolve) => setTimeout(resolve, 2000));

            // Verify connection
            if (guild.members.me.voice.channelId === data.voiceChannelId) {
              connected = true;
              console.log(
                `Successfully connected to voice channel in guild ${data.id}`
              );
            } else {
              throw new Error("Voice connection verification failed");
            }
          } catch (error) {
            console.error(`Connection attempt ${attempt + 1} failed:`, error);
            if (attempt === 2) throw error;
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }
        }

        if (!connected) {
          throw new Error(
            "Failed to establish voice connection after all attempts"
          );
        }

        // Restore player settings
        await player.setVolume(data.volume);
        player.repeatMode = data.repeatMode;
        player.set("autoplay_enabled", data.autoplay);
        if (data.filters && Object.keys(data.filters).length) {
          await player.setFilters(data.filters);
        }

        // Create requester object
        const createRequesterObject = (trackData) => {
          if (!trackData?.requesterData) return null;

          const requesterData = trackData.requesterData;
          return {
            id: requesterData.id,
            username: requesterData.username || "Unknown User",
            displayName:
              requesterData.displayName ||
              requesterData.username ||
              "Unknown User",
            locale: requesterData.locale || "en",
            displayAvatarURL: () =>
              requesterData.avatarURL ||
              `https://cdn.discordapp.com/embed/avatars/${Math.floor(
                Math.random() * 5
              )}.png`,
            avatarURL:
              requesterData.avatarURL ||
              `https://cdn.discordapp.com/embed/avatars/${Math.floor(
                Math.random() * 5
              )}.png`,
            // Add user-like methods to match Discord.js User interface
            toString: () => `<@${requesterData.id}>`,
            tag: requesterData.username || "Unknown User",
          };
        };

        // Restore queue tracks
        if (data.queue && data.queue.length) {
          for (const track of data.queue) {
            try {
              const resolvedTrack = await node.decode.singleTrack(
                track.encoded
              );
              if (resolvedTrack) {
                Object.assign(resolvedTrack, {
                  info: track.info,
                  requester: createRequesterObject(track),
                });
                player.queue.add(resolvedTrack);
              }
            } catch (error) {
              console.error(
                `Failed to decode track in queue for guild ${data.id}:`,
                error
              );
            }
          }
        }

        // Restore current track if it exists
        if (data.currentTrack && connected) {
          try {
            const currentTrack = await node.decode.singleTrack(
              data.currentTrack.encoded
            );
            if (currentTrack) {
              Object.assign(currentTrack, {
                info: data.currentTrack.info,
                requester: createRequesterObject(data.currentTrack),
              });

              // Start playing from the saved position
              await player.play({
                track: currentTrack,
                options: {
                  startTime: data.position,
                  paused: false,
                },
              });
            }
          } catch (error) {
            console.error(
              `Failed to restore current track for guild ${data.id}:`,
              error
            );
            // If current track fails, try to play next in queue
            if (player.queue.tracks.length > 0) {
              await player.play(player.queue.tracks[0]);
            }
          }
        } else if (connected && player.queue.tracks.length > 0) {
          // If no current track but queue has tracks, start playing
          await player.play(player.queue.tracks[0]);
        }

        console.log(`Successfully restored music player for guild ${data.id}`);
      } catch (error) {
        console.error(`Failed to restore player for guild ${data.id}:`, error);
        if (
          error.message.includes("No users in voice") ||
          error.code === 40032
        ) {
          console.log("Skipping player deletion due to voice channel state");
          continue;
        }
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

    // Set up raw packet handling first to catch all voice state updates
    const voiceStateQueue = new Map();

    client.on("raw", async (packet) => {
      if (!["VOICE_STATE_UPDATE", "VOICE_SERVER_UPDATE"].includes(packet.t))
        return;

      if (!client.lavalink?.isInitialized) {
        // Queue voice states until Lavalink is ready
        const key = `${packet.d.guild_id}-${packet.t}`;
        voiceStateQueue.set(key, packet);
        return;
      }

      try {
        await client.lavalink.sendRawData(packet);
      } catch (error) {
        console.error("Failed to send voice state to Lavalink:", error);
      }
    });

    // Remove the interval-based save system

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

    // Handle voice state updates before creating Lavalink instance
    client.on("raw", async (packet) => {
      if (!["VOICE_STATE_UPDATE", "VOICE_SERVER_UPDATE"].includes(packet.t))
        return;

      // Forward these events to Lavalink once it's initialized
      if (client.lavalink?.isInitialized) {
        await client.lavalink.sendRawData(packet);
      }
    });

    // Initialize Lavalink after voice handling is set up
    client.lavalink = new LavalinkManager({
      nodes: [workingServer],
      sendToShard: (guildId, payload) => {
        const guild = client.guilds.cache.get(guildId);
        if (guild) return guild.shard.send(payload);
      },
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

    // Initialize the connection
    await client.lavalink.init({ ...client.user, shards: "auto" });
    client.lavalink.isInitialized = true;

    // Process any queued voice states
    for (const [key, packet] of voiceStateQueue.entries()) {
      try {
        await client.lavalink.sendRawData(packet);
      } catch (error) {
        console.error(
          `Failed to process queued voice state for ${key}:`,
          error
        );
      }
    }
    voiceStateQueue.clear();

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
      await music.savePlayer(player).catch((error) => {
        console.error("Failed to save player state on trackStart:", error);
      });

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

    client.lavalink.on("trackEnd", async (player) => {
      await music.savePlayer(player).catch((error) => {
        console.error("Failed to save player state on trackEnd:", error);
      });
    });

    client.lavalink.on("queueEnd", async (player) => {
      console.log("Queue ended, saving state");
      await music.savePlayer(player).catch((error) => {
        console.error("Failed to save player state on queueEnd:", error);
      });
    });

    // Add state saving for filters
    client.lavalink.on("filterUpdate", async (player) => {
      console.log("Filters updated, saving state");
      await music.savePlayer(player).catch((error) => {
        console.error("Failed to save player state on filterUpdate:", error);
      });
    });

    // Add state saving for pause/resume
    client.lavalink.on("playerPause", async (player) => {
      console.log("Player paused, saving state");
      await music.savePlayer(player).catch((error) => {
        console.error("Failed to save player state on pause:", error);
      });
    });

    client.lavalink.on("playerResume", async (player) => {
      console.log("Player resumed, saving state");
      await music.savePlayer(player).catch((error) => {
        console.error("Failed to save player state on resume:", error);
      });
    });

    // Add state saving for repeat mode changes
    client.lavalink.on("playerRepeatModeUpdate", async (player, mode) => {
      console.log(`Repeat mode changed to ${mode}, saving state`);
      await music.savePlayer(player).catch((error) => {
        console.error(
          "Failed to save player state on repeat mode update:",
          error
        );
      });
    });

    // Track add/remove events
    client.lavalink.on("trackAdd", async (player) => {
      console.log("Track added to queue, saving state");
      await music.savePlayer(player).catch((error) => {
        console.error("Failed to save player state on trackAdd:", error);
      });
    });

    client.lavalink.on("trackRemove", async (player) => {
      console.log("Track removed from queue, saving state");
      await music.savePlayer(player).catch((error) => {
        console.error("Failed to save player state on trackRemove:", error);
      });
    });

    // Handle seeking
    client.lavalink.on("playerSeek", async (player) => {
      console.log("Player seeked, saving state");
      await music.savePlayer(player).catch((error) => {
        console.error("Failed to save player state on seek:", error);
      });
    });

    // Handle autoplay changes
    client.lavalink.on("playerUpdate", async ({ guildId, state }) => {
      const player = client.lavalink.getPlayer(guildId);
      if (!player) return;

      // Save state for any player update including autoplay changes
      await music.savePlayer(player).catch((error) => {
        console.error("Failed to save player state on player update:", error);
      });

      // Rest of existing playerUpdate code...
      if (player?.queue?.current) {
        // Ensure requester object has all necessary methods
        if (
          player.queue.current.requester &&
          !player.queue.current.requester.displayAvatarURL
        ) {
          const requesterData = player.queue.current.requester;
          player.queue.current.requester = {
            ...requesterData,
            displayAvatarURL: () =>
              requesterData.avatarURL ||
              `https://cdn.discordapp.com/embed/avatars/${Math.floor(
                Math.random() * 5
              )}.png`,
            toString: () => `<@${requesterData.id}>`,
            tag: requesterData.username || "Unknown User",
          };
        }
      }

      console.log("Player state in playerUpdate:", {
        guildId,
        hasMessage: !!player.nowPlayingMessage,
        messageId: player.nowPlayingMessage?.id,
        hasRequester: !!player.queue?.current?.requester,
        requesterInfo: player.queue?.current?.requester
          ? {
              id: player.queue.current.requester.id,
              username: player.queue.current.requester.username,
              avatar: player.queue.current.requester.avatarURL,
            }
          : null,
      });

      const eventModule = await import("../events/music/playerUpdate.js");
      if (
        eventModule.default &&
        typeof eventModule.default.execute === "function"
      ) {
        await eventModule.default.execute(client, player);
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
      const filePath = join(eventsPath, file.name);
      const eventModule = await import(filePath);

      if (
        eventModule.default &&
        typeof eventModule.default.execute === "function"
      ) {
        const eventName = file.name.replace(".js", "");
        console.log(`Loaded event: ${eventName} (music player)`);
        client.lavalink.on(eventName, (...args) => {
          console.log(`Executing event: ${eventName}`);
          eventModule.default.execute(client, ...args);
        });
      } else {
        console.log(`Invalid event file: ${file.name}`);
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

    // Handle volume changes
    client.lavalink.on(
      "playerVolumeUpdate",
      async (player, oldVolume, newVolume) => {
        console.log(
          `Volume changed from ${oldVolume} to ${newVolume}, saving state`
        );
        await music.savePlayer(player).catch((error) => {
          console.error("Failed to save player state on volume update:", error);
        });
      }
    );

    // Handle disconnect and reconnect
    client.lavalink.on("playerDisconnect", async (player) => {
      console.log("Player disconnected, saving state");
      await music.savePlayer(player).catch((error) => {
        console.error("Failed to save player state on disconnect:", error);
      });
    });

    client.lavalink.on("playerReconnect", async (player) => {
      console.log("Player reconnected, saving state");
      await music.savePlayer(player).catch((error) => {
        console.error("Failed to save player state on reconnect:", error);
      });
    });

    // Handle move between voice channels
    client.lavalink.on("playerMove", async (player, oldChannel, newChannel) => {
      console.log(
        `Player moved from ${oldChannel} to ${newChannel}, saving state`
      );
      await music.savePlayer(player).catch((error) => {
        console.error("Failed to save player state on move:", error);
      });
    });

    client.lavalink.on("trackStuck", async (player, track) => {
      console.log("Track stuck, saving state before handling");
      await music.savePlayer(player).catch((error) => {
        console.error("Failed to save player state on track stuck:", error);
      });
    });

    console.log("Lavalink initialization completed successfully.");

    // We already have raw event handler above, so we don't need the direct voice state handler
    client.on("raw", (d) => {
      // Only forward voice-related packets when Lavalink is initialized
      if (["VOICE_STATE_UPDATE", "VOICE_SERVER_UPDATE"].includes(d.t)) {
        client.lavalink?.sendRawData(d).catch((error) => {
          // Only log error if it's not related to missing player
          if (!error.message?.includes("No player found")) {
            console.error("Error sending raw voice data:", error);
          }
        });
      }
    });

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
