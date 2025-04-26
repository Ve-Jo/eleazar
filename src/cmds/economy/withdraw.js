import {
  EmbedBuilder,
  AttachmentBuilder,
  SlashCommandSubcommandBuilder,
} from "discord.js";
import Database from "../../database/client.js";
import { generateImage } from "../../utils/imageGenerator.js";
import { Prisma } from "@prisma/client"; // Import Prisma for Decimal

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
    await interaction.deferReply();
    const amount = interaction.options.getString("amount");
    const guildId = interaction.guild.id;
    const userId = interaction.user.id;

    try {
      // --- Marriage Check & Initial Data Fetch ---
      const marriageStatus = await Database.getMarriageStatus(guildId, userId);
      let partnerData = null;
      let userBankBalance = new Prisma.Decimal(0);
      let partnerBankBalance = new Prisma.Decimal(0);
      let combinedAvailableBalance = new Prisma.Decimal(0);

      const initialUserData = await Database.getUser(guildId, userId, true);

      if (!initialUserData?.economy) {
        // User might not have an economy record yet, but could be married
        // Continue check, but user's balance is 0
      } else {
        userBankBalance = new Prisma.Decimal(
          await Database.calculateBankBalance(initialUserData)
        );
        combinedAvailableBalance =
          combinedAvailableBalance.plus(userBankBalance);
      }

      if (marriageStatus && marriageStatus.status === "MARRIED") {
        partnerData = await Database.getUser(
          guildId,
          marriageStatus.partnerId,
          true
        );
        if (partnerData?.economy) {
          partnerBankBalance = new Prisma.Decimal(
            await Database.calculateBankBalance(partnerData)
          );
          combinedAvailableBalance =
            combinedAvailableBalance.plus(partnerBankBalance);
        }
      } else if (userBankBalance.isZero()) {
        // If not married and user has no balance, they can't withdraw
        return interaction.editReply({
          content: i18n.__("commands.economy.withdraw.noBankAccount"),
          ephemeral: true,
        });
      }
      // --- End Marriage Check & Initial Data Fetch ---

      // Calculate withdrawal amount with precision
      let amountToWithdraw = new Prisma.Decimal(0);
      const requestedAmount = interaction.options.getString("amount");

      // --- Declare amounts outside transaction --- //
      let partnerWithdrawAmount = new Prisma.Decimal(0);
      // --- End Declare amounts --- //

      if (requestedAmount === "all") {
        amountToWithdraw = combinedAvailableBalance;
      } else if (requestedAmount === "half") {
        amountToWithdraw = combinedAvailableBalance.dividedBy(2);
      } else {
        amountToWithdraw = new Prisma.Decimal(requestedAmount);
        if (amountToWithdraw.isNaN()) {
          return interaction.editReply({
            content: i18n.__("commands.economy.withdraw.invalidAmount"),
            ephemeral: true,
          });
        }
      }

      // Ensure 5 decimal precision (Prisma handles this, but good practice for display/checks)
      amountToWithdraw = new Prisma.Decimal(amountToWithdraw.toFixed(5));

      // Validate amount
      if (combinedAvailableBalance.lessThan(amountToWithdraw)) {
        return interaction.editReply({
          content: i18n.__("commands.economy.withdraw.insufficientFunds"),
          ephemeral: true,
        });
      }
      if (amountToWithdraw.lessThanOrEqualTo(0)) {
        return interaction.editReply({
          content: i18n.__("commands.economy.withdraw.amountGreaterThanZero"),
          ephemeral: true,
        });
      }

      // --- Perform the withdrawal transaction ---
      await Database.client.$transaction(async (tx) => {
        let remainingWithdrawAmount = amountToWithdraw;
        let userWithdrawAmount = new Prisma.Decimal(0);

        // 1. Withdraw from the user's account first
        if (userBankBalance.greaterThan(0)) {
          userWithdrawAmount = Prisma.Decimal.min(
            remainingWithdrawAmount,
            userBankBalance
          );
          remainingWithdrawAmount =
            remainingWithdrawAmount.minus(userWithdrawAmount);
        }

        // 2. Withdraw the rest from the partner's account if married and necessary
        if (
          remainingWithdrawAmount.greaterThan(0) &&
          partnerData &&
          partnerBankBalance.greaterThan(0)
        ) {
          partnerWithdrawAmount = Prisma.Decimal.min(
            remainingWithdrawAmount,
            partnerBankBalance
          );
          remainingWithdrawAmount = remainingWithdrawAmount.minus(
            partnerWithdrawAmount
          );
        }

        // This check should technically be covered by the initial balance check, but double-check
        if (remainingWithdrawAmount.greaterThan(0)) {
          console.error("Withdrawal calculation error: Remaining amount > 0", {
            initialCombined: combinedAvailableBalance.toString(),
            amountToWithdraw: amountToWithdraw.toString(),
            userBalance: userBankBalance.toString(),
            partnerBalance: partnerBankBalance.toString(),
            userWithdraw: userWithdrawAmount.toString(),
            partnerWithdraw: partnerWithdrawAmount.toString(),
            remaining: remainingWithdrawAmount.toString(),
          });
          throw new Error("Calculation error during withdrawal.");
        }

        const totalWithdrawn = userWithdrawAmount.plus(partnerWithdrawAmount);

        // 3. Update the user's economy record
        const newUserBankBalance = userBankBalance.minus(userWithdrawAmount);
        await tx.economy.upsert({
          where: { userId_guildId: { userId: userId, guildId: guildId } },
          create: {
            // Should not happen if user has balance, but handle defensively
            userId: userId,
            guildId: guildId,
            balance: totalWithdrawn.toFixed(5),
            bankBalance: newUserBankBalance.toFixed(5),
            bankRate: newUserBankBalance.lessThanOrEqualTo(0)
              ? "0"
              : initialUserData?.economy?.bankRate ?? "0",
            bankStartTime: newUserBankBalance.lessThanOrEqualTo(0)
              ? 0
              : Date.now(),
          },
          update: {
            balance: { increment: totalWithdrawn.toFixed(5) }, // Add total withdrawn to user's pocket
            bankBalance: newUserBankBalance.toFixed(5),
            bankRate: newUserBankBalance.lessThanOrEqualTo(0)
              ? "0.00000"
              : initialUserData.economy.bankRate,
            bankStartTime: newUserBankBalance.lessThanOrEqualTo(0)
              ? 0
              : Date.now(),
          },
        });
        await tx.user.update({
          where: { guildId_id: { id: userId, guildId: guildId } },
          data: { lastActivity: Date.now() },
        });

        // 4. Update the partner's economy record if applicable
        if (partnerData && partnerWithdrawAmount.greaterThan(0)) {
          const newPartnerBankBalance = partnerBankBalance.minus(
            partnerWithdrawAmount
          );
          await tx.economy.update({
            where: {
              userId_guildId: { userId: partnerData.id, guildId: guildId },
            },
            data: {
              // Partner's pocket balance doesn't change
              bankBalance: newPartnerBankBalance.toFixed(5),
              bankRate: newPartnerBankBalance.lessThanOrEqualTo(0)
                ? "0.00000"
                : partnerData.economy.bankRate,
              bankStartTime: newPartnerBankBalance.lessThanOrEqualTo(0)
                ? 0
                : Date.now(),
            },
          });
          await tx.user.update({
            where: { guildId_id: { id: partnerData.id, guildId: guildId } },
            data: { lastActivity: Date.now() }, // Update partner activity too
          });
        }
      });
      // --- End withdrawal transaction ---

      // --- Send DM if partner's balance was affected ---
      let partnerDmNotificationSent = true; // Assume success unless we try and fail
      if (partnerData && partnerWithdrawAmount.greaterThan(0)) {
        try {
          const partnerDiscordUser = await interaction.client.users.fetch(
            partnerData.id
          );
          await partnerDiscordUser.send(
            i18n.__("commands.economy.withdraw.partnerWithdrawDM", {
              user: interaction.user.tag,
              amount: amountToWithdraw.toFixed(2), // Total withdrawn
              partnerAmount: partnerWithdrawAmount.toFixed(2), // Amount taken from partner
              guild: interaction.guild.name,
            })
          );
        } catch (dmError) {
          console.warn(
            `Failed to send withdrawal DM to partner ${partnerData.id}:`,
            dmError
          );
          partnerDmNotificationSent = false;
        }
      }
      // --- End Send DM ---

      // --- Explicitly invalidate cache AFTER transaction for BOTH users ---
      const userKeysToDel = [
        Database._cacheKeyUser(guildId, userId, true),
        Database._cacheKeyUser(guildId, userId, false),
        Database._cacheKeyStats(guildId, userId),
      ];
      if (partnerData) {
        userKeysToDel.push(
          Database._cacheKeyUser(guildId, partnerData.id, true),
          Database._cacheKeyUser(guildId, partnerData.id, false),
          Database._cacheKeyStats(guildId, partnerData.id)
        );
      }

      if (Database.redisClient) {
        try {
          await Database.redisClient.del(userKeysToDel);
          Database._logRedis("del", userKeysToDel.join(", "), true);
        } catch (err) {
          Database._logRedis("del", userKeysToDel.join(", "), err);
        }
      }

      // Get updated user data (for the image)
      const updatedUser = await Database.getUser(guildId, userId, true);
      // Recalculate combined balance for the image based on potentially updated partner data
      let finalCombinedBank = new Prisma.Decimal(
        updatedUser.economy?.bankBalance ?? 0
      );
      if (marriageStatus && marriageStatus.status === "MARRIED") {
        const updatedPartner = await Database.getUser(
          guildId,
          marriageStatus.partnerId,
          true
        );
        finalCombinedBank = finalCombinedBank.plus(
          new Prisma.Decimal(updatedPartner.economy?.bankBalance ?? 0)
        );
        updatedUser.partnerData = updatedPartner; // Pass updated partner data
        updatedUser.marriageStatus = marriageStatus;
        updatedUser.combinedBankBalance = finalCombinedBank.toFixed(5);
      }

      // Generate the transfer image
      const [pngBuffer, dominantColor] = await generateImage(
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
          isDeposit: false,
          amount: amountToWithdraw.toNumber(), // Pass the actual withdrawn amount
          afterBalance: updatedUser.economy.balance,
          afterBank: updatedUser.economy.bankBalance, // Show user's bank balance
          returnDominant: true,
          database: { ...updatedUser }, // Pass updated user data (includes combinedBankBalance etc)
        },
        { image: 2, emoji: 1 },
        i18n
      );

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
