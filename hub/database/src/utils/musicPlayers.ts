type MusicPlayerClient = {
  musicPlayer: {
    findUnique: (args: unknown) => Promise<unknown>;
    findMany: (args: unknown) => Promise<unknown>;
    delete: (args: unknown) => Promise<unknown>;
    create: (args: unknown) => Promise<unknown>;
    update: (args: unknown) => Promise<unknown>;
  };
  $transaction: <T>(callback: (tx: MusicPlayerTransaction) => Promise<T>, options?: unknown) => Promise<T>;
};

type MusicPlayerTransaction = {
  musicPlayer: {
    upsert: (args: unknown) => Promise<unknown>;
  };
};

type ErrorWithCode = {
  code?: string;
};

type TrackRequester = {
  id?: string;
  username?: string;
  displayName?: string;
  locale?: string;
  avatarURL?: (() => string | null) | string | null;
  displayAvatarURL?: (() => string | null) | null;
};

type PlayerTrack = {
  encoded?: string;
  info?: unknown;
  requester?: TrackRequester | null;
};

type PlayerShape = {
  guildId?: string;
  voiceChannelId?: string | null;
  textChannelId?: string | null;
  queue?: {
    current?: PlayerTrack | null;
    tracks?: PlayerTrack[];
  };
  position?: number;
  volume?: number;
  repeatMode?: string;
  filters?: unknown;
  get?: (key: string) => unknown;
};

function getAvatarUrl(requester: TrackRequester | null | undefined): string | null {
  if (!requester) {
    return null;
  }

  if (typeof requester.avatarURL === "function") {
    try {
      return requester.avatarURL();
    } catch (error) {
      console.error("Error getting avatar URL:", error);
      return null;
    }
  }

  if (typeof requester.avatarURL === "string") {
    return requester.avatarURL;
  }

  if (typeof requester.displayAvatarURL === "function") {
    try {
      return requester.displayAvatarURL();
    } catch (error) {
      console.error("Error getting display avatar URL:", error);
      return null;
    }
  }

  return null;
}

function mapTrack(track: PlayerTrack | null | undefined) {
  if (!track) {
    return null;
  }

  return {
    encoded: track.encoded || "",
    info: track.info || {},
    requesterData: track.requester
      ? {
          id: track.requester.id,
          username: track.requester.username || "Unknown",
          displayName:
            track.requester.displayName || track.requester.username || "Unknown",
          avatarURL: getAvatarUrl(track.requester),
          locale: track.requester.locale || "en",
        }
      : null,
  };
}

async function savePlayer(
  client: MusicPlayerClient,
  player: PlayerShape | null | undefined
): Promise<unknown> {
  try {
    if (!player || !player.guildId) {
      console.log("No player or invalid player provided to savePlayer");
      return null;
    }

    if (!player.queue?.current && (!player.queue?.tracks || player.queue.tracks.length === 0)) {
      console.log(`No content to save for player ${player.guildId}`);
      return null;
    }

    const playerData = {
      id: player.guildId,
      voiceChannelId: player.voiceChannelId || null,
      textChannelId: player.textChannelId || null,
      queue: player.queue?.tracks?.map((track) => mapTrack(track)) || [],
      currentTrack: mapTrack(player.queue?.current),
      position: Math.max(0, Math.floor(player.position || 0)) || 0,
      volume: player.volume || 100,
      repeatMode: player.repeatMode || "off",
      autoplay: !!player.get?.("autoplay_enabled"),
      filters: player.filters || {},
    };

    return await client.$transaction(
      async (tx) => {
        return tx.musicPlayer.upsert({
          where: {
            id: playerData.id,
          },
          create: playerData,
          update: playerData,
        });
      },
      {
        timeout: 10000,
        isolationLevel: "ReadCommitted",
      }
    );
  } catch (error) {
    console.error(
      `Failed to save player for guild ${player?.guildId || "unknown"}:`,
      error
    );
    return null;
  }
}

async function getPlayer(
  client: MusicPlayerClient,
  guildId: string
): Promise<unknown> {
  if (!guildId) {
    console.error("Guild ID is required");
    return null;
  }

  try {
    return await client.musicPlayer.findUnique({
      where: { id: guildId },
    });
  } catch (error) {
    console.error(`Error getting player ${guildId}:`, error);
    return null;
  }
}

async function loadPlayers(client: MusicPlayerClient): Promise<unknown[]> {
  try {
    console.log("Attempting to load music players from database...");
    const players = await client.musicPlayer.findMany({
      where: {},
      select: {
        id: true,
        voiceChannelId: true,
        textChannelId: true,
        queue: true,
        currentTrack: true,
        position: true,
        volume: true,
        repeatMode: true,
        autoplay: true,
        filters: true,
      },
    });

    console.log("Database query completed");
    console.log("Found players:", {
      count: (players as unknown[])?.length || 0,
      players,
    });
    return (players as unknown[]) || [];
  } catch (error) {
    console.error("Error loading music players:", error);
    return [];
  }
}

async function deletePlayer(
  client: MusicPlayerClient,
  guildId: string
): Promise<unknown> {
  if (!guildId) {
    console.log("No guild ID provided for deletion");
    return null;
  }

  try {
    return await client.musicPlayer.delete({
      where: { id: guildId },
    });
  } catch (error) {
    const typedError = error as ErrorWithCode;
    if (typedError.code === "P2025") {
      console.log(`No music player found for guild ${guildId}`);
      return null;
    }
    console.error(`Error deleting player ${guildId}:`, error);
    throw error;
  }
}

async function ensurePlayer(
  client: MusicPlayerClient,
  guildId: string,
  data: Record<string, unknown> = {}
): Promise<unknown> {
  if (!guildId) {
    console.error("Guild ID is required");
    return null;
  }

  try {
    try {
      await client.musicPlayer.delete({
        where: { id: guildId },
      });
    } catch (_error) {
      console.log(`No existing record found for ${guildId}`);
    }

    return await client.musicPlayer.create({
      data: {
        id: guildId,
        voiceChannelId: "",
        textChannelId: "",
        queue: [],
        currentTrack: null,
        position: 0,
        volume: 100,
        repeatMode: "off",
        autoplay: false,
        filters: {},
        ...data,
      },
    });
  } catch (error) {
    console.error(`Error ensuring player ${guildId}:`, error);
    throw error;
  }
}

async function updatePlayer(
  client: MusicPlayerClient,
  guildId: string,
  data: Record<string, unknown>
): Promise<unknown> {
  if (!guildId) {
    console.error("Guild ID is required");
    return null;
  }

  try {
    const exists = await client.musicPlayer.findUnique({
      where: { id: guildId },
      select: { id: true },
    });

    if (!exists) {
      return await client.musicPlayer.create({
        data: {
          id: guildId,
          ...data,
        },
      });
    }

    return await client.musicPlayer.update({
      where: { id: guildId },
      data,
    });
  } catch (error) {
    console.error(`Error updating player ${guildId}:`, error);
    throw error;
  }
}

export { savePlayer, getPlayer, loadPlayers, deletePlayer, ensurePlayer, updatePlayer };
