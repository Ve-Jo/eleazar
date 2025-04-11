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
      .setName("deposit")
      .setDescription("Deposit money into your bank account")
      .addNumberOption((option) =>
        option
          .setName("amount")
          .setDescription("Amount to deposit")
          .setRequired(true)
          .setMinValue(0)
      );
    return builder;
  },

  localization_strings: {
    command: {
      name: {
        ru: "внести",
        uk: "внести",
      },
      description: {
        ru: "Внести деньги на ваш банковский счет",
        uk: "Внести гроші на ваш банківський рахунок",
      },
    },
    options: {
      amount: {
        name: {
          ru: "сумма",
          uk: "сума",
        },
        description: {
          ru: "Сумма для внесения",
          uk: "Сума для внесення",
        },
      },
    },
    title: {
      en: "Deposit",
      ru: "Внесение",
      uk: "Внесення",
    },
    depositSuccess: {
      en: "Successfully deposited {{amount}} to your bank account.",
      ru: "Успешно внесено {{amount}} на ваш банковский счет.",
      uk: "Успішно внесено {{amount}} на ваш банківський рахунок.",
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
      en: "An error occurred while processing your deposit",
      ru: "Произошла ошибка при обработке депозита",
      uk: "Сталася помилка під час обробки депозиту",
    },
  },

  async execute(interaction, i18n) {
    await interaction.deferReply();

    try {
      // No need to set locale here as it's already set in interactionCreate
      const amount = interaction.options.getNumber("amount");

      // Validate the amount
      if (amount <= 0) {
        return interaction.editReply({
          content: i18n.__("commands.economy.deposit.invalidAmount"),
          ephemeral: true,
        });
      }

      // Get user data
      const userData = await Database.getUser(
        interaction.guild.id,
        interaction.user.id,
        true
      );

      if (!userData || !userData.economy) {
        return interaction.editReply({
          content: i18n.__("commands.economy.deposit.userNotFound"),
          ephemeral: true,
        });
      }

      // Check if user has enough money
      if (userData.economy.balance < amount) {
        return interaction.editReply({
          content: i18n.__("commands.economy.deposit.notEnoughMoney"),
          ephemeral: true,
        });
      }

      // Process deposit
      await Database.client.economy.update({
        where: {
          userId_guildId: {
            userId: interaction.user.id,
            guildId: interaction.guild.id,
          },
        },
        data: {
          balance: { decrement: amount },
          bankBalance: { increment: amount },
          bankStartTime: userData.economy.bankStartTime || new Date(),
        },
      });

      // Get updated user data
      const updatedUser = await Database.getUser(
        interaction.guild.id,
        interaction.user.id,
        true
      );

      // Generate deposit confirmation image - pass the i18n instance
      const [buffer, dominantColor] = await generateImage(
        "Transaction",
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
          locale: interaction.locale,
          transactionType: "deposit",
          amount: amount,
          afterBalance: updatedUser.economy.balance,
          afterBank: updatedUser.economy.bankBalance,
          returnDominant: true,
          database: updatedUser,
        },
        { image: 2, emoji: 1 },
        i18n
      );

      // Create response embed
      if (!buffer) {
        return interaction.editReply({
          content: i18n.__("commands.economy.deposit.imageError"),
          ephemeral: true,
        });
      }

      const attachment = new AttachmentBuilder(buffer, {
        name: `deposit.png`,
      });

      const embed = new EmbedBuilder()
        .setTimestamp()
        .setColor(dominantColor?.embedColor ?? 0x0099ff)
        .setImage(`attachment://deposit.png`)
        .setAuthor({
          name: i18n.__("commands.economy.deposit.title"),
          iconURL: interaction.user.displayAvatarURL(),
        })
        .setDescription(
          i18n.__("commands.economy.deposit.depositSuccess", {
            amount: amount.toFixed(2),
          })
        );

      // Send response
      await interaction.editReply({
        embeds: [embed],
        files: [attachment],
      });
    } catch (error) {
      console.error("Error in deposit command:", error);
      await interaction.editReply({
        content: i18n.__("commands.economy.deposit.error"),
        ephemeral: true,
      });
    }
  },
};
