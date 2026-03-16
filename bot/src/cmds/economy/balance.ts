import { AttachmentBuilder, SlashCommandSubcommandBuilder } from "discord.js";
import hubClient from "../../api/hubClient.ts";
import { generateImage } from "../../utils/imageGenerator.ts";
import { ComponentBuilder } from "../../utils/componentConverter.ts";

type TranslatorLike = {
  __: (key: string, vars?: Record<string, unknown>) => Promise<string | unknown>;
};

type UserLike = {
  id: string;
  username: string;
  displayName: string;
  displayAvatarURL: (options?: Record<string, unknown>) => string;
};

type GuildLike = {
  id: string;
  name: string;
  iconURL: (options?: Record<string, unknown>) => string | null;
};

type GenericRecord = Record<string, any>;

type InteractionLike = {
  replied?: boolean;
  deferred?: boolean;
  locale: string;
  member: UserLike;
  guild: GuildLike;
  client: {
    users: {
      fetch: (userId: string) => Promise<{ username?: string; displayAvatarURL: (options?: Record<string, unknown>) => string } | null>;
    };
  };
  options: {
    getMember: (name: string) => UserLike | null;
  };
  deferReply: () => Promise<unknown>;
  editReply: (payload: unknown) => Promise<unknown>;
  reply: (payload: unknown) => Promise<unknown>;
};

