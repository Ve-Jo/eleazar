import { SlashCommandSubcommandBuilder } from "discord.js";

export default {
  data: () => {
    // Create a standard subcommand with Discord.js builders
    const builder = new SlashCommandSubcommandBuilder()
      .setName("skip")
      .setDescription("Skip the current song");

    return builder;
  },

  // Define localization strings directly in the command
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

  async execute(interaction, i18n) {
    await interaction.deferReply();
    const player = await interaction.client.lavalink.getPlayer(
      interaction.guild.id,
    );

    if (!player) {
      return interaction.editReply({
        content: await i18n.__("commands.music.skip.noMusicPlaying"),
        ephemeral: true,
      });
    } else {
      if (interaction.member.voice.channelId !== player.voiceChannelId) {
        return interaction.editReply({
          content: await i18n.__("commands.music.skip.notInVoiceChannel"),
          ephemeral: true,
        });
      }
    }

    try {
      await player.skip();
    } catch (error) {
      let autoplay = player.get("autoplay_enabled");
      if (autoplay) {
        await player.seek(player.queue.current.info.duration);
        return interaction.editReply({
          content: await i18n.__("commands.music.skip.skippedSong"),
          ephemeral: true,
        });
      }
      return interaction.editReply({
        content: await i18n.__("commands.music.skip.skippingSongError"),
        ephemeral: true,
      });
    }
    await interaction.editReply({
      content: await i18n.__("commands.music.skip.skippedSong"),
      ephemeral: true,
    });
  },
};
