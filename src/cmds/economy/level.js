import {
  SlashCommandSubcommand,
  SlashCommandOption,
  OptionType,
  I18nCommandBuilder,
} from "../../utils/builders/index.js";
import { EmbedBuilder, AttachmentBuilder } from "discord.js";
import EconomyEZ from "../../utils/economy.js";
import { generateRemoteImage } from "../../utils/remoteImageGenerator.js";
import i18n from "../../utils/i18n.js";
import LevelsManager from "../../utils/levelsManager.js";

export default {
  data: () => {
    const i18nBuilder = new I18nCommandBuilder("economy", "level");

    const subcommand = new SlashCommandSubcommand({
      name: i18nBuilder.getSimpleName(i18nBuilder.translate("name")),
      description: i18nBuilder.translate("description"),
      name_localizations: i18nBuilder.getLocalizations("name"),
      description_localizations: i18nBuilder.getLocalizations("description"),
    });

    // Add user option
    const userOption = new SlashCommandOption({
      type: OptionType.USER,
      name: "user",
      description: i18nBuilder.translateOption("user", "description"),
      required: false,
      name_localizations: i18nBuilder.getOptionLocalizations("user", "name"),
      description_localizations: i18nBuilder.getOptionLocalizations(
        "user",
        "description"
      ),
    });

    subcommand.addOption(userOption);

    return subcommand;
  },
  async execute(interaction) {
    await interaction.deferReply();
    const user = interaction.options.getMember("user") || interaction.user;
    const userData = await EconomyEZ.get(
      `economy.${interaction.guild.id}.${user.id}`
    );

    if (!userData) {
      return interaction.editReply({
        content: i18n.__("economy.level.userNotFound"),
        ephemeral: true,
      });
    }

    const levelData = LevelsManager.calculateLevel(
      userData.total_xp || 0,
      LevelsManager.getLevelMultiplier()
    );

    let pngBuffer = await generateRemoteImage(
      "Level",
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
            locale: user.locale,
          },
        },
        locale: interaction.locale,
        currentXP: levelData.currentXP,
        requiredXP: levelData.requiredXP,
        level: levelData.level,
      },
      { width: 400, height: 200 },
      { image: 2, emoji: 1 }
    );

    const attachment = new AttachmentBuilder(pngBuffer, {
      name: "level.png",
    });

    // Clear the buffer
    pngBuffer = null;

    let level_embed = new EmbedBuilder()
      .setTimestamp()
      .setColor(process.env.EMBED_COLOR)
      .setImage("attachment://level.png")
      .setAuthor({
        name: user.displayName,
        iconURL: user.displayAvatarURL({
          extension: "png",
          size: 1024,
        }),
      });

    await interaction.editReply({
      embeds: [level_embed],
      files: [attachment],
    });
  },
  localization_strings: {
    name: {
      en: "level",
      ru: "уровень",
      uk: "рівень",
    },
    title: {
      en: "Level",
      ru: "Уровень",
      uk: "Рівень",
    },
    description: {
      en: "Check level",
      ru: "Посмотреть уровень",
      uk: "Переглянути рівень",
    },
    userNotFound: {
      en: "User not found",
      ru: "Пользователь не найден",
      uk: "Користувач не знайдений",
    },
    options: {
      user: {
        name: {
          en: "user",
          ru: "пользователь",
          uk: "користувач",
        },
        description: {
          en: "User to check",
          ru: "Пользователь для проверки",
          uk: "Користувач для перевірки",
        },
      },
    },
  },
};
