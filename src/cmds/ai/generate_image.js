import { SlashCommandSubcommandBuilder, AttachmentBuilder } from "discord.js";
import fetch from "node-fetch";

export default {
  data: new SlashCommandSubcommandBuilder()
    .setName("generate_image")
    .setDescription("Generate image by prompt")
    .setDescriptionLocalizations({
      ru: "Генерация изображения по запросу",
      uk: "Генерація зображення за запитом",
    })
    .addStringOption((option) =>
      option
        .setName("prompt")
        .setDescription("Prompt")
        .setDescriptionLocalizations({
          ru: "Запрос",
          uk: "Запит",
        })
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("aspect_ratio")
        .setDescription("Aspect ratio")
        .setDescriptionLocalizations({
          ru: "Соотношение сторон",
          uk: "Відношення сторін",
        })
        .addChoices(
          { name: "1:1", value: "1:1" },
          { name: "21:9", value: "21:9" },
          { name: "16:9", value: "16:9" },
          { name: "4:5", value: "4:5" },
          { name: "5:4", value: "5:4" },
          { name: "4:3", value: "4:3" },
          { name: "9:16", value: "9:16" },
          { name: "9:21", value: "9:21" }
        )
        .setRequired(true)
    ),
  async execute(interaction) {
    await interaction.deferReply();

    let prompt = interaction.options.getString("prompt");
    let aspectRatio = interaction.options.getString("aspect_ratio");

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
          content: `Generated image for prompt: "${prompt}"`,
          files: [attachment],
        });
      } else {
        await interaction.editReply(
          "Failed to generate the image. Please try again."
        );
      }
    } catch (error) {
      console.error("Error generating image:", error);
      await interaction.editReply(
        "An error occurred while generating the image. Please try again later."
      );
    }
  },
};
