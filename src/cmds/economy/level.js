import {
  EmbedBuilder,
  AttachmentBuilder,
  SlashCommandSubcommandBuilder,
} from "discord.js";
import Database from "../../database/client.js";
import { generateImage } from "../../utils/imageGenerator.js";

export default {
  data: () => {
    const builder = new SlashCommandSubcommandBuilder()
      .setName("level")
      .setDescription("Check your or another user's level")
      .addUserOption((option) =>
        option
          .setName("user")
          .setDescription("User to check level for")
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
        ru: "Проверить свой уровень или уровень другого пользователя",
        uk: "Перевірити свій рівень або рівень іншого користувача",
      },
    },
    options: {
      user: {
        name: {
          ru: "пользователь",
          uk: "користувач",
        },
        description: {
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
    voiceTime: {
      en: "Currently in voice: {{hours}}h {{minutes}}m | Earned: {{xp}} XP ({{rate}} XP/min)",
      ru: "Сейчас в голосовом: {{hours}}ч {{minutes}}м | Заработано: {{xp}} XP ({{rate}} XP/мин)",
      uk: "Зараз в голосовому: {{hours}}г {{minutes}}х | Зароблено: {{xp}} XP ({{rate}} XP/хв)",
    },
    title: {
      en: "Level",
      ru: "Уровень",
      uk: "Рівень",
    },
  },

  async execute(interaction, i18n) {
    await interaction.deferReply();

    try {
      const targetUser =
        interaction.options.getUser("user") || interaction.user;
      const guildId = interaction.guild.id;
      const userId = targetUser.id;

      // Get all necessary data in parallel
      let [levelData, currentSeason, voiceSession, guildSettings] =
        await Promise.all([
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
          Database.getCurrentSeason(),
          Database.getVoiceSession(guildId, userId),
          Database.client.guild.findUnique({
            where: { id: guildId },
            select: { settings: true },
          }),
        ]);

      // If no level data exists, create default data
      if (!levelData) {
        await Database.client.level.create({
          data: {
            userId,
            guildId,
            xp: 0n,
            gameXp: 0n,
            seasonXp: 0n,
          },
        });
        // Re-fetch the newly created data
        levelData = await Database.client.level.findUnique({
          where: {
            userId_guildId: { userId, guildId },
          },
          select: {
            xp: true,
            gameXp: true,
            seasonXp: true,
          },
        });
      }

      // Calculate current voice XP if user is in voice
      let currentVoiceXP = 0;
      let voiceTimeString = "";
      if (voiceSession) {
        const timeSpent = Date.now() - Number(voiceSession.joinedAt);
        const minutes = timeSpent / 60000;
        const xpPerMinute = guildSettings?.settings?.xp_per_voice_minute || 1;
        currentVoiceXP = Math.floor(minutes * xpPerMinute);

        const hours = Math.floor(minutes / 60);
        const remainingMinutes = Math.floor(minutes % 60);
        voiceTimeString = i18n.__("voiceTime", {
          hours,
          minutes: remainingMinutes,
          xp: currentVoiceXP,
          rate: xpPerMinute,
        });
      }

      // Calculate all level types including season and potential voice XP
      const calculatedLevels = {
        activity: Database.calculateLevel(
          levelData.xp + BigInt(currentVoiceXP)
        ),
        gaming: Database.calculateLevel(levelData.gameXp),
        season: Database.calculateLevel(
          levelData.seasonXp + BigInt(currentVoiceXP)
        ),
      };

      const buffer = await generateImage(
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
          // Activity level data with current voice XP
          level: calculatedLevels.activity.level,
          currentXP: calculatedLevels.activity.currentXP,
          requiredXP: calculatedLevels.activity.requiredXP,
          // Gaming level data
          gameLevel: calculatedLevels.gaming.level,
          gameCurrentXP: calculatedLevels.gaming.currentXP,
          gameRequiredXP: calculatedLevels.gaming.requiredXP,
          // Season level data with current voice XP
          seasonXP: Number(levelData.seasonXp) + currentVoiceXP,
          seasonEnds: currentSeason.seasonEnds,
          seasonNumber: currentSeason.seasonNumber,
        },
        { image: 2, emoji: 1 }
      );

      const attachment = new AttachmentBuilder(buffer, {
        name: `level.${
          buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46
            ? "gif"
            : "png"
        }`,
      });

      const embed = new EmbedBuilder()
        .setColor(process.env.EMBED_COLOR)
        .setAuthor({
          name: i18n.__("title"),
          iconURL: targetUser.displayAvatarURL(),
        })
        .setImage(
          `attachment://level.${
            buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46
              ? "gif"
              : "png"
          }`
        );

      // Add voice XP info if user is in voice
      if (voiceSession) {
        embed.setFooter({ text: voiceTimeString });
      }

      embed.setTimestamp();

      await interaction.editReply({
        embeds: [embed],
        files: [attachment],
      });
    } catch (error) {
      console.error("Error in level command:", error);
      await interaction.editReply({
        content: i18n.__("error"),
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
