import {
  SlashCommandSubcommand,
  I18nCommandBuilder,
} from "../../utils/builders/index.js";
import Database from "../../database/client.js";
import i18n from "../../utils/i18n.js";

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

    // Get current guild settings
    const guildData = await Database.client.guild.findUnique({
      where: { id: guild.id },
      select: { settings: true },
    });

    if (guildData?.settings?.counting) {
      // Remove counting from settings while preserving other settings
      const { counting, ...otherSettings } = guildData.settings;

      await Database.client.guild.update({
        where: { id: guild.id },
        data: {
          settings: otherSettings,
        },
      });

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
