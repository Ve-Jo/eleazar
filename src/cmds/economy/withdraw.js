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

    try {
      // Get initial user data and update bank balance
      await EconomyEZ.updateBankOnInactivity(
        interaction.guild.id,
        interaction.user.id
      );
      const initialUser = await EconomyEZ.get(
        `${interaction.guild.id}.${interaction.user.id}`
      );

      if (!initialUser?.bank) {
        return interaction.editReply({
          content: i18n.__("economy.withdraw.noBankAccount"),
          ephemeral: true,
        });
      }

      // Calculate withdrawal amount
      let amountInt = 0;
      if (amount === "all") {
        amountInt = Number(initialUser.bank.amount);
      } else if (amount === "half") {
        amountInt = Math.floor(Number(initialUser.bank.amount) / 2);
      } else {
        amountInt = parseInt(amount);
        if (isNaN(amountInt)) {
          return interaction.editReply({
            content: i18n.__("economy.withdraw.invalidAmount"),
            ephemeral: true,
          });
        }
      }

      // Validate amount
      if (initialUser.bank.amount < amountInt) {
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

      // Perform the withdrawal transaction
      // Update bank data with proper nested update
      const newBankAmount = initialUser.bank.amount - amountInt;
      await EconomyEZ.set(`${interaction.guild.id}.${interaction.user.id}`, {
        bank: {
          amount: newBankAmount,
          ...(newBankAmount === 0
            ? {
                startedToHold: BigInt(0),
                holdingPercentage: 0,
              }
            : {
                startedToHold: initialUser.bank.startedToHold,
                holdingPercentage: initialUser.bank.holdingPercentage,
              }),
        },
        balance: initialUser.balance + amountInt,
      });

      // Get updated user data
      const updatedUser = await EconomyEZ.get(
        `${interaction.guild.id}.${interaction.user.id}`
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
              locale: interaction.user.locale,
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
          database: updatedUser,
          amount: amountInt,
          isDeposit: false,
        },
        { width: 400, height: 200 }
      );

      const attachment = new AttachmentBuilder(pngBuffer.buffer, {
        name: `withdraw.${
          pngBuffer.contentType === "image/gif" ? "gif" : "png"
        }`,
      });

      let withdraw_embed = new EmbedBuilder()
        .setColor(process.env.EMBED_COLOR)
        .setTimestamp()
        .setImage(
          `attachment://withdraw.${
            pngBuffer.contentType === "image/gif" ? "gif" : "png"
          }`
        )
        .setAuthor({
          name: i18n.__("economy.withdraw.title"),
          iconURL: interaction.user.displayAvatarURL(),
        });

      await interaction.editReply({
        embeds: [withdraw_embed],
        files: [attachment],
      });
    } catch (error) {
      console.error("Error in withdraw command:", error);
      await interaction.editReply({
        content: i18n.__("economy.withdraw.error"),
        ephemeral: true,
      });
    }
  },
  localization_strings: {
    name: {
      en: "withdraw",
      ru: "снять",
      uk: "зняти",
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
    invalidAmount: {
      en: "Invalid amount",
      ru: "Неверная сумма",
      uk: "Невірна сума",
    },
    noBankAccount: {
      en: "You don't have a bank account",
      ru: "У вас нет банковского счета",
      uk: "У вас немає банківського рахунку",
    },
    error: {
      en: "An error occurred while processing your withdrawal",
      ru: "Произошла ошибка при обработке снятия",
      uk: "Сталася помилка під час обробки зняття",
    },
    title: {
      en: "Withdraw",
      ru: "Снять",
      uk: "Зняти",
    },
  },
};
