import { SlashCommandSubcommandBuilder } from "discord.js";
import type { TranslatorLike, InteractionLike } from "../../types/index.ts";

type TrackLike = {
  info: {
    title: string;
  };
};

type PlayerLike = {
  voiceChannelId?: string | null;
  queue: {
    current?: TrackLike | null;
    tracks: TrackLike[];
  };
};

const command = {
  data: (): SlashCommandSubcommandBuilder => {
    return new SlashCommandSubcommandBuilder()
      .setName("queue")
      .setDescription("Show the music queue");
  },

  localization_strings: {
    command: {
      name: {
        en: "queue",
        ru: "очередь",
        uk: "черга",
      },
      description: {
        en: "Show the music queue",
        ru: "Показать очередь музыки",
        uk: "Показати чергу музики",
      },
    },
    currentPlaying: {
      en: "Currently playing: {{title}}",
      ru: "Текущая песня: {{title}}",
      uk: "Поточна пісня: {{title}}",
    },
    nextInQueue: {
      en: "Next in queue: {{tracks}}",
      ru: "Следующая в очереди: {{tracks}}",
      uk: "Наступна в черзі: {{tracks}}",
    },
    currentQueue: {
      en: "Current queue",
      ru: "Текущая очередь",
      uk: "Поточна черга",
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
      await interaction.editReply(await i18n.__("commands.music.queue.noMusicPlaying"));
      return;
    }

    if ((interaction.member as any)?.voice?.channelId !== player.voiceChannelId) {
      await interaction.editReply({
        content: await i18n.__("commands.music.queue.notInVoiceChannel"),
        ephemeral: true,
      });
      return;
    }

    const current = player.queue.current;
    if (!current) {
      await interaction.editReply(await i18n.__("commands.music.queue.noMusicPlaying"));
      return;
    }

    const nextTrack = player.queue.tracks;
    const queueString = `${await i18n.__("commands.music.queue.currentPlaying", {
      title: current.info.title,
    })}\n${await i18n.__("commands.music.queue.nextInQueue", {
      tracks: nextTrack.map((track: any) => `• ${track.info.title}`).join(", "),
    })}`;

    await interaction.editReply(
      `${await i18n.__("commands.music.queue.currentQueue")}\n${queueString}`
    );
  },
};

export default command;
