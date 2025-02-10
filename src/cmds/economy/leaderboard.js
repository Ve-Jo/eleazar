import {
  SlashCommandSubcommand,
  I18nCommandBuilder,
  SlashCommandOption,
} from "../../utils/builders/index.js";
import {
  EmbedBuilder,
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} from "discord.js";
import Database from "../../database/client.js";
import { generateRemoteImage } from "../../utils/remoteImageGenerator.js";

export default {
  data: () => {
    const i18nBuilder = new I18nCommandBuilder("economy", "leaderboard");

    const subcommand = new SlashCommandSubcommand({
      name: i18nBuilder.getSimpleName(i18nBuilder.translate("name")),
      description: i18nBuilder.translate("description"),
      name_localizations: i18nBuilder.getLocalizations("name"),
      description_localizations: i18nBuilder.getLocalizations("description"),
      options: [
        new SlashCommandOption({
          name: "category",
          description: "Category to display",
          type: 3, // String
          required: false,
          choices: [
            { name: "Total Balance", value: "total" },
            { name: "Balance", value: "balance" },
            { name: "Bank Balance", value: "bank" },
            { name: "Level", value: "level" },
            { name: "Games", value: "games" },
            { name: "Season", value: "season" }, // Add new season category
          ],
        }),
      ],
    });

    return subcommand;
  },
  async execute(interaction, i18n) {
    await interaction.deferReply();
    const { guild } = interaction;
    let category = interaction.options.getString("category") || "total";

    try {
      let page = 0;
      const pageSize = 10;
      let highlightedPosition = null;

      const generateLeaderboardMessage = async () => {
        // Get users based on category
        let guildUsers;

        if (category === "season") {
          // For season category, fetch global users ordered by seasonXp
          guildUsers = await Database.client.level.findMany({
            orderBy: {
              seasonXp: "desc",
            },
            take: 250, // Limit to reasonable amount
            include: {
              user: true,
            },
          });

          // Transform the data to match the expected structure
          guildUsers = guildUsers.map((level) => ({
            id: level.user.id,
            seasonXp: level.seasonXp,
            guildId: level.guildId,
          }));
        } else {
          // For guild-specific categories
          guildUsers = await Database.client.user.findMany({
            where: { guildId: guild.id },
            include: {
              economy: true,
              stats: true,
              Level: true,
            },
          });
        }

        // Sort users based on category
        const sortedUsers = guildUsers
          .map((userData) => {
            let sortValue = 0;
            let displayValue = 0; // New variable for display value
            switch (category) {
              case "season":
                sortValue = Number(userData.seasonXp || 0);
                displayValue = sortValue;
                break;
              case "total":
                sortValue =
                  Number(userData.economy?.balance || 0) +
                  Number(userData.economy?.bankBalance || 0);
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
                displayValue = Database.calculateLevel(sortValue).level;
                break;
              case "games":
                const gameRecords = userData.stats?.gameRecords
                  ? userData.stats.gameRecords
                  : { 2048: { highScore: 0 }, snake: { highScore: 0 } };
                sortValue = Math.max(
                  gameRecords["2048"]?.highScore || 0,
                  gameRecords.snake?.highScore || 0
                );
                displayValue = sortValue;
                break;
            }
            return { ...userData, sortValue, displayValue };
          })
          .sort((a, b) => b.sortValue - a.sortValue);

        if (highlightedPosition === null) {
          const userIndex = sortedUsers.findIndex(
            (user) => user.id === interaction.user.id
          );
          if (userIndex !== -1) {
            highlightedPosition = userIndex + 1;
            // Adjust page to show the user's position
            page = Math.floor(userIndex / pageSize);
          }
        }

        const totalPages = Math.ceil(sortedUsers.length / pageSize);
        const startIndex = page * pageSize;
        const endIndex = startIndex + pageSize;
        const usersToDisplay = sortedUsers.slice(startIndex, endIndex);

        // Fetch member data for each user
        const usersWithNames = await Promise.all(
          usersToDisplay.map(async (userData) => {
            try {
              const member = await guild.members.fetch(userData.id);
              return {
                ...userData,
                name: member.displayName,
                avatarURL: member.displayAvatarURL({
                  extension: "png",
                  size: 1024,
                }),
              };
            } catch (error) {
              console.error(`Failed to fetch member ${userData.id}:`, error);
              return null;
            }
          })
        );

        const validUsers = usersWithNames.filter((user) => user !== null);

        // Generate leaderboard image
        const pngBuffer = await generateRemoteImage(
          "Leaderboard",
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
                id: guild.id,
                name: guild.name,
                iconURL: guild.iconURL({
                  extension: "png",
                  size: 1024,
                }),
              },
            },
            locale: interaction.locale,
            category,
            users: validUsers.map((user, index) => ({
              id: user.id,
              position: startIndex + index + 1,
              name: user.name,
              avatarURL: user.avatarURL,
              value: user.displayValue,
              // Include all relevant data for each user
              balance: Number(user.economy?.balance || 0),
              bank: Number(user.economy?.bankBalance || 0),
              totalBalance:
                Number(user.economy?.balance || 0) +
                Number(user.economy?.bankBalance || 0),
              xpStats: user.stats?.xpStats || { chat: 0, voice: 0 },
              gameRecords: user.stats?.gameRecords || {
                2048: { highScore: 0 },
                snake: { highScore: 0 },
              },
              seasonStats: user.Level
                ? {
                    rank: sortedUsers.findIndex((u) => u.id === user.id) + 1,
                    totalXP: Number(user.Level.seasonXp || 0),
                  }
                : null,
            })),
            currentPage: page + 1,
            totalPages,
            highlightedPosition,
          },
          { width: 400, height: 775 }
        );

        const attachment = new AttachmentBuilder(pngBuffer.buffer, {
          name: `leaderboard.${
            pngBuffer.contentType === "image/gif" ? "gif" : "png"
          }`,
        });

        const embed = new EmbedBuilder()
          .setColor(process.env.EMBED_COLOR)
          .setAuthor({
            name: `${i18n.__("economy.leaderboard.title")} - ${
              i18n.__("economy.leaderboard.categories." + category) ||
              "Total Balance"
            }`,
            iconURL: interaction.user.displayAvatarURL(),
          })
          .setImage(
            `attachment://leaderboard.${
              pngBuffer.contentType === "image/gif" ? "gif" : "png"
            }`
          )
          .setTimestamp();

        // Create navigation buttons
        const prevButton = new ButtonBuilder()
          .setCustomId("prev_page")
          .setLabel("◀")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(page === 0);

        const nextButton = new ButtonBuilder()
          .setCustomId("next_page")
          .setLabel("▶")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(page >= totalPages - 1);

        const buttonRow = new ActionRowBuilder().addComponents(
          prevButton,
          nextButton
        );

        let components = [buttonRow];

        if (validUsers.length > 0) {
          // Create category selector
          const categoryMenu = new StringSelectMenuBuilder()
            .setCustomId("select_category")
            .setPlaceholder("Select Category")
            .addOptions([
              {
                label: i18n.__("economy.leaderboard.categories.total"),
                value: "total",
                default: category === "total",
              },
              {
                label: i18n.__("economy.leaderboard.categories.balance"),
                value: "balance",
                default: category === "balance",
              },
              {
                label: i18n.__("economy.leaderboard.categories.bank"),
                value: "bank",
                default: category === "bank",
              },
              {
                label: i18n.__("economy.leaderboard.categories.level"),
                value: "level",
                default: category === "level",
              },
              {
                label: i18n.__("economy.leaderboard.categories.games"),
                value: "games",
                default: category === "games",
              },
              {
                label: i18n.__("economy.leaderboard.categories.season"),
                value: "season",
                default: category === "season",
              },
            ]);

          const categoryRow = new ActionRowBuilder().addComponents(
            categoryMenu
          );
          components.push(categoryRow);

          // Create user selector
          const selectOptions = validUsers.map((user, index) => ({
            label: `${startIndex + index + 1}. ${user.name.slice(0, 20)}`,
            value: (startIndex + index + 1).toString(),
            description: `${
              i18n.__("economy.leaderboard.categories." + category) ||
              "Total Balance"
            }: ${user.sortValue}`.slice(0, 50),
          }));

          const selectMenu = new StringSelectMenuBuilder()
            .setCustomId("select_user")
            .setPlaceholder("Select User")
            .addOptions(selectOptions);

          const selectRow = new ActionRowBuilder().addComponents(selectMenu);
          components.push(selectRow);
        }

        return {
          embeds: [embed],
          files: [attachment],
          components,
        };
      };

      const message = await interaction.editReply(
        await generateLeaderboardMessage()
      );

      // Create collector for buttons and select menu
      const collector = message.createMessageComponentCollector({
        filter: (i) => i.user.id === interaction.user.id,
        time: 60000,
      });

      collector.on("collect", async (i) => {
        if (i.customId === "prev_page") {
          page = Math.max(0, page - 1);
          highlightedPosition = null;
          await i.update(await generateLeaderboardMessage());
        } else if (i.customId === "next_page") {
          page++;
          highlightedPosition = null;
          await i.update(await generateLeaderboardMessage());
        } else if (i.customId === "select_user") {
          highlightedPosition = parseInt(i.values[0]);
          await i.update(await generateLeaderboardMessage());
        } else if (i.customId === "select_category") {
          category = i.values[0];
          page = 0;
          highlightedPosition = null;
          await i.update(await generateLeaderboardMessage());
        }
      });

      collector.on("end", () => {
        if (message.editable) {
          message.edit({ components: [] }).catch(() => {});
        }
      });
    } catch (error) {
      console.error("Error in leaderboard command:", error);
      await interaction.editReply({
        content: i18n.__("economy.leaderboard.error"),
        ephemeral: true,
      });
    }
  },
  localization_strings: {
    name: {
      en: "leaderboard",
      ru: "лидерборд",
      uk: "лідерборд",
    },
    description: {
      en: "View server leaderboard",
      ru: "Посмотреть таблицу лидеров сервера",
      uk: "Переглянути таблицю лідерів сервера",
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
      total: {
        en: "Total Balance",
        ru: "Общий баланс",
        uk: "Загальний баланс",
      },
      balance: {
        en: "Balance",
        ru: "Баланс",
        uk: "Баланс",
      },
      bank: {
        en: "Bank Balance",
        ru: "Банковский баланс",
        uk: "Банківський баланс",
      },
      level: {
        en: "Level",
        ru: "Уровень",
        uk: "Рівень",
      },
      games: {
        en: "Games",
        ru: "Игры",
        uk: "Ігри",
      },
      season: {
        en: "Season XP",
        ru: "Сезонный опыт",
        uk: "Сезонний досвід",
      },
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
  },
};
