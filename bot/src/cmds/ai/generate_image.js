import { SlashCommandSubcommandBuilder, AttachmentBuilder } from "discord.js";
import fetch from "node-fetch";
import { Client } from "@gradio/client";
import OpenAI from "openai";
import CONFIG from "../../config/aiConfig.js";

export default {
  data: () => {
    // Create a standard subcommand with Discord.js builders
    const builder = new SlashCommandSubcommandBuilder()
      .setName("generate_image")
      .setDescription("Generate beautiful image by prompt")
      .addStringOption((option) =>
        option
          .setName("model")
          .setDescription("Select image generation model")
          .setRequired(true)
          .addChoices(
            { name: "Qwen Image (NanoGPT)", value: "qwen-image" },
            { name: "HiDream (NanoGPT)", value: "hidream" },
            { name: "Chroma (NanoGPT)", value: "chroma" },
            {
              name: "ArtiWaifu Diffusion (NanoGPT)",
              value: "artiwaifu-diffusion",
            },

            { name: "FLUX.1 Schnell (Gradio)", value: "gradio" }
          )
      )
      .addStringOption((option) =>
        option
          .setName("prompt")
          .setDescription("Enter your prompt (English gives better results)")
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
          .setMinValue(4)
          .setMaxValue(50)
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
      model: {
        name: {
          ru: "модель",
          uk: "модель",
        },
        description: {
          ru: "Выберите модель генерации изображений",
          uk: "Виберіть модель генерації зображень",
        },
      },
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
    generating: {
      en: "Generating image with prompt: {{prompt}}...",
      ru: "Генерируется изображение с запросом: {{prompt}}...",
      uk: "Генерується зображення з запитом: {{prompt}}...",
    },
  },

  async execute(interaction, i18n) {
    await interaction.deferReply();

    let modelId = interaction.options.getString("model");
    let prompt = interaction.options.getString("prompt");
    let width = interaction.options.getInteger("width") || 1024;
    let height = interaction.options.getInteger("height") || 1024;
    let interferenceSteps =
      interaction.options.getInteger("interference_steps") || 10;
    let seed = interaction.options.getInteger("seed") || 0;
    console.log(JSON.stringify({ modelId, prompt, width, height }, null, 2));

    // Validate interference steps - if outside range, clamp to valid range
    /*if (interferenceSteps > 5) {
      console.log(`Clamping interference steps from ${interferenceSteps} to 5`);
      interferenceSteps = 5;
    } else if (interferenceSteps < 2) {
      console.log(`Clamping interference steps from ${interferenceSteps} to 2`);
      interferenceSteps = 2;
    }*/

    // Generate image with selected model
    await this.generateImage(
      interaction,
      i18n,
      prompt,
      width,
      height,
      interferenceSteps,
      seed,
      modelId
    );
  },

  async generateImage(
    interaction,
    i18n,
    prompt,
    width,
    height,
    interferenceSteps,
    seed,
    modelId
  ) {
    try {
      // Update status
      await interaction.editReply({
        content: await i18n.__("commands.ai.generate_image.generating", {
          prompt,
        }),
      });

      let imageBuffer;
      let usedSeed = seed;

      // Try NanoGPT models first if selected
      if (modelId !== "gradio") {
        try {
          imageBuffer = await this.generateWithNanoGPT(
            prompt,
            width,
            height,
            interferenceSteps,
            seed,
            modelId
          );
          console.log(
            `Successfully generated image with NanoGPT model: ${modelId}`
          );
        } catch (nanoGptError) {
          console.error(
            `NanoGPT generation failed for model ${modelId}:`,
            nanoGptError
          );
          // Fallback to Gradio
          console.log("Falling back to Gradio model...");
          imageBuffer = await this.generateWithGradio(
            prompt,
            width,
            height,
            interferenceSteps,
            seed
          );
          modelId = "gradio"; // Update model ID to reflect fallback
        }
      } else {
        // Use Gradio directly
        imageBuffer = await this.generateWithGradio(
          prompt,
          width,
          height,
          interferenceSteps,
          seed
        );
      }

      // Create attachment and send result
      const attachment = new AttachmentBuilder(imageBuffer).setName(
        "generated_image.png"
      );

      const responseContent = await i18n.__(
        "commands.ai.generate_image.generated",
        {
          prompt,
          seed: usedSeed || "random",
          steps: interferenceSteps,
        }
      );

      await interaction.editReply({
        content: responseContent,
        files: [attachment],
      });
    } catch (error) {
      console.error("Error generating image:", error);
      const errorMessage = await i18n.__("commands.ai.generate_image.error");

      try {
        await interaction.editReply({
          content: errorMessage,
        });
      } catch (replyError) {
        console.error("Error sending error response:", replyError);
      }
    }
  },

  async generateWithNanoGPT(prompt, width, height, steps, seed, modelId) {
    if (!CONFIG.nanogpt.apiKey) {
      throw new Error("NanoGPT API key not configured");
    }

    // Try both endpoints - first the OpenAI-compatible one, then the direct one
    const endpoints = [
      "https://nano-gpt.com/v1/images/generations",
      "https://nano-gpt.com/api/generate-image",
    ];

    let lastError;

    for (const endpoint of endpoints) {
      try {
        console.log(`Trying NanoGPT endpoint: ${endpoint}`);

        const requestBody = endpoint.includes("/v1/images/generations")
          ? {
              model: modelId,
              prompt: prompt,
              n: 1,
              size: `${width}x${height}`,
              response_format: "url",
              num_inference_steps: steps,
              ...(seed !== 0 && { seed: seed }),
            }
          : {
              model: modelId,
              prompt: prompt,
              width: width,
              height: height,
              steps: steps,
              seed: seed || 0,
            };

        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${CONFIG.nanogpt.apiKey}`,
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `NanoGPT API error: ${response.status} - ${errorText}`
          );
        }

        // Check content type to determine if response is JSON or binary image
        const contentType = response.headers.get("content-type");
        console.log(`Response content-type: ${contentType}`);

        if (contentType && contentType.includes("application/json")) {
          // JSON response - parse it
          const result = await response.json();
          console.log(
            `NanoGPT JSON response from ${endpoint}:`,
            JSON.stringify(result, null, 2)
          );

          let imageUrl;
          let base64Data;

          // Handle different response formats
          if (endpoint.includes("/v1/images/generations")) {
            // OpenAI-compatible format
            if (!result.data || !result.data[0]) {
              throw new Error("No data in NanoGPT response (OpenAI format)");
            }

            // Try URL first, then base64
            if (result.data[0].url) {
              imageUrl = result.data[0].url;
            } else if (result.data[0].b64_json) {
              base64Data = result.data[0].b64_json;
            } else {
              throw new Error(
                "No image URL or base64 data in NanoGPT response"
              );
            }
          } else {
            // Direct API format
            if (result.imageUrl) {
              imageUrl = result.imageUrl;
            } else if (result.b64_json) {
              base64Data = result.b64_json;
            } else {
              throw new Error(
                "No image URL or base64 data in NanoGPT response"
              );
            }
          }

          if (base64Data) {
            // Decode base64 data directly
            return Buffer.from(base64Data, "base64");
          } else {
            // Fetch image from URL
            const imageResponse = await fetch(imageUrl);
            if (!imageResponse.ok) {
              throw new Error(
                `Failed to fetch image from NanoGPT: ${imageResponse.statusText}`
              );
            }
            return Buffer.from(await imageResponse.arrayBuffer());
          }
        } else {
          // Binary response - assume it's the image data directly
          console.log(
            `Received binary response from ${endpoint}, size: ${response.headers.get(
              "content-length"
            )} bytes`
          );
          return Buffer.from(await response.arrayBuffer());
        }
      } catch (error) {
        lastError = error;
        console.log(`Endpoint ${endpoint} failed:`, error.message);
        // Continue to next endpoint
      }
    }

    // If we get here, all endpoints failed
    throw new Error(
      `All NanoGPT endpoints failed. Last error: ${lastError.message}`
    );
  },

  async generateWithGradio(prompt, width, height, steps, seed) {
    const client = await Client.connect("black-forest-labs/FLUX.1-schnell");

    const output = await client.predict("/infer", [
      prompt,
      seed,
      !seed,
      width,
      height,
      steps,
    ]);

    console.log("Gradio output:", output);

    if (output.data && output.data.length > 0) {
      const imageUrl = output.data[0].url;
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(
          `Failed to fetch image from Gradio: ${response.statusText}`
        );
      }
      return Buffer.from(await response.arrayBuffer());
    }

    throw new Error("No image in Gradio response");
  },
};
