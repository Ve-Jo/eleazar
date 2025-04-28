import {
  AttachmentBuilder,
  SlashCommandSubcommandBuilder,
  MessageFlags,
} from "discord.js";
import Database from "../../database/client.js";
import { generateImage } from "../../utils/imageGenerator.js";
import { Prisma } from "@prisma/client"; // Import Prisma for Decimal
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
    await interaction.deferReply();

    const guildId = interaction.guild.id;
    const userId = interaction.user.id;

    try {
      const amountStr = interaction.options.getString("amount");

      // --- Marriage Check & Initial Data Fetch ---
      const marriageStatus = await Database.getMarriageStatus(guildId, userId);
      let partnerData = null;
      let partnerBankBalance = new Prisma.Decimal(0);
      // --- End Marriage Check ---

      // Get user data *before* the transaction
      const initialUserData = await Database.getUser(guildId, userId, true);

      if (!initialUserData || !initialUserData.economy) {
        // Need economy record to get balance for depositing
        return interaction.editReply({
          content: i18n.__("commands.economy.deposit.userNotFound"), // Or a more specific message
          ephemeral: true,
        });
      }

      // Fetch partner data if married (needed for display later)
      if (marriageStatus && marriageStatus.status === "MARRIED") {
        partnerData = await Database.getUser(
          guildId,
          marriageStatus.partnerId,
          true
        );
        if (partnerData?.economy) {
          // Calculate partner's balance for display later
          partnerBankBalance = new Prisma.Decimal(
            await Database.calculateBankBalance(partnerData)
          );
        }
      }

      // Calculate deposit amount with precision
      let amountToDeposit = new Prisma.Decimal(0);
      const userBalance = new Prisma.Decimal(initialUserData.economy.balance);

      if (amountStr === "all") {
        amountToDeposit = userBalance;
      } else if (amountStr === "half") {
        amountToDeposit = userBalance.dividedBy(2);
      } else {
        amountToDeposit = new Prisma.Decimal(amountStr);
        if (amountToDeposit.isNaN()) {
          return interaction.editReply({
            content: i18n.__("commands.economy.deposit.invalidAmount"),
            ephemeral: true,
          });
        }
      }

      // Ensure 5 decimal precision
      amountToDeposit = new Prisma.Decimal(amountToDeposit.toFixed(5));

      // Validate amount
      if (userBalance.lessThan(amountToDeposit)) {
        return interaction.editReply({
          content: i18n.__("commands.economy.deposit.notEnoughMoney"),
          ephemeral: true,
        });
      }
      if (amountToDeposit.lessThanOrEqualTo(0)) {
        return interaction.editReply({
          content: i18n.__("commands.economy.deposit.amountGreaterThanZero"),
          ephemeral: true,
        });
      }

      // --- Process deposit using transaction ---
      await Database.client.$transaction(async (tx) => {
        // Calculate bank rate based on chat level AND game level
        const chatXp = Number(initialUserData.Level?.xp ?? 0);
        const chatLevelInfo = Database.calculateLevel(chatXp);

        const gameXp = Number(initialUserData.Level?.gameXp ?? 0);
        const gameLevelInfo = Database.calculateLevel(gameXp);

        // Base 300% + 2.5% per chat level + 2.5% per game level
        const baseRate =
          300 +
          (Math.floor(chatLevelInfo.level * 2.5) +
            Math.floor(gameLevelInfo.level * 2.5));

        // Apply bank rate upgrade
        const bankRateUpgrade = initialUserData.upgrades.find(
          (u) => u.type === "bank_rate"
        );
        const bankRateLevel = bankRateUpgrade?.level || 1;
        const bankRateBonus = (bankRateLevel - 1) * 5; // 5% increase per level

        const bankRate = new Prisma.Decimal(baseRate + bankRateBonus);

        // Get current bank balance with interest, using the transaction client
        let currentBankBalance = new Prisma.Decimal(0);
        if (initialUserData.economy) {
          currentBankBalance = new Prisma.Decimal(
            await Database.calculateBankBalance(initialUserData, tx)
          );
        }

        // Update economy record with both balance and bank changes
        await tx.economy.update({
          where: {
            userId_guildId: {
              userId: userId,
              guildId: guildId,
            },
          },
          data: {
            balance: { decrement: amountToDeposit.toFixed(5) },
            bankBalance: currentBankBalance.plus(amountToDeposit).toFixed(5),
            bankRate: bankRate.toFixed(5),
            bankStartTime: Date.now(), // Reset interest timer on deposit
          },
        });

        // Update user's last activity
        await tx.user.update({
          where: {
            guildId_id: {
              id: userId,
              guildId: guildId,
            },
          },
          data: {
            lastActivity: Date.now(),
          },
        });

        // If married, update partner's last activity too, as their interest calc might change
        if (partnerData) {
          await tx.user.update({
            where: {
              guildId_id: {
                id: partnerData.id,
                guildId: guildId,
              },
            },
            data: {
              lastActivity: Date.now(),
            },
          });
        }
      });
      // --- End Deposit Transaction ---

      // --- Send DM if married ---
      let partnerDmNotificationSent = true;
      if (partnerData) {
        // partnerData is fetched earlier if married
        try {
          const partnerDiscordUser = await interaction.client.users.fetch(
            partnerData.id
          );
          await partnerDiscordUser.send(
            i18n.__("commands.economy.deposit.partnerDepositDM", {
              user: interaction.user.tag,
              amount: amountToDeposit.toFixed(2),
              guild: interaction.guild.name,
            })
          );
        } catch (dmError) {
          console.warn(
            `Failed to send deposit DM to partner ${partnerData.id}:`,
            dmError
          );
          partnerDmNotificationSent = false; // Track if DM failed for potential feedback
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

      // Get updated user data *after* invalidating cache
      const updatedUser = await Database.getUser(guildId, userId, true);
      // Recalculate combined balance for the image
      let finalCombinedBank = new Prisma.Decimal(
        updatedUser.economy?.bankBalance ?? 0
      );
      if (marriageStatus && marriageStatus.status === "MARRIED") {
        // Re-fetch partner data OR use the previously fetched partnerBankBalance
        // Re-fetching is safer if partner's interest might have changed significantly
        const updatedPartner = await Database.getUser(
          guildId,
          marriageStatus.partnerId,
          true
        );
        const updatedPartnerBalance = updatedPartner?.economy
          ? new Prisma.Decimal(
              await Database.calculateBankBalance(updatedPartner)
            )
          : new Prisma.Decimal(0);
        finalCombinedBank = finalCombinedBank.plus(updatedPartnerBalance);

        updatedUser.partnerData = updatedPartner; // Pass updated partner data
        updatedUser.marriageStatus = marriageStatus;
        updatedUser.combinedBankBalance = finalCombinedBank.toFixed(5);
      } else {
        // If not married, ensure combinedBankBalance reflects only user's balance
        updatedUser.combinedBankBalance = new Prisma.Decimal(
          updatedUser.economy?.bankBalance ?? 0
        ).toFixed(5);
      }

      // Generate deposit confirmation image
      const [buffer, dominantColor] = await generateImage(
        "Transfer",
        {
          interaction: {
            user: {
              id: userId,
              username: interaction.user.username,
              displayName: interaction.user.displayName,
              avatarURL: interaction.user.displayAvatarURL({
                extension: "png",
                size: 1024,
              }),
            },
            guild: {
              id: guildId,
              name: interaction.guild.name,
              iconURL: interaction.guild.iconURL({
                extension: "png",
                size: 1024,
              }),
            },
          },
          locale: interaction.locale,
          isDeposit: true,
          amount: amountToDeposit.toNumber(),
          afterBalance: updatedUser.economy.balance,
          afterBank: updatedUser.economy.bankBalance, // Still show user's individual bank balance here
          returnDominant: true,
          database: updatedUser, // Pass updated user data (incl. combinedBankBalance etc.)
        },
        { image: 2, emoji: 1 },
        i18n
      );

      // Create response component
      if (!buffer) {
        return interaction.editReply({
          content: i18n.__("commands.economy.deposit.imageError"),
          ephemeral: true,
        });
      }

      const attachment = new AttachmentBuilder(buffer, {
        name: `deposit.png`,
      });

      const depositComponent = new ComponentBuilder()
        .setColor(dominantColor?.embedColor ?? 0x0099ff)
        .addText(i18n.__("commands.economy.deposit.title"), "header3")
        .addImage(`attachment://deposit.png`)
        .addTimestamp(interaction.locale);

      // Send response
      await interaction.editReply({
        components: [depositComponent.build()],
        files: [attachment],
        flags: MessageFlags.IsComponentsV2,
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
