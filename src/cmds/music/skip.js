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
      return interaction.editReply({
        content: i18n.__("music.noMusicPlaying"),
        ephemeral: true,
      });
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
        return interaction.editReply({
          content: i18n.__("music.skip.skippedSong"),
          ephemeral: true,
        });
      }
      return interaction.editReply({
        content: i18n.__("music.skip.skippingSongError"),
        ephemeral: true,
      });
    }
    await interaction.editReply({
      content: i18n.__("music.skip.skippedSong"),
      ephemeral: true,
    });
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
  },
};
