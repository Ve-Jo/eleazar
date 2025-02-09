import {
  SlashCommandSubcommand,
  I18nCommandBuilder,
} from "../../utils/builders/index.js";
import {
  EmbedBuilder,
  AttachmentBuilder,
  ApplicationCommandOptionType,
} from "discord.js";
import Database from "../../database/client.js";
import { generateRemoteImage } from "../../utils/remoteImageGenerator.js";

export default {
  data: () => {
    const i18nBuilder = new I18nCommandBuilder("economy", "level");

    const subcommand = new SlashCommandSubcommand({
      name: i18nBuilder.getSimpleName(i18nBuilder.translate("name")),
      description: i18nBuilder.translate("description"),
      name_localizations: i18nBuilder.getLocalizations("name"),
      description_localizations: i18nBuilder.getLocalizations("description"),
      options: [
        {
          type: ApplicationCommandOptionType.User,
          name: i18nBuilder.getSimpleName(
            i18nBuilder.translate("options.user.name")
          ),
          description: i18nBuilder.translate("options.user.description"),
          name_localizations: i18nBuilder.getLocalizations("options.user.name"),
          description_localizations: i18nBuilder.getLocalizations(
            "options.user.description"
          ),
          required: false,
        },
      ],
    });

    return subcommand;
  },
  async execute(interaction, i18n) {
    await interaction.deferReply();

    try {
      const targetUser =
        interaction.options.getUser("user") || interaction.user;
      const guildId = interaction.guild.id;
      const userId = targetUser.id;

      // Get raw level data directly from the database to ensure we have accurate seasonXp
      const [levelData, globalSettings] = await Promise.all([
        Database.client.level.findUnique({
          where: {
            userId_guildId: { userId, guildId },
          },
          select: {
            xp: true,
            gameXp: true,
            seasonXp: true,
          },
        }),
        Database.client.globalSettings.findUnique({
          where: { id: "singleton" },
        }),
      ]);

      if (!levelData) {
        return interaction.editReply({
          content: i18n.__("economy.level.userNotFound"),
          ephemeral: true,
        });
      }

      // Calculate all level types including season
      const calculatedLevels = {
        activity: Database.calculateLevel(levelData.xp),
        gaming: Database.calculateLevel(levelData.gameXp),
        season: Database.calculateLevel(levelData.seasonXp),
      };

      // Get season timing data
      const seasonStart = new Date(
        Number(globalSettings?.seasonStart || Date.now())
      );
      const seasonEnd = new Date(
        seasonStart.getFullYear(),
        seasonStart.getMonth() + 1,
        0,
        23,
        59,
        59,
        999
      ).getTime();

      const pngBuffer = await generateRemoteImage(
        "Level2",
        {
          interaction: {
            user: {
              id: targetUser.id,
              username: targetUser.username,
              displayName: targetUser.displayName,
              avatarURL: targetUser.displayAvatarURL({
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
          i18n,
          // Activity level data
          level: calculatedLevels.activity.level,
          currentXP: calculatedLevels.activity.currentXP,
          requiredXP: calculatedLevels.activity.requiredXP,
          // Gaming level data
          gameLevel: calculatedLevels.gaming.level,
          gameCurrentXP: calculatedLevels.gaming.currentXP,
          gameRequiredXP: calculatedLevels.gaming.requiredXP,
          // Season level data
          seasonXP: Number(levelData.seasonXp), // Convert BigInt to Number
          seasonEnds: seasonEnd,
          seasonStart: Number(globalSettings?.seasonStart || Date.now()),
        },
        { width: 400, height: 254 },
        { image: 2, emoji: 1 }
      );

      const attachment = new AttachmentBuilder(pngBuffer.buffer, {
        name: `level.${pngBuffer.contentType === "image/gif" ? "gif" : "png"}`,
      });

      const embed = new EmbedBuilder()
        .setColor(process.env.EMBED_COLOR)
        .setAuthor({
          name: i18n.__("economy.level.title"),
          iconURL: targetUser.displayAvatarURL(),
        })
        .setImage(
          `attachment://level.${
            pngBuffer.contentType === "image/gif" ? "gif" : "png"
          }`
        );

      // Remove the detailed XP breakdown fields as they're now shown in the Level2 component
      embed.setTimestamp();

      await interaction.editReply({
        embeds: [embed],
        files: [attachment],
      });
    } catch (error) {
      console.error("Error in level command:", error);
      await interaction.editReply({
        content: i18n.__("economy.level.error"),
        ephemeral: true,
      });
    }
  },
  localization_strings: {
    name: {
      en: "level",
      ru: "уровень",
      uk: "рівень",
    },
    description: {
      en: "Check your or another user's level",
      ru: "Проверить свой уровень или уровень другого пользователя",
      uk: "Перевірити свій рівень або рівень іншого користувача",
    },
    options: {
      user: {
        name: {
          en: "user",
          ru: "пользователь",
          uk: "користувач",
        },
        description: {
          en: "User to check level for",
          ru: "Пользователь, чей уровень нужно проверить",
          uk: "Користувач, чий рівень потрібно перевірити",
        },
      },
    },
    userNotFound: {
      en: "User not found",
      ru: "Пользователь не найден",
      uk: "Користувач не знайдений",
    },
    error: {
      en: "An error occurred while processing your level request",
      ru: "Произошла ошибка при обработке запроса уровня",
      uk: "Сталася помилка під час обробки запиту рівня",
    },
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
