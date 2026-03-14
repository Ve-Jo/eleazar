import { SlashCommandBuilder } from "discord.js";

const command = {
  data: (): SlashCommandBuilder => {
    return new SlashCommandBuilder()
      .setName("filters")
      .setDescription("Apply a filter to the image");
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
};

export default command;
