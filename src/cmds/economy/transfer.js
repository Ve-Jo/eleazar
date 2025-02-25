import {
  SlashCommandSubcommand,
  SlashCommandOption,
  OptionType,
  I18nCommandBuilder,
} from "../../utils/builders/index.js";
import { EmbedBuilder, AttachmentBuilder } from "discord.js";
import Database from "../../database/client.js";
import { generateImage } from "../../utils/imageGenerator.js";

export default {
  data: () => {
    const i18nBuilder = new I18nCommandBuilder("economy", "transfer");

    const subcommand = new SlashCommandSubcommand({
      name: i18nBuilder.getSimpleName(i18nBuilder.translate("name")),
      description: i18nBuilder.translate("description"),
      name_localizations: i18nBuilder.getLocalizations("name"),
      description_localizations: i18nBuilder.getLocalizations("description"),
    });

    // Add user option
    const userOption = new SlashCommandOption({
      type: OptionType.USER,
      name: "user",
      description: i18nBuilder.translateOption("user", "description"),
      required: true,
      name_localizations: i18nBuilder.getOptionLocalizations("user", "name"),
      description_localizations: i18nBuilder.getOptionLocalizations(
        "user",
        "description"
      ),
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

    subcommand.addOption(userOption);
    subcommand.addOption(amountOption);

    return subcommand;
  },
  async execute(interaction, i18n) {
    await interaction.deferReply();
    const targetUser = interaction.options.getUser("user");
    const amount = interaction.options.getString("amount");

    // Prevent self-transfers
    if (targetUser.id === interaction.user.id) {
      return interaction.editReply({
        content: i18n.__("economy.transfer.cannotTransferToSelf"),
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
            content: i18n.__("economy.transfer.invalidAmount"),
            ephemeral: true,
          });
        }
      }

      // Validate amount
      if (!senderData.economy || senderData.economy.balance < amountInt) {
        return interaction.editReply({
          content: i18n.__("economy.transfer.insufficientFunds"),
          ephemeral: true,
        });
      }
      if (amountInt <= 0) {
        return interaction.editReply({
          content: i18n.__("economy.transfer.amountGreaterThanZero"),
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
          name: i18n.__("economy.transfer.title"),
          iconURL: interaction.user.displayAvatarURL(),
        });

      await interaction.editReply({
        embeds: [transfer_embed],
        files: [attachment],
      });
    } catch (error) {
      console.error("Error in transfer command:", error);
      await interaction.editReply({
        content: i18n.__("economy.transfer.error"),
        ephemeral: true,
      });
    }
  },
  localization_strings: {
    name: {
      en: "transfer",
      ru: "перевод",
      uk: "переказ",
    },
    description: {
      en: "Transfer money to another user",
      ru: "Перевести деньги другому пользователю",
      uk: "Переказати гроші іншому користувачу",
    },
    options: {
      user: {
        name: {
          en: "user",
          ru: "пользователь",
          uk: "користувач",
        },
        description: {
          en: "User to transfer money to",
          ru: "Пользователь, которому перевести деньги",
          uk: "Користувач, якому переказати гроші",
        },
      },
      amount: {
        name: {
          en: "amount",
          ru: "сумма",
          uk: "сума",
        },
        description: {
          en: "Amount to transfer (or 'all', 'half')",
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
};
