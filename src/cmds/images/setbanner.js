import {
  SlashCommandSubcommand,
  SlashCommandOption,
  OptionType,
  I18nCommandBuilder,
} from "../../utils/builders/index.js";
import { AttachmentBuilder, EmbedBuilder } from "discord.js";
import EconomyEZ from "../../utils/economy.js";
import i18n from "../../utils/i18n.js";
import { generateRemoteImage } from "../../utils/remoteImageGenerator.js";

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

      const MAX_SIZE = 8 * 1024 * 1024;
      if (attachment.size > MAX_SIZE) {
        return interaction.editReply({
          content: i18n.__("images.setbanner.imageTooLarge"),
          ephemeral: true,
        });
      }

      await EconomyEZ.set(
        `economy.${interaction.guild.id}.${interaction.user.id}.banner_url`,
        attachment.url
      );

      const userData = await EconomyEZ.get(
        `economy.${interaction.guild.id}.${interaction.user.id}`
      );

      await interaction.editReply({
        content: i18n.__("images.setbanner.processing"),
      });

      let imageResponse = await generateRemoteImage(
        "Balance",
        {
          interaction: {
            user: {
              id: interaction.user.id,
              username: interaction.user.username,
              displayName: interaction.user.displayName,
              avatarURL: interaction.user.displayAvatarURL({
                extension: "png",
                size: 1024,
              }),
            },
            guild: {
              id: interaction.guild.id,
              name: interaction.guild.name,
              iconURL: interaction.guild.iconURL({
                extension: "png",
                size: 1024,
              }),
            },
          },
          locale: interaction.locale,
          targetUser: {
            id: interaction.user.id,
            username: interaction.user.username,
            displayName: interaction.user.displayName,
            avatarURL: interaction.user.displayAvatarURL({
              extension: "png",
              size: 1024,
            }),
          },
          database: {
            ...userData,
          },
        },
        { width: 400, height: 225 },
        { image: 2, emoji: 1 }
      );

      const final_attachment = new AttachmentBuilder(imageResponse.buffer, {
        name: `balance.${
          imageResponse.contentType === "image/gif" ? "gif" : "png"
        }`,
      });

      await interaction.editReply({
        content: i18n.__(
          `images.setbanner.success.${
            imageResponse.contentType === "image/gif" ? "gif" : "static"
          }`
        ),
        files: [final_attachment],
      });

      if (typeof Bun !== "undefined") {
        Bun.gc();
      }
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
    processing: {
      en: "Processing banner... This may take a moment (especially if it's a GIF).",
      ru: "Обработка баннера... Это может занять некоторое время (особенно если это гифка).",
      uk: "Обробка банера... Це може зайняти деякий час (особливо якщо це анімація).",
    },
    success: {
      static: {
        en: "Banner has been set successfully!",
        ru: "Ваше изображение баннера успешно установлено!",
        uk: "Ваше зображення банера успішно встановлено!",
      },
      gif: {
        en: "Your GIF has been set successfully as a banner!\n\nNote: To maintain fast rendering of each of your commands, the number of frames on the entire animation will be limited to 30 frames. Try to choose short animations to get smooth display.",
        ru: "Ваша гифка была успешно установлена в качестве баннера!\n\nОбратите внимание, чтобы поддерживать быстрый рендер каждой вашей команды, количество кадров на всю анимацию будет ограничено 30 кадрами. Старайтесь подбирать короткие анимации дабы получить плавное отображение.",
        uk: "Ваша анімація банера успішно встановлена як баннер!\n\nЗверніть увагу, щоб підтримувати швидкий рендер кожної вашої команди, кількість кадрів на всю анімацію буде обмежено 30 кадрами. Намагайтесь вибирати короткі анімації дабы отримати плавне відображення.",
      },
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
