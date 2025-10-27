import { AttachmentBuilder, MessageFlags } from "discord.js";
import i18n from "./i18n.js";
import { generateImage } from "./imageGenerator.js";
import { ComponentBuilder } from "./componentConverter.js";
import { createMusicButtons } from "./musicButtons.js";

// Define localization strings
const localization_strings = {
  music: {
    player: {
      title: {
        en: "Now Playing",
        ru: "Сейчас играет",
        uk: "Зараз грає",
      },
      footerText: {
        en: "Requested by {author}",
        ru: "Запросил {author}",
        uk: "Запитав {author}",
      },
      additionalTracks: {
        en: "Additional tracks",
        ru: "Дополнительные треки",
        uk: "Додаткові треки",
      },
      andMoreTracks: {
        en: "And {count} more tracks",
        ru: "И еще {count} треков",
        uk: "І ще {count} треків",
      },
      noTitle: {
        en: "Unknown Title",
        ru: "Неизвестное название",
        uk: "Невідома назва",
      },
      noArtist: {
        en: "Unknown Artist",
        ru: "Неизвестный исполнитель",
        uk: "Невідомий виконавець",
      },
      duration: {
        en: "Duration",
        ru: "Длительность",
        uk: "Тривалість",
      },
      queue: {
        en: "Queue",
        ru: "Очередь",
        uk: "Черга",
      },
      emptyQueue: {
        en: "Queue is empty",
        ru: "Очередь пуста",
        uk: "Черга порожня",
      },
      filters: {
        en: "Filters",
        ru: "Фильтры",
        uk: "Фільтри",
      },
      noFilters: {
        en: "No filters",
        ru: "Без фильтров",
        uk: "Без фільтрів",
      },
    },
  },
};

// Replace i18n import with hubClient
import { hubClient } from "../api/hubClient.js";

// Use fire-and-forget async registration
(async () => {
  for (const category of Object.keys(localization_strings)) {
    for (const component of Object.keys(localization_strings[category])) {
      await hubClient.registerLocalizations(
        category,
        component,
        localization_strings[category][component],
        true
      );
    }
  }
})();

// In createOrUpdateMusicPlayerEmbed, remove i18n.setLocale and use hubClient.getTranslation with explicit locale
// Make the function async if not already
// Replace all await i18n.__ calls with await hubClient.getTranslation('music.player.[key]', locale, { variables })
let lastGeneratedImage = null;
let lastGeneratedImageTimestamp = 0;

// Remove extra comments added previously

