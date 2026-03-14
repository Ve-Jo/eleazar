import hubClient from "../api/hubClient.ts";
import {
  createRequesterObject,
  restoreQueueTracks,
  restoreCurrentTrack,
} from "./musicRestoreHelpers.ts";

type PersistedPlayerData = {
  id: string;
  voiceChannelId: string;
  textChannelId?: string;
  volume?: number;
  repeatMode?: unknown;
  autoplay?: boolean;
  filters?: Record<string, unknown>;
  queue?: Array<{
    encoded?: string;
    info?: Record<string, unknown>;
    requesterData?: {
      id?: string;
      username?: string;
      displayName?: string;
      locale?: string;
      avatarURL?: string;
    };
  }>;
  currentTrack?: {
    encoded?: string;
    info?: Record<string, unknown>;
    requesterData?: {
      id?: string;
      username?: string;
      displayName?: string;
      locale?: string;
      avatarURL?: string;
    };
  };
  position?: number;
};

type LavalinkNodeLike = {
  id: string;
  connected?: boolean;
  decode: {
    singleTrack: (encoded: string) => Promise<any>;
  };
};

type PlayerLike = {
  queue: {
    add: (track: any) => Promise<unknown> | unknown;
    tracks: any[];
  };
  connect: () => Promise<unknown>;
  play: (payload?: unknown) => Promise<unknown>;
  setVolume: (volume?: number) => Promise<unknown>;
  set: (key: string, value: unknown) => void;
  setFilters: (filters: Record<string, unknown>) => Promise<unknown>;
  repeatMode: unknown;
};

type VoiceChannelLike = {
  type: number;
  members: {
    filter: (predicate: (member: { user: { bot?: boolean } }) => boolean) => {
      size: number;
    };
  };
  permissionsFor: (user: unknown) => { has: (permissions: string[]) => boolean } | null;
};

type GuildLike = {
  channels: {
    fetch: (channelId: string) => Promise<VoiceChannelLike | null>;
  };
  members: {
    me: {
      voice: {
        channelId?: string | null;
        disconnect: () => Promise<unknown>;
      };
    };
  };
};

type ClientLike = {
  user?: unknown;
  guilds: {
    fetch: (guildId: string) => Promise<GuildLike | null>;
  };
  lavalink: {
    nodeManager?: {
      nodes: {
        values: () => Iterable<LavalinkNodeLike>;
      };
    };
    createPlayer: (options: {
      guildId: string;
      voiceChannelId: string;
      textChannelId?: string;
      selfDeaf: boolean;
      node: string;
    }) => Promise<PlayerLike>;
  };
};

async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForReadyNode(client: ClientLike): Promise<LavalinkNodeLike | null> {
  try {
    if (!client.lavalink || !client.lavalink.nodeManager) {
      throw new Error("LavalinkManager not properly initialized");
    }

    const nodeReadyPromise = new Promise<LavalinkNodeLike>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("Timeout waiting for Lavalink node")),
        30000
      );
      const checkNode = setInterval(() => {
        const nodes = Array.from(client.lavalink.nodeManager!.nodes.values());
        const readyNode = nodes.find((node) => node?.connected);
        if (readyNode) {
          clearInterval(checkNode);
          clearTimeout(timeout);
          resolve(readyNode);
        }
      }, 1000);
    });

    console.log("Waiting for Lavalink node to be ready...");
    return await nodeReadyPromise;
  } catch (error) {
    console.error("Failed to find a ready Lavalink node:", error);
    return null;
  }
}

async function createAndConnectPlayer(
  client: ClientLike,
  node: LavalinkNodeLike,
  data: PersistedPlayerData,
  guild: GuildLike,
  voiceChannel: VoiceChannelLike
): Promise<{ player: PlayerLike | null; connected: boolean }> {
  let player: PlayerLike | null = null;

  try {
    const createPlayerPromise = client.lavalink.createPlayer({
      guildId: data.id,
      voiceChannelId: data.voiceChannelId,
      textChannelId: data.textChannelId,
      selfDeaf: true,
      node: node.id,
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Player creation timed out")), 10000)
    );

    player = await Promise.race([createPlayerPromise, timeoutPromise]);
  } catch (error) {
    console.error(`Failed to create player for guild ${data.id}:`, error);
    return { player: null, connected: false };
  }

  if (!player) {
    console.error(`Failed to create player for guild ${data.id}`);
    return { player: null, connected: false };
  }

  let connected = false;
  for (let attempt = 0; attempt < 3 && !connected; attempt += 1) {
    try {
      console.log(`Attempting to connect to voice channel (attempt ${attempt + 1}/3)`);
      const currentNonBotMembers = voiceChannel.members.filter((member) => !member.user.bot);
      if (currentNonBotMembers.size === 0) {
        throw new Error("No users in voice channel");
      }

      if (guild.members.me.voice.channelId) {
        await guild.members.me.voice.disconnect().catch(() => null);
        await wait(1000);
      }

      const connectPromise = player.connect();
      const connectTimeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Voice connection timed out")), 5000)
      );
      await Promise.race([connectPromise, connectTimeoutPromise]);
      await wait(2000);

      if (guild.members.me.voice.channelId === data.voiceChannelId) {
        connected = true;
        console.log(`Successfully connected to voice channel in guild ${data.id}`);
      } else {
        throw new Error("Voice connection verification failed");
      }
    } catch (error) {
      console.error(`Connection attempt ${attempt + 1} failed:`, error);
      if (attempt === 2) {
        return { player, connected: false };
      }
      await wait(2000);
    }
  }

  return { player, connected };
}

