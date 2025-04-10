import { SlashCommandBuilder } from "discord.js";

export default {
  data: () => {
    // Create a command with automatic localization
    /*const command = new LocalizedCommand({
      category: "images",
      name: "images",
      description: "Manage profile images and banners",
      localizationStrings: {
        name: {
          en: "images",
          ru: "изображения",
          uk: "зображення",
        },
        description: {
          en: "Manage profile images and banners",
          ru: "Управление изображениями и баннерами профиля",
          uk: "Керування зображеннями та банерами профілю",
        },
      },
    });

    return command;*/

    const command = new SlashCommandBuilder()
      .setName("images")
      .setDescription("Manage profile images and banners");

    return command;
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