export async function createOrUpdateMusicPlayerEmbed(
  track,
  player,
  oldEmbed = null
) {
  console.log(
    `[MusicPlayerEmbed] Starting generation for track: ${track?.info?.title}`
  );
  let locale = track.requester?.locale || "en";
  if (locale.includes("-")) {
    locale = locale.split("-")[0];
  }
  // Remove i18n.setLocale

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
    console.log(`[MusicPlayerEmbed] Generating new image...`);
    try {
      const buffer = await generateImage(
        "MusicPlayer",
        {
          interaction: {
            user: {
              id: track.requester?.id || "unknown",
              username:
                track.requester?.username ||
                (await hubClient.getTranslation(
                  "music.player.noTitle",
                  {},
                  locale
                )),
              displayName:
                track.requester?.displayName ||
                (await hubClient.getTranslation(
                  "music.player.noTitle",
                  {},
                  locale
                )),
              avatarURL: getAvatarUrl(track.requester),
              locale: track.requester?.locale || "en",
            },
          },
          currentSong: {
            title:
              track.info.title ||
              (await hubClient.getTranslation(
                "music.player.noTitle",
                {},
                locale
              )),
            artist:
              track.info.author ||
              (await hubClient.getTranslation(
                "music.player.noArtist",
                {},
                locale
              )),
            thumbnail: track.info.artworkUrl,
            addedBy:
              track.requester?.username ||
              (await hubClient.getTranslation(
                "music.player.noTitle",
                {},
                locale
              )),
            addedByAvatar: getAvatarUrl(track.requester),
            duration: track.info.duration,
            user: {
              id: track.requester?.id || "unknown",
              username:
                track.requester?.username ||
                (await hubClient.getTranslation(
                  "music.player.noTitle",
                  {},
                  locale
                )),
              displayName:
                track.requester?.displayName ||
                (await hubClient.getTranslation(
                  "music.player.noTitle",
                  {},
                  locale
                )),
              avatarURL: getAvatarUrl(track.requester),
            },
          },
          locale: track.requester?.locale || "en",
          previousSong: previousSong
            ? {
                title:
                  previousSong.info.title ||
                  (
                    await hubClient.getTranslation(
                      "music.player.noTitle",
                      {},
                      locale
                    )
                  ).translation,
                duration: previousSong.info.duration,
                thumbnail: previousSong.info.artworkUrl,
                user: {
                  id: previousSong.requester?.id || "unknown",
                  username:
                    previousSong.requester?.username ||
                    (
                      await hubClient.getTranslation(
                        "music.player.noTitle",
                        {},
                        locale
                      )
                    ).translation,
                  displayName:
                    previousSong.requester?.displayName ||
                    (
                      await hubClient.getTranslation(
                        "music.player.noTitle",
                        {},
                        locale
                      )
                    ).translation,
                  avatarURL: getAvatarUrl(previousSong.requester),
                },
              }
            : undefined,
          nextSongs: await Promise.all(
            player.queue.tracks.slice(0, 5).map(async (t) => ({
              title:
                t.info.title ||
                (
                  await hubClient.getTranslation(
                    "music.player.noTitle",
                    {},
                    locale
                  )
                ).translation,
              duration: t.info.duration,
              thumbnail: t.info.artworkUrl,
              user: {
                id: t.requester?.id || "unknown",
                username:
                  t.requester?.username ||
                  (
                    await hubClient.getTranslation(
                      "music.player.noTitle",
                      {},
                      locale
                    )
                  ).translation,
                displayName:
                  t.requester?.displayName ||
                  (
                    await hubClient.getTranslation(
                      "music.player.noTitle",
                      {},
                      locale
                    )
                  ).translation,
                avatarURL: getAvatarUrl(t.requester),
              },
            }))
          ),
          queueLength: player.queue.tracks.length,
          currentTime: player.position,
          duration: track.info.duration,
          userAvatar: getAvatarUrl(track.requester),
          // Add proper queue info for the component
          hasPrevious: !!previousSong,
          hasNext: player.queue.tracks.length > 0,
        },
        { image: 1, emoji: 1 },
        { getLocale: () => locale }
      );
      console.log(`[MusicPlayerEmbed] Image generation successful.`);
      lastGeneratedImage = { buffer };
      lastGeneratedImageTimestamp = currentTime;
    } catch (genError) {
      console.error(`[MusicPlayerEmbed] Error during generateImage:`, genError);
      throw genError;
    }
  } else {
    console.log(`[MusicPlayerEmbed] Using cached image.`);
  }

  const attachment = new AttachmentBuilder(lastGeneratedImage.buffer, {
    name: `musicplayer.png`,
  });

  // Create the main component using ComponentBuilder
  const musicPlayerComponent = new ComponentBuilder()
    .addText(
      (await hubClient.getTranslation("music.player.title", {}, locale))
        .translation,
      "header3"
    )
    .setColor(process.env.EMBED_COLOR ?? 0x0099ff)
    // Add the generated image
    .addImage(`attachment://${attachment.name}`)
    // Add the music control buttons
    .addActionRow(await createMusicButtons(player));

  console.log(
    `[MusicPlayerEmbed] Finished generation for track: ${track?.info?.title}`
  );
  // Return the structure expected for interaction replies/edits
  return {
    components: [musicPlayerComponent.build()],
    files: [attachment],
    flags: MessageFlags.IsComponentsV2,
  };
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
