import { AttachmentBuilder, SlashCommandSubcommandBuilder } from "discord.js";
import hubClient from "../../api/hubClient.ts";
import { generateImage } from "../../utils/imageGenerator.ts";
import { ComponentBuilder } from "../../utils/componentConverter.ts";
import { CRATE_TYPES, UPGRADES } from "../../../../hub/shared/src/domain.ts";
import { loadGames } from "../../utils/loadGames.ts";
import type { TranslatorLike, InteractionLike, UserLike } from "../../types/index.ts";

type GenericRecord = Record<string, any>;

type UpgradeConfig = {
  basePrice: number;
  priceMultiplier: number;
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

    const user = interaction.options.getMember!("user") || interaction.member!;

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
    let bankCycleData = null;
    if (userData.economy) {
      const bankResult = await (hubClient as any).calculateBankBalance(userData);
      const balanceData = await (hubClient as any).getBalance(interaction.guild.id, user.id);
      const distributedBalance = Number(balanceData?.bankDistributed || 0);

      // Handle new BankResult format with cycle info
      if (bankResult && typeof bankResult === "object" && "balance" in bankResult) {
        individualBankBalance = Number(bankResult.balance) + distributedBalance;
        
        // Store cycle data for Balance component
        if (bankResult.maxInactiveMs > 0) {
          bankCycleData = {
            cycleCount: bankResult.cycleCount,
            cycleComplete: bankResult.cycleComplete,
            maxInactiveMs: bankResult.maxInactiveMs,
            timeIntoCycle: bankResult.timeIntoCycle,
            annualRate: bankResult.annualRate,
          };
        }
      } else {
        // Fallback for old format
        individualBankBalance = Number(bankResult || 0) + distributedBalance;
      }
      
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
        const partnerBankResult = await (hubClient as any).calculateBankBalance(partnerData);
        // Handle new BankResult format
        const partnerBankBalance = partnerBankResult && typeof partnerBankResult === "object" && "balance" in partnerBankResult
          ? Number(partnerBankResult.balance)
          : Number(partnerBankResult || 0);
        partnerData.economy.bankBalance = partnerBankBalance;
        combinedBankBalance += partnerBankBalance;
      }
      userData.combinedBankBalance = Number(combinedBankBalance).toFixed(5);
      userData.individualBankBalance = Number(individualBankBalance).toFixed(5);
      userData.marriageStatus = marriageStatus;

      try {
        const partnerDiscordUser = await interaction.client?.users.fetch(marriageStatus.partnerId) as UserLike | null;
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
    let voiceLevelData: GenericRecord | null = null;
    let gameLevelData: GenericRecord | null = null;
    let chatRank: { rank: number; total: number } | null = null;
    let voiceRank: { rank: number; total: number } | null = null;
    let gameRank: { rank: number; total: number } | null = null;

    if (userData.Level) {
      const chatXP = Number(userData.Level.xp || 0);
      chatLevelData = (hubClient as any).calculateLevel(chatXP);

      const voiceXP = Number(userData.Level.voiceXp || 0);
      voiceLevelData = (hubClient as any).calculateLevel(voiceXP);

      const gameXP = Number(userData.Level.gameXp || 0);
      gameLevelData = (hubClient as any).calculateLevel(gameXP);
    }

    try {
      const guildUsers = (await (hubClient as any).getGuildUsers(interaction.guild.id)) as GenericRecord[];
      const computeRank = (users: GenericRecord[], xpField: string, userId: string) => {
        const scored = users
          .map((u) => ({ id: u.id || u.userId, xp: Number(u?.Level?.[xpField] || 0) }))
          .filter((entry) => entry.id && Number.isFinite(entry.xp));
        const sorted = scored.sort((a, b) => {
          if (b.xp === a.xp) return (a.id || "").localeCompare(b.id || "");
          return b.xp - a.xp;
        });
        const idx = sorted.findIndex((entry) => entry.id === userId);
        if (idx === -1) return null;
        return { rank: idx + 1, total: sorted.length };
      };

      chatRank = computeRank(guildUsers, "xp", user.id);
      voiceRank = computeRank(guildUsers, "voiceXp", user.id);
      gameRank = computeRank(guildUsers, "gameXp", user.id);
    } catch (error) {
      console.warn(`Failed to compute ranks for guild ${interaction.guild.id}:`, error);
    }

    const getUpgradeLevel = (entry: unknown, key: string): number => {
      if (!entry) return 1;
      if (Array.isArray(entry)) {
        const found = entry.find((u) => u?.type === key);
        return typeof found?.level === "number" ? found.level : 1;
      }
      if (typeof entry === "object" && entry !== null && key in (entry as Record<string, unknown>)) {
        const levelValue = (entry as Record<string, any>)[key]?.level;
        return typeof levelValue === "number" ? levelValue : 1;
      }
      return 1;
    };

    const calculateUpgradePrice = (config: UpgradeConfig, currentLevel: number): number => {
      return Math.max(
        1,
        Math.floor(config.basePrice * Math.pow(config.priceMultiplier, Math.max(0, currentLevel - 1)))
      );
    };

    const upgradesConfig = UPGRADES as Record<string, UpgradeConfig>;
    const userBalance = Number(userData?.economy?.balance || 0);
    let affordableUpgradesCount = 0;
    for (const key of Object.keys(upgradesConfig)) {
      const config = upgradesConfig[key];
      if (!config) continue;
      const currentLevel = getUpgradeLevel(userData?.upgrades, key);
      const price = calculateUpgradePrice(config, currentLevel);
      if (userBalance >= price) {
        affordableUpgradesCount++;
      }
    }

    const gamesMap = await loadGames();
    const hasAvailableGames = gamesMap.size > 0;

    // Calculate total daily earnings potential across all games
    let totalDailyCap = 0;
    let totalEarnedToday = 0;
    const gameStatuses: Array<{ gameId: string; cap: number; earned: number; remaining: number }> = [];

    if (hasAvailableGames) {
      const gameIds = Array.from(gamesMap.keys());
      const gameStatusPromises = gameIds.map(async (gameId) => {
        try {
          const status = await (hubClient as any).getGameDailyStatus(
            interaction.guild.id,
            user.id,
            gameId
          );
          return {
            gameId,
            cap: status?.cap || 0,
            earned: status?.earnedToday || 0,
            remaining: status?.remainingToday || 0,
          };
        } catch (error) {
          console.warn(`Failed to get daily status for game ${gameId}:`, error);
          return { gameId, cap: 0, earned: 0, remaining: 0 };
        }
      });

      const gameStatusesResult = await Promise.all(gameStatusPromises);
      for (const status of gameStatusesResult) {
        totalDailyCap += status.cap;
        totalEarnedToday += status.earned;
        if (status.cap > 0) {
          gameStatuses.push(status);
        }
      }
    }

    const workProgress = totalDailyCap > 0 ? totalEarnedToday / totalDailyCap : 0;

    const crateTypes = CRATE_TYPES as Record<string, { cooldown: number }>;
    const now = Date.now();
    const [dailyCooldownTimestamp, weeklyCooldownTimestamp, crimeCooldownResponse] = await Promise.all([
      (hubClient as any).getCrateCooldown(interaction.guild.id, user.id, "daily"),
      (hubClient as any).getCrateCooldown(interaction.guild.id, user.id, "weekly"),
      (hubClient as any).getCooldown(interaction.guild.id, user.id, "crime"),
    ]);

    const dailyRemaining = crateTypes?.daily?.cooldown
      ? Number(dailyCooldownTimestamp)
        ? Math.max(0, Number(dailyCooldownTimestamp) + crateTypes.daily.cooldown - now)
        : 0
      : 0;
    const weeklyRemaining = crateTypes?.weekly?.cooldown
      ? Number(weeklyCooldownTimestamp)
        ? Math.max(0, Number(weeklyCooldownTimestamp) + crateTypes.weekly.cooldown - now)
        : 0
      : 0;

    const openableCasesCount = Number(dailyRemaining <= 0) + Number(weeklyRemaining <= 0);
    const nextCaseRemainingMs = [dailyRemaining, weeklyRemaining]
      .filter((remaining) => remaining > 0)
      .sort((a, b) => a - b)[0] ?? null;
    const dailyCooldownMs = Number(crateTypes?.daily?.cooldown || 0);
    const weeklyCooldownMs = Number(crateTypes?.weekly?.cooldown || 0);
    const crimeCooldownMs = 2 * 60 * 60 * 1000;
    const crimeRemainingMs = Math.max(0, Number(crimeCooldownResponse?.cooldown || 0));

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
            id: interaction.guild!.id,
            name: interaction.guild!.name,
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
          bankCycle: bankCycleData,
          levelProgress: {
            chat: { ...chatLevelData, rank: chatRank?.rank, total: chatRank?.total },
            voice: { ...voiceLevelData, rank: voiceRank?.rank, total: voiceRank?.total },
            game: { ...gameLevelData, rank: gameRank?.rank, total: gameRank?.total },
          },
          hints: {
            dailyAvailable: openableCasesCount,
            dailyRemainingMs: nextCaseRemainingMs,
            casesCooldowns: {
              dailyRemainingMs: dailyRemaining,
              dailyCooldownMs,
              weeklyRemainingMs: weeklyRemaining,
              weeklyCooldownMs,
              closestRemainingMs: nextCaseRemainingMs,
            },
            crimeAvailable: crimeRemainingMs <= 0,
            crimeRemainingMs,
            crimeCooldownMs,
            upgradesAffordable: affordableUpgradesCount,
            minUpgradePrice: null,
            balance: userBalance,
            workAvailable: hasAvailableGames,
            workEarnings: {
              totalCap: totalDailyCap,
              earnedToday: totalEarnedToday,
              remainingToday: Math.max(0, totalDailyCap - totalEarnedToday),
              progress: workProgress,
              gameCount: gameStatuses.length,
            },
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
