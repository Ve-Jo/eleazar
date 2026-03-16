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

type TranslatorLike = {
  __: (key: string, vars?: Record<string, unknown>) => Promise<string | unknown>;
};

type UserLike = {
  id: string;
  username: string;
  displayName: string;
  displayAvatarURL: (options?: Record<string, unknown>) => string;
};

type MemberLike = {
  id: string;
  displayName: string;
  displayAvatarURL: (options?: Record<string, unknown>) => string;
};

type GuildLike = {
  id: string;
  name: string;
  iconURL: (options?: Record<string, unknown>) => string | null;
  members: {
    fetch: (userId: string) => Promise<MemberLike>;
  };
};

type UserDataLike = Record<string, any> & {
  id: string;
  economy?: { balance?: number; bankBalance?: number };
  Level?: { xp?: number; seasonXp?: number };
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

type MessageLike = {
  editable?: boolean;
  edit: (payload: unknown) => Promise<unknown>;
  createMessageComponentCollector: (options: Record<string, unknown>) => {
    on: (event: string, handler: (...args: any[]) => void | Promise<void>) => void;
  };
};

type InteractionLike = {
  replied?: boolean;
  deferred?: boolean;
  locale: string;
  user: UserLike;
  guild: GuildLike;
  options: {
    getString: (name: string) => string | null;
  };
  deferReply: () => Promise<unknown>;
  editReply: (payload: unknown) => Promise<MessageLike>;
  reply: (payload: unknown) => Promise<unknown>;
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
            { name: "Total Balance", value: "total" },
            { name: "Balance", value: "balance" },
            { name: "Bank Balance", value: "bank" },
            { name: "Level", value: "level" }
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
      level: { en: "Level", ru: "Уровень", uk: "Рівень" },
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
  },

  async execute(interaction: InteractionLike, i18n: TranslatorLike): Promise<void> {
    await interaction.deferReply();
    const guild = interaction.guild;
    let category = interaction.options.getString("category") || "total";

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

      const generateLeaderboardMessage = async (): Promise<Record<string, unknown>> => {
        let guildUsers: UserDataLike[];
        if (category === "season") {
          guildUsers = (await (hubClient as any).getSeasonLeaderboard(250)) as UserDataLike[];
        } else {
          guildUsers = (await (hubClient as any).getGuildUsers(guild.id)) as UserDataLike[];
        }

        sortedUsers = guildUsers
          .map((userData) => {
            let sortValue = 0;
            let displayValue = 0;
            switch (category) {
              case "season":
                sortValue = Number(userData.seasonXp || 0);
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
              case "level":
                sortValue = Number(userData.Level?.xp || 0);
                displayValue = (hubClient as any).calculateLevel(sortValue).level;
                break;
              case "games": {
                const gameRecords = userData.stats?.gameRecords || { 2048: { highScore: 0 }, snake: { highScore: 0 } };
                sortValue = Number(gameRecords["2048"]?.highScore || 0) + Number(gameRecords.snake?.highScore || 0);
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
              const member = await guild.members.fetch(userData.id);
              const avatarURL = member.displayAvatarURL({ extension: "png", size: 1024 });
              const colorProps = await processImageColors(avatarURL);
              return {
                ...userData,
                name: member.displayName,
                avatarURL,
                coloring: colorProps,
              } as UserDataLike;
            } catch (error) {
              console.error(`Failed to fetch member ${userData.id}:`, error);
              return null;
            }
          })
        );

        const validUsersWithData = potentialUsersWithData.filter((user): user is UserDataLike => user !== null);
        const usersToDisplayFinal = validUsersWithData.slice(0, pageSize);

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
          "Leaderboard",
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
            users: usersToDisplayFinal.map((user) => {
              const originalPosition = sortedUsers.findIndex((sortedUser) => sortedUser.id === user.id) + 1;
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
                xp: Number(user.Level?.xp || 0),
                level: (hubClient as any).calculateLevel(Number(user.Level?.xp || 0)).level,
                xpStats: {
                  chat: Number(user.stats?.xpStats?.chat || 0),
                  voice: Number(user.stats?.xpStats?.voice || 0),
                },
                gameRecords: user.stats?.gameRecords || { 2048: { highScore: 0 }, snake: { highScore: 0 } },
                seasonStats: {
                  rank: sortedUsers.findIndex((entry) => entry.id === user.id) + 1,
                  totalXP: Number(user.Level?.seasonXp || 0),
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
        const attachment = new AttachmentBuilder(pngBuffer, { name: "leaderboard.webp" });

        const leaderboardComponent = new ComponentBuilder({
          dominantColor: dominantColor as any,
          mode: builderMode,
        });

        leaderboardComponent
          .addText(String(await i18n.__("commands.economy.leaderboard.title")), "header3")
          .addImage("attachment://leaderboard.webp");

        leaderboardComponent.addButtons(prevButton, nextButton);

        if (usersToDisplayFinal.length > 0) {
          const categoryMenu = new StringSelectMenuBuilder()
            .setCustomId("select_category")
            .setPlaceholder(String(await i18n.__("commands.economy.leaderboard.selectCategory")))
            .addOptions([
              {
                label: String(await i18n.__("commands.economy.leaderboard.categories.total")),
                value: "total",
                default: category === "total",
              },
              {
                label: String(await i18n.__("commands.economy.leaderboard.categories.balance")),
                value: "balance",
                default: category === "balance",
              },
              {
                label: String(await i18n.__("commands.economy.leaderboard.categories.bank")),
                value: "bank",
                default: category === "bank",
              },
              {
                label: String(await i18n.__("commands.economy.leaderboard.categories.level")),
                value: "level",
                default: category === "level",
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
        message = await interaction.editReply(messageOptions);
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
              category = componentInteraction.values[0] || category;
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
            message.edit({ components: [] }).catch((error: any) => {
              if (error?.code !== 10008) {
                console.error("Failed to remove components on collector end:", error);
              }
            });
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
