import { LavalinkManager } from "lavalink-client";
import { fileURLToPath } from "url";
import { basename, dirname, extname, join } from "path";
import fs from "fs";
import path from "path";
import autoPlayFunction from "../handlers/MusicAutoplay.ts";
import {
  LAVALINK_SERVERS,
  debounce,
  testServerConnection,
} from "./musicHelpers.ts";
import { loadMusicPlayersCore } from "./musicRestoreCore.ts";
import { handlePlayerUpdateCore, handleTrackErrorCore } from "./musicEventCore.ts";
import {
  handleNodeDisconnectCore,
  handleNodeErrorCore,
  runNodeHealthCheck,
} from "./musicNodeHelpers.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));

type LavalinkNodeOptions = {
  id: string;
  host: string;
  port: number;
  authorization: string;
  secure: boolean;
};

type PlayerLike = {
  guildId: string;
  textChannelId?: string;
  queue?: {
    current?: any;
    tracks?: any[];
    add: (tracks: any) => Promise<unknown>;
  };
  get: (key: string) => unknown;
  set: (key: string, value: unknown) => void;
  cleanup?: () => void;
};

type ClientLike = {
  user: {
    id: string;
    username: string;
  };
  guilds: {
    cache: {
      get: (guildId: string) => { shard: { send: (payload: unknown) => unknown } } | undefined;
    };
    fetch: (guildId: string) => Promise<any>;
  };
  channels: {
    fetch: (channelId: string) => Promise<any>;
  };
  lavalink?: any;
  on: (eventName: string, handler: (...args: any[]) => unknown) => void;
};

function buildNodeOptions(workingServer: LavalinkNodeOptions): LavalinkNodeOptions {
  const nodeOptions = {
    id: workingServer.id,
    host: workingServer.host,
    port: parseInt(String(workingServer.port), 10),
    authorization: workingServer.authorization,
    secure: workingServer.secure,
  };

  if (
    !nodeOptions.id ||
    !nodeOptions.host ||
    !nodeOptions.port ||
    !nodeOptions.authorization
  ) {
    throw new Error(`Invalid node configuration: ${JSON.stringify(nodeOptions)}`);
  }

  return nodeOptions;
}

async function findWorkingServer(): Promise<LavalinkNodeOptions> {
  console.log("Testing Lavalink servers...");
  for (const server of LAVALINK_SERVERS) {
    console.log(`Testing server ${server.id}...`);
    const isWorking = await testServerConnection(server);
    if (isWorking) {
      console.log(`Server ${server.id} is available`);
      return server;
    }
    console.log(`Server ${server.id} is not responding`);
  }

  throw new Error("No working Lavalink servers found!");
}

function registerRawVoiceQueue(client: ClientLike): Map<string, any> {
  const voiceStateQueue = new Map<string, any>();

  client.on("raw", async (packet: any) => {
    if (!["VOICE_STATE_UPDATE", "VOICE_SERVER_UPDATE"].includes(packet.t)) {
      return;
    }

    if (!client.lavalink || !client.lavalink?.isInitialized) {
      const key = `${packet.d.guild_id}-${packet.t}`;
      voiceStateQueue.set(key, packet);
      return;
    }

    try {
      await client.lavalink.sendRawData(packet);
    } catch (error: any) {
      if (!error.message?.includes("No player found")) {
        console.error("Failed to send voice state to Lavalink:", error);
      }
    }
  });

  return voiceStateQueue;
}

async function processQueuedVoiceStates(
  client: ClientLike,
  voiceStateQueue: Map<string, any>
): Promise<void> {
  for (const [key, packet] of voiceStateQueue.entries()) {
    try {
      await client.lavalink?.sendRawData(packet);
    } catch (error: any) {
      if (!error.message?.includes("No player found")) {
        console.error(`Failed to process queued voice state for ${key}:`, error);
      }
    }
  }
  voiceStateQueue.clear();
}

