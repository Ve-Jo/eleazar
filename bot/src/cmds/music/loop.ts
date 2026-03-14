import { SlashCommandSubcommandBuilder } from "discord.js";

type TranslatorLike = {
  __: (key: string, variables?: Record<string, unknown>) => Promise<string>;
};

type LoopMode = "track" | "queue" | "off";

type PlayerLike = {
  voiceChannelId?: string | null;
  setRepeatMode: (mode: LoopMode) => Promise<void>;
};

type MusicInteractionLike = {
  client: {
    lavalink: {
      getPlayer: (guildId: string) => Promise<PlayerLike | null>;
    };
  };
  guild: { id: string };
  member: { voice: { channelId?: string | null } };
  options: {
    getString: (name: string) => string | null;
  };
  deferReply: () => Promise<unknown>;
  editReply: (payload: string | { content: string; ephemeral?: boolean }) => Promise<unknown>;
};

const command = {
  data: (): SlashCommandSubcommandBuilder => {
    return new SlashCommandSubcommandBuilder()
      .setName("loop")
      .setDescription("Loop the current song/queue")
      .addStringOption((option) =>
        option
          .setName("type")
          .setDescription("The type of loop to set")
          .setRequired(true)
          .addChoices(
            { name: "Track", value: "track" },
            { name: "Queue", value: "queue" },
            { name: "Off", value: "off" },
          ),
      );
  },

  localization_strings: {
    command: {
      name: {
        en: "loop",
        ru: "повтор",
        uk: "повтор",
      },
      description: {
        en: "Loop the current song/queue",
        ru: "Повторить текущую песню/очередь",
        uk: "Зациклити пісню/чергу",
      },
    },
    options: {
      type: {
        name: {
          ru: "тип",
          uk: "тип",
        },
        description: {
          ru: "Тип повтора",
          uk: "Тип повтору",
        },
      },
    },
    loopApplied: {
      en: "Loop type has been set to {{type}}",
      ru: "Тип повтора был установлен на {{type}}",
      uk: "Тип повтору був встановлений на {{type}}",
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

  async execute(interaction: MusicInteractionLike, i18n: TranslatorLike): Promise<void> {
    await interaction.deferReply();
    const player = await interaction.client.lavalink.getPlayer(interaction.guild.id);

    if (!player) {
      await interaction.editReply(await i18n.__("commands.music.loop.noMusicPlaying"));
      return;
    }

    if (interaction.member.voice.channelId !== player.voiceChannelId) {
      await interaction.editReply({
        content: await i18n.__("commands.music.loop.notInVoiceChannel"),
        ephemeral: true,
      });
      return;
    }

    const loopType = interaction.options.getString("type");
    if (!loopType || !["track", "queue", "off"].includes(loopType)) {
      return;
    }

    await player.setRepeatMode(loopType as LoopMode);
    await interaction.editReply(
      await i18n.__("commands.music.loop.loopApplied", { type: loopType })
    );
  },
};

export default command;
