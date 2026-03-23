import { SlashCommandSubcommandBuilder } from "discord.js";
import type { TranslatorLike, InteractionLike } from "../../types/index.ts";

type TrackLike = {
  info: {
    title: string;
  };
};

type PlayerLike = {
  voiceChannelId?: string | null;
  playing?: boolean;
  paused?: boolean;
  play: () => Promise<void>;
  queue: {
    previous: TrackLike[];
    add: (track: TrackLike, position?: number) => Promise<unknown>;
  };
};

const command = {
  data: (): SlashCommandSubcommandBuilder => {
    return new SlashCommandSubcommandBuilder()
      .setName("previous")
      .setDescription("Play the previous song");
  },

  localization_strings: {
    command: {
      name: {
        en: "previous",
        ru: "предыдущая",
        uk: "попередня",
      },
      description: {
        en: "Play the previous song",
        ru: "Воспроизвести предыдущую песню",
        uk: "Відтворити попередню пісню",
      },
    },
    noPreviousSongs: {
      en: "There are no previous songs in the queue",
      ru: "В очереди нет предыдущих песен",
      uk: "В черзі немає попередніх пісень",
    },
    addedPreviousToQueue: {
      en: "Added previous song to queue: {{title}}",
      ru: "Добавлена предыдущая песня в очередь: {{title}}",
      uk: "Додано попередню пісню в чергу: {{title}}",
    },
    noMusicPlaying: {
      en: "No music is currently playing",
      ru: "Музыка сейчас не играет",
      uk: "Музика зараз не грає",
    },
    notInVoiceChannel: {
      en: "You are not in the same voice channel as the player",
      ru: "Вы не в том же голосовом канале, что и плеер",
      uk: "Ви не в тому ж голосовому каналі, що й плеєр",
    },
  },

  async execute(interaction: InteractionLike, i18n: TranslatorLike): Promise<void> {
    await interaction.deferReply();
    const player = await (interaction.client as any).lavalink.getPlayer(interaction.guild.id);

    if (!player) {
      await interaction.editReply({
        content: await i18n.__("commands.music.previous.noMusicPlaying"),
      });
      return;
    }

    if ((interaction.member as any)?.voice?.channelId !== player.voiceChannelId) {
      await interaction.editReply({
        content: await i18n.__("commands.music.previous.notInVoiceChannel"),
        ephemeral: true,
      });
      return;
    }

    if (player.queue.previous.length === 0) {
      await interaction.editReply({
        content: await i18n.__("commands.music.previous.noPreviousSongs"),
      });
      return;
    }

    const previousTrack = player.queue.previous[player.queue.previous.length - 1];
    if (!previousTrack) {
      await interaction.editReply({
        content: await i18n.__("commands.music.previous.noPreviousSongs"),
      });
      return;
    }

    await player.queue.add(previousTrack, 0);

    await interaction.editReply({
      content: await i18n.__("commands.music.previous.addedPreviousToQueue", {
        title: previousTrack.info.title,
      }),
    });

    if (!player.playing && !player.paused) {
      await player.play();
    }
  },
};

export default command;
