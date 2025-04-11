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
  },

  async execute(interaction) {
    await interaction.deferReply();

    try {
      const user = interaction.options.getMember("user") || interaction.member;

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

      // Generate level card image using the imageGenerator
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
          database: {
            ...userData,
          },
        },
        { image: 2, emoji: 1 }
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
