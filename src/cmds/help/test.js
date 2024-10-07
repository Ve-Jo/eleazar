import { SlashCommandSubcommandBuilder, AttachmentBuilder } from "discord.js";
import Balance from "../../components/Balance.jsx";
import { generateImage } from "../../utils/imageGenerator.js";

export default {
  data: new SlashCommandSubcommandBuilder()
    .setName("test")
    .setDescription("This is a cool test!"),
  async execute(interaction) {
    let timeStart = performance.now();
    const pngBuffer = await generateImage(Balance, {
      username: interaction.user.username,
    });
    let timeEnd = performance.now();
    console.log(`Time taken: ${timeEnd - timeStart} milliseconds`);

    const attachment = new AttachmentBuilder(pngBuffer, { name: "image.png" });
    await interaction.reply({
      content: "Here is your image!",
      files: [attachment],
    });
  },
};
