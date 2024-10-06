import { SlashCommandSubcommandBuilder } from "discord.js";
import i18n from "../../utils/i18n";

export default {
  data: new SlashCommandSubcommandBuilder()
    .setName("seek")
    .setDescription("Seek to a specific time in the current track")
    .setDescriptionLocalizations({
      ru: "Перейти к определенному времени в текущем треке",
      uk: "Перейти до певного часу в поточному треку",
    })
    .addStringOption((option) =>
      option
        .setName("time")
        .setDescription("Time to seek to (format: m:ss or ss)")
        .setRequired(true)
        .setAutocomplete(true)
    ),
  async autocomplete(interaction) {
    const player = interaction.client.lavalink.players.get(
      interaction.guild.id
    );
    if (!player || !player.queue.current) return;

    const focusedValue = interaction.options.getFocused(true).value;
    const currentPosition = Math.floor(player.position / 1000);
    const newPosition = parseTimeToMs(focusedValue) / 1000;

    if (newPosition !== null) {
      const currentTime = formatTime(currentPosition);
      const newTime = formatTime(newPosition);
      return interaction.respond([
        { name: `${currentTime} -> ${newTime}`, value: focusedValue },
      ]);
    } else {
      return interaction.respond([
        { name: "Invalid format. Use m:ss or ss", value: "0:00" },
      ]);
    }
  },
  async execute(interaction) {
    const player = interaction.client.lavalink.players.get(
      interaction.guild.id
    );
    if (!player) {
      return interaction.editReply({
        content: i18n.__("music.noMusicPlaying"),
        ephemeral: true,
      });
    }

    if (interaction.member.voice.channelId !== player.voiceChannelId) {
      return interaction.editReply({
        content: i18n.__("music.notInVoiceChannel"),
        ephemeral: true,
      });
    }

    const timeString = interaction.options.getString("time");
    const timeInMs = parseTimeToMs(timeString);

    if (timeInMs === null) {
      return interaction.editReply({
        content: i18n.__("music.invalidTimeFormat"),
        ephemeral: true,
      });
    }

    if (timeInMs > player.queue.current.info.duration) {
      return interaction.editReply({
        content: i18n.__("music.seekBeyondDuration"),
        ephemeral: true,
      });
    }

    await player.seek(timeInMs);
    return interaction.editReply({
      content: i18n.__("music.seekedTo", { time: timeString }),
      ephemeral: true,
    });
  },
};

function parseTimeToMs(timeString) {
  const parts = timeString.split(":").map((part) => parseInt(part, 10));
  if (parts.length === 1 && !isNaN(parts[0])) {
    return parts[0] * 1000; // seconds only
  } else if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return (parts[0] * 60 + parts[1]) * 1000; // minutes and seconds
  }
  return null; // invalid format
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}
