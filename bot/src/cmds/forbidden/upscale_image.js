import { SlashCommandSubcommandBuilder, AttachmentBuilder } from "discord.js";
import fetch from "node-fetch";
import sharp from "sharp";

export default {
  data: () => {
    // Create a standard subcommand with Discord.js builders
    const builder = new SlashCommandSubcommandBuilder()
      .setName("upscale_image")
      .setDescription("Upscale an image to improve its quality")
      .addAttachmentOption((option) =>
        option
          .setName("image")
          .setDescription("The image to upscale")
          .setRequired(true),
      )
      .addIntegerOption((option) =>
        option
          .setName("scale")
          .setDescription("Scale factor (2-4)")
          .setRequired(true)
          .setMinValue(2)
          .setMaxValue(4),
      );

    return builder;
  },

  // Define localization strings directly in the command
  localization_strings: {
    command: {
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
    },
    options: {
      image: {
        name: {
          ru: "изображение",
          uk: "зображення",
        },
        description: {
          ru: "Изображение для увеличения",
          uk: "Зображення для збільшення",
        },
      },
      scale: {
        name: {
          ru: "масштаб",
          uk: "масштаб",
        },
        description: {
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
    no_attachment: {
      en: "Please provide an image to upscale.",
      ru: "Пожалуйста, предоставьте изображение для увеличения.",
      uk: "Будь ласка, надайте зображення для збільшення.",
    },
    not_an_image: {
      en: "The provided file is not an image. Content type: {{content_type}}",
      ru: "Предоставленный файл не является изображением. Тип содержимого: {{content_type}}",
      uk: "Наданий файл не є зображенням. Тип вмісту: {{content_type}}",
    },
    file_too_large: {
      en: "The image file is too large (max 10MB).",
      ru: "Файл изображения слишком большой (максимум 10МБ).",
      uk: "Файл зображення занадто великий (максимум 10МБ).",
    },
    download_failed: {
      en: "Failed to download the image.",
      ru: "Не удалось загрузить изображение.",
      uk: "Не вдалося завантажити зображення.",
    },
    processing: {
      en: "Processing your image...",
      ru: "Обработка вашего изображения...",
      uk: "Обробка вашого зображення...",
    },
    api_error: {
      en: "Error connecting to the upscale API.",
      ru: "Ошибка при подключении к API увеличения.",
      uk: "Помилка при підключенні до API збільшення.",
    },
    processing_failed: {
      en: "Failed to process the image.",
      ru: "Не удалось обработать изображение.",
      uk: "Не вдалося обробити зображення.",
    },
    no_output: {
      en: "The upscaling service did not return any output.",
      ru: "Сервис увеличения не вернул результат.",
      uk: "Сервіс збільшення не повернув результат.",
    },
    result_download_failed: {
      en: "Failed to download the upscaled image.",
      ru: "Не удалось загрузить увеличенное изображение.",
      uk: "Не вдалося завантажити збільшене зображення.",
    },
    success: {
      en: "Here is your upscaled image!",
      ru: "Вот ваше увеличенное изображение!",
      uk: "Ось ваше збільшене зображення!",
    },
  },

  async execute(interaction, i18n) {
    await interaction.deferReply();

    const attachment = interaction.options.getAttachment("image");

    if (!attachment) {
      return interaction.editReply(await i18n.__("no_attachment"));
    }

    // Check if file is an image
    if (!attachment.contentType?.startsWith("image/")) {
      return interaction.editReply(
        await i18n.__("not_an_image", {
          content_type: attachment.contentType || "unknown",
        }),
      );
    }

    // Check file size (10MB limit)
    if (attachment.size > 10 * 1024 * 1024) {
      return interaction.editReply(await i18n.__("file_too_large"));
    }

    try {
      // Download the image
      const response = await fetch(attachment.url);
      if (!response.ok) {
        throw new Error(await i18n.__("download_failed"));
      }

      const imageBuffer = await response.arrayBuffer();

      await interaction.editReply(await i18n.__("processing"));

      // Call the upscale API using Replicate
      const prediction = await interaction.client.replicate.predictions.create({
        version:
          "42fed1c4974146d4d2414e2be2c5277c7fcf05fcc3a73abf41610695738c1d7b",
        input: {
          image: Buffer.from(imageBuffer).toString("base64"),
        },
      });

      if (!prediction) {
        throw new Error(await i18n.__("api_error"));
      }

      // Wait for the prediction to complete
      let finalPrediction = prediction;
      while (
        finalPrediction.status !== "succeeded" &&
        finalPrediction.status !== "failed"
      ) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        finalPrediction = await interaction.client.replicate.predictions.get(
          prediction.id,
        );
      }

      if (finalPrediction.status === "failed") {
        throw new Error(await i18n.__("processing_failed"));
      }

      // Get the result image
      const output = finalPrediction.output;

      if (!output || !output[0]) {
        throw new Error(await i18n.__("no_output"));
      }

      // Download the result image
      const upscaledImageUrl = output[0];
      const upscaledImageResponse = await fetch(upscaledImageUrl);

      if (!upscaledImageResponse.ok) {
        throw new Error(await i18n.__("result_download_failed"));
      }

      const upscaledImageBuffer = await upscaledImageResponse.arrayBuffer();

      // Send the result
      const resultAttachment = new AttachmentBuilder(
        Buffer.from(upscaledImageBuffer),
      ).setName("upscaled_image.avif");

      await interaction.editReply({
        content: await i18n.__("success"),
        files: [resultAttachment],
      });
    } catch (error) {
      console.error("Error upscaling image:", error);
      await interaction.editReply(await i18n.__("error"));
    }
  },
};
