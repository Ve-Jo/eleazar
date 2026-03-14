type RequesterData = {
  id?: string;
  username?: string;
  displayName?: string;
  locale?: string;
  avatarURL?: string;
};

type PersistedTrack = {
  encoded?: string;
  info?: Record<string, unknown>;
  requesterData?: RequesterData;
};

type DecodedTrack = {
  encoded?: string;
  info?: Record<string, unknown>;
  requester?: unknown;
  title?: string;
};

type LavalinkNodeLike = {
  id?: string;
  decode: {
    singleTrack: (encoded: string) => Promise<DecodedTrack | null>;
  };
};

type PlayerLike = {
  queue: {
    add: (track: DecodedTrack | DecodedTrack[]) => Promise<unknown> | unknown;
    tracks: DecodedTrack[];
  };
  play: (payload?: unknown) => Promise<unknown>;
};

type RestorablePlayerState = {
  id: string;
  queue?: PersistedTrack[];
  currentTrack?: PersistedTrack;
  position?: number;
};

type RequesterLike = {
  id?: string;
  username: string;
  displayName: string;
  locale: string;
  displayAvatarURL: () => string;
  avatarURL: string;
  toString: () => string;
  tag: string;
};

function createRequesterObject(trackData?: PersistedTrack | null): RequesterLike | null {
  try {
    if (!trackData?.requesterData) {
      return null;
    }

    const requesterData = trackData.requesterData;
    const avatarUrl =
      requesterData.avatarURL ||
      `https://cdn.discordapp.com/embed/avatars/${Math.floor(Math.random() * 5)}.png`;

    return {
      id: requesterData.id,
      username: requesterData.username || "Unknown User",
      displayName:
        requesterData.displayName || requesterData.username || "Unknown User",
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
}

async function restoreQueueTracks(
  node: LavalinkNodeLike,
  player: PlayerLike,
  data: RestorablePlayerState,
  maxQueueRestore = 50
): Promise<number> {
  if (!data.queue?.length) {
    return 0;
  }

  const queueToRestore = data.queue.slice(0, maxQueueRestore);
  let restoredTracks = 0;

  for (const track of queueToRestore) {
    try {
      if (!track?.encoded) {
        console.log("Skipping track with missing encoded data");
        continue;
      }

      const resolvedTrack = await node.decode.singleTrack(track.encoded).catch(() => null);
      if (resolvedTrack) {
        Object.assign(resolvedTrack, {
          info: track.info || {},
          requester: createRequesterObject(track),
        });
        await player.queue.add(resolvedTrack);
        restoredTracks += 1;
      }
    } catch (error) {
      console.error(
        `Failed to decode track in queue for guild ${data.id}:`,
        error
      );
    }
  }

  return restoredTracks;
}

async function restoreCurrentTrack(
  node: LavalinkNodeLike,
  player: PlayerLike,
  data: RestorablePlayerState,
  connected: boolean
): Promise<boolean> {
  if (!data.currentTrack?.encoded || !connected) {
    return false;
  }

  try {
    const currentTrack = await node.decode.singleTrack(data.currentTrack.encoded).catch(() => null);
    if (!currentTrack) {
      return false;
    }

    Object.assign(currentTrack, {
      info: data.currentTrack.info || {},
      requester: createRequesterObject(data.currentTrack),
    });

    await player.play({
      track: currentTrack,
      options: {
        startTime: Math.max(0, data.position || 0),
        paused: false,
      },
    });
    return true;
  } catch (error) {
    console.error(`Failed to restore current track for guild ${data.id}:`, error);
    if (player.queue.tracks.length > 0) {
      await player.play(player.queue.tracks[0]).catch((playError) => {
        console.error(`Failed to play next track for guild ${data.id}:`, playError);
      });
    }
    return false;
  }
}

export {
  createRequesterObject,
  restoreQueueTracks,
  restoreCurrentTrack,
};
