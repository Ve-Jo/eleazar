import { SlashCommandSubcommandBuilder, AttachmentBuilder } from "discord.js";
import fetch from "node-fetch";
import { Client } from "@gradio/client";

export default {
  data: () => {
    // Create a standard subcommand with Discord.js builders
    const builder = new SlashCommandSubcommandBuilder()
      .setName("generate_image")
      .setDescription("Generate beautiful image by prompt")
      .addStringOption((option) =>
        option
          .setName("prompt")
          .setDescription("Enter your prompt")
          .setRequired(true)
      )
      .addIntegerOption((option) =>
        option
          .setName("width")
          .setDescription("Choose width")
          .setRequired(true)
          .setMinValue(256)
          .setMaxValue(2048)
          .addChoices(
            { name: "256", value: 256 },
            { name: "512", value: 512 },
            { name: "768", value: 768 },
            { name: "1024", value: 1024 }
          )
      )
      .addIntegerOption((option) =>
        option
          .setName("height")
          .setDescription("Choose height")
          .setRequired(true)
          .setMinValue(256)
          .setMaxValue(2048)
          .addChoices(
            { name: "256", value: 256 },
            { name: "512", value: 512 },
            { name: "768", value: 768 },
            { name: "1024", value: 1024 }
          )
      )
      .addIntegerOption((option) =>
        option
          .setName("interference_steps")
          .setDescription(
            "Number of inference steps (higher = better quality but slower)"
          )
          .setRequired(false)
          .setMinValue(2)
          .setMaxValue(5)
      )
      .addIntegerOption((option) =>
        option
          .setName("seed")
          .setDescription("Random seed for generation (0 for random)")
          .setRequired(false)
      );

    return builder;
  },

  // Define localization strings directly in the command
  localization_strings: {
    command: {
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
    },
    options: {
      prompt: {
        name: {
          ru: "промпт",
          uk: "запит",
        },
        description: {
          ru: "Введите ваш запрос",
          uk: "Введіть ваш запит",
        },
      },
      width: {
        name: {
          ru: "ширина",
          uk: "ширина",
        },
        description: {
          ru: "Выберите ширину",
          uk: "Виберіть ширину",
        },
      },
      height: {
        name: {
          ru: "высота",
          uk: "висота",
        },
        description: {
          ru: "Выберите высоту",
          uk: "Виберіть висоту",
        },
      },
      interference_steps: {
        name: {
          ru: "шаги_вывода",
          uk: "кроки_виводу",
        },
        description: {
          ru: "Количество шагов вывода (больше = лучше качество, но медленнее)",
          uk: "Кількість кроків виводу (більше = краща якість, але повільніше)",
        },
      },
      seed: {
        name: {
          ru: "сид",
          uk: "сід",
        },
        description: {
          ru: "Сид для генерации (0 для случайного)",
          uk: "Сід для генерації (0 для випадкового)",
        },
      },
    },
    generated: {
      en: "Generated image with prompt: {{prompt}}\nSeed: {{seed}}\nSteps: {{steps}}",
      ru: "Сгенерированное изображение с запросом: {{prompt}}\nСид: {{seed}}\nШагов: {{steps}}",
      uk: "Згенероване зображення із запитом: {{prompt}}\nСід: {{seed}}\nКроків: {{steps}}",
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
    gradio_error: {
      en: "There was an error with the image generation service. Please try again later.",
      ru: "Произошла ошибка с сервисом генерации изображений. Пожалуйста, попробуйте позже.",
      uk: "Виникла помилка з сервісом генерації зображень. Будь ласка, спробуйте пізніше.",
    },
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
            content: i18n.__("commands.ai.generate_image.generated", {
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
        return interaction.editReply({
          content: i18n.__("commands.ai.generate_image.gradio_error"),
        });
      }
    } catch (error) {
      console.error("Error generating image:", error);
      await interaction.editReply({
        content: i18n.__("commands.ai.generate_image.error"),
      });
    }
  },
};
