import { SlashCommandSubcommandBuilder } from "discord.js";
import type { TranslatorLike, InteractionLike } from "../../types/index.ts";

type TrackLike = {
  info: {
    duration: number;
  };
};

type PlayerLike = {
  voiceChannelId?: string | null;
  position: number;
  queue: {
    current?: TrackLike | null;
  };
  seek: (position: number) => Promise<void>;
};

type AutocompleteOptionLike = {
  name: string;
  value: string;
};

const parseTimeToMs = (timeString: string): number | null => {
  const parts = timeString.split(":").map((part) => Number.parseInt(part, 10));
  if (parts.length === 1 && !Number.isNaN(parts[0] ?? Number.NaN)) {
    return (parts[0] ?? 0) * 1000;
  }
  if (
    parts.length === 2 &&
    !Number.isNaN(parts[0] ?? Number.NaN) &&
    !Number.isNaN(parts[1] ?? Number.NaN)
  ) {
    return ((parts[0] ?? 0) * 60 + (parts[1] ?? 0)) * 1000;
  }
  return null;
};

const formatTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
};

const command = {
  data: (): SlashCommandSubcommandBuilder => {
    return new SlashCommandSubcommandBuilder()
      .setName("seek")
      .setDescription("Seek to a specific time in the current track")
      .addStringOption((option) =>
        option
          .setName("time")
          .setDescription("Time to seek to (format: m:ss or ss)")
          .setRequired(true)
          .setAutocomplete(true),
      );
  },

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

  async execute(interaction: InteractionLike, i18n: TranslatorLike): Promise<void> {
    await interaction.deferReply();
    const player = (interaction.client as any).lavalink.players.get(interaction.guild.id);
    if (!player) {
      await interaction.editReply({
        content: await i18n.__("commands.music.seek.noMusicPlaying"),
        ephemeral: true,
      });
      return;
    }

    if ((interaction.member as any)?.voice?.channelId !== player.voiceChannelId) {
      await interaction.editReply({
        content: await i18n.__("commands.music.seek.notInVoiceChannel"),
        ephemeral: true,
      });
      return;
    }

    const timeString = interaction.options.getString!("time");
    if (!timeString) {
      await interaction.editReply({
        content: await i18n.__("commands.music.seek.invalidTimeFormat"),
        ephemeral: true,
      });
      return;
    }

    const timeInMs = parseTimeToMs(timeString);

    if (timeInMs === null) {
      await interaction.editReply({
        content: await i18n.__("commands.music.seek.invalidTimeFormat"),
        ephemeral: true,
      });
      return;
    }

    const currentTrack = player.queue.current;
    if (!currentTrack || timeInMs > currentTrack.info.duration) {
      await interaction.editReply({
        content: await i18n.__("commands.music.seek.seekBeyondDuration"),
        ephemeral: true,
      });
      return;
    }

    await player.seek(timeInMs);
    await interaction.editReply({
      content: await i18n.__("commands.music.seek.seekedTo", {
        time: timeString,
      }),
      ephemeral: true,
    });
  },

  async autocomplete(interaction: InteractionLike, i18n: TranslatorLike): Promise<void> {
    const player = (interaction.client as any).lavalink.players.get(interaction.guild.id);
    if (!player || !player.queue.current) {
      return;
    }

    const focusedValue = (interaction.options.getFocused!("time") as any).value as string;
    const currentPosition = Math.floor(player.position / 1000);
    const parsedPosition = parseTimeToMs(focusedValue);

    if (parsedPosition !== null) {
      const currentTime = formatTime(currentPosition);
      const newTime = formatTime(parsedPosition / 1000);
      await (interaction as any).respond([{ name: `${currentTime} -> ${newTime}`, value: focusedValue }]);
      return;
    }

    await (interaction as any).respond([
      {
        name: await i18n.__("commands.music.seek.invalidTimeFormat"),
        value: "0:00",
      },
    ]);
  },
};

export default command;
