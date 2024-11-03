import {
  SlashCommandSubcommand,
  I18nCommandBuilder,
} from "../../utils/builders/index.js";
import i18n from "../../utils/i18n.js";
export default {
  data: () => {
    const i18nBuilder = new I18nCommandBuilder("music", "stop");

    const subcommand = new SlashCommandSubcommand({
      name: i18nBuilder.getSimpleName(i18nBuilder.translate("name")),
      description: i18nBuilder.translate("description"),
      name_localizations: i18nBuilder.getLocalizations("name"),
      description_localizations: i18nBuilder.getLocalizations("description"),
    });

    return subcommand;
  },
  async execute(interaction) {
    await interaction.deferReply();
    const player = await interaction.client.lavalink.getPlayer(
      interaction.guild.id
    );

    if (!player) {
      return interaction.editReply(i18n.__("music.noMusicPlaying"));
    } else {
      if (interaction.member.voice.channelId !== player.voiceChannelId) {
        return interaction.editReply({
          content: i18n.__("music.notInVoiceChannel"),
          ephemeral: true,
        });
      }
    }

    await player.destroy(`${interaction.user.username} stopped the music`);
    await interaction.editReply(i18n.__("music.musicStopped"));
  },
  localization_strings: {
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
};
