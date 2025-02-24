import {
  SlashCommandSubcommand,
  SlashCommandOption,
  OptionType,
  I18nCommandBuilder,
} from "../../utils/builders/index.js";
import { EmbedBuilder, AttachmentBuilder } from "discord.js";
import Database from "../../database/client.js";
import { generateImage } from "../../utils/imageGenerator.js";

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

    const [buffer, dominantColor] = await generateImage(
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
        returnDominant: true,
        database: {
          ...userData,
        },
      },
      { image: 2, emoji: 1 }
    );

    console.log(buffer);

    if (!buffer) {
      console.error("Buffer is undefined or null");
      return interaction.editReply({
        content: i18n.__("economy.balance.imageError"),
        ephemeral: true,
      });
    }

    console.log(`Buffer type: ${typeof buffer}, size: ${buffer.length}`);

    const attachment = new AttachmentBuilder(buffer, {
      name: `balance.png`,
    });

    let balance_embed = new EmbedBuilder()
      .setTimestamp()
      .setColor(dominantColor?.embedColor ?? 0x0099ff) // Default color if dominantColor is undefined
      .setImage(`attachment://balance.png`)
      .setAuthor({
        name: i18n.__("economy.balance.title"),
        iconURL: user.avatarURL(),
      });

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
