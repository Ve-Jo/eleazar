import { EmbedBuilder, AttachmentBuilder } from "discord.js";
import i18n from "./i18n.js";
import { generateRemoteImage } from "./remoteImageGenerator.js";

let lastGeneratedImage = null;
let lastGeneratedImageTimestamp = 0;

export async function createOrUpdateMusicPlayerEmbed(
  track,
  player,
  oldEmbed = null
) {
  let locale = track.requester.locale || "en";
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

  // Only generate a new image if more than 5 seconds have passed or if it's the first generation
  if (!lastGeneratedImage || timeSinceLastGeneration > 10000) {
    // Generate the music player image
    const imageData = await generateRemoteImage(
      "MusicPlayer",
      {
        currentSong: {
          title: track.info.title,
          artist: track.info.author,
          thumbnail: track.info.artworkUrl,
          addedBy: track.requester.username,
          addedByAvatar: track.requester.displayAvatarURL({
            extension: "png",
            size: 256,
          }),
          duration: track.info.duration,
          user: {
            id: track.requester.id,
            username: track.requester.username,
            displayName: track.requester.displayName,
            avatarURL: track.requester.displayAvatarURL({
              extension: "png",
              size: 256,
            }),
          },
        },
        locale: track.requester.locale,
        previousSong: previousSong
          ? {
              title: previousSong.info.title,
              duration: previousSong.info.duration,
              thumbnail: previousSong.info.artworkUrl,
              user: {
                id: previousSong.requester.id,
                username: previousSong.requester.username,
                displayName: previousSong.requester.displayName,
                avatarURL: previousSong.requester.displayAvatarURL({
                  extension: "png",
                  size: 256,
                }),
              },
            }
          : undefined,
        nextSongs: player.queue.tracks.slice(0, 5).map((t) => ({
          title: t.info.title,
          duration: t.info.duration,
          thumbnail: t.info.artworkUrl,
          user: {
            id: t.requester.id,
            username: t.requester.username,
            displayName: t.requester.displayName,
            avatarURL: t.requester.displayAvatarURL({
              extension: "png",
              size: 256,
            }),
          },
        })),
        queueLength: player.queue.tracks.length,
        currentTime: player.position,
        duration: track.info.duration,
        userAvatar: track.requester.displayAvatarURL({
          extension: "png",
          size: 256,
        }),
      },
      { width: 525, height: 200 }
    );

    lastGeneratedImage = imageData;
    lastGeneratedImageTimestamp = currentTime;
  }

  const attachment = new AttachmentBuilder(lastGeneratedImage.buffer, {
    name: "musicplayer.png",
  });

  const embedBase = oldEmbed ? EmbedBuilder.from(oldEmbed) : new EmbedBuilder();

  const embed = embedBase
    .setColor(process.env.EMBED_COLOR)
    .setImage("attachment://musicplayer.png")
    .setFooter({
      text: i18n.__("music.player.footerText", {
        author: track.requester.username,
      }),
      iconURL: track.requester.displayAvatarURL({ size: 128 }),
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
