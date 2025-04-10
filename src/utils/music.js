import { LavalinkManager } from "lavalink-client";
import { fileURLToPath } from "url";
import autoPlayFunction from "../handlers/MusicAutoplay.js";
import music from "../database/music.js";
import { dirname, join } from "path";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Utility function to safely get avatar URLs
function getAvatarUrl(user) {
  if (!user) return null;
  
  try {
    // If avatarURL is a function, call it
    if (typeof user.avatarURL === 'function') {
      return user.avatarURL();
    }
    // If it's a string, use it directly
    if (typeof user.avatarURL === 'string') {
      return user.avatarURL;
    }
    // Try displayAvatarURL next
    if (typeof user.displayAvatarURL === 'function') {
      return user.displayAvatarURL();
    }
    // Last resort - just return null
    return null;
  } catch (error) {
    console.error("Error getting avatar URL:", error);
    return null;
  }
}

const LAVALINK_SERVERS = [
  {
    id: "INZEWORLD.COM (DE)",
    authorization: "saher.inzeworld.com",
    host: "lava.inzeworld.com",
    port: 3128,
    secure: false,
  },
  /*{
    id: "localhost",
    host: "127.0.0.1",
    port: 8080,
    authorization: "youshallnotpass",
    secure: false,
  },*/
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

function debounce(func, wait) {
  let timeout;

  const debounced = function (...args) {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), wait);
  };

  debounced.cancel = function () {
    clearTimeout(timeout);
  };

  return debounced;
}

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
    const savedPlayers = await music.loadPlayers().catch((err) => {
      console.error("Failed to load music players from database:", err);
      return [];
    });

    if (!savedPlayers?.length) {
      console.log("No saved music players found");
      return;
    }

    console.log(`Found ${savedPlayers.length} saved music players`);

    // Wait for node to be ready with timeout
    let node;
    try {
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
      node = await nodeReadyPromise;
      console.log("Lavalink node ready, proceeding with player restoration");
    } catch (error) {
      console.error("Failed to find a ready Lavalink node:", error);
      return;
    }

    if (!node) {
      console.error("No available Lavalink node found");
      return;
    }

    // Process players one at a time to avoid overloading
    for (const data of savedPlayers) {
      try {
        // Verify the guild still exists
        const guild = await client.guilds.fetch(data.id).catch(() => null);
        if (!guild) {
          console.log(
            `Guild ${data.id} no longer exists, skipping player restoration`
          );
          await music.deletePlayer(data.id).catch(() => null);
          continue;
        }

        const voiceChannel = await guild.channels
          .fetch(data.voiceChannelId)
          .catch(() => null);
        if (!voiceChannel) {
          console.log(
            `Voice channel ${data.voiceChannelId} no longer exists in guild ${data.id}`
          );
          await music.deletePlayer(data.id).catch(() => null);
          continue;
        }

        // Only proceed if it's a voice channel
        if (voiceChannel.type !== 2) {
          // 2 is GUILD_VOICE
          console.log(
            `Channel ${data.voiceChannelId} is not a voice channel, skipping`
          );
          await music.deletePlayer(data.id).catch(() => null);
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
        if (!permissions || !permissions.has(["Connect", "Speak"])) {
          console.log(`Missing voice channel permissions in guild ${data.id}`);
          continue; // Don't delete the player, just skip restoration
        }

        console.log(
          `Creating player for guild ${data.id} with voice channel ${data.voiceChannelId}`
        );

        // Create new player with timeout protection
        let player;
        try {
          const createPlayerPromise = client.lavalink.createPlayer({
            guildId: data.id,
            voiceChannelId: data.voiceChannelId,
            textChannelId: data.textChannelId,
            selfDeaf: true,
            node: node.id,
          });

          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error("Player creation timed out")),
              10000
            )
          );

          player = await Promise.race([createPlayerPromise, timeoutPromise]);
        } catch (error) {
          console.error(`Failed to create player for guild ${data.id}:`, error);
          continue;
        }

        if (!player) {
          console.error(`Failed to create player for guild ${data.id}`);
          continue;
        }

        // Try to establish voice connection with timeout protection
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

            // Connect the player with timeout
            const connectPromise = player.connect();
            const connectTimeoutPromise = new Promise((_, reject) =>
              setTimeout(
                () => reject(new Error("Voice connection timed out")),
                5000
              )
            );
            await Promise.race([connectPromise, connectTimeoutPromise]);

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
          console.log(
            "Failed to establish voice connection after all attempts, skipping player restoration"
          );
          continue;
        }

        try {
          // Restore player settings
          await player.setVolume(data.volume);
          player.repeatMode = data.repeatMode;
          player.set("autoplay_enabled", data.autoplay);
          if (data.filters && Object.keys(data.filters).length) {
            await player.setFilters(data.filters).catch((err) => {
              console.error(`Failed to set filters for guild ${data.id}:`, err);
            });
          }

          // Create requester object - using a safe function with error handling
          const createRequesterObject = (trackData) => {
            try {
              if (!trackData?.requesterData) return null;

              const requesterData = trackData.requesterData;
              const avatarUrl =
                requesterData.avatarURL ||
                `https://cdn.discordapp.com/embed/avatars/${Math.floor(
                  Math.random() * 5
                )}.png`;

              return {
                id: requesterData.id,
                username: requesterData.username || "Unknown User",
                displayName:
                  requesterData.displayName ||
                  requesterData.username ||
                  "Unknown User",
                locale: requesterData.locale || "en",
                displayAvatarURL: () => avatarUrl,
                avatarURL: avatarUrl,
                toString: () => `<@${requesterData.id}>`,
                tag: requesterData.username || "Unknown User",
              };
            } catch (error) {
              console.error("Error creating requester object:", error);
              return null;
            }
          };

          // Restore queue tracks (with a limit to avoid memory issues)
          const MAX_QUEUE_RESTORE = 50; // Limit to 50 tracks to avoid memory issues

          if (data.queue && data.queue.length) {
            const queueToRestore = data.queue.slice(0, MAX_QUEUE_RESTORE);
            let restoredTracks = 0;

            for (const track of queueToRestore) {
              try {
                if (!track?.encoded) {
                  console.log("Skipping track with missing encoded data");
                  continue;
                }

                const resolvedTrack = await node.decode
                  .singleTrack(track.encoded)
                  .catch(() => null);
                if (resolvedTrack) {
                  Object.assign(resolvedTrack, {
                    info: track.info || {},
                    requester: createRequesterObject(track),
                  });
                  player.queue.add(resolvedTrack);
                  restoredTracks++;
                }
              } catch (error) {
                console.error(
                  `Failed to decode track in queue for guild ${data.id}:`,
                  error
                );
              }
            }

            console.log(
              `Restored ${restoredTracks} tracks to the queue for guild ${data.id}`
            );
          }

          // Add small delay before attempting to restore current track
          await new Promise((resolve) => setTimeout(resolve, 1000));

          // Restore current track if it exists
          if (data.currentTrack && data.currentTrack.encoded && connected) {
            try {
              const currentTrack = await node.decode
                .singleTrack(data.currentTrack.encoded)
                .catch(() => null);

              if (currentTrack) {
                Object.assign(currentTrack, {
                  info: data.currentTrack.info || {},
                  requester: createRequesterObject(data.currentTrack),
                });

                // Start playing from the saved position
                await player
                  .play({
                    track: currentTrack,
                    options: {
                      startTime: Math.max(0, data.position || 0),
                      paused: false,
                    },
                  })
                  .catch((err) => {
                    console.error(
                      `Failed to play current track for guild ${data.id}:`,
                      err
                    );
                  });
              }
            } catch (error) {
              console.error(
                `Failed to restore current track for guild ${data.id}:`,
                error
              );
              // If current track fails, try to play next in queue
              if (player.queue.tracks.length > 0) {
                await player.play(player.queue.tracks[0]).catch((err) => {
                  console.error(
                    `Failed to play next track for guild ${data.id}:`,
                    err
                  );
                });
              }
            }
          } else if (connected && player.queue.tracks.length > 0) {
            // If no current track but queue has tracks, start playing
            await player.play(player.queue.tracks[0]).catch((err) => {
              console.error(
                `Failed to play first track for guild ${data.id}:`,
                err
              );
            });
          }

          console.log(
            `Successfully restored music player for guild ${data.id}`
          );

          // Add a small delay between processing players to reduce load
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch (playerError) {
          console.error(
            `Error setting up player for guild ${data.id}:`,
            playerError
          );
        }
      } catch (error) {
        console.error(`Failed to restore player for guild ${data.id}:`, error);
        if (
          error.message?.includes("No users in voice") ||
          error.code === 40032
        ) {
          console.log("Skipping player deletion due to voice channel state");
          continue;
        }
        await music.deletePlayer(data.id).catch(() => null);
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
        if (!error.message?.includes("No player found")) {
          console.error("Failed to send voice state to Lavalink:", error);
        }
      }
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

    // Initialize Lavalink with improved error handling
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

              if (!lastPlayedTrack) {
                console.log("No last played track found, cannot autoplay");
                return null;
              }

              const result = await autoPlayFunction(player, lastPlayedTrack);
              if (!result || result.length === 0) {
                console.log("No tracks found for autoplay");
                return null;
              }

              await player.queue.add(result);
              return result[0];
            } catch (error) {
              console.error("Error in autoplay function:", error);
              return null;
            }
          },
        },
      },
      queueOptions: {
        maxPreviousTracks: 1,
        cleanupThreshold: 1000 * 60 * 1,
      },
    });

    // Initialize the connection with retry logic
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        await client.lavalink.init({ ...client.user, shards: "auto" });
        client.lavalink.isInitialized = true;
        break;
      } catch (error) {
        retryCount++;
        console.error(
          `Failed to initialize Lavalink (attempt ${retryCount}/${maxRetries}):`,
          error
        );
        if (retryCount === maxRetries) {
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, 2000 * retryCount));
      }
    }

    // Process any queued voice states
    for (const [key, packet] of voiceStateQueue.entries()) {
      try {
        await client.lavalink.sendRawData(packet);
      } catch (error) {
        if (!error.message?.includes("No player found")) {
          console.error(
            `Failed to process queued voice state for ${key}:`,
            error
          );
        }
      }
    }
    voiceStateQueue.clear();

    // Set up node event handlers with improved error handling
    client.lavalink.nodeManager.on("connect", async (node) => {
      console.log(`Node ${node.id} connected successfully!`);
      try {
        await loadMusicPlayers(client);
      } catch (error) {
        console.error(
          "Failed to load music players after node connect:",
          error
        );
      }
    });

    client.lavalink.nodeManager.on("disconnect", async (node, reason) => {
      console.error(`Node ${node.id} disconnected. Reason:`, reason);
      try {
        const affectedPlayers = client.lavalink.players.filter(
          (p) => p.node.id === node.id
        );

        for (const server of LAVALINK_SERVERS) {
          if (server.id === node.id) continue;

          const isWorking = await testServerConnection(server);
          if (isWorking) {
            console.log(`Connecting to alternative server ${server.id}`);
            const newNode = await client.lavalink.nodeManager.createNode(
              server
            );

            for (const player of affectedPlayers.values()) {
              try {
                const currentState = player.playing;
                const currentPosition = player.position;
                const currentTrack = player.queue.current;

                await player.setNode(newNode.id);

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
      } catch (error) {
        console.error("Error handling node disconnect:", error);
      }
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

    // Add this variable before the event handlers
    const debouncedSavePlayer = debounce(async (player) => {
      if (!player?.guildId) return;

      try {
        // Check if there's actually something to save
        if (
          !player.queue?.current &&
          (!player.queue?.tracks || player.queue.tracks.length === 0)
        ) {
          console.log(`No content to save for player ${player.guildId}`);
          return;
        }
        await music.savePlayer(player);
      } catch (error) {
        console.error(
          `Failed to save player state (debounced): ${error.message}`
        );
      }
    }, 2000); // 2 second debounce

    client.lavalink.on("trackStart", async (player, track) => {
      console.log("Track started, storing track info");
      player.set("lastPlayedTrack", track);
      debouncedSavePlayer(player);

      // Execute trackStart event
      try {
        const eventModule = await import("../events/music/trackStart.js").catch(
          () => null
        );
        if (
          eventModule?.default &&
          typeof eventModule.default.execute === "function"
        ) {
          await eventModule.default.execute(client, player, track);
        }
      } catch (error) {
        console.error("Error executing trackStart event:", error);
      }
    });

    client.lavalink.on("trackEnd", async (player) => {
      debouncedSavePlayer(player);
    });

    client.lavalink.on("queueEnd", async (player) => {
      console.log("Queue ended, saving state");
      debouncedSavePlayer(player);
    });

    // Add state saving for filters
    client.lavalink.on("filterUpdate", async (player) => {
      console.log("Filters updated, saving state");
      debouncedSavePlayer(player);
    });

    // Add state saving for pause/resume
    client.lavalink.on("playerPause", async (player) => {
      console.log("Player paused, saving state");
      debouncedSavePlayer(player);
    });

    client.lavalink.on("playerResume", async (player) => {
      console.log("Player resumed, saving state");
      debouncedSavePlayer(player);
    });

    // Add state saving for repeat mode changes
    client.lavalink.on("playerRepeatModeUpdate", async (player, mode) => {
      console.log(`Repeat mode changed to ${mode}, saving state`);
      debouncedSavePlayer(player);
    });

    // Track add/remove events
    client.lavalink.on("trackAdd", async (player) => {
      console.log("Track added to queue, saving state");
      debouncedSavePlayer(player);
    });

    client.lavalink.on("trackRemove", async (player) => {
      console.log("Track removed from queue, saving state");
      debouncedSavePlayer(player);
    });

    // Handle seeking
    client.lavalink.on("playerSeek", async (player) => {
      console.log("Player seeked, saving state");
      debouncedSavePlayer(player);
    });

    // Handle autoplay changes
    client.lavalink.on("playerUpdate", async ({ guildId, state }) => {
      try {
        const player = client.lavalink.getPlayer(guildId);
        if (!player) return;

        // Use debounced save instead of immediate save
        debouncedSavePlayer(player);

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

        // Check if player is connected to voice
        if (player.voiceChannelId && !player.voice?.connection) {
          try {
            const guild = await client.guilds.fetch(guildId).catch((err) => {
              console.error(`Failed to fetch guild ${guildId}:`, err);
              return null;
            });

            if (!guild) {
              console.log("Guild not found, skipping reconnection");
              return;
            }

            const voiceChannel = await guild.channels
              .fetch(player.voiceChannelId)
              .catch((err) => {
                console.error(
                  `Failed to fetch voice channel ${player.voiceChannelId}:`,
                  err
                );
                return null;
              });

            if (!voiceChannel) {
              console.log("Voice channel not found, skipping reconnection");
              return;
            }

            // Check if there are any non-bot users in the voice channel
            const nonBotMembers = voiceChannel.members.filter(
              (member) => !member.user.bot
            );
            if (nonBotMembers.size === 0) {
              console.log("No users in voice channel, skipping reconnection");
              return;
            }

            // Check voice channel permissions
            const permissions = voiceChannel.permissionsFor(client.user);
            if (!permissions || !permissions.has(["Connect", "Speak"])) {
              console.log(
                "Missing voice channel permissions, skipping reconnection"
              );
              return;
            }

            // Only try to connect if not already in voice
            if (!guild.members.me.voice.channelId) {
              await player.connect().catch((err) => {
                console.error("Error connecting to voice:", err);
              });
              console.log("Successfully reconnected to voice channel");

              // Delay before attempting to play to ensure connection is established
              await new Promise((resolve) => setTimeout(resolve, 1000));
            }
          } catch (error) {
            console.error("Failed to reconnect to voice channel:", error);
            return;
          }
        }

        // Check if player is playing and has a current track
        if (player.queue?.current && !player.playing && !player.paused) {
          console.log(
            "Player has current track but not playing, attempting to play..."
          );
          try {
            await player.play().catch((err) => {
              console.error("Error playing track:", err);
            });
            console.log("Started playing current track");
          } catch (error) {
            console.error("Failed to resume playback:", error);
          }
        }
        // Check if player has tracks in queue but no current track
        else if (!player.queue?.current && player.queue?.tracks?.length > 0) {
          console.log(
            "Player has tracks in queue but no current track, playing next track"
          );
          try {
            const nextTrack = player.queue.tracks[0];
            await player.play(nextTrack).catch((err) => {
              console.error("Error playing next track:", err);
            });
            console.log("Started playing next track from queue");
          } catch (error) {
            console.error("Failed to play next track:", error);
          }
        }

        // Try to process the player update event if module exists
        try {
          const eventModule = await import(
            "../events/music/playerUpdate.js"
          ).catch(() => null);
          if (
            eventModule?.default &&
            typeof eventModule.default.execute === "function"
          ) {
            await eventModule.default.execute(client, player);
          }
        } catch (eventError) {
          console.error("Error in playerUpdate event module:", eventError);
        }
      } catch (error) {
        console.error("Error in playerUpdate handler:", error);
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
        error: payload?.error || payload?.exception?.message || "Unknown error",
      });

      // If error is connection-related, try to recover
      if (
        payload?.error?.includes?.("connection") ||
        payload?.error?.includes?.("timeout") ||
        payload?.exception?.message?.includes?.("connection") ||
        payload?.exception?.message?.includes?.("timeout")
      ) {
        try {
          // Try to restart the track
          if (track) {
            await player
              .play(track)
              .catch((e) => console.error("Error restarting track:", e));
            return;
          }
        } catch (error) {
          console.error("Failed to recover from track error:", error);
        }
      }

      // Save state regardless of recovery attempt
      debouncedSavePlayer(player);
    });

    // Handle volume changes
    client.lavalink.on(
      "playerVolumeUpdate",
      async (player, oldVolume, newVolume) => {
        console.log(
          `Volume changed from ${oldVolume} to ${newVolume}, saving state`
        );
        debouncedSavePlayer(player);
      }
    );

    // Handle disconnect and reconnect
    client.lavalink.on("playerDisconnect", async (player) => {
      console.log("Player disconnected, saving state");
      debouncedSavePlayer(player);
    });

    client.lavalink.on("playerReconnect", async (player) => {
      console.log("Player reconnected, saving state");
      debouncedSavePlayer(player);
    });

    // Handle move between voice channels
    client.lavalink.on("playerMove", async (player, oldChannel, newChannel) => {
      console.log(
        `Player moved from ${oldChannel} to ${newChannel}, saving state`
      );
      debouncedSavePlayer(player);
    });

    client.lavalink.on("trackStuck", async (player, track) => {
      console.log("Track stuck, saving state before handling");
      debouncedSavePlayer(player);
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
          // Cancel any pending saves for this player
          debouncedSavePlayer.cancel?.();

          // Directly delete from database without debounce
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
