import {
  SlashCommandSubcommand,
  I18nCommandBuilder,
} from "../../utils/builders/index.js";
import {
  EmbedBuilder,
  AttachmentBuilder,
  ApplicationCommandOptionType,
} from "discord.js";
import EconomyEZ from "../../utils/economy.js";
import { generateRemoteImage } from "../../utils/remoteImageGenerator.js";
import i18n from "../../utils/i18n.js";

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
  async execute(interaction) {
    await interaction.deferReply();

    try {
      const targetUser =
        interaction.options.getUser("user") || interaction.user;
      const guildId = interaction.guild.id;
      const userId = targetUser.id;

      const userData = await EconomyEZ.get(`${guildId}.${userId}`);

      if (!userData) {
        return interaction.editReply({
          content: i18n.__("economy.level.userNotFound"),
          ephemeral: true,
        });
      }

      const levelInfo = EconomyEZ.calculateLevel(userData.totalXp);

      const pngBuffer = await generateRemoteImage(
        "Level",
        {
          interaction: {
            user: {
              id: interaction.user.id,
              username: interaction.user.username,
              displayName: interaction.user.displayName,
              avatarURL: interaction.user.displayAvatarURL({
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
          targetUser: {
            id: targetUser.id,
            username: targetUser.username,
            displayName: targetUser.displayName,
            avatarURL: targetUser.displayAvatarURL({
              extension: "png",
              size: 1024,
            }),
          },
          level: levelInfo.level,
          currentXP: levelInfo.currentXP,
          requiredXP: levelInfo.requiredXP,
          totalXP: userData.totalXp,
        },
        { width: 450, height: 200 }
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
        )
        .setTimestamp();

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
    title: {
      en: "Level Information",
      ru: "Информация об уровне",
      uk: "Інформація про рівень",
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
