import { SlashCommandSubcommandBuilder, AttachmentBuilder } from "discord.js";
import satori from "satori";
import fs from "fs";
import sharp from "sharp";

export default {
  data: new SlashCommandSubcommandBuilder()
    .setName("test")
    .setDescription("This is a cool test!"),
  async execute(interaction) {
    const fontBuffer = fs.readFileSync("./Roboto-Medium.ttf");
    const html = fs.readFileSync("./test.html", "utf8");
    const strippedHtml = html.replace(/<(\/?)html>/g, "");
    console.log(strippedHtml);
    const svg = await satori(
      <div style={{ color: "white" }}>hello, world</div>,
      {
        width: 600,
        height: 400,
        fonts: [
          {
            name: "Roboto",
            // Use `fs` (Node.js only) or `fetch` to read the font as Buffer/ArrayBuffer and provide `data` here.
            data: fontBuffer,
            weight: 400,
            style: "normal",
          },
        ],
      }
    );

    const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();

    const attachment = new AttachmentBuilder(pngBuffer, { name: "image.png" });
    await interaction.reply({
      content: "Here is your image!",
      files: [attachment],
    });
  },
};
