type RequesterLike = {
  id?: string;
  username?: string;
  avatarURL?: string;
  displayAvatarURL?: () => string;
  toString?: () => string;
  tag?: string;
  [key: string]: unknown;
};

type TrackLike = {
  title?: string;
  requester?: RequesterLike | null;
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

function ensureRequesterDisplayShape(track: TrackLike): void {
  if (!track.requester || track.requester.displayAvatarURL) {
    return;
  }

  const requesterData = track.requester;
  const fallbackAvatar =
    requesterData.avatarURL ||
    `https://cdn.discordapp.com/embed/avatars/${Math.floor(Math.random() * 5)}.png`;

  track.requester = {
    ...requesterData,
    displayAvatarURL: () => fallbackAvatar,
    toString: () => `<@${requesterData.id}>`,
    tag: requesterData.username || "Unknown User",
  };
}

function isYoutubeExtractionError(
  track: TrackLike | null | undefined,
  payload: TrackErrorPayload | null | undefined
): boolean {
  return Boolean(
    payload?.exception?.cause?.includes?.("/s/player/") ||
      payload?.exception?.cause?.includes?.("player_ias.vflset") ||
      (track?.info?.sourceName === "youtube" &&
        payload?.exception?.message?.includes("broke when playing"))
  );
}

function buildAlternativeSearchQuery(
  track: TrackLike | null | undefined
): string | null {
  if (!track) {
    return null;
  }

  if (track.info?.author) {
    return `${track.info.title} ${track.info.author}`;
  }

  return track.info?.title || track.title || null;
}

function isConnectionErrorPayload(
  payload: TrackErrorPayload | null | undefined
): boolean {
  return /connection|timeout|reset|refused|closed/i.test(
    payload?.error || payload?.exception?.message || ""
  );
}

export {
  ensureRequesterDisplayShape,
  isYoutubeExtractionError,
  buildAlternativeSearchQuery,
  isConnectionErrorPayload,
};
