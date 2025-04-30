import {
  AttachmentBuilder,
  SlashCommandSubcommandBuilder,
  MessageFlags,
} from "discord.js";
import Database from "../../database/client.js";
import { generateImage } from "../../utils/imageGenerator.js";
import i18n from "../../utils/newI18n.js";
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
          .setRequired(false)
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

  async execute(interaction) {
    // Determine builder mode based on execution context
    const isAiContext = !!interaction._isAiProxy;
    const builderMode = isAiContext ? "v1" : "v2";

    // Defer only for normal context
    if (!isAiContext) {
      await interaction.deferReply();
    }

    try {
      const user = interaction.options.getMember("user") || interaction.member;

      // Get user data with relationships
      const userData = await Database.getUser(
        interaction.guild.id,
        user.id,
        true
      );

      if (!userData) {
        return interaction.editReply({
          content: i18n.__("commands.economy.level.userNotFound"),
          ephemeral: true,
        });
      }

      // Fetch seasons data
      const seasons = await Database.client.seasons.findFirst({
        where: { id: "current" },
      });

      // Fetch and calculate all level data
      const chatXp = Number(userData.Level?.xp || 0);
      const chatLevelInfo = Database.calculateLevel(chatXp);

      const gameXp = Number(userData.Level?.gameXp || 0);
      const gameLevelInfo = Database.calculateLevel(gameXp);

      const seasonXp = Number(userData.Level?.seasonXp || 0);
      const seasonEnds =
        seasons?.seasonEnds || Date.now() + 7 * 24 * 60 * 60 * 1000;
      const seasonNumber = seasons?.seasonNumber || 1;

      // --- Fetch Level Role Info --- //
      let nextLevelRoleInfo = null;
      try {
        const nextRoleData = await Database.getNextLevelRole(
          interaction.guild.id,
          chatLevelInfo.level
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
          err
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
        i18n
      );

      if (!buffer) {
        console.error("Buffer is undefined or null");
        const errorOptions = {
          content: i18n.__("commands.economy.level.imageError"),
          ephemeral: true,
        };
        if (isAiContext) {
          throw new Error(i18n.__("commands.economy.level.imageError"));
        } else {
          return interaction.editReply(errorOptions);
        }
      }

      const attachment = new AttachmentBuilder(buffer, {
        name: `level.avif`,
      });

      // Use the new ComponentBuilder with automatic color handling
      const levelComponent = new ComponentBuilder({
        dominantColor: dominantColor,
        mode: builderMode,
      })
        .addText(i18n.__("commands.economy.level.title"), "header3")
        .addImage("attachment://level.avif")
        .addTimestamp(interaction.locale);

      // Prepare the reply options using the builder
      const replyOptions = levelComponent.toReplyOptions({
        files: [attachment],
        // Add content only for V1 mode (AI context)
        content: isAiContext
          ? i18n.__("commands.economy.level.title")
          : undefined,
      });

      // Adjust reply logic based on context
      if (isAiContext) {
        // AI Context: Use proxy's reply
        await interaction.reply(replyOptions); // interaction is proxy
      } else {
        // Normal Context: Edit the original deferred reply
        await interaction.editReply(replyOptions);
      }
    } catch (error) {
      console.error("Error in level command:", error);
      const errorOptions = {
        content: i18n.__("commands.economy.level.error"),
        ephemeral: true,
        components: [], // Ensure components are cleared on error
        embeds: [], // Ensure embeds are cleared on error
        files: [], // Ensure files are cleared on error
      };
      if (isAiContext) {
        throw new Error(i18n.__("commands.economy.level.error"));
      } else {
        if (interaction.replied || interaction.deferred) {
          await interaction.editReply(errorOptions).catch(() => {});
        } else {
          await interaction.reply(errorOptions).catch(() => {});
        }
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
