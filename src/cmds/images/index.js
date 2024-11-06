import { I18nCommandBuilder } from "../../utils/builders/index.js";

export default {
  data: () => {
    const i18nBuilder = new I18nCommandBuilder("images");
    const command = i18nBuilder.createCommand();
    return command;
  },
  server: true,
  localization_strings: {
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
};
