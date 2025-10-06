import {
  AttachmentBuilder,
  SlashCommandSubcommandBuilder,
  MessageFlags,
} from "discord.js";
import hubClient from "../../api/hubClient.js";
import { generateImage } from "../../utils/imageGenerator.js";
// Using standard JavaScript numbers instead of Prisma.Decimal
import { ComponentBuilder } from "../../utils/componentConverter.js";

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
    // --- Deposit DM --- //
    partnerDepositDM: {
      en: "🏧 Your partner {{user}} deposited {{amount}} into your shared bank balance in {{guild}}.",
      ru: "🏧 Ваш партнер {{user}} внес {{amount}} на ваш общий банковский баланс на сервере {{guild}}.",
      uk: "🏧 Ваш партнер {{user}} вніс {{amount}} на ваш спільний банківський баланс на сервері {{guild}}.",
    },
  },

  async execute(interaction, i18n) {
    // Always use v2 builder mode
    const builderMode = "v2";

    // Always defer reply
    await interaction.deferReply();

    const guildId = interaction.guild.id;
    const userId = interaction.user.id;

    try {
      const amountStr = interaction.options.getString("amount");

      // Get marriage status for visual display purposes only
      const marriageStatus = await hubClient.getMarriageStatus(guildId, userId);
      let partnerData = null;

      // Ensure user exists in database before fetching data
      await hubClient.ensureGuildUser(guildId, userId);

      // Get user data *before* the transaction
      const initialUserData = await hubClient.getUser(guildId, userId, true);

      if (!initialUserData || !initialUserData.economy) {
        // Need economy record to get balance for depositing
        return interaction.editReply({
          content: await i18n.__("commands.economy.deposit.noBankAccount"),
          ephemeral: true,
        });
      }

      // Fetch partner data if married (for visual display only)
      if (marriageStatus && marriageStatus.status === "MARRIED") {
        await hubClient.ensureGuildUser(guildId, marriageStatus.partnerId);
        partnerData = await hubClient.getUser(
          guildId,
          marriageStatus.partnerId,
          true
        );
      }

      // Calculate deposit amount with precision
      let amountToDeposit = 0; // Using standard JavaScript numbers
      const userBalance = initialUserData?.economy?.balance || 0;

      if (amountStr === "all") {
        amountToDeposit = userBalance;
      } else if (amountStr === "half") {
        amountToDeposit = userBalance / 2;
      } else {
        amountToDeposit = parseFloat(amountStr);
        if (isNaN(amountToDeposit)) {
          return interaction.editReply({
            content: await i18n.__("commands.economy.deposit.invalidAmount"),
            ephemeral: true,
          });
        }
      }

      // Ensure 5 decimal precision
      amountToDeposit = parseFloat((Number(amountToDeposit) || 0).toFixed(5));

      // Validate amount
      if (userBalance < amountToDeposit) {
        return interaction.editReply({
          content: await i18n.__("commands.economy.deposit.notEnoughMoney"),
          ephemeral: true,
        });
      }
      if (amountToDeposit <= 0) {
        return interaction.editReply({
          content: await i18n.__(
            "commands.economy.deposit.amountGreaterThanZero"
          ),
          ephemeral: true,
        });
      }

      // --- Process deposit using hubClient ---
      await hubClient.deposit(guildId, userId, amountToDeposit);
      // --- End Deposit Transaction ---

      // Get updated user data after deposit
      const updatedUser = await hubClient.getUser(guildId, userId, true);

      // Calculate current bank balance with interest for display
      const currentBankBalance = updatedUser.economy
        ? await hubClient.calculateBankBalance(updatedUser)
        : 0;

      // Calculate combined balance for visual display if married
      if (
        marriageStatus &&
        marriageStatus.status === "MARRIED" &&
        partnerData
      ) {
        const updatedPartner = await hubClient.getUser(
          guildId,
          marriageStatus.partnerId,
          true
        );
        const userBankBalance = Number(currentBankBalance) || 0;
        const partnerBankBalance = updatedPartner?.economy
          ? Number(await hubClient.calculateBankBalance(updatedPartner)) || 0
          : 0;
        const combinedBankBalance = userBankBalance + partnerBankBalance;

        updatedUser.partnerData = updatedPartner;
        updatedUser.marriageStatus = marriageStatus;
        updatedUser.combinedBankBalance = combinedBankBalance.toFixed(5);
      } else {
        updatedUser.combinedBankBalance = (
          Number(currentBankBalance) || 0
        ).toFixed(5);
      }

      // Update the economy bankBalance for display purposes
      if (updatedUser.economy) {
        updatedUser.economy.bankBalance = currentBankBalance;
      }

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
          amount: amountToDeposit,
          afterBalance: updatedUser.economy.balance,
          afterBank: updatedUser.economy.bankBalance, // Still show user's individual bank balance here
          returnDominant: true,
          database: updatedUser, // Pass updated user data (incl. combinedBankBalance etc.)
          partnerData: partnerData, // Pass final partner data
          type: "deposit",
          amount: amountToDeposit,
          dominantColor: "user",
          returnDominant: true,
        },
        { image: 2, emoji: 1 },
        i18n
      );

      const attachment = new AttachmentBuilder(buffer, {
        name: `deposit_receipt.png`,
      });

      const receiptComponent = new ComponentBuilder({
        dominantColor,
        mode: builderMode,
      })
        .addText(await i18n.__("commands.economy.deposit.title"), "header3")
        .addText(
          await i18n.__("commands.economy.deposit.depositSuccess", {
            amount: amountToDeposit.toFixed(2),
          })
        )
        .addImage("attachment://deposit_receipt.png")
        .addTimestamp(interaction.locale);

      const replyOptions = receiptComponent.toReplyOptions({
        files: [attachment],
      });

      // Always edit reply
      await interaction.editReply(replyOptions);

      // Send DM to partner if married
      if (partnerData) {
        try {
          const partnerDiscordUser = await interaction.client.users.fetch(
            partnerData.id
          );
          if (partnerDiscordUser) {
            await partnerDiscordUser.send({
              content: await i18n.__(
                "commands.economy.deposit.partnerDepositDM",
                {
                  user: interaction.user.tag,
                  amount: amountToDeposit.toFixed(2),
                  guild: interaction.guild.name,
                }
              ),
            });
          }
        } catch (dmError) {
          console.error(
            `Failed to send deposit DM to partner ${partnerData.id}:`,
            dmError
          );
        }
      }
    } catch (error) {
      console.error("Error in deposit command:", error);
      const errorOptions = {
        content: await i18n.__("commands.economy.deposit.error"),
        ephemeral: true,
        components: [],
        embeds: [],
        files: [],
      };
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply(errorOptions).catch(() => {});
      } else {
        await interaction.reply(errorOptions).catch(() => {});
      }
    }
  },
};
