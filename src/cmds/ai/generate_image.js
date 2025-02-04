import {
  SlashCommandSubcommand,
  SlashCommandOption,
  OptionType,
  I18nCommandBuilder,
} from "../../utils/builders/index.js";
import { AttachmentBuilder } from "discord.js";
import fetch from "node-fetch";
import { Client } from "@gradio/client";

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

    // Add width option
    const widthOption = new SlashCommandOption({
      type: OptionType.INTEGER,
      name: "width",
      description: i18nBuilder.translateOption("width", "description"),
      required: true,
      name_localizations: i18nBuilder.getOptionLocalizations("width", "name"),
      description_localizations: i18nBuilder.getOptionLocalizations(
        "width",
        "description"
      ),
      min_value: 256,
      max_value: 2048,
      choices: [
        { name: "256", value: 256 },
        { name: "512", value: 512 },
        { name: "768", value: 768 },
        { name: "1024", value: 1024 },
      ],
    });

    // Add height option
    const heightOption = new SlashCommandOption({
      type: OptionType.INTEGER,
      name: "height",
      description: i18nBuilder.translateOption("height", "description"),
      required: true,
      name_localizations: i18nBuilder.getOptionLocalizations("height", "name"),
      description_localizations: i18nBuilder.getOptionLocalizations(
        "height",
        "description"
      ),
      min_value: 256,
      max_value: 2048,
      choices: [
        { name: "256", value: 256 },
        { name: "512", value: 512 },
        { name: "768", value: 768 },
        { name: "1024", value: 1024 },
      ],
    });

    const interferenceSteps = new SlashCommandOption({
      type: OptionType.INTEGER,
      name: "interference_steps",
      description: i18nBuilder.translateOption(
        "interference_steps",
        "description"
      ),
      required: false,
      name_localizations: i18nBuilder.getOptionLocalizations(
        "interference_steps",
        "name"
      ),
      description_localizations: i18nBuilder.getOptionLocalizations(
        "interference_steps",
        "description"
      ),
      min_value: 2,
      max_value: 5,
    });

    const seedOption = new SlashCommandOption({
      type: OptionType.INTEGER,
      name: "seed",
      description: i18nBuilder.translateOption("seed", "description"),
      required: false,
      name_localizations: i18nBuilder.getOptionLocalizations("seed", "name"),
      description_localizations: i18nBuilder.getOptionLocalizations(
        "seed",
        "description"
      ),
    });

    subcommand.addOption(promptOption);
    subcommand.addOption(widthOption);
    subcommand.addOption(heightOption);
    subcommand.addOption(interferenceSteps);
    subcommand.addOption(seedOption);
    return subcommand;
  },
  async execute(interaction, i18n) {
    await interaction.deferReply();

    let prompt = interaction.options.getString("prompt");
    let width = interaction.options.getInteger("width") || 1024;
    let height = interaction.options.getInteger("height") || 1024;
    let interferenceSteps =
      interaction.options.getInteger("interference_steps") || 4;
    let seed = interaction.options.getInteger("seed") || 0;
    console.log(JSON.stringify({ prompt, width, height }, null, 2));

    try {
      // First try using Gradio client
      try {
        const client = await Client.connect("black-forest-labs/FLUX.1-schnell");
        const output = await client.predict("/infer", [
          prompt,
          seed,
          !seed,
          width,
          height,
          interferenceSteps,
        ]);

        console.log("Gradio output:", output);

        if (output.data && output.data.length > 0) {
          const imageUrl = output.data[0].url; // Access url property from the file data object
          const response = await fetch(imageUrl);
          if (!response.ok)
            throw new Error(`Failed to fetch image: ${response.statusText}`);
          const imageBuffer = await response.arrayBuffer();

          const attachment = new AttachmentBuilder(
            Buffer.from(imageBuffer)
          ).setName("generated_image.png");

          await interaction.editReply({
            content: i18n.__("ai.generate_image.generated", {
              prompt,
              seed: output.data[1] || "random", // Use the seed from output data
              steps: interferenceSteps,
            }),
            files: [attachment],
          });
          return;
        }
        throw new Error("No image in response");
      } catch (gradioError) {
        console.error("Gradio client error:", gradioError);
        // Fallback to DeepInfra
        const output = await interaction.client.deepinfra.flux_schnell.generate(
          {
            prompt,
            width,
            height,
            num_inference_steps: interferenceSteps,
            seed,
          }
        );

        console.log("DeepInfra output:");

        if (output && output.images && output.images.length > 0) {
          const imageUrl = output.images[0];

          const response = await fetch(imageUrl);
          if (!response.ok)
            throw new Error(`Failed to fetch image: ${response.statusText}`);
          const imageBuffer = await response.arrayBuffer();

          const attachment = new AttachmentBuilder(
            Buffer.from(imageBuffer)
          ).setName("generated_image.png");

          await interaction.editReply({
            content: i18n.__("ai.generate_image.generated", {
              prompt,
              seed: seed || "random",
              steps: interferenceSteps,
            }),
            files: [attachment],
          });
        } else {
          await interaction.editReply(i18n.__("ai.generate_image.failed"));
        }
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
      width: {
        name: {
          en: "width",
          ru: "ширина",
          uk: "ширина",
        },
        description: {
          en: "Choose width",
          ru: "Выберите ширину",
          uk: "Виберіть ширину",
        },
      },
      height: {
        name: {
          en: "height",
          ru: "высота",
          uk: "висота",
        },
        description: {
          en: "Choose height",
          ru: "Выберите высоту",
          uk: "Виберіть висоту",
        },
      },
      interference_steps: {
        name: {
          en: "interference_steps",
          ru: "шаги_генерации",
          uk: "кроки_генерації",
        },
        description: {
          en: "Choose number of steps for generation",
          ru: "Выберите количество шагов для генерации",
          uk: "Виберіть кількість кроків для генерації",
        },
      },
      seed: {
        name: {
          en: "seed",
          ru: "сид",
          uk: "сид",
        },
        description: {
          en: "Choose seed",
          ru: "Выберите сид",
          uk: "Виберіть сид",
        },
      },
    },
    generated: {
      en: 'Generated image for prompt: "{{prompt}}"\nSeed: {{seed}} | Steps: {{steps}}',
      ru: 'Сгенерировано изображение для запроса: "{{prompt}}"\nСид: {{seed}} | Шаги: {{steps}}',
      uk: 'Згенеровано зображення для запиту: "{{prompt}}"\nСид: {{seed}} | Кроків: {{steps}}',
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