async function restoreSingleMusicPlayer(
  client: ClientLike,
  node: LavalinkNodeLike,
  data: PersistedPlayerData
): Promise<void> {
  try {
    const guild = await client.guilds.fetch(data.id).catch(() => null);
    if (!guild) {
      console.log(`Guild ${data.id} no longer exists, skipping player restoration`);
      await (hubClient as any).deletePlayer(data.id).catch(() => null);
      return;
    }

    const voiceChannel = await guild.channels.fetch(data.voiceChannelId).catch(() => null);
    if (!voiceChannel) {
      console.log(`Voice channel ${data.voiceChannelId} no longer exists in guild ${data.id}`);
      await (hubClient as any).deletePlayer(data.id).catch(() => null);
      return;
    }

    if (voiceChannel.type !== 2) {
      console.log(`Channel ${data.voiceChannelId} is not a voice channel, skipping`);
      await (hubClient as any).deletePlayer(data.id).catch(() => null);
      return;
    }

    const nonBotMembers = voiceChannel.members.filter((member) => !member.user.bot);
    if (nonBotMembers.size === 0) {
      console.log(`No users in voice channel ${data.voiceChannelId}, skipping restoration`);
      return;
    }

    const permissions = voiceChannel.permissionsFor(client.user);
    if (!permissions || !permissions.has(["Connect", "Speak"])) {
      console.log(`Missing voice channel permissions in guild ${data.id}`);
      return;
    }

    console.log(`Creating player for guild ${data.id} with voice channel ${data.voiceChannelId}`);
    const { player, connected } = await createAndConnectPlayer(
      client,
      node,
      data,
      guild,
      voiceChannel
    );

    if (!player || !connected) {
      console.log(
        "Failed to establish voice connection after all attempts, skipping player restoration"
      );
      return;
    }

    try {
      await player.setVolume(data.volume);
      player.repeatMode = data.repeatMode;
      player.set("autoplay_enabled", data.autoplay);
      if (data.filters && Object.keys(data.filters).length > 0) {
        await player.setFilters(data.filters).catch((error) => {
          console.error(`Failed to set filters for guild ${data.id}:`, error);
        });
      }

      const restoredTracks = await restoreQueueTracks(node, player, data, 50);
      console.log(`Restored ${restoredTracks} tracks to the queue for guild ${data.id}`);

      await wait(1000);
      const restoredCurrentTrack = await restoreCurrentTrack(node, player, data, connected);
      if (!restoredCurrentTrack && connected && player.queue.tracks.length > 0) {
        await player.play(player.queue.tracks[0]).catch((error) => {
          console.error(`Failed to play first track for guild ${data.id}:`, error);
        });
      }

      console.log(`Successfully restored music player for guild ${data.id}`);
      await wait(1000);
    } catch (playerError) {
      console.error(`Error setting up player for guild ${data.id}:`, playerError);
    }
  } catch (error: any) {
    console.error(`Failed to restore player for guild ${data.id}:`, error);
    if (error?.message?.includes("No users in voice") || error?.code === 40032) {
      console.log("Skipping player deletion due to voice channel state");
      return;
    }
    await (hubClient as any).deletePlayer(data.id).catch(() => null);
  }
}

async function loadMusicPlayersCore(client: ClientLike): Promise<void> {
  try {
    const savedPlayers = (await (hubClient as any).loadPlayers().catch((error: Error) => {
      console.error("Failed to load music players from database:", error);
      return [];
    })) as PersistedPlayerData[];

    if (!savedPlayers?.length) {
      console.log("No saved music players found");
      return;
    }

    console.log(`Found ${savedPlayers.length} saved music players`);
    const node = await waitForReadyNode(client);
    if (!node) {
      console.error("No available Lavalink node found");
      return;
    }

    for (const data of savedPlayers) {
      await restoreSingleMusicPlayer(client, node, data);
    }
  } catch (error) {
    console.error("Failed to load music players:", error);
  }
}

export {
  wait,
  waitForReadyNode,
  createAndConnectPlayer,
  restoreSingleMusicPlayer,
  loadMusicPlayersCore,
  createRequesterObject,
};
