import {
  SlashCommandSubcommand,
  I18nCommandBuilder,
} from "../../utils/builders/index.js";
import EconomyEZ from "../../utils/economy.js";

export default {
  data: () => {
    const i18nBuilder = new I18nCommandBuilder("counting", "remove");

    const subcommand = new SlashCommandSubcommand({
      name: i18nBuilder.getSimpleName(i18nBuilder.translate("name")),
      description: i18nBuilder.translate("description"),
      name_localizations: i18nBuilder.getLocalizations("name"),
      description_localizations: i18nBuilder.getLocalizations("description"),
    });

    return subcommand;
  },
  async execute(interaction) {
    const { guild } = interaction;

    const countingChannel = await EconomyEZ.get(`counting.${guild.id}`);

    if (countingChannel) {
      await EconomyEZ.remove(`counting.${guild.id}`);

      await interaction.reply({
        content: i18n.__("counting.remove.success"),
      });
    } else {
      await interaction.reply({
        content: i18n.__("counting.remove.notSet"),
      });
    }
  },
  localization_strings: {
    name: {
      en: "remove",
      ru: "удалить",
      uk: "видалити",
    },
    description: {
      en: "Remove counting channel",
      ru: "Удалить канал для счета",
      uk: "Видалити канал для счета",
    },
    success: {
      en: "Counting channel removed",
      ru: "Канал для счета удален",
      uk: "Канал для рахунку видалено",
    },
    notSet: {
      en: "Counting channel is not set",
      ru: "Канал для счета не установлен",
      uk: "Канал для рахунку не встановлено",
    },
  },
};
