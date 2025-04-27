import {
  EmbedBuilder,
  AttachmentBuilder,
  SlashCommandSubcommandBuilder,
} from "discord.js";
import Database from "../../database/client.js";
import { generateImage } from "../../utils/imageGenerator.js";
import i18n from "../../utils/newI18n.js";

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
    await interaction.deferReply();

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
        return interaction.editReply({
          content: i18n.__("commands.economy.level.imageError"),
          ephemeral: true,
        });
      }

      const attachment = new AttachmentBuilder(buffer, {
        name: `level.png`,
      });

      let embed = new EmbedBuilder()
        .setTimestamp()
        .setColor(dominantColor?.embedColor ?? 0x0099ff)
        .setImage(`attachment://level.png`)
        .setAuthor({
          name: i18n.__("commands.economy.level.title"),
          iconURL: user.avatarURL(),
        });

      await interaction.editReply({
        embeds: [embed],
        files: [attachment],
      });
    } catch (error) {
      console.error("Error in level command:", error);
      await interaction.editReply({
        content: i18n.__("commands.economy.level.error"),
        ephemeral: true,
      });
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
