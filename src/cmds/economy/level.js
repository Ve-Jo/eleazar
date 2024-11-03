import {
  SlashCommandSubcommand,
  I18nCommandBuilder,
} from "../../utils/builders/index.js";
import i18n from "../../utils/i18n.js";
export default {
  data: () => {
    const i18nBuilder = new I18nCommandBuilder("economy", "level");

    const subcommand = new SlashCommandSubcommand({
      name: i18nBuilder.getSimpleName(i18nBuilder.translate("name")),
      description: i18nBuilder.translate("description"),
      name_localizations: i18nBuilder.getLocalizations("name"),
      description_localizations: i18nBuilder.getLocalizations("description"),
    });

    return subcommand;
  },
  async execute(interaction) {
    await interaction.deferReply();
    await interaction.reply("Level command executed");
  },
  localization_strings: {
    name: {
      en: "level",
      ru: "уровень",
      uk: "рівень",
    },
    description: {
      en: "Check level",
      ru: "Проверить уровень",
      uk: "Перевірити рівень",
    },
  },
};
