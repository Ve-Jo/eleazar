import { SlashCommandSubcommandBuilder, AttachmentBuilder } from "discord.js";
import fetch from "node-fetch";
import sharp from "sharp";

export default {
  data: new SlashCommandSubcommandBuilder()
    .setName("upscale_image")
    .setDescription("Upscale an image to improve its quality")
    .setDescriptionLocalizations({
      ru: "Увеличить изображение для улучшения его качества",
      uk: "Збільшити зображення для покращення його якості",
    })
    .addAttachmentOption((option) =>
      option
        .setName("image")
        .setDescription("The image to upscale")
        .setDescriptionLocalizations({
          ru: "Изображение для увеличения",
          uk: "Зображення для збільшення",
        })
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName("scale")
        .setDescription("Scale factor (2-4)")
        .setDescriptionLocalizations({
          ru: "Коэффициент масштабирования (2-4)",
          uk: "Коефіцієнт масштабування (2-4)",
        })
        .setMinValue(2)
        .setMaxValue(4)
        .setRequired(true)
    ),
  async execute(interaction) {
    await interaction.deferReply();

    const attachment = interaction.options.getAttachment("image");
    const scale = interaction.options.getInteger("scale");

    if (!attachment.contentType.startsWith("image/")) {
      return interaction.editReply("Please provide a valid image file.");
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
          `Image dimensions must not exceed 1024x1024 pixels.\n\nYour current image is ${metadata.width}x${metadata.height} pixels.`
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
          content: `Image upscaled with scale factor ${scale}x`,
          files: [upscaledAttachment],
        });
      } else {
        await interaction.editReply(
          "Failed to upscale the image. Please try again."
        );
      }
    } catch (error) {
      console.error("Error upscaling image:", error);
      await interaction.editReply(
        "An error occurred while upscaling the image. Please try again later."
      );
    }
  },
};
