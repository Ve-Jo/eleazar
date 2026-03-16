import { AttachmentBuilder, SlashCommandSubcommandBuilder } from "discord.js";
import hubClient from "../../api/hubClient.ts";
import { generateImage } from "../../utils/imageGenerator.ts";
import { ComponentBuilder } from "../../utils/componentConverter.ts";

type TranslatorLike = {
  __: (key: string, vars?: Record<string, unknown>) => Promise<string | unknown>;
};

type UserLike = {
  id: string;
  tag?: string;
  username: string;
  displayName: string;
  displayAvatarURL: (options?: Record<string, unknown>) => string;
};

type GuildLike = {
  id: string;
  name: string;
  iconURL: (options?: Record<string, unknown>) => string | null;
};

type EconomyData = {
  balance?: number;
  bankBalance?: number;
};

type GenericUserData = Record<string, any> & {
  id?: string;
  economy?: EconomyData;
  guild?: Record<string, unknown>;
  partnerData?: Record<string, unknown> | null;
  marriageStatus?: Record<string, unknown> | null;
  combinedBankBalance?: string;
};

type InteractionLike = {
  replied?: boolean;
  deferred?: boolean;
  locale: string;
  user: UserLike;
  guild: GuildLike;
  client: {
    users: {
      fetch: (userId: string) => Promise<{ send: (payload: unknown) => Promise<unknown> } | null>;
    };
  };
  options: {
    getString: (name: string) => string | null;
  };
  deferReply: () => Promise<unknown>;
  editReply: (payload: unknown) => Promise<unknown>;
  reply: (payload: unknown) => Promise<unknown>;
};

