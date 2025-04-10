import { EmbedBuilder, AttachmentBuilder } from "discord.js";
import i18n from "./newI18n.js";
import { generateImage } from "./imageGenerator.js";

// Define localization strings
const localization_strings = {
  music: {
    player: {
      title: {
        en: "Now Playing",
        ru: "Сейчас играет",
        uk: "Зараз грає"
      },
      footerText: {
        en: "Requested by {author}",
        ru: "Запросил {author}",
        uk: "Запитав {author}"
      },
      additionalTracks: {
        en: "Additional tracks",
        ru: "Дополнительные треки",
        uk: "Додаткові треки"
      },
      andMoreTracks: {
        en: "And {count} more tracks",
        ru: "И еще {count} треков",
        uk: "І ще {count} треків"
      },
      noTitle: {
        en: "Unknown Title",
        ru: "Неизвестное название",
        uk: "Невідома назва"
      },
      noArtist: {
        en: "Unknown Artist",
        ru: "Неизвестный исполнитель",
        uk: "Невідомий виконавець"
      },
      duration: {
        en: "Duration",
        ru: "Длительность",
        uk: "Тривалість"
      },
      queue: {
        en: "Queue",
        ru: "Очередь",
        uk: "Черга"
      },
      emptyQueue: {
        en: "Queue is empty",
        ru: "Очередь пуста",
        uk: "Черга порожня"
      },
      filters: {
        en: "Filters",
        ru: "Фильтры",
        uk: "Фільтри"
      },
      noFilters: {
        en: "No filters",
        ru: "Без фильтров",
        uk: "Без фільтрів"
      }
    }
  }
};

// Register translations with i18n system
Object.keys(localization_strings).forEach(category => {
  Object.keys(localization_strings[category]).forEach(component => {
    i18n.registerLocalizations(category, component, localization_strings[category][component], true);
  });
});

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
          username: track.requester?.username || i18n.__("music.player.noTitle"),
          displayName: track.requester?.displayName || i18n.__("music.player.noTitle"),
          avatarURL: getAvatarUrl(track.requester),
          locale: track.requester?.locale || "en",
        },
      },
      currentSong: {
        title: track.info.title || i18n.__("music.player.noTitle"),
        artist: track.info.author || i18n.__("music.player.noArtist"),
        thumbnail: track.info.artworkUrl,
        addedBy: track.requester?.username || i18n.__("music.player.noTitle"),
        addedByAvatar: getAvatarUrl(track.requester),
        duration: track.info.duration,
        user: {
          id: track.requester?.id || "unknown",
          username: track.requester?.username || i18n.__("music.player.noTitle"),
          displayName: track.requester?.displayName || i18n.__("music.player.noTitle"),
          avatarURL: getAvatarUrl(track.requester),
        },
      },
      locale: track.requester?.locale || "en",
      previousSong: previousSong
        ? {
            title: previousSong.info.title || i18n.__("music.player.noTitle"),
            duration: previousSong.info.duration,
            thumbnail: previousSong.info.artworkUrl,
            user: {
              id: previousSong.requester?.id || "unknown",
              username: previousSong.requester?.username || i18n.__("music.player.noTitle"),
              displayName:
                previousSong.requester?.displayName || i18n.__("music.player.noTitle"),
              avatarURL: getAvatarUrl(previousSong.requester),
            },
          }
        : undefined,
      nextSongs: player.queue.tracks.slice(0, 5).map((t) => ({
        title: t.info.title || i18n.__("music.player.noTitle"),
        duration: t.info.duration,
        thumbnail: t.info.artworkUrl,
        user: {
          id: t.requester?.id || "unknown",
          username: t.requester?.username || i18n.__("music.player.noTitle"),
          displayName: t.requester?.displayName || i18n.__("music.player.noTitle"),
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
        author: track.requester?.username || i18n.__("music.player.noTitle"),
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
