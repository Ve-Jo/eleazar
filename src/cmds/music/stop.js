import { SlashCommandSubcommandBuilder } from "discord.js";

export default {
  data: () => {
    // Create a standard subcommand with Discord.js builders
    const builder = new SlashCommandSubcommandBuilder()
      .setName("stop")
      .setDescription("Stop the music");

    return builder;
  },

  // Define localization strings directly in the command
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

  async execute(interaction, i18n) {
    await interaction.deferReply();
    const player = await interaction.client.lavalink.getPlayer(
      interaction.guild.id
    );

    if (!player) {
      return interaction.editReply(
        await i18n.__("commands.music.stop.noMusicPlaying")
      );
    } else {
      if (interaction.member.voice.channelId !== player.voiceChannelId) {
        return interaction.editReply({
          content: await i18n.__("commands.music.stop.notInVoiceChannel"),
          ephemeral: true,
        });
      }
    }

    await player.destroy(`${interaction.user.username} stopped the music`);
    await interaction.editReply({
      content: await i18n.__("commands.music.stop.musicStopped"),
    });
  },
};
