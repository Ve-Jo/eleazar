import {
  SlashCommandSubcommand,
  SlashCommandOption,
  OptionType,
  I18nCommandBuilder,
} from "../../utils/builders/index.js";
import { AttachmentBuilder } from "discord.js";
import fetch from "node-fetch";
import i18n from "../../utils/i18n.js";

export default {
  data: () => {
    const i18nBuilder = new I18nCommandBuilder("ai", "generate_image");

    const subcommand = new SlashCommandSubcommand({
      name: i18nBuilder.getSimpleName(i18nBuilder.translate("name")),
      description: i18nBuilder.translate("description"),
      name_localizations: i18nBuilder.getLocalizations("name"),
      description_localizations: i18nBuilder.getLocalizations("description"),
    });

    // Add prompt option
    const promptOption = new SlashCommandOption({
      type: OptionType.STRING,
      name: "prompt",
      description: i18nBuilder.translateOption("prompt", "description"),
      required: true,
      name_localizations: i18nBuilder.getOptionLocalizations("prompt", "name"),
      description_localizations: i18nBuilder.getOptionLocalizations(
        "prompt",
        "description"
      ),
    });

    // Add ratio option
    const ratioOption = new SlashCommandOption({
      type: OptionType.STRING,
      name: "ratio",
      description: i18nBuilder.translateOption("ratio", "description"),
      required: true,
      name_localizations: i18nBuilder.getOptionLocalizations("ratio", "name"),
      description_localizations: i18nBuilder.getOptionLocalizations(
        "ratio",
        "description"
      ),
      choices: [
        { name: "1:1", value: "1:1" },
        { name: "21:9", value: "21:9" },
        { name: "16:9", value: "16:9" },
        { name: "4:5", value: "4:5" },
        { name: "5:4", value: "5:4" },
        { name: "4:3", value: "4:3" },
        { name: "9:16", value: "9:16" },
        { name: "9:21", value: "9:21" },
      ],
    });

    subcommand.addOption(promptOption);
    subcommand.addOption(ratioOption);

    return subcommand;
  },
  async execute(interaction) {
    await interaction.deferReply();

    let prompt = interaction.options.getString("prompt");
    let aspectRatio = interaction.options.getString("ratio");

    console.log(JSON.stringify({ prompt, aspectRatio }, null, 2));

    try {
      let output = await interaction.client.replicate.run(
        "black-forest-labs/flux-schnell",
        {
          input: {
            prompt,
            aspect_ratio: aspectRatio,
          },
        }
      );

      console.log("Replicate API output:", output);

      if (output && output.length > 0 && output[0]) {
        const imageUrl = output[0];

        const response = await fetch(imageUrl);
        if (!response.ok)
          throw new Error(`Failed to fetch image: ${response.statusText}`);
        const imageBuffer = await response.arrayBuffer();

        // Create an attachment
        const attachment = new AttachmentBuilder(
          Buffer.from(imageBuffer)
        ).setName("generated_image.png");

        await interaction.editReply({
          content: i18n.__("ai.generate_image.generated", { prompt }),
          files: [attachment],
        });
      } else {
        await interaction.editReply(i18n.__("ai.generate_image.failed"));
      }
    } catch (error) {
      console.error("Error generating image:", error);
      await interaction.editReply({
        content: i18n.__("ai.generate_image.error"),
      });
    }
  },
  localization_strings: {
    name: {
      en: "generate",
      ru: "генерировать",
      uk: "генерувати",
    },
    description: {
      en: "Generate beautiful image by prompt",
      ru: "Генерация красивого изображения по запросу",
      uk: "Генерація красивого зображення за запитом",
    },
    options: {
      prompt: {
        name: {
          en: "prompt",
          ru: "промпт",
          uk: "запит",
        },
        description: {
          en: "Enter your prompt",
          ru: "Введите ваш запрос",
          uk: "Введіть ваш запит",
        },
      },
      ratio: {
        name: {
          en: "ratio",
          ru: "формат",
          uk: "формат",
        },
        description: {
          en: "Choose aspect ratio",
          ru: "Выберите соотношение сторон",
          uk: "Виберіть співвідношення сторін",
        },
      },
    },
    generated: {
      en: 'Generated image for prompt: "{{prompt}}"',
      ru: 'Сгенерировано изображение для запроса: "{{prompt}}"',
      uk: 'Згенеровано зображення для запиту: "{{prompt}}"',
    },
    failed: {
      en: "Failed to generate the image. Please try again.",
      ru: "Не удалось сгенерировать изображение. Пожалуйста, попробуйте еще раз.",
      uk: "Не вдалося згенерувати зображення. Будь ласка, спробуйте ще раз.",
    },
    error: {
      en: "An error occurred while generating the image. Please try again later.",
      ru: "Произошла ошибка при генерации изображения. Пожалуйста, попробуйте еще раз позже.",
      uk: "Виникла помилка при генерації зображення. Будь ласка, спробуйте ще раз пізніше.",
    },
  },
};
