import {
  SlashCommandSubcommand,
  SlashCommandOption,
  OptionType,
  I18nCommandBuilder,
} from "../../utils/builders/index.js";
import { EmbedBuilder } from "discord.js";
import EconomyEZ from "../../utils/economy.js";

export default {
  data: () => {
    const i18nBuilder = new I18nCommandBuilder("economy", "transfer");

    const subcommand = new SlashCommandSubcommand({
      name: i18nBuilder.getSimpleName(i18nBuilder.translate("name")),
      description: i18nBuilder.translate("description"),
      name_localizations: i18nBuilder.getLocalizations("name"),
      description_localizations: i18nBuilder.getLocalizations("description"),
    });

    // Add amount option
    const amountOption = new SlashCommandOption({
      type: OptionType.STRING,
      name: "amount",
      description: i18nBuilder.translateOption("amount", "description"),
      required: true,
      name_localizations: i18nBuilder.getOptionLocalizations("amount", "name"),
      description_localizations: i18nBuilder.getOptionLocalizations(
        "amount",
        "description"
      ),
    });

    // Add user option
    const userOption = new SlashCommandOption({
      type: OptionType.USER,
      name: "user",
      description: i18nBuilder.translateOption("user", "description"),
      required: true,
      name_localizations: i18nBuilder.getOptionLocalizations("user", "name"),
      description_localizations: i18nBuilder.getOptionLocalizations(
        "user",
        "description"
      ),
    });

    subcommand.addOption(amountOption);
    subcommand.addOption(userOption);

    return subcommand;
  },
  async execute(interaction) {
    const targetUser = interaction.options.getMember("user");
    const amount = interaction.options.getString("amount");

    //if its bot
    if (targetUser.user.bot) {
      return interaction.editReply({
        content: i18n.__("economy.cannotSelectBot"),
        ephemeral: true,
      });
    }

    const initialUser = await EconomyEZ.get(
      `economy.${interaction.guild.id}.${interaction.user.id}`
    );

    let amountInt = 0;
    if (amount === "all") {
      amountInt = initialUser.balance;
    } else if (amount === "half") {
      amountInt = Math.floor(initialUser.balance / 2);
    } else {
      amountInt = parseInt(amount);
    }
    if (amountInt <= 0) {
      return interaction.editReply({
        content: i18n.__("economy.amountGreaterThanZero"),
        ephemeral: true,
      });
    }

    const targetUserData = await EconomyEZ.get(
      `economy.${interaction.guild.id}.${targetUser.id}`
    );

    if (!targetUserData) {
      return interaction.editReply({
        content: i18n.__("economy.userNotFound"),
        ephemeral: true,
      });
    }
    if (targetUser.id === interaction.user.id) {
      return interaction.editReply({
        content: i18n.__("economy.cannotSelectSelf"),
        ephemeral: true,
      });
    }

    if (initialUser.balance < amountInt) {
      return interaction.editReply({
        content: i18n.__("economy.insufficientFunds"),
        ephemeral: true,
      });
    }

    await EconomyEZ.math(
      `economy.${interaction.guild.id}.${interaction.user.id}.balance`,
      "-",
      amountInt
    );
    await EconomyEZ.math(
      `economy.${interaction.guild.id}.${targetUser.id}.balance`,
      "+",
      amountInt
    );

    const updatedUser = await EconomyEZ.get(
      `economy.${interaction.guild.id}.${interaction.user.id}`
    );
    const updatedTargetUser = await EconomyEZ.get(
      `economy.${interaction.guild.id}.${targetUser.id}`
    );

    let withdraw_embed = new EmbedBuilder()
      .setColor(process.env.EMBED_COLOR)
      .setTimestamp()
      .setThumbnail(interaction.user.avatarURL())
      .setAuthor({
        name: i18n.__("economy.title"),
        iconURL: interaction.user.avatarURL(),
      })
      .setFields({
        name: i18n.__("economy.transfer"),
        value: i18n.__("economy.transferValue", {
          senderBalance: updatedUser.balance,
          targetBalance: updatedTargetUser.balance,
          amount: amountInt,
        }),
      });
    await interaction.editReply({ embeds: [withdraw_embed] });
  },
  localization_strings: {
    name: {
      en: "transfer",
      ru: "перевести",
      uk: "переказати",
    },
    description: {
      en: "Transfer money to another user",
      ru: "Перевести деньги другому пользователю",
      uk: "Переказати гроші іншому користувачу",
    },
    options: {
      amount: {
        name: {
          en: "amount",
          ru: "сумма",
          uk: "сума",
        },
        description: {
          en: "Amount to transfer (or 'all', 'half')",
          ru: "Сумма для перевода (или 'all', 'half')",
          uk: "Сума для переказу (або 'all', 'half')",
        },
      },
      user: {
        name: {
          en: "user",
          ru: "пользователь",
          uk: "користувач",
        },
        description: {
          en: "User to transfer to",
          ru: "Пользователь для перевода",
          uk: "Користувач для переказу",
        },
      },
    },
  },
};
