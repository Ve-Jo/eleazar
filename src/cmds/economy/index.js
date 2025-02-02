import { I18nCommandBuilder } from "../../utils/builders/index.js";

export default {
  data: () => {
    const i18nBuilder = new I18nCommandBuilder("economy");
    const command = i18nBuilder.createCommand();
    return command;
  },
  server: true,
  localization_strings: {
    name: {
      en: "economy",
      ru: "экономика",
      uk: "економіка",
    },
    description: {
      en: "Commands for economy",
      ru: "Команды для экономики",
      uk: "Команди для економіки",
    },
    upgrades: {
      0: {
        name: {
          en: "Daily bonus",
          ru: "Ежедневный бонус",
          uk: "Щоденна премія",
        },
        description: {
          en: "Increase your daily bonus",
          ru: "Увеличение ежедневного бонуса",
          uk: "Збільшення щоденної премії",
        },
      },
      1: {
        name: {
          en: "Crime cooldown",
          ru: "Время между преступлениями",
          uk: "Час між злочинами",
        },
        description: {
          en: "Decrease your crime cooldown",
          ru: "Уменьшение времени между возможными преступлениями",
          uk: "Зменшення часу між можливими злочинами",
        },
      },
    },
  },
};
