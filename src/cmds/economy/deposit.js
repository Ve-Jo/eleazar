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
    const i18nBuilder = new I18nCommandBuilder("economy", "deposit");

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
      amountInt = initialUser.balance;
    } else if (amount === "half") {
      amountInt = Math.floor(initialUser.balance / 2);
    } else {
      amountInt = parseInt(amount);
    }
    if (amountInt <= 0) {
      return interaction.editReply({
        content: i18n.__("economy.deposit.amountGreaterThanZero"),
        ephemeral: true,
      });
    }

    if (initialUser.balance < amountInt) {
      return interaction.editReply({
        content: i18n.__("economy.deposit.insufficientFunds"),
        ephemeral: true,
      });
    }

    const updatedUser = {
      balance: initialUser.balance - amountInt,
      bank: initialUser.bank + amountInt,
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
        isDeposit: true,
      },
      { width: 400, height: 200 }
    );

    const attachment = new AttachmentBuilder(pngBuffer, {
      name: "deposit.png",
    });

    let deposit_embed = new EmbedBuilder()
      .setColor(process.env.EMBED_COLOR)
      .setTimestamp()
      .setImage("attachment://deposit.png")
      .setAuthor({
        name: i18n.__("economy.deposit.title"),
        iconURL: interaction.user.displayAvatarURL(),
      });

    await interaction.editReply({
      content: i18n.__("economy.deposit.success", { amount: amountInt }),
      embeds: [deposit_embed],
      files: [attachment],
    });
  },
  localization_strings: {
    name: {
      en: "deposit",
      ru: "внести",
      uk: "внести",
    },
    title: {
      en: "Deposit",
      ru: "Внести",
      uk: "Внести",
    },
    description: {
      en: "Deposit money",
      ru: "Положить деньги на счет",
      uk: "Покласти гроші на рахунок",
    },
    options: {
      amount: {
        name: {
          en: "amount",
          ru: "сумма",
          uk: "сума",
        },
        description: {
          en: "Amount to deposit (or 'all', 'half')",
          ru: "Сумма для внесения (или 'all', 'half')",
          uk: "Сума для внесення (або 'all', 'half')",
        },
      },
    },
    success: {
      en: "Successfully deposited {{amount}} coins",
      ru: "Успешно внесено {{amount}} монет",
      uk: "Успішно внесено {{amount}} монет",
    },
    amountGreaterThanZero: {
      en: "Amount must be greater than 0",
      ru: "Сумма должна быть больше 0",
      uk: "Сума повинна бути більшою за 0",
    },
    insufficientFunds: {
      en: "Insufficient funds",
      ru: "Недостаточно средств",
      uk: "Недостатньо коштів",
    },
  },
};