function registerStatePersistenceEvents(client: ClientLike): void {
  const debouncedSavePlayer = debounce(async (player: PlayerLike) => {
    if (!player?.guildId) {
      return;
    }

    try {
      if (
        !player.queue?.current &&
        (!player.queue?.tracks || player.queue.tracks.length === 0)
      ) {
        console.log(`No content to save for player ${player.guildId}`);
        return;
      }

      const hubClientModule = await import("../api/hubClient.ts");
      await hubClientModule.default.savePlayer(player);
    } catch (error: any) {
      console.error(`Failed to save player state (debounced): ${error.message}`);
    }
  }, 2000);

  client.lavalink.on("trackStart", async (player: any, track: any) => {
    if (track) {
      player.set("lastTrackSource", track.info?.sourceName || "unknown");
      player.set("lastTrackUri", track.info?.uri || null);
    }
    player.set("lastPlayedTrack", track);
    debouncedSavePlayer(player);

    try {
      const eventModule = await import("../events/music/trackStart.ts").catch(() => null);
      if (eventModule?.default && typeof eventModule.default.execute === "function") {
        await (eventModule.default as any).execute(client, player, track);
      }
    } catch (error) {
      console.error("Error executing trackStart event:", error);
    }
  });

  [
    "trackEnd",
    "queueEnd",
    "filterUpdate",
    "playerPause",
    "playerResume",
    "trackAdd",
    "trackRemove",
    "playerSeek",
    "playerVolumeUpdate",
    "playerDisconnect",
    "playerReconnect",
    "playerMove",
  ].forEach((eventName) => {
    client.lavalink.on(eventName, async (...args: any[]) => {
      const player = args[0];
      if (player) {
        debouncedSavePlayer(player);
      }
    });
  });

  client.lavalink.on("playerRepeatModeUpdate", async (player: any) => {
    debouncedSavePlayer(player);
  });

  client.lavalink.on("playerUpdate", async ({ guildId }: { guildId: string }) => {
    await handlePlayerUpdateCore(client as any, guildId, debouncedSavePlayer as any);
  });

  client.lavalink.on("trackError", async (player: any, track: any, payload: any) => {
    await handleTrackErrorCore(client as any, player, track, payload, debouncedSavePlayer as any);
  });

  client.lavalink.on("trackStuck", async (player: any, track: any) => {
    debouncedSavePlayer(player);
    try {
      if (player.queue?.tracks?.length > 0) {
        await player.stop();
      } else if (track) {
        await player.play(track);
      }
    } catch (error) {
      console.error("Failed to recover from stuck track:", error);
    }
  });

  client.lavalink.on("playerDestroy", async (player: any) => {
    if (!player) {
      return;
    }

    try {
      debouncedSavePlayer.cancel?.();
      const hubClientModule = await import("../api/hubClient.ts");
      await hubClientModule.default.deletePlayer(player.guildId);
      player.cleanup && player.cleanup();
    } catch (error: any) {
      if (
        error.message?.includes("Record not found") ||
        error.message?.includes("500 Internal Server Error")
      ) {
        console.log(
          `Player record for guild ${player.guildId} was already deleted or doesn't exist`
        );
      } else {
        console.error(`Failed to cleanup player for guild ${player.guildId}:`, error);
      }
    }
  });
}

async function loadAdditionalMusicEvents(client: ClientLike): Promise<void> {
  const eventsPath = path.join(__dirname, "../events/music");
  const preferredFiles = new Map<string, string>();
  fs.readdirSync(eventsPath, { withFileTypes: true })
    .filter((file) => file.isFile() && (file.name.endsWith(".ts") || file.name.endsWith(".js")))
    .forEach((file) => {
      const extension = extname(file.name);
      const baseName = basename(file.name, extension);
      if (["trackStart", "playerUpdate"].includes(baseName)) {
        return;
      }
      const existing = preferredFiles.get(baseName);
      if (!existing || extension === ".ts") {
        preferredFiles.set(baseName, file.name);
      }
    });
  const eventFiles = Array.from(preferredFiles.values()).map((name) => ({ name }));

  for (const file of eventFiles) {
    const filePath = join(eventsPath, file.name);
    const eventModule = await import(filePath);
    if (eventModule.default && typeof eventModule.default.execute === "function") {
      const eventName = basename(file.name, extname(file.name));
      client.lavalink.on(eventName, (...args: any[]) => {
        eventModule.default.execute(client, ...args);
      });
    }
  }
}

