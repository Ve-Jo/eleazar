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
  async execute(interaction, i18n) {
    await interaction.deferReply();
    const amount = interaction.options.getString("amount");

    try {
      // Get user data with all relations
      const userData = await Database.getUser(
        interaction.guild.id,
        interaction.user.id
      );

      if (!userData?.economy?.bankBalance) {
        return interaction.editReply({
          content: i18n.__("economy.withdraw.noBankAccount"),
          ephemeral: true,
        });
      }

      // Calculate current bank balance with interest
      const currentBankBalance = await Database.calculateBankBalance(userData);

      // Calculate withdrawal amount with precision
      let amountInt = 0;
      const preciseCurrentBalance = parseFloat(currentBankBalance);

      if (amount === "all") {
        amountInt = preciseCurrentBalance;
      } else if (amount === "half") {
        amountInt = preciseCurrentBalance / 2;
      } else {
        amountInt = parseFloat(amount);
        if (isNaN(amountInt)) {
          return interaction.editReply({
            content: i18n.__("economy.withdraw.invalidAmount"),
            ephemeral: true,
          });
        }
      }

      // Ensure 5 decimal precision
      amountInt = parseFloat(amountInt.toFixed(5));

      // Validate amount
      if (preciseCurrentBalance < amountInt) {
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
      await Database.client.$transaction(async (tx) => {
        // Calculate remaining balance after withdrawal
        const remainingBalance = (preciseCurrentBalance - amountInt).toFixed(5);

        // Update economy record with both balance and bank changes
        await tx.economy.update({
          where: {
            userId_guildId: {
              userId: interaction.user.id,
              guildId: interaction.guild.id,
            },
          },
          data: {
            balance: { increment: amountInt },
            // Set exact remaining balance
            bankBalance: remainingBalance,
            bankRate:
              parseFloat(remainingBalance) <= 0
                ? "0.00000"
                : userData.economy.bankRate,
            bankStartTime: parseFloat(remainingBalance) <= 0 ? 0 : Date.now(), // Reset interest calculation time
          },
        });

        // Update user's last activity
        await tx.user.update({
          where: {
            guildId_id: {
              id: interaction.user.id,
              guildId: interaction.guild.id,
            },
          },
          data: {
            lastActivity: Date.now(),
          },
        });
      });

      // Get updated user data
      const updatedUser = await Database.getUser(
        interaction.guild.id,
        interaction.user.id,
        true
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
