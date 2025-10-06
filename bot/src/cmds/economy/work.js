import { MessageFlags, SlashCommandSubcommandBuilder } from "discord.js";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  AttachmentBuilder,
} from "discord.js";
import hubClient from "../../api/hubClient.js";
//import legacyDb from "../../database/legacyClient.js"; // Import legacy client
import { generateImage } from "../../utils/imageGenerator.js";
import { loadGames, getGameModule } from "../../utils/loadGames.js";
import { ComponentBuilder } from "../../utils/componentConverter.js";

export default {
  data: () => {
    const builder = new SlashCommandSubcommandBuilder()
      .setName("work")
      .setDescription("Play games to earn money")
      .addStringOption((option) =>
        option
          .setName("game")
          .setDescription("Choose a specific game to play directly")
          .setRequired(false)
          .addChoices(
            {
              name: "snake",
              value: "snake",
            },
            {
              name: "2048",
              value: "2048",
            },
            {
              name: "rpg_clicker2",
              value: "rpg_clicker2",
            },
            /*{
              name: "mining2",
              value: "mining2",
            },*/
            {
              name: "coinflip",
              value: "coinflip",
            },
            {
              name: "tower",
              value: "tower",
            },
            {
              name: "Crypto 2.0",
              value: "crypto2",
            }
          )
      );

    return builder;
  },

  localization_strings: {
    command: {
      name: {
        ru: "работать",
        uk: "працювати",
      },
      description: {
        ru: "Играйте в игры, чтобы заработать деньги",
        uk: "Грайте в ігри, щоб заробити гроші",
      },
    },
    options: {
      game: {
        name: {
          ru: "игра",
          uk: "гра",
        },
        description: {
          ru: "Выберите конкретную игру для прямого запуска",
          uk: "Виберіть конкретну гру для прямого запуску",
        },
        choices: {
          crypto2: {
            name: {
              en: "Crypto 2.0",
              ru: "Крипто 2.0",
              uk: "Кріпто 2.0",
            },
          },
        },
      },
    },
    standardGamesCategory: {
      en: "Standard Games",
      ru: "Обычные Игры",
      uk: "Звичайні Ігри",
    },
    riskyGamesCategory: {
      en: "Risky Games",
      ru: "Рискованные Игры",
      uk: "Ризиковані Ігри",
    },
    oldGamesCategory: {
      en: "Legacy Games",
      ru: "Старые Игры",
      uk: "Старі Ігри",
    },
    title: {
      en: "Game Selection",
      ru: "Выбор игры",
      uk: "Вибір гри",
    },
    selectCategory: {
      en: "Select a game category",
      ru: "Выберите категорию игр",
      uk: "Виберіть категорію ігор",
    },
    playGame: {
      en: "Play",
      ru: "Играть",
      uk: "Грати",
    },
    gameStarted: {
      en: "Starting {{game}}...",
      ru: "Запуск {{game}}...",
      uk: "Запуск {{game}}...",
    },
    error: {
      en: "An error occurred while processing your work request",
      ru: "Произошла ошибка при обработке вашего рабочего запроса",
      uk: "Сталася помилка під час обробки вашого робочого запиту",
    },
    gameError: {
      en: "Error starting {{game}}. Please try again.",
      ru: "Ошибка при запуске {{game}}. Пожалуйста, попробуйте снова.",
      uk: "Помилка при запуску {{game}}. Будь ласка, спробуйте знову.",
    },
    noGamesAvailable: {
      en: "No games are currently available.",
      ru: "В данный момент игры недоступны.",
      uk: "На даний момент ігри недоступні.",
    },
    gameNotFound: {
      en: "The selected game was not found.",
      ru: "Выбранная игра не найдена.",
      uk: "Вибрана гра не знайдена.",
    },
  },

  async execute(interaction, i18n) {
    return interaction.reply({
      content: "Команда устарела",
      ephemeral: true,
    });
    // Always use v2 builder mode
    const builderMode = "v2";

    // Always defer reply
    await interaction.deferReply();

    try {
      // Explicitly set locale based on interaction
      const locale = interaction.locale || interaction.guildLocale || "en";
      const normalizedLocale = locale.split("-")[0].toLowerCase();

      // Load games and convert Map to array
      const gamesMap = await loadGames(i18n);
      const gamesArray = Array.from(gamesMap.values());
      console.log(
        `[work] Loaded ${gamesArray.length} games with titles:`,
        gamesArray.map((g) => `${g.id}: "${g.title}"`)
      );

      // Add legacy RPG Clicker game manually
      gamesMap.set("rpg_clicker2", {
        id: "rpg_clicker2",
        title: "RPG Clicker",
        emoji: "⚔️",
        file: "../games/ported/rpg_clicker2.js",
        isLegacy: true,
      });

      if (gamesMap.size === 0) {
        throw new Error("No games found");
      }

      // Check if a specific game was requested
      const requestedGame = interaction.options.getString("game");
      if (requestedGame) {
        // Validate the requested game exists
        if (!gamesMap.has(requestedGame)) {
          await interaction.editReply({
            content: await i18n.__("commands.economy.work.gameNotFound"),
            ephemeral: true,
          });
          return;
        }

        console.log(`[work] Specific game requested: ${requestedGame}`);
        // Use getGameModule to get the game with enhanced i18n support
        const gameModule = await getGameModule(requestedGame, i18n);
        if (!gameModule?.default) {
          await interaction.editReply({
            content: await i18n.__("commands.economy.work.gameNotFound"),
            ephemeral: true,
          });
          return;
        }

        // Execute the game - handle legacy vs non-legacy
        if (gameModule.default.isLegacy) {
          // Pass legacy DB for legacy games
          //await gameModule.default.execute(interaction, legacyDb);
        } else {
          // Pass i18n for non-legacy games
          await gameModule.default.execute(interaction, i18n);
        }
        return;
      }

      // Get user and game records in a single operation
      const gameRecords = await hubClient.getGameRecords(
        interaction.guild.id,
        interaction.user.id
      );

      // Filter games into categories
      const standardGamesArray = gamesArray.filter(
        (game) =>
          !game.isLegacy &&
          !game.file.startsWith("games/risky/") &&
          !game.file.startsWith("games/ported/") // Ensure ported are not standard
      );
      const riskyGamesArray = gamesArray.filter((game) =>
        game.file.startsWith("games/risky/")
      );
      const legacyGamesArray = gamesArray.filter(
        (game) => game.isLegacy || game.file.startsWith("games/ported/")
      );

      // Use translated category names
      const standardCategoryName = await i18n.__(
        "commands.economy.work.standardGamesCategory"
      );
      const riskyCategoryName = await i18n.__(
        "commands.economy.work.riskyGamesCategory"
      );
      const legacyCategoryName = await i18n.__(
        "commands.economy.work.oldGamesCategory"
      );

      const games = {};

      // Add categories only if they have games
      if (standardGamesArray.length > 0) {
        games[standardCategoryName] = {
          avatar: interaction.client.user.displayAvatarURL({
            extension: "png",
            size: 1024,
          }),
          games_list: standardGamesArray.map((game) => ({
            ...game,
            highScore: gameRecords[game.id]?.highScore || 0,
          })),
        };
      }

      if (riskyGamesArray.length > 0) {
        games[riskyCategoryName] = {
          avatar: interaction.client.user.displayAvatarURL({
            extension: "png",
            size: 1024,
          }),
          games_list: riskyGamesArray.map((game) => ({
            ...game,
            // Risky games might not track high score in the same way, adjust if needed
            highScore: gameRecords[game.id]?.highScore || "-", // Or keep 0
          })),
        };
      }

      if (legacyGamesArray.length > 0) {
        games[legacyCategoryName] = {
          avatar: interaction.client.user.displayAvatarURL({
            extension: "png",
            size: 1024,
          }),
          games_list: legacyGamesArray.map((game) => ({
            ...game,
            highScore: "-", // Legacy games might not have scores tracked
          })),
        };
      }

      // Handle case where no games are categorized (shouldn't happen if loadGames works)
      if (Object.keys(games).length === 0) {
        console.warn("[work] No games were categorized.");
        await interaction.editReply({
          content: await i18n.__("commands.economy.work.noGamesAvailable"),
          ephemeral: true,
        });
        return;
      }

      let selectedGame = null;
      let highlightedGame = 0;
      let currentCategory = 0; // Index of the current category

      // Store current game records to avoid fetching again
      let currentGameRecords = gameRecords;

      // Get user data once for initial rendering
      let userData = await hubClient.getUser(
        interaction.guild.id,
        interaction.user.id
      );

      const generateGameMessage = async (options = {}) => {
        const { disableInteractions = false } = options;

        const categoryNames = Object.keys(games);
        const currentCategoryGames =
          games[categoryNames[currentCategory]]?.games_list || [];
        const currentGame = currentCategoryGames[highlightedGame];

        console.log(
          `[work] Generating message with ${currentCategoryGames.length} games in category "${categoryNames[currentCategory]}"`
        );

        if (currentGame) {
          console.log(
            `[work] Current highlighted game: ${currentGame.id} - "${currentGame.title}"`
          );
        }

        // Generate game launcher image
        const [pngBuffer, dominantColor] = await generateImage(
          "GameLauncher",
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
            locale: i18n.getLocale(),
            database: userData,
            games: games,
            selectedGame,
            currentLocale: i18n.getLocale(),
            highlightedGame,
            highlightedCategory: currentCategory,
            returnDominant: true,
            gameStats: currentGameRecords, // Use existing game records
          },
          { image: 2, emoji: 1 },
          i18n
        );

        const attachment = new AttachmentBuilder(pngBuffer, {
          name: `work_games.png`,
        });

        // Create game launcher component
        const gameLauncherComponent = new ComponentBuilder({
          dominantColor,
          mode: builderMode,
        })
          .setColor(dominantColor?.embedColor)
          .addText(await i18n.__(`commands.economy.work.title`), "header3")
          .addImage(`attachment://work_games.png`);

        // Create category select menu
        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId("select_category")
          .setPlaceholder(await i18n.__(`commands.economy.work.selectCategory`))
          .addOptions(
            categoryNames.map((category, index) => ({
              label: category,
              value: index.toString(),
              default: currentCategory === index,
            }))
          );

        // Create navigation buttons
        const prevButton = new ButtonBuilder()
          .setCustomId("prev_game")
          .setLabel("◀")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(highlightedGame === 0);

        const nextButton = new ButtonBuilder()
          .setCustomId("next_game")
          .setLabel("▶")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(highlightedGame >= currentCategoryGames.length - 1);

        const selectButton = new ButtonBuilder()
          .setCustomId("select_game")
          .setLabel(await i18n.__(`commands.economy.work.playGame`))
          .setStyle(
            selectedGame === currentCategoryGames[highlightedGame]?.id
              ? ButtonStyle.Secondary
              : ButtonStyle.Success
          );

        // Add components to the launcher
        const selectRow = new ActionRowBuilder().addComponents(selectMenu);

        // Conditionally add interactive components
        if (!disableInteractions) {
          gameLauncherComponent.addActionRow(selectRow);
        }

        const buttonRow = new ActionRowBuilder().addComponents(
          prevButton,
          selectButton,
          nextButton
        );

        // Conditionally add interactive components
        if (!disableInteractions) {
          gameLauncherComponent.addActionRow(buttonRow);
        }

        // Return the complete reply options object using the builder
        return gameLauncherComponent.toReplyOptions({
          files: [attachment],
        });
      };

      // Initial reply/edit
      const initialMessageOptions = await generateGameMessage();

      // Edit deferred reply
      const message = await interaction.editReply(initialMessageOptions);

      // Create collector for buttons and select menu
      const collector = message.createMessageComponentCollector({
        filter: (i) => i.user.id === interaction.user.id,
        time: 60000,
      });

      collector.on("collect", async (i) => {
        // Ensure locale is consistently set during interaction handling
        const interactionLocale = i.locale || i.guildLocale || normalizedLocale;
        const normalizedInteractionLocale = interactionLocale
          .split("-")[0]
          .toLowerCase();
        // No need to set i18n locale here, it should be handled by middleware or initial setup
        console.log(
          `[work-collect] Handling interaction with locale ${normalizedInteractionLocale}`
        );

        const categoryNames = Object.keys(games);
        const currentCategoryGames =
          games[categoryNames[currentCategory]]?.games_list;

        if (!currentCategoryGames || currentCategoryGames.length === 0) {
          await i.reply({
            content: await i18n.__(`commands.economy.work.noGamesAvailable`),
            ephemeral: true,
          });
          return;
        }

        if (i.customId === "select_category") {
          currentCategory = parseInt(i.values[0]);
          highlightedGame = 0;
          selectedGame = null;
          console.log(
            `[work-collect] Selected category ${currentCategory}: "${categoryNames[currentCategory]}"`
          );
          await i.update(await generateGameMessage());
        } else if (i.customId === "prev_game") {
          if (highlightedGame > 0) {
            highlightedGame--;
            selectedGame = null;
            console.log(
              `[work-collect] Navigated to previous game: ${highlightedGame}`
            );
            await i.update(await generateGameMessage());
          }
        } else if (i.customId === "next_game") {
          if (highlightedGame < currentCategoryGames.length - 1) {
            highlightedGame++;
            selectedGame = null;
            console.log(
              `[work-collect] Navigated to next game: ${highlightedGame}`
            );
            await i.update(await generateGameMessage());
          }
        } else if (i.customId === "select_game") {
          const game = currentCategoryGames[highlightedGame];
          if (!game) {
            await i.reply({
              content: await i18n.__(`commands.economy.work.gameNotFound`),
              ephemeral: true,
            });
            return;
          }

          selectedGame = game.id;
          console.log(
            `[work-collect] Selected game ${game.id}: \"${game.title}\" (Legacy: ${game.isLegacy})`
          );

          // Defer the update instead of sending a full update
          await i.deferUpdate();

          try {
            // Load the game module using the stored relative file path
            console.log(
              `[work-collect] Loading game module: ${game.id} from ${game.file}`
            );
            const gameModule = await getGameModule(game.id, i18n);

            if (!gameModule?.default?.execute) {
              // Check if execute function exists
              throw new Error(
                `Game module ${game.id} missing execute function`
              );
            }

            // Execute based on legacy status
            if (game.isLegacy) {
              console.log(`[work-collect] Executing legacy game: ${game.id}`);
              // Assuming legacy game execute signature is (client, message)
              // We need to adapt or pass legacyDb somehow.
              // Let's pass interaction and legacyDb for now.
              // IMPORTANT: The legacy game file rpg_clicker2.js needs modification
              // to accept (interaction, legacyDb) and use legacyDb for db calls.
              //await gameModule.default.execute(interaction, legacyDb); // Pass interaction and legacy DB
            } else {
              console.log(`[work-collect] Executing standard game: ${game.id}`);
              // For non-legacy games like Tower
              // Pass the ORIGINAL interaction from the work command's scope
              await gameModule.default.execute(interaction, i18n);
            }
          } catch (error) {
            console.error(`Error executing game ${game.id}:`, error);
            // Use followUp as update was already sent to remove components
            await i.followUp({
              content: await i18n.__(`commands.economy.work.gameError`, {
                game: game.title,
              }),
              ephemeral: true,
            });
          }
        }
      });

      collector.on("end", async () => {
        if (message.editable) {
          try {
            // Regenerate the message without interactive components
            const finalMessage = await generateGameMessage({
              disableInteractions: true,
            });
            await message.edit(finalMessage);
          } catch (error) {
            console.error("Error updating components on end:", error);
            // Fallback: Try removing components if regeneration fails
            await message.edit({ components: [] }).catch(() => {});
          }
        }
      });
    } catch (error) {
      console.error("Error in work command:", error);
      // Create error options with appropriate message
      const errorOptions = {
        content: await i18n.__("commands.economy.work.error"),
        ephemeral: true,
      };

      // Send error response based on interaction state
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply(errorOptions).catch(() => {});
      } else {
        await interaction.reply(errorOptions).catch(() => {});
      }
    }
  },
};