const command = {
  data: (): SlashCommandSubcommandBuilder => {
    return new SlashCommandSubcommandBuilder()
      .setName("balance")
      .setDescription("Check balance")
      .addUserOption((option) =>
        option.setName("user").setDescription("User to check").setRequired(false)
      );
  },

  localization_strings: {
    command: {
      name: {
        ru: "баланс",
        uk: "рахунок",
      },
      description: {
        ru: "Посмотреть баланс",
        uk: "Переглянути баланс",
      },
    },
    options: {
      user: {
        name: {
          ru: "пользователь",
          uk: "користувач",
        },
        description: {
          ru: "Пользователь для проверки",
          uk: "Користувач для перевірки",
        },
      },
    },
    title: {
      en: "Balance",
      ru: "Баланс",
      uk: "Баланс",
    },
  },

  async execute(interaction: InteractionLike, i18n: TranslatorLike): Promise<void> {
    const builderMode = "v2";
    await interaction.deferReply();

    const user = interaction.options.getMember("user") || interaction.member;

    const marriageStatus = await (hubClient as any).getMarriageStatus(
      interaction.guild.id,
      user.id
    );

    let partnerData: GenericRecord | null = null;
    let combinedBankBalance = 0;

    await (hubClient as any).ensureGuildUser(interaction.guild.id, user.id);
    const userData = (await (hubClient as any).getUser(
      interaction.guild.id,
      user.id
    )) as GenericRecord | null;

    if (!userData) {
      await interaction.editReply({
        content: await i18n.__("commands.economy.userNotFound"),
        ephemeral: true,
      });
      return;
    }

    let individualBankBalance = 0;
    if (userData.economy) {
      const activeBankBalance = await (hubClient as any).calculateBankBalance(userData);
      const balanceData = await (hubClient as any).getBalance(interaction.guild.id, user.id);
      const distributedBalance = Number(balanceData?.bankDistributed || 0);

      individualBankBalance = Number(activeBankBalance) + distributedBalance;
      userData.economy.bankBalance = individualBankBalance;
      combinedBankBalance += Number(individualBankBalance);
    }

    if (marriageStatus && marriageStatus.status === "MARRIED") {
      await (hubClient as any).ensureGuildUser(
        interaction.guild.id,
        marriageStatus.partnerId
      );
      partnerData = (await (hubClient as any).getUser(
        interaction.guild.id,
        marriageStatus.partnerId
      )) as GenericRecord;
      if (partnerData?.economy) {
        const partnerBankBalance = await (hubClient as any).calculateBankBalance(partnerData);
        partnerData.economy.bankBalance = partnerBankBalance;
        combinedBankBalance += Number(partnerBankBalance);
      }
      userData.combinedBankBalance = Number(combinedBankBalance).toFixed(5);
      userData.individualBankBalance = Number(individualBankBalance).toFixed(5);
      userData.marriageStatus = marriageStatus;

      try {
        const partnerDiscordUser = await interaction.client.users.fetch(marriageStatus.partnerId);
        userData.partnerAvatarUrl = partnerDiscordUser?.displayAvatarURL({
          extension: "png",
          size: 64,
        });
        userData.partnerUsername = partnerDiscordUser?.username || partnerData?.username || "Partner";
      } catch (error) {
        console.error(`Failed to fetch partner Discord user (${marriageStatus.partnerId}):`, error);
        userData.partnerAvatarUrl = "https://cdn.discordapp.com/embed/avatars/0.png";
        userData.partnerUsername = partnerData?.username || "Partner";
      }
    }

    let chatLevelData: GenericRecord | null = null;
    let gameLevelData: GenericRecord | null = null;

    if (userData.Level) {
      const chatXP = Number(userData.Level.xp || 0);
      chatLevelData = (hubClient as any).calculateLevel(chatXP);

      const gameXP = Number(userData.Level.gameXp || 0);
      gameLevelData = (hubClient as any).calculateLevel(gameXP);
    }

    let guildVault: GenericRecord | null = null;
    let userVaultDistributions: unknown = [];
    const guildId = interaction.guild.id;
    const userId = user.id;

    try {
      guildVault = (await (hubClient as any).getGuildVault(guildId)) as GenericRecord | null;
      userVaultDistributions = await (hubClient as any).getUserVaultDistributions(
        guildId,
        userId,
        5
      );
    } catch (error) {
      console.warn(`Failed to get guild vault info for guild ${guildId}:`, error);
    }

    let distributions: GenericRecord[] = [];
    if (typeof userVaultDistributions === "string") {
      try {
        distributions = JSON.parse(userVaultDistributions) as GenericRecord[];
      } catch (error) {
        console.error("Failed to parse JSON string:", error);
        distributions = [];
      }
    } else if (Array.isArray(userVaultDistributions)) {
      distributions = userVaultDistributions as GenericRecord[];
    } else if (userVaultDistributions && typeof userVaultDistributions === "object") {
      const wrapped = userVaultDistributions as GenericRecord;
      if (Array.isArray(wrapped.data)) {
        distributions = wrapped.data;
      } else if (Array.isArray(wrapped.distributions)) {
        distributions = wrapped.distributions;
      }
    }

    const normalizedDistributions = distributions.map((dist) => ({
      amount: parseFloat(String(dist.amount)) || 0,
      timestamp:
        dist.timestamp ||
        (dist.distributionDate ? new Date(dist.distributionDate).getTime() : Date.now()),
      type: dist.type || "distribution",
      id: dist.id,
      source: dist.source,
      triggeredBy: dist.triggeredBy,
    }));

    let totalVaultEarnings = 0;
    for (const dist of normalizedDistributions) {
      totalVaultEarnings += parseFloat(String(dist.amount)) || 0;
    }

    userData.vaultEarnings = totalVaultEarnings;
    userData.vaultDistributions = normalizedDistributions;
    userData.guild = {
      vault: guildVault,
    };

    const generated = (await generateImage(
      "Balance",
      {
        interaction: {
          user: {
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            avatarURL: user.displayAvatarURL({
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
        returnDominant: true,
        database: {
          ...userData,
          levelProgress: {
            chat: chatLevelData,
            game: gameLevelData,
          },
        }
      },
      { image: 2, emoji: 2 },
      i18n as any
    )) as [Buffer | undefined, unknown];

    const buffer = generated?.[0];
    const dominantColor = generated?.[1];

    if (!buffer) {
      console.error("Error in balance command: Buffer is undefined or null");
      const errorOptions = {
        content: await i18n.__("commands.economy.balance.error"),
        ephemeral: true,
      };

      if (interaction.replied || interaction.deferred) {
        await interaction.editReply(errorOptions).catch(() => {});
      } else {
        await interaction.reply(errorOptions).catch(() => {});
      }
      return;
    }

    const attachment = new AttachmentBuilder(buffer, {
      name: "balance.png",
    });

    const balanceComponent = new ComponentBuilder({
      dominantColor: dominantColor as any,
      mode: builderMode,
    })
      .addText(String(await i18n.__("commands.economy.balance.title")), "header3")
      .addImage("attachment://balance.png")
      .addTimestamp(interaction.locale);

    const replyOptions = balanceComponent.toReplyOptions({
      files: [attachment],
    });

    await interaction.editReply(replyOptions);
  },
};

export default command;
