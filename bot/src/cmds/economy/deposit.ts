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
      .setName("deposit")
      .setDescription("Deposit money into your bank account")
      .addStringOption((option) =>
        option
          .setName("amount")
          .setDescription("Amount to deposit (or 'all', 'half')")
          .setRequired(true)
      );
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
    partnerDepositDM: {
      en: "🏧 Your partner {{user}} deposited {{amount}} into your shared bank balance in {{guild}}.",
      ru: "🏧 Ваш партнер {{user}} внес {{amount}} на ваш общий банковский баланс на сервере {{guild}}.",
      uk: "🏧 Ваш партнер {{user}} вніс {{amount}} на ваш спільний банківський баланс на сервері {{guild}}.",
    },
  },

  async execute(interaction: InteractionLike, i18n: TranslatorLike): Promise<void> {
    const builderMode = "v2";
    await interaction.deferReply();

    const guildId = interaction.guild.id;
    const userId = interaction.user.id;

    try {
      const amountStr = interaction.options.getString("amount");
      if (!amountStr) {
        await interaction.editReply({
          content: await i18n.__("commands.economy.deposit.invalidAmount"),
          ephemeral: true,
        });
        return;
      }

      const marriageStatus = await (hubClient as any).getMarriageStatus(guildId, userId);
      let partnerData: GenericUserData | null = null;

      await (hubClient as any).ensureGuildUser(guildId, userId);

      const initialUserData = (await (hubClient as any).getUser(
        guildId,
        userId,
        true
      )) as GenericUserData | null;

      if (!initialUserData?.economy) {
        await interaction.editReply({
          content: await i18n.__("commands.economy.deposit.noBankAccount"),
          ephemeral: true,
        });
        return;
      }

      if (marriageStatus && marriageStatus.status === "MARRIED") {
        await (hubClient as any).ensureGuildUser(guildId, marriageStatus.partnerId);
        partnerData = (await (hubClient as any).getUser(
          guildId,
          marriageStatus.partnerId,
          true
        )) as GenericUserData;
      }

      let amountToDeposit = 0;
      const userBalance = Number(initialUserData.economy?.balance || 0);

      if (amountStr === "all") {
        amountToDeposit = userBalance;
      } else if (amountStr === "half") {
        amountToDeposit = userBalance / 2;
      } else {
        amountToDeposit = parseFloat(amountStr);
        if (Number.isNaN(amountToDeposit)) {
          await interaction.editReply({
            content: await i18n.__("commands.economy.deposit.invalidAmount"),
            ephemeral: true,
          });
          return;
        }
      }

      amountToDeposit = parseFloat((Number(amountToDeposit) || 0).toFixed(5));

      if (userBalance < amountToDeposit) {
        await interaction.editReply({
          content: await i18n.__("commands.economy.deposit.notEnoughMoney"),
          ephemeral: true,
        });
        return;
      }

      if (amountToDeposit <= 0) {
        await interaction.editReply({
          content: await i18n.__("commands.economy.deposit.amountGreaterThanZero"),
          ephemeral: true,
        });
        return;
      }

      await (hubClient as any).deposit(guildId, userId, amountToDeposit);

      const updatedUser = (await (hubClient as any).getUser(guildId, userId, true)) as GenericUserData;

      const userActiveResult = await (hubClient as any).calculateBankBalance(updatedUser);
      const userBalanceData = await (hubClient as any).getBalance(guildId, userId);
      const userDistributedBalance = Number(userBalanceData?.bankDistributed || 0);
      // Handle new BankResult format
      const userActiveBalance = userActiveResult && typeof userActiveResult === "object" && "balance" in userActiveResult
        ? Number(userActiveResult.balance)
        : Number(userActiveResult || 0);
      const currentBankBalance = userActiveBalance + userDistributedBalance;

      if (marriageStatus && marriageStatus.status === "MARRIED" && partnerData) {
        const updatedPartner = (await (hubClient as any).getUser(
          guildId,
          marriageStatus.partnerId,
          true
        )) as GenericUserData;
        const partnerActiveResult = await (hubClient as any).calculateBankBalance(updatedPartner);
        const partnerBalanceData = await (hubClient as any).getBalance(
          guildId,
          marriageStatus.partnerId
        );
        const partnerDistributedBalance = Number(partnerBalanceData?.bankDistributed || 0);
        // Handle new BankResult format
        const partnerActiveBalance = partnerActiveResult && typeof partnerActiveResult === "object" && "balance" in partnerActiveResult
          ? Number(partnerActiveResult.balance)
          : Number(partnerActiveResult || 0);
        const partnerBankBalance = partnerActiveBalance + partnerDistributedBalance;
        const combinedBankBalance = Number(currentBankBalance) + partnerBankBalance;

        updatedUser.partnerData = updatedPartner;
        updatedUser.marriageStatus = marriageStatus;
        updatedUser.combinedBankBalance = combinedBankBalance.toFixed(5);
      } else {
        updatedUser.combinedBankBalance = (Number(currentBankBalance) || 0).toFixed(5);
      }

      if (updatedUser.economy) {
        updatedUser.economy.bankBalance = currentBankBalance;
      }

      let guildVault: Record<string, unknown> | null = null;
      const feeAmount = amountToDeposit * 0.05;

      try {
        guildVault = (await (hubClient as any).getGuildVault(guildId)) as Record<string, unknown> | null;
        if (guildVault) {
          updatedUser.guild = {
            vault: guildVault,
          };
        }
      } catch (error) {
        console.warn(`Failed to get guild vault info for deposit in guild ${guildId}:`, error);
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
          isDeposit: true,
          isTransfer: false,
          amount: amountToDeposit,
          afterBalance: updatedUser.economy?.balance,
          afterBank: updatedUser.economy?.bankBalance,
          returnDominant: true,
          database: updatedUser,
          partnerData,
          guildVault,
          feeAmount,
          type: "deposit",
          dominantColor: "user",
        },
        { image: 2, emoji: 1 },
        i18n as any
      )) as [Buffer, unknown];

      const buffer = generated?.[0];
      const dominantColor = generated?.[1];

      const attachment = new AttachmentBuilder(buffer, {
        name: "deposit_receipt.png",
      });

      const receiptComponent = new ComponentBuilder({
        dominantColor: dominantColor as any,
        mode: builderMode,
      })
        .addText(String(await i18n.__("commands.economy.deposit.title")), "header3")
        .addText(
          String(
            await i18n.__("commands.economy.deposit.depositSuccess", {
              amount: amountToDeposit.toFixed(2),
            })
          )
        )
        .addImage("attachment://deposit_receipt.png")
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
              content: await i18n.__("commands.economy.deposit.partnerDepositDM", {
                user: interaction.user.tag,
                amount: amountToDeposit.toFixed(2),
                guild: interaction.guild.name,
              }),
            });
          }
        } catch (dmError) {
          console.error(`Failed to send deposit DM to partner ${partnerData.id}:`, dmError);
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

export default command;
