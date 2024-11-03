import {
  SlashCommandSubcommand,
  SlashCommandOption,
  OptionType,
  I18nCommandBuilder,
} from "../../utils/builders/index.js";
import { AttachmentBuilder } from "discord.js";
import fetch from "node-fetch";
import sharp from "sharp";
import i18n from "../../utils/i18n.js";

export default {
  data: () => {
    const i18nBuilder = new I18nCommandBuilder("ai", "upscale_image");

    const subcommand = new SlashCommandSubcommand({
      name: i18nBuilder.getSimpleName(i18nBuilder.translate("name")),
      description: i18nBuilder.translate("description"),
      name_localizations: i18nBuilder.getLocalizations("name"),
      description_localizations: i18nBuilder.getLocalizations("description"),
    });

    // Add image option
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

    // Add scale option
    const scaleOption = new SlashCommandOption({
      type: OptionType.INTEGER,
      name: "scale",
      description: i18nBuilder.translateOption("scale", "description"),
      required: true,
      name_localizations: i18nBuilder.getOptionLocalizations("scale", "name"),
      description_localizations: i18nBuilder.getOptionLocalizations(
        "scale",
        "description"
      ),
      min_value: 2,
      max_value: 4,
    });

    subcommand.addOption(imageOption);
    subcommand.addOption(scaleOption);

    return subcommand;
  },
  async execute(interaction) {
    await interaction.deferReply();

    const attachment = interaction.options.getAttachment("image");
    const scale = interaction.options.getInteger("scale");

    if (!attachment.contentType.startsWith("image/")) {
      return interaction.editReply(i18n.__("ai.upscale_image.invalid_file"));
    }

    try {
      // Download the image
      const response = await fetch(attachment.url);
      if (!response.ok)
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      const imageBuffer = await response.arrayBuffer();

      // Check image dimensions
      const metadata = await sharp(Buffer.from(imageBuffer)).metadata();
      if (metadata.width > 1024 || metadata.height > 1024) {
        return interaction.editReply(
          i18n.__("ai.upscale_image.invalid_dimensions", {
            width: metadata.width,
            height: metadata.height,
          })
        );
      }

      // Run the upscaling model
      const output = await interaction.client.replicate.run(
        "nightmareai/real-esrgan:f121d640bd286e1fdc67f9799164c1d5be36ff74576ee11c803ae5b665dd46aa",
        {
          input: {
            image: attachment.url,
            scale: scale,
            face_enhance: false,
          },
        }
      );

      if (output) {
        // Fetch the upscaled image
        const upscaledResponse = await fetch(output);
        if (!upscaledResponse.ok)
          throw new Error(
            `Failed to fetch upscaled image: ${upscaledResponse.statusText}`
          );
        const upscaledImageBuffer = await upscaledResponse.arrayBuffer();

        // Create an attachment
        const upscaledAttachment = new AttachmentBuilder(
          Buffer.from(upscaledImageBuffer)
        ).setName("upscaled_image.png");

        await interaction.editReply({
          content: i18n.__("ai.upscale_image.upscaled", { scale }),
          files: [upscaledAttachment],
        });
      } else {
        await interaction.editReply(i18n.__("ai.upscale_image.failed"));
      }
    } catch (error) {
      console.error("Error upscaling image:", error);
      await interaction.editReply(i18n.__("ai.upscale_image.error"));
    }
  },
  localization_strings: {
    name: {
      en: "upscale",
      ru: "увеличить",
      uk: "збільшити",
    },
    description: {
      en: "Upscale an image to improve its quality",
      ru: "Увеличить изображение для улучшения его качества",
      uk: "Збільшити зображення для покращення його якості",
    },
    options: {
      image: {
        name: {
          en: "image",
          ru: "изображение",
          uk: "зображення",
        },
        description: {
          en: "The image to upscale",
          ru: "Изображение для увеличения",
          uk: "Зображення для збільшення",
        },
      },
      scale: {
        name: {
          en: "scale",
          ru: "масштаб",
          uk: "масштаб",
        },
        description: {
          en: "Scale factor (2-4)",
          ru: "Коэффициент масштабирования (2-4)",
          uk: "Коефіцієнт масштабування (2-4)",
        },
      },
    },
    invalid_file: {
      en: "Please provide a valid image file.",
      ru: "Пожалуйста, предоставьте допустимое изображение.",
      uk: "Будь ласка, надайте допустиме зображення.",
    },
    invalid_dimensions: {
      en: "Image dimensions must not exceed 1024x1024 pixels.\n\nYour current image is {{width}}x{{height}} pixels.",
      ru: "Размеры изображения не должны превышать 1024x1024 пикселей.\n\nВаше текущее изображение имеет размеры {{width}}x{{height}} пикселей.",
      uk: "Розміри зображення не повинні перевищувати 1024x1024 пікселів.\n\nВаше поточне зображення має розмір {{width}}x{{height}} пікселів.",
    },
    failed: {
      en: "Failed to upscale the image. Please try again.",
      ru: "Не удалось увеличить изображение. Пожалуйста, попробуйте еще раз.",
      uk: "Не вдалося збільшити зображення. Будь ласка, спробуйте ще раз.",
    },
    error: {
      en: "An error occurred while upscaling the image. Please try again later.",
      ru: "Произошла ошибка при увеличении изображения. Пожалуйста, попробуйте еще раз позже.",
      uk: "Виникла помилка при збільшенні зображення. Будь ласка, спробуйте ще раз пізніше.",
    },
    upscaled: {
      en: "Image upscaled with scale factor {{scale}}x",
      ru: "Изображение увеличено с коэффициентом масштабирования {{scale}}x",
      uk: "Зображення збільшено з коефіцієнтом масштабування {{scale}}x",
    },
  },
};
