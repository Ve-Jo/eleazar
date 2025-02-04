import {
  SlashCommandSubcommand,
  SlashCommandOption,
  OptionType,
  I18nCommandBuilder,
} from "../../utils/builders/index.js";
import { EmbedBuilder, AttachmentBuilder } from "discord.js";
import Database from "../../database/client.js";
import { generateRemoteImage } from "../../utils/remoteImageGenerator.js";

export default {
  data: () => {
    const i18nBuilder = new I18nCommandBuilder("economy", "balance");

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
  async execute(interaction, i18n) {
    await interaction.deferReply();
    const user = interaction.options.getMember("user") || interaction.member;

    // Get user data with all relations
    const userData = await Database.getUser(
      interaction.guild.id,
      user.id,
      true
    );

    if (!userData) {
      return interaction.editReply({
        content: i18n.__("economy.balance.userNotFound"),
        ephemeral: true,
      });
    }

    if (userData.economy) {
      userData.economy.bankBalance = await Database.calculateBankBalance(
        userData
      );
    }

    let imageResponse = await generateRemoteImage(
      "Balance",
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
        targetUser: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          avatarURL: user.displayAvatarURL({
            extension: "png",
            size: 1024,
          }),
        },
        database: {
          ...userData,
        },
      },
      { width: 400, height: 235 },
      { image: 2, emoji: 1 }
    );

    const attachment = new AttachmentBuilder(imageResponse.buffer, {
      name: `balance.${
        imageResponse.contentType === "image/gif" ? "gif" : "png"
      }`,
    });

    let balance_embed = new EmbedBuilder()
      .setTimestamp()
      .setColor(process.env.EMBED_COLOR)
      .setImage(
        `attachment://balance.${
          imageResponse.contentType === "image/gif" ? "gif" : "png"
        }`
      )
      .setAuthor({
        name: i18n.__("economy.balance.title"),
        iconURL: user.avatarURL(),
      });

    imageResponse = null;

    await interaction.editReply({
      embeds: [balance_embed],
      files: [attachment],
    });
  },
  localization_strings: {
    name: {
      en: "balance",
      ru: "баланс",
      uk: "рахунок",
    },
    title: {
      en: "Balance",
      ru: "Баланс",
      uk: "Баланс",
    },
    description: {
      en: "Check balance",
      ru: "Посмотреть баланс",
      uk: "Переглянути баланс",
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
