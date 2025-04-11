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
      .addStringOption((option) =>
        option
          .setName("amount")
          .setDescription("Amount to deposit (or 'all', 'half')")
          .setRequired(true)
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
          ru: "Сумма для внесения (или 'all', 'half')",
          uk: "Сума для внесення (або 'all', 'half')",
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
    notEnoughMoney: {
      en: "You don't have enough money to deposit",
      ru: "У вас недостаточно денег для внесения",
      uk: "У вас недостатньо грошей для внесення",
    },
    imageError: {
      en: "Failed to generate the image. Please try again.",
      ru: "Не удалось сгенерировать изображение. Пожалуйста, попробуйте еще раз.",
      uk: "Не вдалося згенерувати зображення. Будь ласка, спробуйте ще раз.",
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
      const amount = interaction.options.getString("amount");

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

      // Calculate deposit amount with precision
      let amountInt = 0;
      const userBalance = parseFloat(userData.economy.balance);

      if (amount === "all") {
        amountInt = userBalance;
      } else if (amount === "half") {
        amountInt = userBalance / 2;
      } else {
        amountInt = parseFloat(amount);
        if (isNaN(amountInt)) {
          return interaction.editReply({
            content: i18n.__("commands.economy.deposit.invalidAmount"),
            ephemeral: true,
          });
        }
      }

      // Ensure 5 decimal precision
      amountInt = parseFloat(amountInt.toFixed(5));

      // Validate amount
      if (userBalance < amountInt) {
        return interaction.editReply({
          content: i18n.__("commands.economy.deposit.notEnoughMoney"),
          ephemeral: true,
        });
      }
      if (amountInt <= 0) {
        return interaction.editReply({
          content: i18n.__("commands.economy.deposit.amountGreaterThanZero"),
          ephemeral: true,
        });
      }

      // Process deposit using transaction
      await Database.client.$transaction(async (tx) => {
        // Calculate bank rate based on level
        const xp = Number(userData.level?.xp?.toString() || 0);
        const levelInfo = Database.calculateLevel(xp);
        const baseRate = 300 + Math.floor(levelInfo.level * 5); // Base 300% + 5% per level

        // Apply bank rate upgrade
        const bankRateUpgrade = userData.upgrades.find(
          (u) => u.type === "bank_rate"
        );
        const bankRateLevel = bankRateUpgrade?.level || 1;
        const bankRateBonus = (bankRateLevel - 1) * 5; // 5% increase per level

        const bankRate = baseRate + bankRateBonus;

        // Get current bank balance with interest
        let currentBankBalance = 0;
        if (userData.economy) {
          currentBankBalance = parseFloat(
            await Database.calculateBankBalance(userData)
          );
        }

        // Update economy record with both balance and bank changes
        await tx.economy.update({
          where: {
            userId_guildId: {
              userId: interaction.user.id,
              guildId: interaction.guild.id,
            },
          },
          data: {
            balance: { decrement: amountInt },
            bankBalance: (currentBankBalance + amountInt).toFixed(5),
            bankRate: bankRate.toFixed(5),
            bankStartTime: Date.now(),
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

      // Generate deposit confirmation image
      const [buffer, dominantColor] = await generateImage(
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
          locale: interaction.locale,
          isDeposit: true,
          amount: amountInt,
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
        });

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
