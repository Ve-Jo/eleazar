import { SlashCommandBuilder } from "discord.js";
import generate_image from "./generate_image.js";

export default {
  data: new SlashCommandBuilder()
    .setName("ai")
    .setDescription("AI-related commands")
    .addSubcommand(generate_image.data),
  generate_image: {
    cooldown: 35,
    execute: generate_image.execute,
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
