import {
  AttachmentBuilder,
  SlashCommandSubcommandBuilder,
  MessageFlags,
} from "discord.js";
import hubClient from "../../api/hubClient.js";
import { generateImage } from "../../utils/imageGenerator.js";
import i18n from "../../utils/i18n.js";
import { ComponentBuilder } from "../../utils/componentConverter.js";

export default {
  data: () => {
    const builder = new SlashCommandSubcommandBuilder()
      .setName("level")
      .setDescription("View your XP level or someone else's")
      .addUserOption((option) =>
        option
          .setName("user")
          .setDescription("User to check")
          .setRequired(false),
      );

    return builder;
  },

  localization_strings: {
    command: {
      name: {
        ru: "уровень",
        uk: "рівень",
      },
      description: {
        ru: "Просмотреть свой уровень XP или уровень другого пользователя",
        uk: "Переглянути свій рівень XP або рівень іншого користувача",
      },
    },
    options: {
      user: {
        name: {
          ru: "пользователь",
          uk: "користувач",
        },
        description: {
          ru: "Пользователь для проверки",
          uk: "Користувач для перевірки",
        },
      },
    },
    title: {
      en: "Level",
      ru: "Уровень",
      uk: "Рівень",
    },
    level: {
      en: "Level",
      ru: "Уровень",
      uk: "Рівень",
    },
    nextLevel: {
      en: "Next level",
      ru: "Следующий уровень",
      uk: "Наступний рівень",
    },
    xp: {
      en: "XP",
      ru: "XP",
      uk: "XP",
    },
    userNotFound: {
      en: "User not found",
      ru: "Пользователь не найден",
      uk: "Користувача не знайдено",
    },
    imageError: {
      en: "Failed to generate the image. Please try again.",
      ru: "Не удалось сгенерировать изображение. Пожалуйста, попробуйте еще раз.",
      uk: "Не вдалося згенерувати зображення. Будь ласка, спробуйте ще раз.",
    },
    error: {
      en: "An error occurred while processing your request",
      ru: "Произошла ошибка при обработке запроса",
      uk: "Сталася помилка під час обробки запиту",
    },
  },

  async execute(interaction, i18n) {
    // Always use v2 builder mode
    const builderMode = "v2";

    // Always defer reply
    await interaction.deferReply();

    try {
      const user = interaction.options.getMember("user") || interaction.member;

      // Ensure user exists in database before fetching data
      await hubClient.ensureGuildUser(interaction.guild.id, user.id);

      // Get user data with relationships
      const userData = await hubClient.getUser(
        interaction.guild.id,
        user.id,
        true,
      );

      if (!userData) {
        return interaction.editReply({
          content: await i18n.__("commands.economy.level.userNotFound"),
          ephemeral: true,
        });
      }

      // Fetch seasons data
      const seasons = await hubClient.getCurrentSeason();

      // Fetch and calculate all level data
      const chatXp = Number(userData.Level?.xp || 0);
      const chatLevelInfo = hubClient.calculateLevel(chatXp);

      const gameXp = Number(userData.Level?.gameXp || 0);
      const gameLevelInfo = hubClient.calculateLevel(gameXp);

      const seasonXp = Number(userData.Level?.seasonXp || 0);
      const seasonEnds =
        seasons?.seasonEnds || Date.now() + 7 * 24 * 60 * 60 * 1000;
      const seasonNumber = seasons?.seasonNumber || 1;

      // --- Fetch Level Role Info --- //
      let nextLevelRoleInfo = null;
      try {
        const nextRoleData = await hubClient.getNextLevelRole(
          interaction.guild.id,
          chatLevelInfo.level,
        );
        if (nextRoleData) {
          const role = await interaction.guild.roles
            .fetch(nextRoleData.roleId)
            .catch(() => null);
          if (role) {
            nextLevelRoleInfo = {
              name: role.name,
              color: role.hexColor,
              requiredLevel: nextRoleData.requiredLevel,
            };
          }
        }
      } catch (err) {
        console.error(
          `Error fetching next level role for guild ${interaction.guild.id}:`,
          err,
        );
        // Continue without role info if fetch fails
      }
      // --- End Level Role Info --- //

      // Generate level card image
      const [buffer, dominantColor] = await generateImage(
        "Level2",
        {
          interaction: {
            user: {
              id: user.id,
              username: user.username,
              displayName: user.displayName,
              avatarURL: user.displayAvatarURL({
                extension: "png",
                size: 1024,
              }),
            },
            guild: {
              id: interaction.guild.id,
              name: interaction.guild.name,
              iconURL: interaction.guild.iconURL({
                extension: "png",
                size: 1024,
              }),
            },
          },
          locale: interaction.locale,
          returnDominant: true,
          currentXP: chatLevelInfo.currentXP,
          requiredXP: chatLevelInfo.requiredXP,
          level: chatLevelInfo.level,
          gameCurrentXP: gameLevelInfo.currentXP,
          gameRequiredXP: gameLevelInfo.requiredXP,
          gameLevel: gameLevelInfo.level,
          seasonXP: seasonXp,
          seasonEnds: Number(seasonEnds),
          seasonNumber: Number(seasonNumber),
          nextLevelRole: nextLevelRoleInfo,
        },
        { image: 2, emoji: 1 },
        i18n,
      );

      if (!buffer) {
        console.error("Buffer is undefined or null");
        const errorOptions = {
          content: await i18n.__("commands.economy.level.imageError"),
          ephemeral: true,
        };
        return interaction.editReply(errorOptions);
      }

      const attachment = new AttachmentBuilder(buffer, {
        name: `level.avif`,
      });

      // Use the new ComponentBuilder with automatic color handling
      const levelComponent = new ComponentBuilder({
        dominantColor: dominantColor,
        mode: builderMode,
      })
        .addText(await i18n.__("commands.economy.level.title"), "header3")
        .addImage("attachment://level.avif")
        .addTimestamp(interaction.locale);

      // Prepare the reply options using the builder
      const replyOptions = levelComponent.toReplyOptions({
        files: [attachment],
      });

      // Always edit the original deferred reply
      await interaction.editReply(replyOptions);
    } catch (error) {
      console.error("Error in level command:", error);
      const errorOptions = {
        content: await i18n.__("commands.economy.level.error"),
        ephemeral: true,
        components: [], // Ensure components are cleared on error
        embeds: [], // Ensure embeds are cleared on error
        files: [], // Ensure files are cleared on error
      };
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply(errorOptions).catch(() => {});
      } else {
        await interaction.reply(errorOptions).catch(() => {});
      }
    }
  },
};

// Helper functions for emojis
function getActivityEmoji(type) {
  switch (type) {
    case "chat":
      return "💭";
    case "voice":
      return "🎤";
    default:
      return "⭐";
  }
}

function getGameEmoji(game) {
  switch (game) {
    case "snake":
      return "🐍";
    case "2048":
      return "🎲";
    default:
      return "🎮";
  }
}
