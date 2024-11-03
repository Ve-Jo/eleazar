import {
  SlashCommandSubcommand,
  I18nCommandBuilder,
} from "../../utils/builders/index.js";
import i18n from "../../utils/i18n.js";

export default {
  data: () => {
    const i18nBuilder = new I18nCommandBuilder("music", "skip");

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

    try {
      await player.skip();
    } catch (error) {
      let autoplay = player.get("autoplay_enabled");
      if (autoplay) {
        await player.seek(player.queue.current.info.duration);
        return interaction.editReply(i18n.__("music.skippedSong"));
      }
      return interaction.editReply(i18n.__("music.skippingSongError"));
    }
    await interaction.editReply(i18n.__("music.skippedSong"));
  },
  localization_strings: {
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
};
