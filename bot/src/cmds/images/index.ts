import { SlashCommandBuilder } from "discord.js";

const command = {
  data: (): SlashCommandBuilder => {
    return new SlashCommandBuilder()
      .setName("images")
      .setDescription("Manage profile images and banners");
  },

  localization_strings: {
    name: {
      ru: "изображения",
      uk: "зображення",
    },
    description: {
      ru: "Управление изображениями и баннерами профиля",
      uk: "Керування зображеннями та банерами профілю",
    },
  },
};

export default command;
