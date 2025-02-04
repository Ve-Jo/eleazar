import {
  SlashCommandSubcommand,
  I18nCommandBuilder,
} from "../../utils/builders/index.js";
import { EmbedBuilder } from "discord.js";
import Database from "../../database/client.js";

export default {
  data: () => {
    const i18nBuilder = new I18nCommandBuilder("images", "removebanner");

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

    try {
      await Database.client.user.update({
        where: {
          guildId_id: {
            guildId: interaction.guild.id,
            id: interaction.user.id,
          },
        },
        data: {
          bannerUrl: null,
        },
      });

      const embed = new EmbedBuilder()
        .setColor(process.env.EMBED_COLOR)
        .setTimestamp()
        .setAuthor({
          name: i18n.__("images.removebanner.title"),
          iconURL: interaction.user.displayAvatarURL(),
        });

      await interaction.editReply({
        content: i18n.__("images.removebanner.success"),
        embeds: [embed],
      });
    } catch (error) {
      console.error("Error removing banner:", error);
      await interaction.editReply({
        content: i18n.__("images.removebanner.error"),
        ephemeral: true,
      });
    }
  },
  localization_strings: {
    name: {
      en: "removebanner",
      ru: "убратьбаннер",
      uk: "видалитибанер",
    },
    description: {
      en: "Remove your profile banner image",
      ru: "Удалить изображение баннера профиля",
      uk: "Видалити зображення банера профілю",
    },
    title: {
      en: "Banner Removed",
      ru: "Баннер удален",
      uk: "Банер видалено",
    },
    success: {
      en: "Your banner has been removed successfully!",
      ru: "Ваш баннер успешно удален!",
      uk: "Ваш банер успішно видалено!",
    },
    error: {
      en: "An error occurred while removing the banner",
      ru: "Произошла ошибка при удалении баннера",
      uk: "Виникла помилка під час видалення банера",
    },
  },
};
