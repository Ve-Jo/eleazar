import { EmbedBuilder } from "discord.js";
import i18n from "./i18n.js";

export function createOrUpdateMusicPlayerEmbed(track, player, oldEmbed = null) {
  let locale = track.requester.locale || "en";
  if (locale.includes("-")) {
    locale = locale.split("-")[0];
  }
  i18n.setLocale(locale);

  if (!player.activatedFilters) {
    player.activatedFilters = [];
  }

  const embedBase = oldEmbed ? EmbedBuilder.from(oldEmbed) : new EmbedBuilder();

  const embed = embedBase
    .setColor(process.env.EMBED_COLOR)
    .setTitle(`"${track.info.title}" ${track.info.author}`)
    .setURL(track.info.uri)
    .setAuthor({ name: i18n.__("music.musicPlayerTitle") })
    .setImage(track.info.artworkUrl)
    .setFooter({
      text: i18n.__("music.footerText", {
        author: track.requester.username,
      }),
      iconURL: track.requester.displayAvatarURL({ size: 1024 }),
    })
    .setTimestamp();

  const currentTime = formatTime(player.position);
  const totalTime = formatTime(track.info.duration);
  const progress = createProgressBar(player.position, track.info.duration, 12);

  embed.setFields({
    name: i18n.__("music.info"),
    value: `${progress}\n-# \`${currentTime} / ${totalTime}\` ${i18n.__(
      "music.playerSettingsText",
      {
        volume: player.volume,
        loopType: player.repeatMode || "off",
      }
    )}`,
    inline: false,
  });

  if (player.queue.tracks && player.queue.tracks.length > 0) {
    let next_tracks = player.queue.tracks.map((track, index) => {
      const duration = formatTime(track.info.duration);
      return `+ (${duration}) @${track.requester.tag} "${track.info.title}"`;
    });

    let previous_tracks = [];

    if (player.queue.previous && player.queue.previous.length > 0) {
      previous_tracks = player.queue.previous.slice(-3).map((track, index) => {
        const duration = formatTime(track.info.duration);
        return `- (${duration}) @${track.requester.tag} "${track.info.title}"`;
      });
    }

    let all_tracks = [...previous_tracks, ...next_tracks];

    let queueString = "";
    let trackCount = 0;
    let remainingTracks = 0;

    for (let track of all_tracks) {
      if (queueString.length + track.length + 1 > 250) {
        remainingTracks = all_tracks.length - trackCount;
        break;
      }
      queueString += track + "\n";
      trackCount++;
    }

    if (remainingTracks > 0) {
      queueString += `\n${i18n.__("music.andMoreTracks", {
        count: remainingTracks,
      })}`;
    }

    embed.addFields({
      name: i18n.__("music.queue"),
      value: `\`\`\`diff\n${queueString}\n\`\`\``,
    });
  }

  return embed;
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
