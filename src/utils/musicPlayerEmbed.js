import { EmbedBuilder, AttachmentBuilder } from "discord.js";
import i18n from "./newI18n.js";
import { generateImage } from "./imageGenerator.js";

let lastGeneratedImage = null;
let lastGeneratedImageTimestamp = 0;

export async function createOrUpdateMusicPlayerEmbed(
  track,
  player,
  oldEmbed = null
) {
  let locale = track.requester?.locale || "en";
  if (locale.includes("-")) {
    locale = locale.split("-")[0];
  }
  i18n.setLocale(locale);

  if (!player.activatedFilters) {
    player.activatedFilters = [];
  }

  // Check if there's a previous song
  const previousSong =
    player.queue.previous && player.queue.previous.length > 0
      ? player.queue.previous[0]
      : undefined;

  const currentTime = Date.now();
  const timeSinceLastGeneration = currentTime - lastGeneratedImageTimestamp;

  console.log(player.queue.previous);

  // Get avatar URL with fallback
  const getAvatarUrl = (user) => {
    if (!user)
      return `https://cdn.discordapp.com/embed/avatars/${Math.floor(
        Math.random() * 5
      )}.png`;
    return typeof user.displayAvatarURL === "function"
      ? user.displayAvatarURL({ extension: "png", size: 256 })
      : user.avatarURL ||
          `https://cdn.discordapp.com/embed/avatars/${Math.floor(
            Math.random() * 5
          )}.png`;
  };

  // Only generate a new image if more than 5 seconds have passed or if it's the first generation
  if (!lastGeneratedImage || timeSinceLastGeneration > 10000) {
    // Generate the music player image
    lastGeneratedImage = await generateImage("MusicPlayer", {
      interaction: {
        user: {
          id: track.requester?.id || "unknown",
          username: track.requester?.username || "Unknown User",
          displayName: track.requester?.displayName || "Unknown User",
          avatarURL: getAvatarUrl(track.requester),
          locale: track.requester?.locale || "en",
        },
      },
      currentSong: {
        title: track.info.title,
        artist: track.info.author,
        thumbnail: track.info.artworkUrl,
        addedBy: track.requester?.username || "Unknown User",
        addedByAvatar: getAvatarUrl(track.requester),
        duration: track.info.duration,
        user: {
          id: track.requester?.id || "unknown",
          username: track.requester?.username || "Unknown User",
          displayName: track.requester?.displayName || "Unknown User",
          avatarURL: getAvatarUrl(track.requester),
        },
      },
      locale: track.requester?.locale || "en",
      previousSong: previousSong
        ? {
            title: previousSong.info.title,
            duration: previousSong.info.duration,
            thumbnail: previousSong.info.artworkUrl,
            user: {
              id: previousSong.requester?.id || "unknown",
              username: previousSong.requester?.username || "Unknown User",
              displayName:
                previousSong.requester?.displayName || "Unknown User",
              avatarURL: getAvatarUrl(previousSong.requester),
            },
          }
        : undefined,
      nextSongs: player.queue.tracks.slice(0, 5).map((t) => ({
        title: t.info.title,
        duration: t.info.duration,
        thumbnail: t.info.artworkUrl,
        user: {
          id: t.requester?.id || "unknown",
          username: t.requester?.username || "Unknown User",
          displayName: t.requester?.displayName || "Unknown User",
          avatarURL: getAvatarUrl(t.requester),
        },
      })),
      queueLength: player.queue.tracks.length,
      currentTime: player.position,
      duration: track.info.duration,
      userAvatar: getAvatarUrl(track.requester),
    });
    lastGeneratedImageTimestamp = currentTime;
  }

  const attachment = new AttachmentBuilder(lastGeneratedImage, {
    name: `musicplayer.${
      lastGeneratedImage[0] === 0x47 &&
      lastGeneratedImage[1] === 0x49 &&
      lastGeneratedImage[2] === 0x46
        ? "gif"
        : "png"
    }`,
  });

  const embedBase = oldEmbed ? EmbedBuilder.from(oldEmbed) : new EmbedBuilder();

  const embed = embedBase
    .setColor(process.env.EMBED_COLOR)
    .setImage("attachment://musicplayer.png")
    .setFooter({
      text: i18n.__("music.player.footerText", {
        author: track.requester?.username || "Unknown User",
      }),
      iconURL: getAvatarUrl(track.requester),
    })
    .setTimestamp();

  // You can add additional fields if needed, but most information will be in the image now
  /*if (player.queue.tracks && player.queue.tracks.length > 5) {
    embed.addFields({
      name: i18n.__("music.additionalTracks"),
      value: i18n.__("music.andMoreTracks", {
        count: player.queue.tracks.length - 5,
      }),
    });
  }*/

  return { embed, attachment };
}

function formatTime(ms) {
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor(ms / (1000 * 60 * 60));

  return `${hours ? `${hours}:` : ""}${minutes
    .toString()
    .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function createProgressBar(current, total, length = 12) {
  const percentage = current / total;
  const progress = Math.floor(length * percentage);
  const emptyProgress = length - progress;

  const startingGreen = "<:music_starting_green:1285647252035076127>";
  const playingGreen = "<:music_playing_green:1285647264970182656>";
  const stopGreen = "<:music_stop_green:1285647274550100020>";
  const playingRed = "<:music_playing:1285647527261241406>";
  const stopRed = "<:music_stop:1285647537163993201>";

  let progressBar = startingGreen;

  if (progress > 0) {
    progressBar += playingGreen.repeat(Math.max(progress, 0));
    if (progress === length) {
      progressBar += stopGreen;
    }
  }

  if (emptyProgress > 0) {
    progressBar += playingRed.repeat(Math.max(emptyProgress - 1, 0));
    progressBar += stopRed;
  }

  return progressBar;
}
