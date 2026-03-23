import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandSubcommandBuilder,
  StringSelectMenuBuilder,
} from "discord.js";
import hubClient from "../../api/hubClient.ts";
import { generateImage, processImageColors } from "../../utils/imageGenerator.ts";
import { ComponentBuilder } from "../../utils/componentConverter.ts";
import type { UserLike, GuildLike, TranslatorLike, MessageLike, InteractionLike } from "../../types/index.ts";

type LeaderboardCategory =
  | "total"
  | "balance"
  | "bank"
  | "chat"
  | "voice"
  | "gaming"
  | "season"
  | "games"
  | "2048"
  | "snake";

type GameLeaderboardScope = "local" | "global";

const GAME_CATEGORIES = new Set<LeaderboardCategory>(["games", "2048", "snake"]);
const DEFAULT_AVATAR = "https://cdn.discordapp.com/embed/avatars/0.png";

function isGameCategory(
  category: LeaderboardCategory
): category is "games" | "2048" | "snake" {
  return GAME_CATEGORIES.has(category);
}

type MemberLike = {
  id: string;
  displayName: string;
  displayAvatarURL: (options?: Record<string, unknown>) => string;
};

type ExtendedGuildLike = GuildLike & {
  members: {
    fetch: (userId: string) => Promise<MemberLike>;
  };
};

type UserDataLike = Record<string, any> & {
  id: string;
  economy?: { balance?: number; bankBalance?: number };
  Level?: { xp?: number; voiceXp?: number; gameXp?: number; seasonXp?: number };
  stats?: {
    xpStats?: { chat?: number; voice?: number };
    gameRecords?: Record<string, { highScore?: number }>;
  };
  seasonXp?: number;
  sortValue?: number;
  displayValue?: number;
  name?: string;
  avatarURL?: string;
  coloring?: unknown;
};

