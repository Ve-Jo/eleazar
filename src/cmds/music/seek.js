import {
  SlashCommandSubcommand,
  SlashCommandOption,
  OptionType,
  I18nCommandBuilder,
} from "../../utils/builders/index.js";
import i18n from "../../utils/i18n.js";

export default {
  data: () => {
    const i18nBuilder = new I18nCommandBuilder("music", "seek");

    const subcommand = new SlashCommandSubcommand({
      name: i18nBuilder.getSimpleName(i18nBuilder.translate("name")),
      description: i18nBuilder.translate("description"),
      name_localizations: i18nBuilder.getLocalizations("name"),
      description_localizations: i18nBuilder.getLocalizations("description"),
    });

    // Add time option
    const timeOption = new SlashCommandOption({
      type: OptionType.STRING,
      name: "time",
      description: i18nBuilder.translateOption("time", "description"),
      required: true,
      name_localizations: i18nBuilder.getOptionLocalizations("time", "name"),
      description_localizations: i18nBuilder.getOptionLocalizations(
        "time",
        "description"
      ),
      autocomplete: true,
    });

    subcommand.addOption(timeOption);

    return subcommand;
  },
  async execute(interaction) {
    await interaction.deferReply();
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
        content: i18n.__("music.seek.invalidTimeFormat"),
        ephemeral: true,
      });
    }

    if (timeInMs > player.queue.current.info.duration) {
      return interaction.editReply({
        content: i18n.__("music.seek.seekBeyondDuration"),
        ephemeral: true,
      });
    }

    await player.seek(timeInMs);
    return interaction.editReply({
      content: i18n.__("music.seek.seekedTo", { time: timeString }),
      ephemeral: true,
    });
  },
  async autocomplete(interaction) {
    await interaction.deferReply();
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
  localization_strings: {
    name: {
      en: "seek",
      ru: "перемотать",
      uk: "перемотати",
    },
    description: {
      en: "Seek to a specific time in the current track",
      ru: "Перейти к определенному времени в текущем треке",
      uk: "Перейти до певного часу в поточному треку",
    },
    invalidTimeFormat: {
      en: "Invalid time format. Use m:ss or ss",
      ru: "Неверный формат времени. Используйте m:ss или ss",
      uk: "Невірний формат часу. Використовуйте m:ss або ss",
    },
    seekBeyondDuration: {
      en: "You can't seek beyond the duration of the current track",
      ru: "Вы не можете перемотать за пределы длительности текущего трека",
      uk: "Ви не можете перемотати за межі тривалості поточного треку",
    },
    seekedTo: {
      en: "Seeked to {{time}}",
      ru: "Перемотано к {{time}}",
      uk: "Перемотано до {{time}}",
    },
    options: {
      time: {
        name: {
          en: "time",
          ru: "время",
          uk: "час",
        },
        description: {
          en: "Time to seek to (format: m:ss or ss)",
          ru: "Время для перемотки (формат: m:ss или ss)",
          uk: "Час для перемотки (формат: m:ss або ss)",
        },
      },
    },
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
