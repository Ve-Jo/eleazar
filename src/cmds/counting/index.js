import { I18nCommandBuilder } from "../../utils/builders/index.js";

export default {
  data: () => {
    const i18nBuilder = new I18nCommandBuilder("counting");
    const command = i18nBuilder.createCommand();
    return command;
  },
  server: true,
  ai: false,
  localization_strings: {
    name: {
      en: "counting",
      ru: "считалочка",
      uk: "підрахунок",
    },
    description: {
      en: "Set and manage counting channel",
      ru: "Установка и управление каналом для счета",
      uk: "Налаштування і керування каналом для підрахунку",
    },
  },
};
