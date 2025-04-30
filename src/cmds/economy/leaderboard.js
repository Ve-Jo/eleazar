import {
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  SlashCommandSubcommandBuilder,
  MessageFlags,
} from "discord.js";
import Database from "../../database/client.js";
import {
  generateImage,
  processImageColors,
} from "../../utils/imageGenerator.js";
import { ComponentBuilder } from "../../utils/componentConverter.js";

export default {
  data: () => {
    const builder = new SlashCommandSubcommandBuilder()
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
            /*{ name: "Games", value: "games" },
            { name: "Season XP", value: "season" }*/
          )
      );

    return builder;
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
      /*games: {
        en: "Games",
        ru: "Игры",
        uk: "Ігри",
      },
      season: {
        en: "Season XP",
        ru: "Сезонный опыт",
        uk: "Сезонний досвід",
      },*/
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

  async execute(interaction, i18n) {
    await interaction.deferReply();
    const { guild } = interaction;
    let category = interaction.options.getString("category") || "total";

    try {
      let page = 0;
      const pageSize = 10;
      let highlightedPosition = null;
      let currentTotalPages = 1;
      let sortedUsers = [];

      // Determine builder mode based on execution context
      const isAiContext = !!interaction._isAiProxy;
      const builderMode = isAiContext ? "v1" : "v2";

      async function findMyself() {
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
      }

      async function generateLeaderboardMessage() {
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
            select: {
              id: true,
              guildId: true,
              bannerUrl: true,
              economy: true,
              stats: true,
              Level: true,
            },
          });
        }

        // Sort users based on category
        sortedUsers = guildUsers
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
                sortValue =
                  (gameRecords["2048"]?.highScore || 0) +
                  (gameRecords.snake?.highScore || 0);
                displayValue = sortValue;
                break;
            }
            return { ...userData, sortValue, displayValue };
          })
          .sort((a, b) => b.sortValue - a.sortValue);

        currentTotalPages = Math.ceil(sortedUsers.length / pageSize);
        const startIndex = page * pageSize;
        const endIndex = startIndex + pageSize;
        const usersToDisplay = sortedUsers.slice(startIndex, endIndex);

        // Fetch member data and process colors for each user
        const usersWithData = await Promise.all(
          usersToDisplay.map(async (userData) => {
            try {
              const member = await guild.members.fetch(userData.id);
              const avatarURL = member.displayAvatarURL({
                extension: "png",
                size: 1024,
              });
              const colorProps = await processImageColors(avatarURL);

              return {
                ...userData,
                name: member.displayName,
                avatarURL,
                coloring: colorProps,
              };
            } catch (error) {
              console.error(`Failed to fetch member ${userData.id}:`, error);
              return null;
            }
          })
        );

        const validUsers = usersWithData.filter((user) => user !== null);

        // Generate leaderboard image
        const [pngBuffer, dominantColor] = await generateImage(
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
                id: interaction.guild.id,
                name: interaction.guild.name,
                iconURL: interaction.guild.iconURL({
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
              coloring: user.coloring,
              // Include all relevant data for each user
              bannerUrl: user.bannerUrl,
              balance: Number(user.economy?.balance || 0),
              bank: Number(user.economy?.bankBalance || 0),
              totalBalance:
                Number(user.economy?.balance || 0) +
                Number(user.economy?.bankBalance || 0),
              xp: Number(user.Level?.xp || 0),
              level: Database.calculateLevel(Number(user.Level?.xp || 0)).level,
              xpStats: {
                chat: Number(user.stats?.xpStats?.chat || 0),
                voice: Number(user.stats?.xpStats?.voice || 0),
              },
              gameRecords: user.stats?.gameRecords || {
                2048: { highScore: 0 },
                snake: { highScore: 0 },
              },
              seasonStats: {
                rank: sortedUsers.findIndex((u) => u.id === user.id) + 1,
                totalXP: Number(user.Level?.seasonXp || 0),
              },
            })),
            currentPage: page + 1,
            totalPages: Math.max(1, currentTotalPages),
            highlightedPosition,
            pageSize,
            returnDominant: true, // Request dominant color
          },
          { image: 2, emoji: 1 }, // Example weights
          i18n
        );

        const attachment = new AttachmentBuilder(pngBuffer, {
          name: `leaderboard.avif`,
        });

        // Create leaderboard component builder with the correct mode
        const leaderboardComponent = new ComponentBuilder({
          dominantColor,
          mode: builderMode, // Use 'v1' or 'v2' based on context
        })
          .addText(i18n.__(`commands.economy.leaderboard.title`), "header3")
          .addImage(`attachment://leaderboard.avif`);

        // Create navigation buttons
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

        console.log("Button states:", {
          page,
          currentTotalPages,
          prevDisabled: page <= 0,
          nextDisabled: page >= currentTotalPages - 1,
        });

        // Add buttons using the builder's method (works for both modes)
        leaderboardComponent.addButtons(prevButton, nextButton);

        if (validUsers.length > 0) {
          // Create category selector
          const categoryMenu = new StringSelectMenuBuilder()
            .setCustomId("select_category")
            .setPlaceholder(
              i18n.__("commands.economy.leaderboard.selectCategory")
            )
            .addOptions([
              {
                label: i18n.__("commands.economy.leaderboard.categories.total"),
                value: "total",
                default: category === "total",
              },
              {
                label: i18n.__(
                  // Corrected i18n call
                  "commands.economy.leaderboard.categories.balance"
                ),
                value: "balance",
                default: category === "balance",
              },
              {
                label: i18n.__("commands.economy.leaderboard.categories.bank"),
                value: "bank",
                default: category === "bank",
              },
              {
                label: i18n.__("commands.economy.leaderboard.categories.level"),
                value: "level",
                default: category === "level",
              },
              /*{
                label: i18n.__("commands.economy.leaderboard.categories.games"),
                value: "games",
                default: category === "games",
              },
              {
                label: i18n.__("commands.economy.leaderboard.categories.season"),
                value: "season",
                default: category === "season",
              },*/
            ]);

          // Add category selector using the builder (works for both modes)
          leaderboardComponent
            .createActionRow()
            .addComponents(categoryMenu)
            .done();

          // Create user selector
          const selectOptions = validUsers.map((user, index) => ({
            label: `${startIndex + index + 1}. ${user.name.slice(0, 20)}`,
            value: (startIndex + index + 1).toString(),
            description: `${i18n.__(
              // Corrected i18n call
              `commands.economy.leaderboard.categories.${category}`
            )}: ${user.displayValue}`.slice(0, 50),
          }));

          const selectMenu = new StringSelectMenuBuilder()
            .setCustomId("select_user")
            .setPlaceholder(i18n.__("commands.economy.leaderboard.selectUser")) // Use localized placeholder
            .addOptions(selectOptions);

          // Add user selector using the builder (works for both modes)
          leaderboardComponent
            .createActionRow()
            .addComponents(selectMenu)
            .done();
        }

        // Return the complete reply options object using the builder
        return leaderboardComponent.toReplyOptions({ files: [attachment] });
      }

      // Call findMyself after initial leaderboard generation setup is complete
      // but before sending the first message
      await findMyself();

      console.log("Initial state:", {
        page,
        currentTotalPages,
        highlightedPosition,
        category,
      });
      let message; // Declare message variable here

      try {
        const messageOptions = await generateLeaderboardMessage();
        // No need to add flags here, toReplyOptions handles V1/V2 structure
        console.log(
          "Generated message options:",
          JSON.stringify(messageOptions, null, 2)
        );

        if (isAiContext) {
          // AI context: Use proxy's reply method
          message = await interaction.reply(messageOptions); // interaction is the proxy
        } else {
          // Normal context: Edit the deferred reply
          message = await interaction.editReply(messageOptions);
        }
      } catch (error) {
        console.error("Error updating leaderboard message:", error);
        const errorOptions = {
          content: i18n.__("commands.economy.leaderboard.error"),
          ephemeral: true,
          components: [],
          files: [],
          embeds: [], // Ensure embeds are cleared on error
        };
        if (isAiContext) {
          // AI context: Throw error for the proxy to handle
          throw new Error(`Leaderboard command failed: ${error.message}`);
        } else {
          // Normal context: Edit reply with error
          try {
            message = await interaction.editReply(errorOptions);
          } catch (editError) {
            console.error(
              "Failed to edit reply with error message:",
              editError
            );
            message = null; // Ensure message is null if edit fails
          }
        }
      }

      // Create collector for buttons and select menu if a message was successfully sent/edited
      if (message && message.editable) {
        // Check if message exists and is editable
        const collector = message.createMessageComponentCollector({
          filter: (i) => i.user.id === interaction.user.id,
          time: 60000, // 60 seconds
        });

        collector.on("collect", async (i) => {
          try {
            // Defer update immediately
            await i.deferUpdate();

            let needsUpdate = false;
            if (i.customId === "prev_page") {
              console.log("Previous page clicked", {
                currentPage: page,
                currentTotalPages,
                isDisabled: page <= 0,
              });
              if (page > 0) {
                page--;
                console.log("Moving to previous page:", page);
                highlightedPosition = null;
                needsUpdate = true;
              }
            } else if (i.customId === "next_page") {
              console.log("Next page clicked", {
                currentPage: page,
                currentTotalPages,
                isDisabled: page >= currentTotalPages - 1,
              });

              if (page < currentTotalPages - 1) {
                page++;
                console.log("Moving to next page:", page);
                highlightedPosition = null;
                needsUpdate = true;
              }
            } else if (i.customId === "select_user") {
              highlightedPosition = parseInt(i.values[0]);
              console.log("Select user:", { highlightedPosition });
              needsUpdate = true;
            } else if (i.customId === "select_category") {
              category = i.values[0];
              page = 0;
              highlightedPosition = null;
              console.log("Category changed:", {
                category,
                page,
                currentTotalPages,
                highlightedPosition,
              });
              needsUpdate = true;
            }

            // If any action required an update, regenerate and edit the message
            if (needsUpdate) {
              const newMessageOptions = await generateLeaderboardMessage();
              console.log(
                "Updating message with options:",
                JSON.stringify(newMessageOptions, null, 2)
              );
              await message.edit(newMessageOptions);
            }
          } catch (collectError) {
            console.error(
              "Error processing leaderboard interaction:",
              collectError
            );
            // Optionally send an ephemeral message to the user
            try {
              await i.followUp({
                content: "An error occurred while updating the leaderboard.",
                ephemeral: true,
              });
            } catch (followUpError) {
              console.error("Failed to send error follow-up:", followUpError);
            }
          }
        });

        collector.on("end", (collected, reason) => {
          console.log(
            `Leaderboard collector ended. Reason: ${reason}, Collected: ${collected.size}`
          );
          if (message.editable) {
            // Remove components after timeout
            message
              .edit({ components: [] })
              .catch((e) =>
                console.error(
                  "Failed to remove components on collector end:",
                  e
                )
              );
          }
        });
      }
    } catch (error) {
      console.error("Error executing leaderboard command:", error);
      // Send error message
      const errorOptions = {
        content: i18n.__("commands.economy.leaderboard.error"),
        ephemeral: true,
        components: [],
        embeds: [],
        files: [],
      };
      // Check context for error handling
      const isAiContextCheck = !!interaction._isAiProxy;
      if (isAiContextCheck) {
        // AI context: Rethrow the error to be caught by toolExecutor
        throw error; // Rethrow the original error
      } else {
        // Normal context: Try to edit the deferred reply
        if (interaction.replied || interaction.deferred) {
          await interaction.editReply(errorOptions).catch(() => {});
        } else {
          // Fallback if not deferred/replied
          await interaction.reply(errorOptions).catch(() => {});
        }
      }
    }
  },
};