const command = {
  data: (): SlashCommandSubcommandBuilder => {
    return new SlashCommandSubcommandBuilder()
      .setName("leaderboard")
      .setDescription("View the leaderboard")
      .addStringOption((option) =>
        option
          .setName("category")
          .setDescription("Category to display")
          .setRequired(false)
          .addChoices(
            { name: "Season XP", value: "season" },
            { name: "Total Balance", value: "total" },
            { name: "Balance", value: "balance" },
            { name: "Bank Balance", value: "bank" },
            { name: "Chat Level", value: "chat" },
            { name: "Voice Level", value: "voice" },
            { name: "Gaming Level", value: "gaming" },
            { name: "Total Games Score", value: "games" },
            { name: "2048 High Score", value: "2048" },
            { name: "Snake High Score", value: "snake" }
          )
      );
  },

  localization_strings: {
    command: {
      name: {
        ru: "лидерборд",
        uk: "лідерборд",
      },
      description: {
        ru: "Посмотреть таблицу лидеров",
        uk: "Переглянути таблицю лідерів",
      },
    },
    title: {
      en: "Server Leaderboard",
      ru: "Таблица лидеров сервера",
      uk: "Таблиця лідерів сервера",
    },
    selectUser: {
      en: "Select a user to view details",
      ru: "Выберите пользователя для просмотра деталей",
      uk: "Виберіть користувача для перегляду деталей",
    },
    selectCategory: {
      en: "Select category to view",
      ru: "Выберите категорию для просмотра",
      uk: "Виберіть категорію для перегляду",
    },
    categories: {
      total: { en: "Total Balance", ru: "Общий баланс", uk: "Загальний баланс" },
      balance: { en: "Balance", ru: "Баланс", uk: "Баланс" },
      bank: { en: "Bank Balance", ru: "Банковский баланс", uk: "Банківський баланс" },
      chat: { en: "Chat Level", ru: "Уровень чата", uk: "Рівень чату" },
      voice: { en: "Voice Level", ru: "Уровень голоса", uk: "Рівень голосу" },
      gaming: { en: "Gaming Level", ru: "Игровой уровень", uk: "Ігровий рівень" },
      season: { en: "Season XP", ru: "Сезонный опыт", uk: "Сезонний досвід" },
      games: { en: "Total Games", ru: "Всего игр", uk: "Всього ігор" },
      2048: { en: "2048", ru: "2048", uk: "2048" },
      snake: { en: "Snake", ru: "Snake", uk: "Snake" },
    },
    selectedUser: {
      en: "Selected user at position {{position}}",
      ru: "Выбран пользователь на позиции {{position}}",
      uk: "Обрано користувача на позиції {{position}}",
    },
    error: {
      en: "An error occurred while processing your leaderboard request",
      ru: "Произошла ошибка при обработке запроса таблицы лидеров",
      uk: "Сталася помилка під час обробки запиту таблиці лідерів",
    },
    noUsersOnPage: {
      en: "No valid users found on this page.",
      ru: "На этой странице не найдено действительных пользователей.",
      uk: "На цій сторінці не знайдено дійсних користувачів.",
    },
    scopeLocal: {
      en: "Local",
      ru: "Локальный",
      uk: "Локальний",
    },
    scopeGlobal: {
      en: "Global",
      ru: "Глобальный",
      uk: "Глобальний",
    },
  },

  async execute(interaction: InteractionLike, i18n: TranslatorLike): Promise<void> {
    await interaction.deferReply();
    const guild = interaction.guild;
    let category =
      (interaction.options.getString!("category") as LeaderboardCategory | null) || "total";
    let gameScope: GameLeaderboardScope = "local";

    try {
      let page = 0;
      const pageSize = 10;
      let highlightedPosition: number | null = null;
      let currentTotalPages = 1;
      let sortedUsers: UserDataLike[] = [];
      const fetchBufferSize = 5;
      const builderMode = "v2" as const;

      const findMyself = async (): Promise<void> => {
        if (highlightedPosition === null) {
          const userIndex = sortedUsers.findIndex((user) => user.id === interaction.user.id);
          if (userIndex !== -1) {
            highlightedPosition = userIndex + 1;
            page = Math.floor(userIndex / pageSize);
          }
        }
      };

      const normalizeGameRecords = (
        records: Record<string, { highScore?: number }> | undefined
      ): { "2048": { highScore: number }; snake: { highScore: number } } => {
        return {
          "2048": { highScore: Number(records?.["2048"]?.highScore || 0) },
          snake: { highScore: Number(records?.snake?.highScore || 0) },
        };
      };

      const disableInteractiveComponents = (components: unknown[]): unknown[] => {
        return components.map((component) => {
          const normalized =
            component && typeof component === "object" && "toJSON" in (component as Record<string, unknown>)
              ? (component as { toJSON: () => Record<string, unknown> }).toJSON()
              : (component as Record<string, unknown>);

          if (!normalized || typeof normalized !== "object") {
            return normalized;
          }

          const cloned = { ...normalized } as Record<string, unknown>;
          if (Array.isArray(cloned.components)) {
            cloned.components = disableInteractiveComponents(cloned.components as unknown[]);
          }

          const type = Number(cloned.type || 0);
          if ([2, 3, 5, 6, 7, 8].includes(type)) {
            cloned.disabled = true;
          }

          return cloned;
        });
      };

      const generateLeaderboardMessage = async (): Promise<Record<string, unknown>> => {
        let guildUsers: UserDataLike[];

        if (category === "season") {
          const currentSeason = await hubClient.getCurrentSeason();
          const seasonId = Number(currentSeason?.seasonNumber || 0);
          const seasonRows = seasonId > 0 ? await hubClient.getSeasonLeaderboard(seasonId, 250) : [];
          guildUsers = seasonRows
            .map((entry) => {
              const userId = String(entry.userId || "");
              const seasonXp = Number((entry as Record<string, unknown>).totalXp || entry.xp || entry.score || 0);
              return {
                id: userId,
                Level: { seasonXp },
                seasonXp,
              } as UserDataLike;
            })
            .filter((entry) => Boolean(entry.id));
        } else if (isGameCategory(category)) {
          const gameRows = await hubClient.getGameLeaderboard(
            category,
            gameScope,
            gameScope === "local" ? guild.id : undefined,
            250
          );

          guildUsers = gameRows
            .map((entry) => ({
              id: String(entry.userId || entry.id || ""),
              stats: {
                gameRecords: normalizeGameRecords(
                  (entry.stats as { gameRecords?: Record<string, { highScore?: number }> })?.gameRecords
                ),
              },
            }))
            .filter((entry) => Boolean(entry.id));
        } else {
          guildUsers = (await hubClient.getGuildUsers(guild.id)) as UserDataLike[];
        }

        sortedUsers = guildUsers
          .map((userData) => {
            let sortValue = 0;
            let displayValue = 0;
            switch (category) {
              case "season":
                sortValue = Number(userData.Level?.seasonXp || userData.seasonXp || 0);
                displayValue = sortValue;
                break;
              case "total":
                sortValue = Number(userData.economy?.balance || 0) + Number(userData.economy?.bankBalance || 0);
                displayValue = sortValue;
                break;
              case "balance":
                sortValue = Number(userData.economy?.balance || 0);
                displayValue = sortValue;
                break;
              case "bank":
                sortValue = Number(userData.economy?.bankBalance || 0);
                displayValue = sortValue;
                break;
              case "chat":
                sortValue = Number(userData.Level?.xp || 0);
                displayValue = hubClient.calculateLevel(sortValue).level;
                break;
              case "voice":
                sortValue = Number(userData.Level?.voiceXp || 0);
                displayValue = hubClient.calculateLevel(sortValue).level;
                break;
              case "gaming":
                sortValue = Number(userData.Level?.gameXp || 0);
                displayValue = hubClient.calculateLevel(sortValue).level;
                break;
              case "games": {
                const gameRecords = userData.stats?.gameRecords || { 2048: { highScore: 0 }, snake: { highScore: 0 } };
                sortValue = Number(gameRecords["2048"]?.highScore || 0) + Number(gameRecords.snake?.highScore || 0);
                displayValue = sortValue;
                break;
              }
              case "2048": {
                const gameRecords2048 = userData.stats?.gameRecords || { 2048: { highScore: 0 } };
                sortValue = Number(gameRecords2048["2048"]?.highScore || 0);
                displayValue = sortValue;
                break;
              }
              case "snake": {
                const gameRecordsSnake = userData.stats?.gameRecords || { snake: { highScore: 0 } };
                sortValue = Number(gameRecordsSnake.snake?.highScore || 0);
                displayValue = sortValue;
                break;
              }
            }
            return { ...userData, sortValue, displayValue };
          })
          .sort((a, b) => Number(b.sortValue || 0) - Number(a.sortValue || 0));

        currentTotalPages = Math.ceil(sortedUsers.length / pageSize);
        const startIndex = page * pageSize;
        const extendedEndIndex = startIndex + pageSize + fetchBufferSize;
        const potentialUsersToDisplay = sortedUsers.slice(startIndex, extendedEndIndex);

        const potentialUsersWithData = await Promise.all(
          potentialUsersToDisplay.map(async (userData) => {
            try {
              const member = await guild?.members?.fetch(userData.id);
              if (!member) throw new Error("Member not found");
              const avatarURL = member.displayAvatarURL({ extension: "png", size: 1024 });
              const colorProps = await processImageColors(avatarURL);
              return {
                ...userData,
                name: member.displayName,
                avatarURL,
                coloring: colorProps,
              } as UserDataLike;
            } catch (error) {
              return {
                ...userData,
                name: `User ${String(userData.id).slice(-6)}`,
                avatarURL: DEFAULT_AVATAR,
              } as UserDataLike;
            }
          })
        );

        const usersToDisplayFinal = potentialUsersWithData.slice(0, pageSize);

        const prevButton = new ButtonBuilder()
          .setCustomId("prev_page")
          .setLabel("◀")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(page <= 0);

        const nextButton = new ButtonBuilder()
          .setCustomId("next_page")
          .setLabel("▶")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(page >= currentTotalPages - 1);

        if (usersToDisplayFinal.length === 0 && sortedUsers.length > 0) {
          const emptyPageBuilder = new ComponentBuilder({ mode: builderMode });
          emptyPageBuilder
            .addText(
              String((await i18n.__("commands.economy.leaderboard.noUsersOnPage")) || "No valid users found on this page.")
            )
            .addButtons(prevButton, nextButton);
          return emptyPageBuilder.toReplyOptions({}) as Record<string, unknown>;
        }

        const generated = (await generateImage(
          "Leaderboard2",
          {
            interaction: {
              user: {
                id: interaction.user.id,
                username: interaction.user.username,
                displayName: interaction.user.displayName,
                avatarURL: interaction.user.displayAvatarURL({ extension: "png", size: 1024 }),
              },
              guild: {
                id: interaction.guild.id,
                name: interaction.guild.name,
                iconURL: interaction.guild.iconURL({ extension: "png", size: 1024 }),
              },
            },
            locale: interaction.locale,
            category,
            gameScope,
            users: usersToDisplayFinal.map((user) => {
              const originalPosition = sortedUsers.findIndex((sortedUser) => sortedUser.id === user.id) + 1;
              const chatXp = Number(user.Level?.xp || 0);
              const voiceXp = Number(user.Level?.voiceXp || 0);
              const gameXp = Number(user.Level?.gameXp || 0);
              const totalXp = chatXp + voiceXp + gameXp;
              const chatLevelData = hubClient.calculateLevel(chatXp);
              const voiceLevelData = hubClient.calculateLevel(voiceXp);
              const gamingLevelData = hubClient.calculateLevel(gameXp);
              return {
                id: user.id,
                position: originalPosition,
                name: user.name,
                avatarURL: user.avatarURL,
                value: user.displayValue,
                coloring: user.coloring,
                bannerUrl: (user as any).bannerUrl,
                balance: Number(user.economy?.balance || 0),
                bank: Number(user.economy?.bankBalance || 0),
                totalBalance: Number(user.economy?.balance || 0) + Number(user.economy?.bankBalance || 0),
                xp: chatXp,
                chatCurrentXP: chatLevelData.currentXP,
                chatRequiredXP: chatLevelData.requiredXP,
                voiceXp: voiceXp,
                voiceCurrentXP: voiceLevelData.currentXP,
                voiceRequiredXP: voiceLevelData.requiredXP,
                gameXp: gameXp,
                gameCurrentXP: gamingLevelData.currentXP,
                gameRequiredXP: gamingLevelData.requiredXP,
                totalXp: totalXp,
                level: chatLevelData.level,
                voiceLevel: voiceLevelData.level,
                gamingLevel: gamingLevelData.level,
                xpStats: {
                  chat: chatXp,
                  voice: voiceXp,
                  gaming: gameXp,
                },
                gameRecords: user.stats?.gameRecords || { 2048: { highScore: 0 }, snake: { highScore: 0 } },
                seasonStats: {
                  rank: sortedUsers.findIndex((entry) => entry.id === user.id) + 1,
                  totalXP: Number(user.Level?.seasonXp || user.seasonXp || 0),
                },
              };
            }),
            currentPage: page + 1,
            totalPages: Math.max(1, currentTotalPages),
            highlightedPosition,
            pageSize,
            returnDominant: true,
          },
          { image: 2, emoji: 1 },
          i18n as any
        )) as [Buffer, unknown];

        const pngBuffer = generated?.[0];
        const dominantColor = generated?.[1];
        const attachment = new AttachmentBuilder(pngBuffer, { name: "leaderboard.png" });

        const leaderboardComponent = new ComponentBuilder({
          dominantColor: dominantColor as any,
          mode: builderMode,
        });

        leaderboardComponent
          .addText(String(await i18n.__("commands.economy.leaderboard.title")), "header3")
          .addImage("attachment://leaderboard.png");

        leaderboardComponent.addButtons(prevButton, nextButton);

        if (isGameCategory(category)) {
          const localLabel = String(await i18n.__("commands.economy.leaderboard.scopeLocal"));
          const globalLabel = String(await i18n.__("commands.economy.leaderboard.scopeGlobal"));
          const currentScopeLabel = gameScope === "global" ? globalLabel : localLabel;

          const scopeToggleButton = new ButtonBuilder()
            .setCustomId("leaderboard_scope_toggle")
            .setLabel(`${currentScopeLabel}`)
            .setStyle(ButtonStyle.Secondary);

          leaderboardComponent.addButtons(scopeToggleButton);
        }

        if (usersToDisplayFinal.length > 0) {
          const categoryMenu = new StringSelectMenuBuilder()
            .setCustomId("select_category")
            .setPlaceholder(String(await i18n.__("commands.economy.leaderboard.selectCategory")))
            .addOptions([
              {
                label: `✨ ${String(await i18n.__("commands.economy.leaderboard.categories.season"))}`,
                value: "season",
                default: category === "season",
              },
              {
                label: `🏦 ${String(await i18n.__("commands.economy.leaderboard.categories.total"))}`,
                value: "total",
                default: category === "total",
              },
              {
                label: `💰 ${String(await i18n.__("commands.economy.leaderboard.categories.balance"))}`,
                value: "balance",
                default: category === "balance",
              },
              {
                label: `💳 ${String(await i18n.__("commands.economy.leaderboard.categories.bank"))}`,
                value: "bank",
                default: category === "bank",
              },
              {
                label: `💬 ${String(await i18n.__("commands.economy.leaderboard.categories.chat"))}`,
                value: "chat",
                default: category === "chat",
              },
              {
                label: `🎤 ${String(await i18n.__("commands.economy.leaderboard.categories.voice"))}`,
                value: "voice",
                default: category === "voice",
              },
              {
                label: `🎮 ${String(await i18n.__("commands.economy.leaderboard.categories.gaming"))}`,
                value: "gaming",
                default: category === "gaming",
              },
              {
                label: `🏆 ${String(await i18n.__("commands.economy.leaderboard.categories.games"))}`,
                value: "games",
                default: category === "games",
              },
              {
                label: `🔢 ${String(await i18n.__("commands.economy.leaderboard.categories.2048"))}`,
                value: "2048",
                default: category === "2048",
              },
              {
                label: `🐍 ${String(await i18n.__("commands.economy.leaderboard.categories.snake"))}`,
                value: "snake",
                default: category === "snake",
              },
            ]);

          leaderboardComponent.createActionRow().addComponents(categoryMenu).done();

          const selectOptions = await Promise.all(
            usersToDisplayFinal.map(async (user) => {
              const originalPosition = sortedUsers.findIndex((sortedUser) => sortedUser.id === user.id) + 1;
              return {
                label: `${originalPosition}. ${(user.name || "User").slice(0, 20)}`,
                value: originalPosition.toString(),
                description: `${await i18n.__(`commands.economy.leaderboard.categories.${category}`)}: ${user.displayValue}`.slice(0, 50),
              };
            })
          );

          const selectMenu = new StringSelectMenuBuilder()
            .setCustomId("select_user")
            .setPlaceholder(String(await i18n.__("commands.economy.leaderboard.selectUser")))
            .addOptions(selectOptions);

          leaderboardComponent.createActionRow().addComponents(selectMenu).done();
        }

        return leaderboardComponent.toReplyOptions({ files: [attachment] }) as Record<string, unknown>;
      };

      await findMyself();
      let message: MessageLike | undefined;

      try {
        const messageOptions = await generateLeaderboardMessage();
        const message = await interaction.editReply(messageOptions) as MessageLike;
      } catch (error) {
        console.error("Error updating leaderboard message:", error);
        const errorOptions = {
          content: await i18n.__("commands.economy.leaderboard.error"),
          ephemeral: true,
          components: [],
          files: [],
          embeds: [],
        };
        try {
          if (interaction.replied || interaction.deferred) {
            await interaction.editReply(errorOptions);
          } else {
            await interaction.reply(errorOptions);
          }
        } catch (finalError) {
          console.error("Failed to send final error message:", finalError);
        }
      }

      if (message && message.editable) {
        const collector = message.createMessageComponentCollector({
          filter: (componentInteraction: any) =>
            componentInteraction.user.id === interaction.user.id &&
            (componentInteraction.isButton?.() || componentInteraction.isStringSelectMenu?.()),
          time: 60000,
        });

        collector.on("collect", async (componentInteraction: any) => {
          try {
            await componentInteraction.deferUpdate();

            let needsUpdate = false;
            if (componentInteraction.customId === "prev_page") {
              if (page > 0) {
                page--;
                highlightedPosition = null;
                needsUpdate = true;
              }
            } else if (componentInteraction.customId === "next_page") {
              if (page < currentTotalPages - 1) {
                page++;
                highlightedPosition = null;
                needsUpdate = true;
              }
            } else if (componentInteraction.customId === "select_user") {
              highlightedPosition = parseInt(componentInteraction.values[0] || "0", 10);
              needsUpdate = true;
            } else if (componentInteraction.customId === "select_category") {
              const nextCategory =
                (componentInteraction.values[0] as LeaderboardCategory | undefined) || category;
              const wasGameCategory = isGameCategory(category);
              category = nextCategory;
              if (!isGameCategory(category) || !wasGameCategory) {
                gameScope = "local";
              }
              page = 0;
              highlightedPosition = null;
              needsUpdate = true;
            } else if (componentInteraction.customId === "leaderboard_scope_toggle") {
              gameScope = gameScope === "local" ? "global" : "local";
              page = 0;
              highlightedPosition = null;
              needsUpdate = true;
            }

            if (needsUpdate) {
              const newMessageOptions = await generateLeaderboardMessage();
              await message.edit(newMessageOptions);
            }
          } catch (collectError) {
            console.error("Error processing leaderboard interaction:", collectError);
            try {
              await componentInteraction.followUp({
                content: "An error occurred while updating the leaderboard.",
                ephemeral: true,
              });
            } catch (followUpError) {
              console.error("Failed to send error follow-up:", followUpError);
            }
          }
        });

        collector.on("end", (collected: { size: number }, reason: string) => {
          console.log(`Leaderboard collector ended. Reason: ${reason}, Collected: ${collected.size}`);
          if (message && message.editable) {
            const messageComponents = Array.isArray(message.components) ? message.components : [];
            if (messageComponents.length > 0) {
              const disabledComponents = disableInteractiveComponents(messageComponents);
              message.edit({ components: disabledComponents }).catch((error: any) => {
                if (error?.code !== 10008) {
                  console.error("Failed to disable components on collector end:", error);
                }
              });
            }
          }
        });
      }
    } catch (error) {
      console.error("Error executing leaderboard command:", error);
      const errorOptions = {
        content: await i18n.__("commands.economy.leaderboard.error"),
        ephemeral: true,
        components: [],
        embeds: [],
        files: [],
      };
      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.editReply(errorOptions);
        } else {
          await interaction.reply(errorOptions);
        }
      } catch (finalError) {
        console.error("Failed to send final error message:", finalError);
      }
    }
  },
};

export default command;
