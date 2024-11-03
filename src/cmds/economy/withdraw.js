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

export default {
  data: () => {
    const i18nBuilder = new I18nCommandBuilder("economy", "withdraw");

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

    subcommand.addOption(amountOption);

    return subcommand;
  },
  async execute(interaction) {
    await interaction.deferReply();
    const amount = interaction.options.getString("amount");

    const initialUser = await EconomyEZ.get(
      `economy.${interaction.guild.id}.${interaction.user.id}`
    );

    let amountInt = 0;
    if (amount === "all") {
      amountInt = initialUser.bank;
    } else if (amount === "half") {
      amountInt = Math.floor(initialUser.bank / 2);
    } else {
      amountInt = parseInt(amount);
    }

    if (initialUser.bank < amountInt) {
      return interaction.editReply({
        content: i18n.__("economy.withdraw.insufficientFunds"),
        ephemeral: true,
      });
    }
    if (amountInt <= 0) {
      return interaction.editReply({
        content: i18n.__("economy.withdraw.amountGreaterThanZero"),
        ephemeral: true,
      });
    }

    const updatedUser = {
      bank: initialUser.bank - amountInt,
      balance: initialUser.balance + amountInt,
    };

    await EconomyEZ.set(
      `economy.${interaction.guild.id}.${interaction.user.id}`,
      updatedUser
    );

    // Generate the transfer image
    const pngBuffer = await generateRemoteImage(
      "Transfer",
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
        database: updatedUser,
        amount: amountInt,
        isDeposit: false,
      },
      { width: 400, height: 200 }
    );

    const attachment = new AttachmentBuilder(pngBuffer, {
      name: "withdraw.png",
    });

    let withdraw_embed = new EmbedBuilder()
      .setColor(process.env.EMBED_COLOR)
      .setTimestamp()
      .setImage("attachment://withdraw.png")
      .setAuthor({
        name: i18n.__("economy.withdraw.title"),
        iconURL: interaction.user.displayAvatarURL(),
      });

    await interaction.editReply({
      embeds: [withdraw_embed],
      files: [attachment],
    });
  },
  localization_strings: {
    name: {
      en: "withdraw",
      ru: "снять",
      uk: "зняти",
    },
    title: {
      en: "Withdraw",
      ru: "Снять",
      uk: "Зняти",
    },
    description: {
      en: "Withdraw money from bank",
      ru: "Снять деньги со счета",
      uk: "Зняти гроші з рахунку",
    },
    options: {
      amount: {
        name: {
          en: "amount",
          ru: "сумма",
          uk: "сума",
        },
        description: {
          en: "Amount to withdraw (or 'all', 'half')",
          ru: "Сумма для снятия (или 'all', 'half')",
          uk: "Сума для зняття (або 'all', 'half')",
        },
      },
    },
    insufficientFunds: {
      en: "Insufficient funds",
      ru: "Недостаточно средств",
      uk: "Недостатньо коштів",
    },
    amountGreaterThanZero: {
      en: "Amount must be greater than zero",
      ru: "Сумма должна быть больше нуля",
      uk: "Сума має бути більшою за нуль",
    },
    title: {
      en: "Withdraw",
      ru: "Снять",
      uk: "Зняти",
    },
  },
};
