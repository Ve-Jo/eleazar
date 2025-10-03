import { SlashCommandSubcommandBuilder, MessageFlags } from "discord.js";
import hubClient from "../../api/hubClient.js";
import { ComponentBuilder } from "../../utils/componentConverter.js";

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
    // Determine builder mode based on execution context
    const isAiContext = !!interaction._isAiProxy;
    const builderMode = isAiContext ? "v1" : "v2";

    // Defer only for normal context, and make it ephemeral
    if (!isAiContext) {
      await interaction.deferReply({ ephemeral: true });
    }

    try {
      // Ensure user exists in database before updating
      await hubClient.ensureGuildUser(
        interaction.guild.id,
        interaction.user.id
      );

      // Remove the banner URL using hubClient
      await hubClient.updateUser(interaction.guild.id, interaction.user.id, {
        bannerUrl: null,
      });

      // Create success component (optional, but good practice)
      const successComponent = new ComponentBuilder({
        mode: builderMode,
        color: 0x00ff00, // Green color for success
      }).addText(await i18n.__("commands.images.removebanner.success"));

      // Reply/edit based on context
      const replyOptions = successComponent.toReplyOptions({
        ephemeral: true, // Keep ephemeral for both contexts
        content: isAiContext
          ? await i18n.__("commands.images.removebanner.success")
          : undefined,
      });

      if (isAiContext) {
        await interaction.reply(replyOptions);
      } else {
        await interaction.editReply(replyOptions);
      }
    } catch (error) {
      console.error("Error removing banner:", error);

      // Create error component
      const errorComponent = new ComponentBuilder({
        mode: builderMode,
        color: 0xff0000, // Red color for error
      }).addText(await i18n.__("commands.images.removebanner.error"));

      const errorOptions = errorComponent.toReplyOptions({
        ephemeral: true,
        content: isAiContext
          ? await i18n.__("commands.images.removebanner.error")
          : undefined,
      });

      if (isAiContext) {
        // For AI, throw the error message instead of replying
        throw new Error(await i18n.__("commands.images.removebanner.error"));
      } else {
        // For normal interactions, edit the deferred reply
        if (interaction.replied || interaction.deferred) {
          await interaction.editReply(errorOptions).catch(() => {});
        } else {
          await interaction.reply(errorOptions).catch(() => {}); // Fallback reply
        }
      }
    }
  },
};
