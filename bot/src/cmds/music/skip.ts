import { SlashCommandSubcommandBuilder } from "discord.js";
import type { TranslatorLike, InteractionLike } from "../../types/index.ts";

type TrackLike = {
  info: {
    duration: number;
  };
};

type PlayerLike = {
  voiceChannelId?: string | null;
  skip: () => Promise<void>;
  seek: (position: number) => Promise<void>;
  get: (key: string) => unknown;
  queue: {
    current?: TrackLike | null;
  };
};

const command = {
  data: (): SlashCommandSubcommandBuilder => {
    return new SlashCommandSubcommandBuilder()
      .setName("skip")
      .setDescription("Skip the current song");
  },

  localization_strings: {
    command: {
      name: {
        en: "skip",
        ru: "пропустить",
        uk: "пропустити",
      },
      description: {
        en: "Skip the current song",
        ru: "Пропустить текущую песню",
        uk: "Пропустити поточну пісню",
      },
    },
    skippedSong: {
      en: "Skipped the current song",
      ru: "Пропущена текущая песня",
      uk: "Пропущена поточна пісня",
    },
    skippingSongError: {
      en: "Failed to skip the current song",
      ru: "Не удалось пропустить текущую песню",
      uk: "Не вдалося пропустити поточну пісню",
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
    const player = await (interaction.client as any).lavalink.getPlayer(interaction.guild.id);

    if (!player) {
      await interaction.editReply({
        content: await i18n.__("commands.music.skip.noMusicPlaying"),
        ephemeral: true,
      });
      return;
    }

    if ((interaction.member as any)?.voice?.channelId !== player.voiceChannelId) {
      await interaction.editReply({
        content: await i18n.__("commands.music.skip.notInVoiceChannel"),
        ephemeral: true,
      });
      return;
    }

    try {
      await player.skip();
    } catch {
      const autoplay = Boolean(player.get("autoplay_enabled"));
      const currentTrack = player.queue.current;
      if (autoplay && currentTrack) {
        await player.seek(currentTrack.info.duration);
        await interaction.editReply({
          content: await i18n.__("commands.music.skip.skippedSong"),
          ephemeral: true,
        });
        return;
      }

      await interaction.editReply({
        content: await i18n.__("commands.music.skip.skippingSongError"),
        ephemeral: true,
      });
      return;
    }

    await interaction.editReply({
      content: await i18n.__("commands.music.skip.skippedSong"),
      ephemeral: true,
    });
  },
};

export default command;
