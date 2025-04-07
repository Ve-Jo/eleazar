import { SlashCommandSubcommandBuilder } from "discord.js";

export default {
  data: () => {
    // Create a standard subcommand with Discord.js builders
    const builder = new SlashCommandSubcommandBuilder()
      .setName("autoplay")
      .setDescription("Toggle autoplay mode");

    return builder;
  },

  // Define localization strings directly in the command
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

  async execute(interaction, i18n) {
    await interaction.deferReply();
    const player = await interaction.client.lavalink.getPlayer(
      interaction.guild.id
    );
    if (!player)
      return interaction.editReply({
        content: i18n.__("noMusicPlaying"),
        ephemeral: true,
      });
    if (interaction.member.voice.channelId !== player.voiceChannelId)
      return interaction.editReply({
        content: i18n.__("notInVoiceChannel"),
        ephemeral: true,
      });

    let autoplay = player.get("autoplay_enabled");
    if (autoplay === undefined || autoplay === false) {
      player.set("autoplay_enabled", true);

      return interaction.editReply({
        content: i18n.__("autoplayToggled", {
          enabled: !autoplay,
        }),
        ephemeral: true,
      });
    } else {
      player.set("autoplay_enabled", false);

      return interaction.editReply({
        content: i18n.__("autoplayToggled", {
          enabled: !autoplay,
        }),
        ephemeral: true,
      });
    }
  },
};
