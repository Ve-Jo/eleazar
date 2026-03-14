import { SlashCommandSubcommandBuilder } from "discord.js";

type TranslatorLike = {
  __: (key: string, variables?: Record<string, unknown>) => Promise<string>;
};

type PlayerLike = {
  voiceChannelId?: string | null;
  destroy: (reason?: string) => Promise<void>;
};

type MusicInteractionLike = {
  client: {
    lavalink: {
      getPlayer: (guildId: string) => Promise<PlayerLike | null>;
    };
  };
  guild: { id: string };
  member: { voice: { channelId?: string | null } };
  user: { username: string };
  deferReply: () => Promise<unknown>;
  editReply: (payload: string | { content: string; ephemeral?: boolean }) => Promise<unknown>;
};

const command = {
  data: (): SlashCommandSubcommandBuilder => {
    return new SlashCommandSubcommandBuilder()
      .setName("stop")
      .setDescription("Stop the music");
  },

  localization_strings: {
    command: {
      name: {
        en: "stop",
        ru: "остановить",
        uk: "зупинити",
      },
      description: {
        en: "Stop the music",
        ru: "Остановить музыку",
        uk: "Зупинити музику",
      },
    },
    musicStopped: {
      en: "Music stopped",
      ru: "Музыка остановлена",
      uk: "Музика зупинена",
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
      await interaction.editReply(await i18n.__("commands.music.stop.noMusicPlaying"));
      return;
    }

    if (interaction.member.voice.channelId !== player.voiceChannelId) {
      await interaction.editReply({
        content: await i18n.__("commands.music.stop.notInVoiceChannel"),
        ephemeral: true,
      });
      return;
    }

    await player.destroy(`${interaction.user.username} stopped the music`);
    await interaction.editReply({
      content: await i18n.__("commands.music.stop.musicStopped"),
    });
  },
};

export default command;
