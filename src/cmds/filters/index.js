import { SlashCommandBuilder } from "discord.js";
import memer from "./image_memer.js";
import text_memer from "./text_memer.js";

export default {
  data: new SlashCommandBuilder()
    .setName("filters")
    .setDescription("Apply a filter to the image")
    .setDescriptionLocalizations({
      ru: "Примените фильтр к изображению",
      uk: "Застосуйте фільтр до зображення",
    })
    .addSubcommand(memer.data)
    .addSubcommand(text_memer.data),
  server: true,
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === "memer") {
      await memer.execute(interaction);
    } else if (subcommand === "text_memer") {
      await text_memer.execute(interaction);
    }
  },
};
