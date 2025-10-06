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
    // --- Withdraw DM --- //
    partnerWithdrawDM: {
      en: "🏧 Your partner {{user}} withdrew {{amount}} from your shared bank balance in {{guild}}. Your contribution to this withdrawal was {{partnerAmount}}.",
      ru: "🏧 Ваш партнер {{user}} снял {{amount}} с вашего общего банковского баланса на сервере {{guild}}. Ваш вклад в это снятие составил {{partnerAmount}}.",
      uk: "🏧 Ваш партнер {{user}} зняв {{amount}} з вашого спільного банківського балансу на сервері {{guild}}. Ваш внесок у це зняття склав {{partnerAmount}}.",
    },
  },

  async execute(interaction, i18n) {
    // Always use v2 builder mode
    const builderMode = "v2";

    // Always defer reply
    await interaction.deferReply();

    const amount = interaction.options.getString("amount");
    const guildId = interaction.guild.id;
    const userId = interaction.user.id;

    try {
      // Get marriage status for visual display purposes only
      const marriageStatus = await hubClient.getMarriageStatus(guildId, userId);
      let partnerData = null;
      let userBankBalance = 0;
      let partnerBankBalance = 0;
      let combinedAvailableBalance = 0;

      // Ensure user exists in database before fetching data
      await hubClient.ensureGuildUser(guildId, userId);

      const initialUserData = await hubClient.getUser(guildId, userId, true);

      if (!initialUserData?.economy) {
        return interaction.editReply({
          content: await i18n.__("commands.economy.withdraw.noBankAccount"),
          ephemeral: true,
        });
      }

      // Calculate user's bank balance
      userBankBalance = await hubClient.calculateBankBalance(initialUserData);
      combinedAvailableBalance = userBankBalance;

      // Fetch partner data if married (for visual display only)
      if (marriageStatus && marriageStatus.status === "MARRIED") {
        partnerData = await hubClient.getUser(
          guildId,
          marriageStatus.partnerId,
          true
        );
        if (partnerData?.economy) {
          partnerBankBalance = await hubClient.calculateBankBalance(
            partnerData
          );
          combinedAvailableBalance += partnerBankBalance;
        }
      }

      if (userBankBalance === 0) {
        return interaction.editReply({
          content: await i18n.__("commands.economy.withdraw.noBankAccount"),
          ephemeral: true,
        });
      }

      // Calculate withdrawal amount with precision - but only withdraw from user's own balance
      let amountToWithdraw = 0;
      const requestedAmount = interaction.options.getString("amount");

      if (requestedAmount === "all") {
        amountToWithdraw = userBankBalance; // Only user's balance, not combined
      } else if (requestedAmount === "half") {
        amountToWithdraw = userBankBalance / 2; // Only user's balance, not combined
      } else {
        amountToWithdraw = parseFloat(requestedAmount);
        if (isNaN(amountToWithdraw)) {
          return interaction.editReply({
            content: await i18n.__("commands.economy.withdraw.invalidAmount"),
            ephemeral: true,
          });
        }
      }

      // Ensure 5 decimal precision
      amountToWithdraw = parseFloat((Number(amountToWithdraw) || 0).toFixed(5));

      // Validate amount against user's individual balance
      if (userBankBalance < amountToWithdraw) {
        return interaction.editReply({
          content: await i18n.__("commands.economy.withdraw.insufficientFunds"),
          ephemeral: true,
        });
      }
      if (amountToWithdraw <= 0) {
        return interaction.editReply({
          content: await i18n.__(
            "commands.economy.withdraw.amountGreaterThanZero"
          ),
          ephemeral: true,
        });
      }

      // Perform the withdrawal transaction (only from user's balance)
      await hubClient.withdraw(guildId, userId, amountToWithdraw);

      // Get user data after the transaction for the receipt
      const finalUserData = await hubClient.getUser(guildId, userId, true);

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
        const userBankBalance =
          Number(await hubClient.calculateBankBalance(finalUserData)) || 0;
        const partnerBankBalance = updatedPartner?.economy
          ? Number(await hubClient.calculateBankBalance(updatedPartner)) || 0
          : 0;
        const combinedBankBalance = userBankBalance + partnerBankBalance;

        finalUserData.partnerData = updatedPartner;
        finalUserData.marriageStatus = marriageStatus;
        finalUserData.combinedBankBalance =
          Number(combinedBankBalance).toFixed(5);
        partnerData = updatedPartner;
      } else {
        const userBankBalance =
          Number(await hubClient.calculateBankBalance(finalUserData)) || 0;
        finalUserData.combinedBankBalance = Number(userBankBalance).toFixed(5);
      }

      const [buffer, dominantColor] = await generateImage(
        "Transfer", // Use Receipt template
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
          database: finalUserData, // Pass final user data
          partnerData: partnerData, // Pass final partner data if married
          type: "withdraw",
          amount: amountToWithdraw, // Pass the actual withdrawn amount
          dominantColor: "user",
          returnDominant: true,
        },
        { image: 2, emoji: 1 },
        i18n
      );

      const attachment = new AttachmentBuilder(buffer, {
        name: `withdraw_receipt.avif`,
      });

      const receiptComponent = new ComponentBuilder({
        dominantColor,
        mode: builderMode,
      })
        .addText(await i18n.__("commands.economy.withdraw.title"), "header3")
        .addImage("attachment://withdraw_receipt.avif")
        .addTimestamp(interaction.locale);

      const replyOptions = receiptComponent.toReplyOptions({
        files: [attachment],
      });

      // Always edit reply
      await interaction.editReply(replyOptions);

      // Send DM to partner if married (informational only)
      if (partnerData) {
        try {
          const partnerDiscordUser = await interaction.client.users.fetch(
            partnerData.id
          );
          if (partnerDiscordUser) {
            await partnerDiscordUser.send({
              content: await i18n.__(
                "commands.economy.withdraw.partnerWithdrawDM",
                {
                  user: interaction.user.tag,
                  amount: amountToWithdraw.toFixed(2),
                  partnerAmount: "0.00", // No money taken from partner
                  guild: interaction.guild.name,
                }
              ),
            });
          }
        } catch (dmError) {
          console.error(
            `Failed to send withdraw DM to partner ${partnerData.id}:`,
            dmError
          );
        }
      }
    } catch (error) {
      console.error("Error in withdraw command:", error);
      const errorOptions = {
        content: await i18n.__("commands.economy.withdraw.error"),
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
