import { SlashCommandSubcommandBuilder } from "discord.js";

export default {
  data: () => {
    // Create a standard subcommand with Discord.js builders
    const builder = new SlashCommandSubcommandBuilder()
      .setName("seek")
      .setDescription("Seek to a specific time in the current track")
      .addStringOption((option) =>
        option
          .setName("time")
          .setDescription("Time to seek to (format: m:ss or ss)")
          .setRequired(true)
          .setAutocomplete(true)
      );

    return builder;
  },

  // Define localization strings directly in the command
  localization_strings: {
    command: {
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
    },
    options: {
      time: {
        name: {
          ru: "время",
          uk: "час",
        },
        description: {
          ru: "Время для перемотки (формат: m:ss или ss)",
          uk: "Час для перемотки (формат: m:ss або ss)",
        },
      },
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
    noMusicPlaying: {
      en: "No music is currently playing",
      ru: "Музыка сейчас не играет",
      uk: "Музика зараз не грає",
    },
    notInVoiceChannel: {
      en: "You are not in a voice channel (or the player is not in the same voice channel)",
      ru: "Вы не в голосовом канале (или плеер не в том же голосовом канале)",
      uk: "Ви не в голосовому каналі (або плеєр не в тому ж голосовому каналі)",
    },
  },

  async execute(interaction, i18n) {
    await interaction.deferReply();
    const player = interaction.client.lavalink.players.get(
      interaction.guild.id
    );
    if (!player) {
      return interaction.editReply({
        content: await i18n.__("commands.music.seek.noMusicPlaying"),
        ephemeral: true,
      });
    }

    if (interaction.member.voice.channelId !== player.voiceChannelId) {
      return interaction.editReply({
        content: await i18n.__("commands.music.seek.notInVoiceChannel"),
        ephemeral: true,
      });
    }

    const timeString = interaction.options.getString("time");
    const timeInMs = parseTimeToMs(timeString);

    if (timeInMs === null) {
      return interaction.editReply({
        content: await i18n.__("commands.music.seek.invalidTimeFormat"),
        ephemeral: true,
      });
    }

    if (timeInMs > player.queue.current.info.duration) {
      return interaction.editReply({
        content: await i18n.__("commands.music.seek.seekBeyondDuration"),
        ephemeral: true,
      });
    }

    await player.seek(timeInMs);
    return interaction.editReply({
      content: await i18n.__("commands.music.seek.seekedTo", {
        time: timeString,
      }),
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
        {
          name: await i18n.__("commands.music.seek.invalidTimeFormat"),
          value: "0:00",
        },
      ]);
    }
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