async function registerNodeHandlers(client: ClientLike): Promise<void> {
  client.lavalink.nodeManager.on("connect", async () => {
    await loadMusicPlayersCore(client as any);
  });

  client.lavalink.nodeManager.on("disconnect", async (node: any) => {
    await handleNodeDisconnectCore(client as any, node, LAVALINK_SERVERS);
  });

  client.lavalink.nodeManager.on("error", async (node: any, error: Error) => {
    await handleNodeErrorCore(client as any, node, error, LAVALINK_SERVERS);
  });
}

function registerHealthChecks(client: ClientLike): void {
  const healthCheckInterval = setInterval(() => {
    void runNodeHealthCheck(client as any, LAVALINK_SERVERS);
  }, 5 * 60 * 1000);

  client.on("destroy", () => {
    clearInterval(healthCheckInterval);
  });
}

async function initMusicBootstrapCore(client: ClientLike): Promise<void> {
  try {
    console.log("Initializing Lavalink Manager...");
    const voiceStateQueue = registerRawVoiceQueue(client);
    const workingServer = await findWorkingServer();
    const nodeOptions = buildNodeOptions(workingServer);

    client.lavalink = new LavalinkManager({
      nodes: [nodeOptions],
      sendToShard: (guildId: string, payload: unknown) => {
        const guild = client.guilds.cache.get(guildId);
        if (guild) {
          return guild.shard.send(payload);
        }
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
        useUnresolvedData: true,
        ytOptions: {
          fetchTimeout: 7000,
          maxRetries: 3,
          fallbackOnFail: true,
        },
        onDisconnect: {
          autoReconnect: true,
          destroyPlayer: false,
          maxReconnectAttempts: 5,
          reconnectTimeout: 3000,
        } as any,
        onEmptyQueue: {
          destroyAfterMs: 30_000,
          autoPlayFunction: (async (player: any) => {
            try {
              const autoplayEnabled = player.get("autoplay_enabled");
              if (autoplayEnabled !== true) {
                return null;
              }
              const lastPlayedTrack = player.get("lastPlayedTrack");
              if (!lastPlayedTrack) {
                return null;
              }
              const result = await autoPlayFunction(player, lastPlayedTrack);
              if (!result || result.length === 0) {
                return null;
              }
              await player.queue.add(result);
              return result[0];
            } catch (error) {
              console.error("Error in autoplay function:", error);
              return null;
            }
          }) as any,
        },
      } as any,
      queueOptions: {
        maxPreviousTracks: 1,
        cleanupThreshold: 1000 * 60 * 1,
      } as any,
    });

    let retryCount = 0;
    const maxRetries = 3;
    while (retryCount < maxRetries) {
      try {
        await client.lavalink.init({ ...client.user, shards: "auto" });
        client.lavalink.isInitialized = true;
        break;
      } catch (error) {
        retryCount += 1;
        console.error(`Failed to initialize Lavalink (attempt ${retryCount}/${maxRetries}):`, error);
        if (retryCount === maxRetries) {
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, 2000 * retryCount));
      }
    }

    await processQueuedVoiceStates(client, voiceStateQueue);
    await registerNodeHandlers(client);
    registerStatePersistenceEvents(client);
    await loadAdditionalMusicEvents(client);
    registerHealthChecks(client);

    client.on("raw", (packet: any) => {
      if (["VOICE_STATE_UPDATE", "VOICE_SERVER_UPDATE"].includes(packet.t)) {
        if (client.lavalink?.sendRawData) {
          client.lavalink.sendRawData(packet).catch((error: any) => {
            if (!error.message?.includes("No player found")) {
              console.error("Error sending raw voice data:", error);
            }
          });
        }
      }
    });
  } catch (error) {
    console.error("Error in Lavalink setup:", error);
    if (client.lavalink) {
      client.lavalink.isInitialized = false;
    } else {
      console.error("LavalinkManager was not created successfully");
    }
  }
}

export default initMusicBootstrapCore;
