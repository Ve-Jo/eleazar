import { EmbedBuilder, SlashCommandSubcommandBuilder } from "discord.js";
import Database from "../../database/client.js";

export default {
  data: () => {
    // Create a standard subcommand with Discord.js builders
    const builder = new SlashCommandSubcommandBuilder()
      .setName("removebanner")
      .setDescription("Remove your profile banner image");

    return builder;
  },

  // Define localization strings directly in the command
  localization_strings: {
    command: {
      name: {
        ru: "убратьбаннер",
        uk: "видалитибанер",
      },
      description: {
        ru: "Удалить изображение баннера профиля",
        uk: "Видалити зображення банера профілю",
      },
    },
    title: {
      en: "Banner Removed",
      ru: "Баннер удален",
      uk: "Банер видалено",
    },
    success: {
      en: "Your banner has been removed successfully!",
      ru: "Ваш баннер успешно удален!",
      uk: "Ваш банер успішно видалено!",
    },
    error: {
      en: "An error occurred while removing the banner",
      ru: "Произошла ошибка при удалении баннера",
      uk: "Виникла помилка під час видалення банера",
    },
  },

  async execute(interaction, i18n) {
    await interaction.deferReply();

    try {
      await Database.client.user.update({
        where: {
          guildId_id: {
            guildId: interaction.guild.id,
            id: interaction.user.id,
          },
        },
        data: {
          bannerUrl: null,
        },
      });

      await interaction.editReply({
        content: i18n.__("commands.images.removebanner.success"),
      });
    } catch (error) {
      console.error("Error removing banner:", error);
      await interaction.editReply({
        content: i18n.__("commands.images.removebanner.error"),
        ephemeral: true,
      });
    }
  },
};
