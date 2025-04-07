import Database from "../../database/client.js";

export default {
  data: () => {
    const subcommand = new LocalizedSubcommand({
      category: "counting",
      name: "remove",
      localizationStrings: {
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
    });

    return subcommand;
  },
  async execute(interaction, i18n) {
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
};
