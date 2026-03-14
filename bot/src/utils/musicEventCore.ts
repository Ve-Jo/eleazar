import {
  ensureRequesterDisplayShape,
  isYoutubeExtractionError,
  buildAlternativeSearchQuery,
  isConnectionErrorPayload,
} from "./musicEventHelpers.ts";
import { findAlternativeTrack } from "./musicRecoveryHelpers.ts";

type ClientLike = {
  user?: unknown;
  guilds: {
    fetch: (guildId: string) => Promise<any>;
  };
  channels: {
    fetch: (channelId: string) => Promise<any>;
  };
  lavalink: {
    getPlayer: (guildId: string) => any;
    nodeManager: {
      nodes: {
        values: () => Iterable<any>;
      };
    };
  };
};

type PlayerLike = {
  guildId: string;
  textChannelId?: string;
  voiceChannelId?: string;
  voice?: { connection?: unknown };
  queue: {
    current?: any;
    tracks: any[];
    add: (track: any) => Promise<unknown>;
  };
  get: (key: string) => unknown;
  set: (key: string, value: unknown) => void;
  connect: () => Promise<unknown>;
  disconnect: () => Promise<unknown>;
  stop: () => Promise<unknown>;
  play: (track?: any) => Promise<unknown>;
  search: (query: { query: string; source: string }) => Promise<{ tracks?: any[] }>;
  setNode: (nodeId: string) => Promise<unknown>;
  node: {
    id: string;
    rest: {
      updatePlayer: (payload: unknown) => Promise<unknown>;
    };
  };
  playing?: boolean;
  paused?: boolean;
  position?: number;
};

type TrackLike = {
  encoded?: string;
  title?: string;
  requester?: any;
  info?: {
    sourceName?: string;
    title?: string;
    author?: string;
  };
};

type TrackErrorPayload = {
  error?: string;
  exception?: {
    message?: string;
    cause?: string;
  };
};

type DebouncedSave = (player: PlayerLike) => void;

