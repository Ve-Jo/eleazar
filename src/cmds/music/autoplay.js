import {
  SlashCommandSubcommand,
  I18nCommandBuilder,
} from "../../utils/builders/index.js";

export default {
  data: () => {
    const i18nBuilder = new I18nCommandBuilder("music", "autoplay");

    const subcommand = new SlashCommandSubcommand({
      name: i18nBuilder.getSimpleName(i18nBuilder.translate("name")),
      description: i18nBuilder.translate("description"),
      name_localizations: i18nBuilder.getLocalizations("name"),
      description_localizations: i18nBuilder.getLocalizations("description"),
    });

    return subcommand;
  },
  async execute(interaction, i18n) {
    await interaction.deferReply();
    const player = await interaction.client.lavalink.getPlayer(
      interaction.guild.id
    );
    if (!player)
      return interaction.editReply({
        content: i18n.__("music.noMusicPlaying"),
        ephemeral: true,
      });
    if (interaction.member.voice.channelId !== player.voiceChannelId)
      return interaction.editReply({
        content: i18n.__("music.notInVoiceChannel"),
        ephemeral: true,
      });

    let autoplay = player.get("autoplay_enabled");
    if (autoplay === undefined || autoplay === false) {
      player.set("autoplay_enabled", true);

      return interaction.editReply({
        content: i18n.__("music.autoplay.autoplayToggled", {
          enabled: !autoplay,
        }),
        ephemeral: true,
      });
    } else {
      player.set("autoplay_enabled", false);

      return interaction.editReply({
        content: i18n.__("music.autoplay.autoplayToggled", {
          enabled: !autoplay,
        }),
        ephemeral: true,
      });
    }
  },
  localization_strings: {
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
    autoplayToggled: {
      en: "Autoplay mode has been toggled {{enabled}}",
      ru: "Режим автопроигрывания был переключен на {{enabled}}",
      uk: "Режим автопрогравання був переключений на {{enabled}}",
    },
  },
};
