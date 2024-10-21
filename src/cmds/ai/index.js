import { SlashCommandBuilder } from "discord.js";
import generate_image from "./generate_image.js";
import transcribe_audio from "./transcribe_audio.js";
import upscale_image from "./upscale_image.js";
export default {
  data: new SlashCommandBuilder()
    .setName("ai")
    .setDescription("AI-related commands")
    .addSubcommand(generate_image.data)
    .addSubcommand(transcribe_audio.data)
    .addSubcommand(upscale_image.data),
  generate_image: {
    cooldown: 40,
    execute: generate_image.execute,
  },
  transcribe_audio: {
    cooldown: 15,
    execute: transcribe_audio.execute,
  },
  upscale_image: {
    cooldown: 20,
    execute: upscale_image.execute,
  },
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (this[subcommand]) {
      await this[subcommand].execute(interaction);
    } else {
      await interaction.reply({
        content: "Invalid subcommand",
        ephemeral: true,
      });
    }
  },
};