async function handlePlayerUpdateCore(
  client: ClientLike,
  guildId: string,
  debouncedSavePlayer: DebouncedSave
): Promise<void> {
  try {
    const player = client.lavalink.getPlayer(guildId);
    if (!player) {
      return;
    }

    debouncedSavePlayer(player);

    if (player.get("autoplay_enabled") === undefined) {
      player.set("autoplay_enabled", false);
    }

    if (player?.queue?.current) {
      ensureRequesterDisplayShape(player.queue.current);
    }

    if (player.voiceChannelId && !player.voice?.connection) {
      try {
        const guild = await client.guilds.fetch(guildId).catch((error) => {
          console.error(`Failed to fetch guild ${guildId}:`, error);
          return null;
        });

        if (!guild) {
          console.log("Guild not found, skipping reconnection");
          return;
        }

        const voiceChannel = await guild.channels.fetch(player.voiceChannelId).catch((error: Error) => {
          console.error(`Failed to fetch voice channel ${player.voiceChannelId}:`, error);
          return null;
        });

        if (!voiceChannel) {
          console.log("Voice channel not found, skipping reconnection");
          return;
        }

        const nonBotMembers = voiceChannel.members.filter((member: any) => !member.user.bot);
        if (nonBotMembers.size === 0) {
          console.log("No users in voice channel, skipping reconnection");
          return;
        }

        const permissions = voiceChannel.permissionsFor(client.user);
        if (!permissions || !permissions.has(["Connect", "Speak"])) {
          console.log("Missing voice channel permissions, skipping reconnection");
          return;
        }

        if (!guild.members.me.voice.channelId) {
          console.log(`Attempting to reconnect to voice in guild ${guildId}`);
          await player.connect().catch((error: Error) => {
            console.error("Error connecting to voice:", error);
          });
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error("Failed to reconnect to voice channel:", error);
        return;
      }
    }

    if (player.queue?.current && !player.playing && !player.paused) {
      console.log("Player has current track but not playing, attempting to play...");
      try {
        await player.play().catch((error: Error) => {
          console.error("Error playing track:", error);
        });
      } catch (error) {
        console.error("Failed to resume playback:", error);
      }
    } else if (!player.queue?.current && player.queue?.tracks?.length > 0) {
      console.log("Player has tracks in queue but no current track, playing next track");
      try {
        const nextTrack = player.queue.tracks[0];
        if (nextTrack) {
          await player.play(nextTrack).catch((error: Error) => {
            console.error("Error playing next track:", error);
          });
        }
      } catch (error) {
        console.error("Failed to play next track:", error);
      }
    }

    try {
      const eventModule = await import("../events/music/playerUpdate.ts").catch(() => null);
      if (eventModule?.default && typeof eventModule.default.execute === "function") {
        await (eventModule.default as any).execute(client, player);
      }
    } catch (eventError) {
      console.error("Error in playerUpdate event module:", eventError);
    }
  } catch (error) {
    console.error("Error in playerUpdate handler:", error);
  }
}

async function handleTrackErrorCore(
  client: ClientLike,
  player: PlayerLike,
  track: TrackLike | null | undefined,
  payload: TrackErrorPayload | null | undefined,
  debouncedSavePlayer: DebouncedSave
): Promise<void> {
  console.error("Track error occurred:", {
    guild: player.guildId,
    track: track?.title || "Unknown",
    error: payload?.error || payload?.exception?.message || "Unknown error",
    details: payload,
  });

  if (isYoutubeExtractionError(track, payload)) {
    console.log("Detected YouTube extraction error, attempting to search using alternative source");
    try {
      const searchQuery = buildAlternativeSearchQuery(track);
      if (!searchQuery) {
        console.error("Cannot perform alternative search: No track title available");
        return;
      }

      const alternativeTrack = await findAlternativeTrack(
        player,
        searchQuery,
        track?.info?.sourceName || "youtube"
      );

      if (alternativeTrack) {
        console.log(
          `Found alternative track: ${alternativeTrack.title} from ${
            alternativeTrack.info?.sourceName || "unknown source"
          }`
        );

        if (track?.requester) {
          alternativeTrack.requester = track.requester;
        }

        try {
          if (player.playing) {
            await player.stop();
          }

          player.queue.current = null;
          await player.queue.add(alternativeTrack);
          await player.play().catch((error: Error) => {
            console.error("Failed to play alternative track:", error);
            throw error;
          });
          return;
        } catch (playError) {
          console.error("Error playing alternative track, trying direct method:", playError);
          try {
            if (alternativeTrack?.encoded) {
              await player.node.rest.updatePlayer({
                guildId: player.guildId,
                data: {
                  encodedTrack: alternativeTrack.encoded,
                },
              });
              return;
            }
          } catch (restError) {
            console.error("REST play attempt failed:", restError);
          }
        }
      }

      const results = await player
        .search({
          query: searchQuery,
          source: "scsearch",
        })
        .catch((error: Error) => {
          console.error("Alternative search failed:", error);
          return null;
        });

      if (results?.tracks?.length) {
        console.log("SoundCloud fallback found results but runtime handoff remains on JS path");
      }
    } catch (searchError) {
      console.error("Error during alternative search:", searchError);
    }
  }

  if (isConnectionErrorPayload(payload)) {
    try {
      console.log(`Attempting to recover from connection error for guild ${player.guildId}`);
      const guild = await client.guilds.fetch(player.guildId).catch(() => null);
      if (guild && player.voiceChannelId) {
        await player.disconnect();
        await new Promise((resolve) => setTimeout(resolve, 1000));
        await player.connect();

        if (track) {
          await player.play(track).catch((error: Error) =>
            console.error("Error restarting track:", error)
          );
          return;
        }

        if (player.queue.tracks.length > 0) {
          await player.play(player.queue.tracks[0]).catch((error: Error) =>
            console.error("Error playing next track:", error)
          );
          return;
        }
      }
    } catch (error) {
      console.error("Failed to recover from track error:", error);

      try {
        const currentNodeId = player.node.id;
        const availableNodes = Array.from(client.lavalink.nodeManager.nodes.values()).filter(
          (node) => node.id !== currentNodeId && node.connected
        );

        if (availableNodes.length > 0) {
          await player.setNode(availableNodes[0].id);
          if (track) {
            await player.play(track);
            return;
          }
        }
      } catch (nodeError) {
        console.error("Failed to switch nodes:", nodeError);
      }
    }
  }

  debouncedSavePlayer(player);
}

export { handlePlayerUpdateCore, handleTrackErrorCore };
