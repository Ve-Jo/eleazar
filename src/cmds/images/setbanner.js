import {
  SlashCommandSubcommand,
  SlashCommandOption,
  OptionType,
  I18nCommandBuilder,
} from "../../utils/builders/index.js";
import { EmbedBuilder } from "discord.js";
import EconomyEZ from "../../utils/economy.js";
import i18n from "../../utils/i18n.js";
import axios from "axios";

export default {
  data: () => {
    const i18nBuilder = new I18nCommandBuilder("images", "setbanner");

    const subcommand = new SlashCommandSubcommand({
      name: i18nBuilder.getSimpleName(i18nBuilder.translate("name")),
      description: i18nBuilder.translate("description"),
      name_localizations: i18nBuilder.getLocalizations("name"),
      description_localizations: i18nBuilder.getLocalizations("description"),
    });

    // Add image attachment option
    const imageOption = new SlashCommandOption({
      type: OptionType.ATTACHMENT,
      name: "image",
      description: i18nBuilder.translateOption("image", "description"),
      required: true,
      name_localizations: i18nBuilder.getOptionLocalizations("image", "name"),
      description_localizations: i18nBuilder.getOptionLocalizations(
        "image",
        "description"
      ),
    });

    subcommand.addOption(imageOption);

    return subcommand;
  },
  async execute(interaction) {
    await interaction.deferReply();
    const attachment = interaction.options.getAttachment("image");

    try {
      // Validate attachment
      if (!attachment.contentType?.startsWith("image/")) {
        return interaction.editReply({
          content: i18n.__("images.setbanner.invalidImage"),
          ephemeral: true,
        });
      }

      // Check file size
      const MAX_SIZE = 8 * 1024 * 1024;
      if (attachment.size > MAX_SIZE) {
        return interaction.editReply({
          content: i18n.__("images.setbanner.imageTooLarge"),
          ephemeral: true,
        });
      }

      // If it's a GIF, request pre-caching
      if (attachment.contentType === "image/gif") {
        try {
          await interaction.editReply({
            content: i18n.__("images.setbanner.processingGif"),
          });

          // Request GIF caching from render server
          await axios.post(`${process.env.IMAGE_SERVER_URL}/api/cache-gif`, {
            url: attachment.url,
          });

          console.log("GIF caching requested successfully");
        } catch (error) {
          console.error("Error requesting GIF caching:", error);
          // Continue even if caching request fails
        }
      }

      // Store the banner URL in the database
      await EconomyEZ.set(
        `economy.${interaction.guild.id}.${interaction.user.id}.banner_url`,
        attachment.url
      );

      const embed = new EmbedBuilder()
        .setColor(process.env.EMBED_COLOR)
        .setTimestamp()
        .setImage(attachment.url)
        .setAuthor({
          name: i18n.__("images.setbanner.title"),
          iconURL: interaction.user.displayAvatarURL(),
        });

      await interaction.editReply({
        content: i18n.__("images.setbanner.success"),
        embeds: [embed],
      });
    } catch (error) {
      console.error("Error setting banner:", error);
      await interaction.editReply({
        content: i18n.__("images.setbanner.error"),
        ephemeral: true,
      });
    }
  },
  localization_strings: {
    name: {
      en: "setbanner",
      ru: "баннер",
      uk: "банер",
    },
    description: {
      en: "Set your profile banner image",
      ru: "Установить изображение баннера профиля",
      uk: "Встановити зображення банера профілю",
    },
    title: {
      en: "Banner Preview",
      ru: "Предпросмотр баннера",
      uk: "Попередній перегляд банера",
    },
    options: {
      image: {
        name: {
          en: "image",
          ru: "изображение",
          uk: "зображення",
        },
        description: {
          en: "Upload your banner image (PNG, JPG, GIF, or WEBP)",
          ru: "Загрузите изображение баннера (PNG, JPG, GIF, или WEBP)",
          uk: "Завантажте зображення банера (PNG, JPG, GIF, або WEBP)",
        },
      },
    },
    invalidImage: {
      en: "The provided URL does not contain a valid image",
      ru: "Предоставленный URL не содержит действительного изображения",
      uk: "Наданий URL не містить дійсного зображення",
    },
    success: {
      en: "Banner has been set successfully!\n\nNote: The first time you use a command with image support, it may take a moment to load.",
      ru: "Баннер успешно установлен!\n\nОбратите внимание, первая загрузка команд с поддержкой изображения может занять некоторое время.",
      uk: "Банер успішно встановлено!\n\nЗверніть увагу, перша завантаження команд з підтримкою зображення може зайняти деякий час.",
    },
    error: {
      en: "An error occurred while setting the banner",
      ru: "Произошла ошибка при установке баннера",
      uk: "Виникла помилка під час встановлення банера",
    },
    imageTooLarge: {
      en: "Image file is too large (maximum 8MB)",
      ru: "Файл изображения слишком большой (максимум 8МБ)",
      uk: "Файл зображення занадто великий (максимум 8МБ)",
    },
    processingGif: {
      en: "Processing GIF banner... This may take a moment.",
      ru: "Обработка GIF баннера... Это может занять некоторое время.",
      uk: "Обробка GIF банера... Це може зайняти деякий час.",
    },
  },
};