const command = {
  data: (): SlashCommandSubcommandBuilder => {
    return new SlashCommandSubcommandBuilder()
      .setName("withdraw")
      .setDescription("Withdraw money from bank")
      .addStringOption((option) =>
        option
          .setName("amount")
          .setDescription("Amount to withdraw (or 'all', 'half')")
          .setRequired(true)
      );
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
    partnerWithdrawDM: {
      en: "🏧 Your partner {{user}} withdrew {{amount}} from your shared bank balance in {{guild}}. Your contribution to this withdrawal was {{partnerAmount}}.",
      ru: "🏧 Ваш партнер {{user}} снял {{amount}} с вашего общего банковского баланса на сервере {{guild}}. Ваш вклад в это снятие составил {{partnerAmount}}.",
      uk: "🏧 Ваш партнер {{user}} зняв {{amount}} з вашого спільного банківського балансу на сервері {{guild}}. Ваш внесок у це зняття склав {{partnerAmount}}.",
    },
  },

  async execute(interaction: InteractionLike, i18n: TranslatorLike): Promise<void> {
    const builderMode = "v2";
    await interaction.deferReply();

    const amount = interaction.options.getString("amount");
    const guildId = interaction.guild.id;
    const userId = interaction.user.id;

    if (!amount) {
      await interaction.editReply({
        content: await i18n.__("commands.economy.withdraw.invalidAmount"),
        ephemeral: true,
      });
      return;
    }

    try {
      const marriageStatus = await (hubClient as any).getMarriageStatus(guildId, userId);
      let partnerData: GenericUserData | null = null;
      let userBankBalance = 0;

      await (hubClient as any).ensureGuildUser(guildId, userId);

      const initialUserData = (await (hubClient as any).getUser(guildId, userId, true)) as GenericUserData;

      if (!initialUserData?.economy) {
        await interaction.editReply({
          content: await i18n.__("commands.economy.withdraw.noBankAccount"),
          ephemeral: true,
        });
        return;
      }

      const activeBankBalance = await (hubClient as any).calculateBankBalance(initialUserData);
      const balanceData = await (hubClient as any).getBalance(guildId, userId);
      const distributedBalance = Number(balanceData?.bankDistributed || 0);
      userBankBalance = Number(activeBankBalance) + distributedBalance;

      if (marriageStatus && marriageStatus.status === "MARRIED") {
        await (hubClient as any).ensureGuildUser(guildId, marriageStatus.partnerId);
        partnerData = (await (hubClient as any).getUser(
          guildId,
          marriageStatus.partnerId,
          true
        )) as GenericUserData;
      }

      if (userBankBalance === 0) {
        await interaction.editReply({
          content: await i18n.__("commands.economy.withdraw.noBankAccount"),
          ephemeral: true,
        });
        return;
      }

      let amountToWithdraw = 0;
      if (amount === "all") {
        amountToWithdraw = userBankBalance;
      } else if (amount === "half") {
        amountToWithdraw = userBankBalance / 2;
      } else {
        amountToWithdraw = parseFloat(amount);
        if (Number.isNaN(amountToWithdraw)) {
          await interaction.editReply({
            content: await i18n.__("commands.economy.withdraw.invalidAmount"),
            ephemeral: true,
          });
          return;
        }
      }

      amountToWithdraw = parseFloat((Number(amountToWithdraw) || 0).toFixed(5));

      if (userBankBalance < amountToWithdraw) {
        await interaction.editReply({
          content: await i18n.__("commands.economy.withdraw.insufficientFunds"),
          ephemeral: true,
        });
        return;
      }

      if (amountToWithdraw <= 0) {
        await interaction.editReply({
          content: await i18n.__("commands.economy.withdraw.amountGreaterThanZero"),
          ephemeral: true,
        });
        return;
      }

      await (hubClient as any).withdraw(guildId, userId, amountToWithdraw);

      const finalUserData = (await (hubClient as any).getUser(guildId, userId, true)) as GenericUserData;

      let guildVault: Record<string, unknown> | null = null;
      const feeAmount = amountToWithdraw * 0.05;

      try {
        guildVault = (await (hubClient as any).getGuildVault(guildId)) as Record<string, unknown> | null;
        if (guildVault) {
          finalUserData.guild = {
            vault: guildVault,
          };
        }
      } catch (error) {
        console.warn(`Failed to get guild vault info for withdraw in guild ${guildId}:`, error);
      }

      if (marriageStatus && marriageStatus.status === "MARRIED" && partnerData) {
        const updatedPartner = (await (hubClient as any).getUser(
          guildId,
          marriageStatus.partnerId,
          true
        )) as GenericUserData;
        const refreshedUserActiveBalance = await (hubClient as any).calculateBankBalance(finalUserData);
        const refreshedUserBalanceData = await (hubClient as any).getBalance(guildId, userId);
        const refreshedUserDistributedBalance = Number(
          refreshedUserBalanceData?.bankDistributed || 0
        );
        const refreshedUserBankBalance = Number(refreshedUserActiveBalance) + refreshedUserDistributedBalance;

        const partnerActiveBalance = await (hubClient as any).calculateBankBalance(updatedPartner);
        const partnerBalanceData = await (hubClient as any).getBalance(
          guildId,
          marriageStatus.partnerId
        );
        const partnerDistributedBalance = Number(partnerBalanceData?.bankDistributed || 0);
        const partnerBankBalance = Number(partnerActiveBalance) + partnerDistributedBalance;
        const combinedBankBalance = refreshedUserBankBalance + partnerBankBalance;

        finalUserData.partnerData = updatedPartner;
        finalUserData.marriageStatus = marriageStatus;
        finalUserData.combinedBankBalance = Number(combinedBankBalance).toFixed(5);
        partnerData = updatedPartner;
      } else {
        const refreshedUserActiveBalance = await (hubClient as any).calculateBankBalance(finalUserData);
        const refreshedUserBalanceData = await (hubClient as any).getBalance(guildId, userId);
        const refreshedUserDistributedBalance = Number(
          refreshedUserBalanceData?.bankDistributed || 0
        );
        const refreshedUserBankBalance = Number(refreshedUserActiveBalance) + refreshedUserDistributedBalance;
        finalUserData.combinedBankBalance = Number(refreshedUserBankBalance).toFixed(5);
      }

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
          isTransfer: false,
          database: finalUserData,
          partnerData,
          guildVault,
          feeAmount,
          type: "withdraw",
          amount: amountToWithdraw,
          dominantColor: "user",
          returnDominant: true,
        },
        { image: 2, emoji: 1 },
        i18n as any
      )) as [Buffer, unknown];

      const buffer = generated?.[0];
      const dominantColor = generated?.[1];

      const attachment = new AttachmentBuilder(buffer, {
        name: "withdraw_receipt.png",
      });

      const receiptComponent = new ComponentBuilder({
        dominantColor: dominantColor as any,
        mode: builderMode,
      })
        .addText(String(await i18n.__("commands.economy.withdraw.title")), "header3")
        .addImage("attachment://withdraw_receipt.png")
        .addTimestamp(interaction.locale);

      const replyOptions = receiptComponent.toReplyOptions({
        files: [attachment],
      });

      await interaction.editReply(replyOptions);

      if (partnerData?.id) {
        try {
          const partnerDiscordUser = await interaction.client.users.fetch(partnerData.id);
          if (partnerDiscordUser) {
            await partnerDiscordUser.send({
              content: await i18n.__("commands.economy.withdraw.partnerWithdrawDM", {
                user: interaction.user.tag,
                amount: amountToWithdraw.toFixed(2),
                partnerAmount: "0.00",
                guild: interaction.guild.name,
              }),
            });
          }
        } catch (dmError) {
          console.error(`Failed to send withdraw DM to partner ${partnerData.id}:`, dmError);
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

export default command;
