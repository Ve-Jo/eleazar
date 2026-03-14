import { SlashCommandSubcommandBuilder } from "discord.js";

type TranslatorLike = {
  __: (key: string, variables?: Record<string, unknown>) => Promise<string>;
};

type PlayerLike = {
  voiceChannelId?: string | null;
  get: (key: string) => unknown;
  set: (key: string, value: unknown) => void;
};

type MusicInteractionLike = {
  client: {
    lavalink: {
      getPlayer: (guildId: string) => Promise<PlayerLike | null>;
    };
  };
  guild: { id: string };
  member: { voice: { channelId?: string | null } };
  deferReply: () => Promise<unknown>;
  editReply: (payload: string | { content: string; ephemeral?: boolean }) => Promise<unknown>;
};

const command = {
  data: (): SlashCommandSubcommandBuilder => {
    return new SlashCommandSubcommandBuilder()
      .setName("autoplay")
      .setDescription("Toggle autoplay mode");
  },

  localization_strings: {
    command: {
      name: {
        en: "autoplay",
        ru: "автопроигрывание",
        uk: "автопрогравання",
      },
      description: {
        en: "Toggle autoplay mode",
        ru: "Переключить режим автопроигрывания",
        uk: "Перемикати режим автопрогравання",
      },
    },
    autoplayToggled: {
      en: "Autoplay mode has been toggled {{enabled}}",
      ru: "Режим автопроигрывания был переключен на {{enabled}}",
      uk: "Режим автопрогравання був переключений на {{enabled}}",
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
      await interaction.editReply({
        content: await i18n.__("commands.music.autoplay.noMusicPlaying"),
        ephemeral: true,
      });
      return;
    }
    if (interaction.member.voice.channelId !== player.voiceChannelId) {
      await interaction.editReply({
        content: await i18n.__("commands.music.autoplay.notInVoiceChannel"),
        ephemeral: true,
      });
      return;
    }

    const autoplay = player.get("autoplay_enabled") === true;
    const nextValue = !autoplay;
    player.set("autoplay_enabled", nextValue);

    await interaction.editReply({
      content: await i18n.__("commands.music.autoplay.autoplayToggled", {
        enabled: nextValue,
      }),
      ephemeral: true,
    });
  },
};

export default command;
