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
    const { guild } = interaction;
    const targetUser = interaction.options.getUser("user") || interaction.user;

    // Get user and guild data
    const [userData, guildData] = await Promise.all([
      EconomyEZ.get(`${guild.id}.${targetUser.id}`),
      EconomyEZ.get(guild.id),
    ]);

    // Calculate level info
    const levelInfo = EconomyEZ.calculateLevel(
      userData.total_xp,
      guildData.levels.multiplier
    );
    const nextLevelXP = levelInfo.requiredXP;
    const currentXP = levelInfo.currentXP;
    const level = levelInfo.level;

    // Generate level card image
    const pngBuffer = await generateRemoteImage(
      "Level",
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
            id: guild.id,
            name: guild.name,
            iconURL: guild.iconURL({
              extension: "png",
              size: 1024,
            }),
          },
        },
        database: userData,
        locale: interaction.locale,
        currentXP: currentXP,
        requiredXP: nextLevelXP,
        level: level,
        totalXP: levelInfo.totalXP,
      },
      { width: 400, height: 200 },
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
      )
      .setTimestamp();

    return interaction.editReply({
      embeds: [embed],
      files: [attachment],
    });
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
  },
};
