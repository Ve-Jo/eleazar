import { SlashCommandBuilder } from "discord.js";

export default {
  data: () => {
    const command = new SlashCommandBuilder()
      .setName("filters")
      .setDescription("Apply a filter to the image");

    return command;
  },

  localization_strings: {
    name: {
      ru: "фильтры",
      uk: "фільтри",
    },
    description: {
      ru: "Примените фильтр к изображению",
      uk: "Застосуйте фільтр до зображення",
    },
  },

  server: true,
};
