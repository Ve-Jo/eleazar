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
      .setName("transfer")
      .setDescription("Transfer money to another user")
      .addUserOption((option) =>
        option
          .setName("user")
          .setDescription("User to transfer money to")
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName("amount")
          .setDescription("Amount to transfer (or 'all', 'half')")
          .setRequired(true)
          .addChoices(
            { name: "All", value: "all" },
            { name: "Half", value: "half" }
          )
      );

    return builder;
  },

  localization_strings: {
    command: {
      name: {
        ru: "перевод",
        uk: "переказ",
      },
      description: {
        ru: "Перевести деньги другому пользователю",
        uk: "Переказати гроші іншому користувачу",
      },
    },
    options: {
      user: {
        name: {
          ru: "пользователь",
          uk: "користувач",
        },
        description: {
          ru: "Пользователь, которому перевести деньги",
          uk: "Користувач, якому переказати гроші",
        },
      },
      amount: {
        name: {
          ru: "сумма",
          uk: "сума",
        },
        description: {
          ru: "Сумма для перевода (или 'all', 'half')",
          uk: "Сума для переказу (або 'all', 'half')",
        },
      },
    },
    cannotTransferToSelf: {
      en: "You cannot transfer money to yourself",
      ru: "Вы не можете перевести деньги самому себе",
      uk: "Ви не можете переказати гроші самому собі",
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
    error: {
      en: "An error occurred while processing your transfer",
      ru: "Произошла ошибка при обработке перевода",
      uk: "Сталася помилка під час обробки переказу",
    },
    title: {
      en: "Transfer",
      ru: "Перевод",
      uk: "Переказ",
    },
  },

  async execute(interaction, i18n) {
    await interaction.deferReply();
    const targetUser = interaction.options.getUser("user");
    const amount = interaction.options.getString("amount");

    // Prevent self-transfers
    if (targetUser.id === interaction.user.id) {
      return interaction.editReply({
        content: i18n.__("commands.economy.transfer.cannotTransferToSelf"),
        ephemeral: true,
      });
    }

    try {
      // Get sender user data with all relations
      const senderData = await Database.getUser(
        interaction.guild.id,
        interaction.user.id,
        true
      );

      // Get recipient user data
      const recipientData = await Database.getUser(
        interaction.guild.id,
        targetUser.id,
        true
      );

      // Calculate transfer amount
      let amountInt = 0;
      if (amount === "all") {
        amountInt = Number(senderData.economy?.balance || 0);
      } else if (amount === "half") {
        amountInt = Math.floor(Number(senderData.economy?.balance || 0) / 2);
      } else {
        amountInt = parseFloat(amount);
        if (isNaN(amountInt)) {
          return interaction.editReply({
            content: i18n.__("commands.economy.transfer.invalidAmount"),
            ephemeral: true,
          });
        }
      }

      // Validate amount
      if (!senderData.economy || senderData.economy.balance < amountInt) {
        return interaction.editReply({
          content: i18n.__("commands.economy.transfer.insufficientFunds"),
          ephemeral: true,
        });
      }
      if (amountInt <= 0) {
        return interaction.editReply({
          content: i18n.__("commands.economy.transfer.amountGreaterThanZero"),
          ephemeral: true,
        });
      }

      // Ensure 5 decimal precision
      amountInt = parseFloat(amountInt.toFixed(5));

      // Perform transfer operation in single transaction
      await Database.client.$transaction(async (tx) => {
        // Deduct from sender
        await tx.economy.update({
          where: {
            userId_guildId: {
              userId: interaction.user.id,
              guildId: interaction.guild.id,
            },
          },
          data: {
            balance: {
              decrement: amountInt,
            },
          },
        });

        // Add to recipient
        await tx.economy.upsert({
          where: {
            userId_guildId: {
              userId: targetUser.id,
              guildId: interaction.guild.id,
            },
          },
          update: {
            balance: {
              increment: amountInt,
            },
          },
          create: {
            userId: targetUser.id,
            guildId: interaction.guild.id,
            balance: amountInt,
            bankBalance: "0.00000",
            bankRate: "0.00000",
            bankStartTime: 0,
          },
        });

        // Update sender's last activity
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
      const updatedSender = await Database.getUser(
        interaction.guild.id,
        interaction.user.id,
        true
      );

      const updatedRecipient = await Database.getUser(
        interaction.guild.id,
        targetUser.id,
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
        database: { ...updatedSender },
        amount: amountInt,
        isTransfer: true,
        recipient: {
          id: targetUser.id,
          username: targetUser.username,
          displayName: targetUser.displayName,
          avatarURL: targetUser.displayAvatarURL({
            extension: "png",
            size: 1024,
          }),
          balance: updatedRecipient.economy?.balance || 0,
        },
        returnDominant: true,
      });

      const attachment = new AttachmentBuilder(pngBuffer, {
        name: `transfer.png`,
      });

      let transfer_embed = new EmbedBuilder()
        .setColor(dominantColor?.embedColor)
        .setTimestamp()
        .setImage(`attachment://transfer.png`)
        .setAuthor({
          name: i18n.__("commands.economy.transfer.title"),
          iconURL: interaction.user.displayAvatarURL(),
        });

      await interaction.editReply({
        embeds: [transfer_embed],
        files: [attachment],
      });
    } catch (error) {
      console.error("Error in transfer command:", error);
      await interaction.editReply({
        content: i18n.__("commands.economy.transfer.error"),
        ephemeral: true,
      });
    }
  },
};
