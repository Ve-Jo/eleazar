import { AttachmentBuilder, SlashCommandSubcommandBuilder } from "discord.js";
import hubClient from "../../api/hubClient.ts";
import { generateImage } from "../../utils/imageGenerator.ts";
import { ComponentBuilder } from "../../utils/componentConverter.ts";
import type { TranslatorLike, InteractionLike } from "../../types/index.ts";

type EconomyUserData = {
  economy?: {
    balance?: number;
  };
};

const command = {
  data: (): SlashCommandSubcommandBuilder => {
    return new SlashCommandSubcommandBuilder()
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

  async execute(interaction: InteractionLike, i18n: TranslatorLike): Promise<void> {
    const builderMode = "v2";
    await interaction.deferReply();

    const targetUser = interaction.options.getUser!("user");
    const amount = interaction.options.getString!("amount");

    if (!targetUser || !amount) {
      await interaction.editReply({
        content: await i18n.__("commands.economy.transfer.invalidAmount"),
        ephemeral: true,
      });
      return;
    }

    if (targetUser.id === interaction.user.id) {
      await interaction.editReply({
        content: await i18n.__("commands.economy.transfer.cannotTransferToSelf"),
        ephemeral: true,
      });
      return;
    }

    try {
      await Promise.all([
        (hubClient as any).ensureGuildUser(interaction.guild.id, interaction.user.id),
        (hubClient as any).ensureGuildUser(interaction.guild.id, targetUser.id),
      ]);

      const senderData = (await (hubClient as any).getUser(
        interaction.guild.id,
        interaction.user.id,
        true
      )) as EconomyUserData;

      const recipientData = (await (hubClient as any).getUser(
        interaction.guild.id,
        targetUser.id,
        true
      )) as EconomyUserData;

      let amountInt = 0;
      if (amount === "all") {
        amountInt = Number(senderData.economy?.balance || 0);
      } else if (amount === "half") {
        amountInt = Math.floor(Number(senderData.economy?.balance || 0) / 2);
      } else {
        amountInt = parseFloat(amount);
        if (Number.isNaN(amountInt)) {
          await interaction.editReply({
            content: await i18n.__("commands.economy.transfer.invalidAmount"),
            ephemeral: true,
          });
          return;
        }
      }

      if (!senderData.economy || Number(senderData.economy.balance || 0) < amountInt) {
        await interaction.editReply({
          content: await i18n.__("commands.economy.transfer.insufficientFunds"),
          ephemeral: true,
        });
        return;
      }

      if (amountInt <= 0) {
        await interaction.editReply({
          content: await i18n.__("commands.economy.transfer.amountGreaterThanZero"),
          ephemeral: true,
        });
        return;
      }

      amountInt = parseFloat((Number(amountInt) || 0).toFixed(5));

      await (hubClient as any).transferBalance(
        interaction.guild.id,
        interaction.user.id,
        targetUser.id,
        amountInt
      );

      const updatedSender = (await (hubClient as any).getUser(
        interaction.guild.id,
        interaction.user.id,
        true
      )) as Record<string, unknown>;

      const updatedRecipient = (await (hubClient as any).getUser(
        interaction.guild.id,
        targetUser.id,
        true
      )) as EconomyUserData;

      const generated = (await generateImage(
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
            recipient: {
              id: targetUser.id,
              username: targetUser.username,
              displayName: targetUser.username,
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
        i18n as any
      )) as [Buffer, unknown];

      const buffer = generated?.[0];
      const dominantColor = generated?.[1];

      const attachment = new AttachmentBuilder(buffer, {
        name: "transfer_receipt.png",
      });

      const transferComponent = new ComponentBuilder({
        dominantColor: dominantColor as any,
        mode: builderMode,
      })
        .addText(String(await i18n.__("commands.economy.transfer.title")), "header3")
        .addImage("attachment://transfer_receipt.png")
        .addTimestamp(interaction.locale);

      const replyOptions = transferComponent.toReplyOptions({
        files: [attachment],
      });

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

export default command;
