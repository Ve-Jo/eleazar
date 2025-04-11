import {
  EmbedBuilder,
  AttachmentBuilder,
  SlashCommandSubcommandBuilder,
} from "discord.js";
import Database from "../../database/client.js";
import { generateImage } from "../../utils/imageGenerator.js";

export default {
  data: () => {
    const builder = new SlashCommandSubcommandBuilder()
      .setName("withdraw")
      .setDescription("Withdraw money from bank")
      .addStringOption((option) =>
        option
          .setName("amount")
          .setDescription("Amount to withdraw (or 'all', 'half')")
          .setRequired(true)
      );

    return builder;
  },
  localization_strings: {
    command: {
      name: {
        ru: "снять",
        uk: "зняти",
      },
      description: {
        ru: "Снять деньги со счета",
        uk: "Зняти гроші з рахунку",
      },
    },
    options: {
      amount: {
        name: {
          ru: "сумма",
          uk: "сума",
        },
        description: {
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
          content: i18n.__("commands.economy.withdraw.noBankAccount"),
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
            content: i18n.__("commands.economy.withdraw.invalidAmount"),
            ephemeral: true,
          });
        }
      }

      // Ensure 5 decimal precision
      amountInt = parseFloat(amountInt.toFixed(5));

      // Validate amount
      if (preciseCurrentBalance < amountInt) {
        return interaction.editReply({
          content: i18n.__("commands.economy.withdraw.insufficientFunds"),
          ephemeral: true,
        });
      }
      if (amountInt <= 0) {
        return interaction.editReply({
          content: i18n.__("commands.economy.withdraw.amountGreaterThanZero"),
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
      const [pngBuffer, dominantColor] = await generateImage("Transfer", {
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
        isDeposit: false,
        amount: amountInt,
        afterBalance: updatedUser.economy.balance,
        afterBank: updatedUser.economy.bankBalance,
        returnDominant: true,
        database: { ...updatedUser },
      });

      const attachment = new AttachmentBuilder(pngBuffer, {
        name: `withdraw.png`,
      });

      let withdraw_embed = new EmbedBuilder()
        .setColor(dominantColor?.embedColor)
        .setTimestamp()
        .setImage(`attachment://withdraw.png`)
        .setAuthor({
          name: i18n.__("commands.economy.withdraw.title"),
          iconURL: interaction.user.displayAvatarURL(),
        });

      await interaction.editReply({
        embeds: [withdraw_embed],
        files: [attachment],
      });
    } catch (error) {
      console.error("Error in withdraw command:", error);
      await interaction.editReply({
        content: i18n.__("commands.economy.withdraw.error"),
        ephemeral: true,
      });
    }
  },
};
