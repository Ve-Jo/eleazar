import {
  AttachmentBuilder,
  SlashCommandSubcommandBuilder,
  MessageFlags,
} from "discord.js";
import hubClient from "../../api/hubClient.js";
import { generateImage } from "../../utils/imageGenerator.js";
import { ComponentBuilder } from "../../utils/componentConverter.js";

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
    // Always use v2 builder mode
    const builderMode = "v2";

    // Always defer reply
    await interaction.deferReply();

    const targetUser = interaction.options.getUser("user");
    const amount = interaction.options.getString("amount");

    // Prevent self-transfers
    if (targetUser.id === interaction.user.id) {
      return interaction.editReply({
        content: await i18n.__(
          "commands.economy.transfer.cannotTransferToSelf"
        ),
        ephemeral: true,
      });
    }

    try {
      // Ensure both users exist in database before fetching data
      await Promise.all([
        hubClient.ensureGuildUser(interaction.guild.id, interaction.user.id),
        hubClient.ensureGuildUser(interaction.guild.id, targetUser.id),
      ]);

      // Get sender user data with all relations
      const senderData = await hubClient.getUser(
        interaction.guild.id,
        interaction.user.id,
        true
      );

      // Get recipient user data
      const recipientData = await hubClient.getUser(
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
            content: await i18n.__("commands.economy.transfer.invalidAmount"),
            ephemeral: true,
          });
        }
      }

      // Validate amount
      if (!senderData.economy || senderData.economy.balance < amountInt) {
        return interaction.editReply({
          content: await i18n.__("commands.economy.transfer.insufficientFunds"),
          ephemeral: true,
        });
      }
      if (amountInt <= 0) {
        return interaction.editReply({
          content: await i18n.__(
            "commands.economy.transfer.amountGreaterThanZero"
          ),
          ephemeral: true,
        });
      }

      // Ensure 5 decimal precision
      amountInt = parseFloat((Number(amountInt) || 0).toFixed(5));

      // Perform transfer operation
      await hubClient.transferBalance(
        interaction.guild.id,
        interaction.user.id,
        targetUser.id,
        amountInt
      );

      // Get updated user data (users already ensured above)
      const updatedSender = await hubClient.getUser(
        interaction.guild.id,
        interaction.user.id,
        true
      );

      const updatedRecipient = await hubClient.getUser(
        interaction.guild.id,
        targetUser.id,
        true
      );

      // Generate transfer confirmation image
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
            recipient: {
              id: targetUser.id,
              username: targetUser.username,
              displayName: targetUser.username, // Or fetch member displayname if needed
              avatarURL: targetUser.displayAvatarURL({
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
        },
        { image: 2, emoji: 1 },
        i18n
      );

      const attachment = new AttachmentBuilder(buffer, {
        name: `transfer_receipt.png`,
      });

      const transferComponent = new ComponentBuilder({
        dominantColor,
        mode: builderMode,
      })
        .addText(await i18n.__("commands.economy.transfer.title"), "header3")
        .addImage("attachment://transfer_receipt.png")
        .addTimestamp(interaction.locale);

      // Prepare reply options
      const replyOptions = transferComponent.toReplyOptions({
        files: [attachment],
      });

      // Always edit reply
      await interaction.editReply(replyOptions);
    } catch (error) {
      console.error("Error executing transfer command:", error);
      const errorOptions = {
        content: await i18n.__("commands.economy.transfer.error"),
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
