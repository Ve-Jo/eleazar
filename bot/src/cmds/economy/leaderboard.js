import {
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  SlashCommandSubcommandBuilder,
  MessageFlags,
} from "discord.js";
import hubClient from "../../api/hubClient.js";
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
            { name: "Level", value: "level" },
            /*{ name: "Games", value: "games" },
            { name: "Season XP", value: "season" }*/
          ),
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
    noUsersOnPage: {
      en: "No valid users found on this page.",
      ru: "На этой странице не найдено действительных пользователей.",
      uk: "На цій сторінці не знайдено дійсних користувачів.",
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
      const fetchBufferSize = 5; // Fetch a few extra users

      // Always use v2 builder mode
      const builderMode = "v2";

      async function findMyself() {
        if (highlightedPosition === null) {
          const userIndex = sortedUsers.findIndex(
            (user) => user.id === interaction.user.id,
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
          guildUsers = await hubClient.getSeasonLeaderboard(
            250, // Limit to reasonable amount
          );
        } else {
          // For guild-specific categories
          guildUsers = await hubClient.getGuildUsers(guild.id);
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
                displayValue = hubClient.calculateLevel(sortValue).level;
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
        // Fetch slightly more users than needed to compensate for potential fetch failures
        const extendedEndIndex = startIndex + pageSize + fetchBufferSize;
        const potentialUsersToDisplay = sortedUsers.slice(
          startIndex,
          extendedEndIndex,
        );

        // Fetch member data and process colors for each potential user
        const potentialUsersWithData = await Promise.all(
          potentialUsersToDisplay.map(async (userData) => {
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
          }),
        );

        // Filter out failed fetches and take the first 'pageSize' valid users
        const validUsersWithData = potentialUsersWithData.filter(
          (user) => user !== null,
        );
        const usersToDisplayFinal = validUsersWithData.slice(0, pageSize);

        // Find the index of the highlighted user *within the final displayed list* if they exist
        const highlightedIndexOnPage =
          highlightedPosition !== null
            ? usersToDisplayFinal.findIndex(
                (u) =>
                  sortedUsers.findIndex((su) => su.id === u.id) + 1 ===
                  highlightedPosition,
              )
            : -1;

        // Create navigation buttons (always needed, regardless of whether the page is empty)
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

        // Handle case where the page is empty after filtering, but the leaderboard isn't overall empty
        if (usersToDisplayFinal.length === 0 && sortedUsers.length > 0) {
          // Create a temporary builder just for the empty page message
          const emptyPageBuilder = new ComponentBuilder({ mode: builderMode });
          emptyPageBuilder
            .addText(
              (await i18n.__("commands.economy.leaderboard.noUsersOnPage")) ||
                "No valid users found on this page.",
            )
            .addButtons(prevButton, nextButton); // Add the navigation buttons

          return emptyPageBuilder.toReplyOptions({}); // Return simplified options
        }

        // --- Generate leaderboard image and full components ONLY if there are users to display ---

        // Generate leaderboard image using the final list
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
            users: usersToDisplayFinal.map((user, index) => {
              // Use usersToDisplayFinal
              // Calculate the original position based on the sortedUsers array
              const originalPosition =
                sortedUsers.findIndex((su) => su.id === user.id) + 1;
              return {
                id: user.id,
                position: originalPosition, // Use original position
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
                level: hubClient.calculateLevel(Number(user.Level?.xp || 0))
                  .level,
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
              };
            }),
            currentPage: page + 1,
            totalPages: Math.max(1, currentTotalPages),
            highlightedPosition, // Keep original highlighted position number
            pageSize,
            returnDominant: true, // Request dominant color
          },
          { image: 2, emoji: 1 }, // Example weights
          i18n,
        );

        const attachment = new AttachmentBuilder(pngBuffer, {
          name: `leaderboard.avif`,
        });

        // Create leaderboard component builder now that we have users and the dominant color
        const leaderboardComponent = new ComponentBuilder({
          dominantColor, // Pass the actual dominant color from the image
          mode: builderMode,
        });

        // Add image and title to the component builder
        leaderboardComponent
          .addText(
            await i18n.__(`commands.economy.leaderboard.title`),
            "header3",
          )
          .addImage(`attachment://leaderboard.avif`);

        // Add navigation buttons using the builder's method (already created earlier)
        leaderboardComponent.addButtons(prevButton, nextButton);

        if (usersToDisplayFinal.length > 0) {
          // Create category selector
          const categoryMenu = new StringSelectMenuBuilder()
            .setCustomId("select_category")
            .setPlaceholder(
              await i18n.__("commands.economy.leaderboard.selectCategory"),
            )
            .addOptions([
              {
                label: await i18n.__(
                  "commands.economy.leaderboard.categories.total",
                ),
                value: "total",
                default: category === "total",
              },
              {
                label: await i18n.__(
                  // Corrected i18n call
                  "commands.economy.leaderboard.categories.balance",
                ),
                value: "balance",
                default: category === "balance",
              },
              {
                label: await i18n.__(
                  "commands.economy.leaderboard.categories.bank",
                ),
                value: "bank",
                default: category === "bank",
              },
              {
                label: await i18n.__(
                  "commands.economy.leaderboard.categories.level",
                ),
                value: "level",
                default: category === "level",
              },
              /*{
                label: await i18n.__("commands.economy.leaderboard.categories.games"),
                value: "games",
                default: category === "games",
              },
              {
                label: await i18n.__("commands.economy.leaderboard.categories.season"),
                value: "season",
                default: category === "season",
              },*/
            ]);

          // Add category selector using the builder (works for both modes)
          leaderboardComponent
            .createActionRow()
            .addComponents(categoryMenu)
            .done();

          // Create user selector based on the final displayed users
          const selectOptions = await Promise.all(
            usersToDisplayFinal.map(async (user, index) => {
              // Use usersToDisplayFinal
              const originalPosition =
                sortedUsers.findIndex((su) => su.id === user.id) + 1; // Get original position
              return {
                label: `${originalPosition}. ${user.name.slice(0, 20)}`, // Use original position
                value: originalPosition.toString(), // Use original position as value
                description: `${await i18n.__(
                  `commands.economy.leaderboard.categories.${category}`,
                )}: ${user.displayValue}`.slice(0, 50),
              };
            }),
          );

          const selectMenu = new StringSelectMenuBuilder()
            .setCustomId("select_user")
            .setPlaceholder(
              await i18n.__("commands.economy.leaderboard.selectUser"),
            ) // Use localized placeholder
            .addOptions(selectOptions);

          // Add user selector using the builder (works for both modes)
          leaderboardComponent
            .createActionRow()
            .addComponents(selectMenu)
            .done();
        }

        // Return the complete reply options object using the builder
        // Ensure the attachment is only included when the image was generated
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
          JSON.stringify(messageOptions, null, 2),
        );

        // Edit the deferred reply
        message = await interaction.editReply(messageOptions);
      } catch (error) {
        console.error("Error updating leaderboard message:", error);
        const errorOptions = {
          content: await i18n.__("commands.economy.leaderboard.error"),
          ephemeral: true,
          components: [],
          files: [],
          embeds: [], // Ensure embeds are cleared on error
        };
        // Try to edit the deferred reply or send a new reply
        try {
          if (interaction.replied || interaction.deferred) {
            await interaction.editReply(errorOptions);
          } else {
            // Fallback if not deferred/replied - unlikely if deferReply was called
            await interaction.reply(errorOptions);
          }
        } catch (finalError) {
          console.error("Failed to send final error message:", finalError);
        }
      }

      // Create collector for buttons and select menu if a message was successfully sent/edited
      if (message && message.editable) {
        // Check if message exists and is editable
        const collector = message.createMessageComponentCollector({
          // Ensure filter only works on button/select, not other components if any were added
          filter: (i) =>
            i.user.id === interaction.user.id &&
            (i.isButton() || i.isStringSelectMenu()),
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
                JSON.stringify(newMessageOptions, null, 2),
              );
              await message.edit(newMessageOptions);
            }
          } catch (collectError) {
            console.error(
              "Error processing leaderboard interaction:",
              collectError,
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
            `Leaderboard collector ended. Reason: ${reason}, Collected: ${collected.size}`,
          );
          // Check if the message exists and is still editable before trying to edit
          if (message && message.editable) {
            // Try to edit, catch potential errors if message deleted during collector lifetime
            message.edit({ components: [] }).catch((e) => {
              if (e.code !== 10008) {
                // Ignore "Unknown Message" errors
                console.error(
                  "Failed to remove components on collector end:",
                  e,
                );
              }
            });
          } else {
            console.log("Collector ended, but message was not editable.");
          }
        });
      }
    } catch (error) {
      console.error("Error executing leaderboard command:", error);
      // Send error message
      const errorOptions = {
        content: await i18n.__("commands.economy.leaderboard.error"),
        ephemeral: true,
        components: [],
        embeds: [],
        files: [],
      };
      // Try to edit the deferred reply or send a new reply
      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.editReply(errorOptions);
        } else {
          // Fallback if not deferred/replied - unlikely if deferReply was called
          await interaction.reply(errorOptions);
        }
      } catch (finalError) {
        console.error("Failed to send final error message:", finalError);
      }
    }
  },
};
