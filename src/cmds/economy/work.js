import { SlashCommandSubcommandBuilder } from "discord.js";
import {
  EmbedBuilder,
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} from "discord.js";
import Database from "../../database/client.js";
import { generateImage } from "../../utils/imageGenerator.js";
import { loadGames, getGameModule } from "../../utils/loadGames.js";
import i18n from "../../utils/newI18n.js";

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
      },
    },
    specialForCategory: {
      en: "Specially for Eleazar",
      ru: "Специально для Eleazar",
      uk: "Спеціально для Eleazar",
    },
    oldGamesCategory: {
      en: "Our old games",
      ru: "Наши старые игры",
      uk: "Наші старі ігри",
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
    await interaction.deferReply();

    try {
      // Explicitly set locale based on interaction
      const locale = interaction.locale || interaction.guildLocale || "en";
      const normalizedLocale = locale.split("-")[0].toLowerCase();

      // Load games and convert Map to array
      const gamesMap = await loadGames();
      const gamesArray = Array.from(gamesMap.values());
      console.log(
        `[work] Loaded ${gamesArray.length} games with titles:`,
        gamesArray.map((g) => `${g.id}: "${g.title}"`)
      );

      if (gamesArray.length === 0) {
        throw new Error("No games found");
      }

      // Check if a specific game was requested
      const requestedGame = interaction.options.getString("game");
      if (requestedGame) {
        // Validate the requested game exists
        if (!gamesMap.has(requestedGame)) {
          await interaction.editReply({
            content: i18n.__("commands.economy.work.gameNotFound"),
            ephemeral: true,
          });
          return;
        }

        console.log(`[work] Specific game requested: ${requestedGame}`);
        // Use getGameModule to get the game with enhanced i18n support
        const gameModule = await getGameModule(requestedGame);
        if (!gameModule?.default) {
          await interaction.editReply({
            content: i18n.__("commands.economy.work.gameNotFound"),
            ephemeral: true,
          });
          return;
        }

        // Execute the game - enhanced i18n is already injected
        await gameModule.default.execute(interaction, i18n);
        return;
      }

      // Get user and game records in a single operation
      const gameRecords = await Database.getGameRecords(
        interaction.guild.id,
        interaction.user.id
      );

      const games = {
        [i18n.__("commands.economy.work.specialForCategory")]: {
          avatar: interaction.client.user.displayAvatarURL({
            extension: "png",
            size: 1024,
          }),
          games_list: gamesArray.map((game) => ({
            ...game,
            highScore: gameRecords[game.id]?.highScore || 0,
          })),
        },
      };

      let selectedGame = null;
      let highlightedGame = 0;
      let currentCategory = 0;

      // Store current game records to avoid fetching again
      let currentGameRecords = gameRecords;

      // Get user data once for initial rendering
      let userData = await Database.getUser(
        interaction.guild.id,
        interaction.user.id
      );

      const generateGameMessage = async () => {
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

        const embed = new EmbedBuilder()
          .setColor(dominantColor?.embedColor)
          .setAuthor({
            name: i18n.__(`commands.economy.work.title`),
            iconURL: interaction.user.displayAvatarURL(),
          })
          .setImage(`attachment://work_games.png`)
          .setTimestamp();

        // Create category select menu
        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId("select_category")
          .setPlaceholder(i18n.__(`commands.economy.work.selectCategory`))
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
          .setLabel(i18n.__(`commands.economy.work.playGame`))
          .setStyle(
            selectedGame === currentCategoryGames[highlightedGame]?.id
              ? ButtonStyle.Secondary
              : ButtonStyle.Success
          );

        const buttonRow = new ActionRowBuilder().addComponents(
          prevButton,
          selectButton,
          nextButton
        );

        const selectRow = new ActionRowBuilder().addComponents(selectMenu);

        return {
          embeds: [embed],
          files: [attachment],
          components: [selectRow, buttonRow],
        };
      };

      const message = await interaction.editReply(await generateGameMessage());

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
        console.log(
          `[work-collect] Setting locale to ${normalizedInteractionLocale} for interaction`
        );

        const categoryNames = Object.keys(games);
        const currentCategoryGames =
          games[categoryNames[currentCategory]]?.games_list;

        if (!currentCategoryGames || currentCategoryGames.length === 0) {
          await i.reply({
            content: i18n.__(`commands.economy.work.noGamesAvailable`),
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
              content: i18n.__(`commands.economy.work.gameNotFound`),
              ephemeral: true,
            });

            return;
          }

          selectedGame = game.id;
          console.log(
            `[work-collect] Selected game ${game.id}: "${game.title}"`
          );

          // Remove components before starting game
          await i.update({ components: [] });

          try {
            // Import and execute the game module
            console.log(`[work-collect] Loading game module: ${game.id}`);
            // Use getGameModule to get the game with enhanced i18n support
            const gameModule = await getGameModule(game.id);
            if (!gameModule?.default) {
              throw new Error(`Game module ${game.id} not found or invalid`);
            }

            await gameModule.default.execute(i, i18n);
          } catch (error) {
            console.error(`Error executing game ${game.id}:`, error);

            await i.followUp({
              content: i18n.__(`commands.economy.work.gameError`, {
                game: game.title,
              }),
              ephemeral: true,
            });
          }
        }
      });

      collector.on("end", () => {
        if (message.editable) {
          message.edit({ components: [] }).catch(() => {});
        }
      });
    } catch (error) {
      console.error("Error in work command:", error);
      await interaction.editReply({
        content: i18n.__("commands.economy.error"),
        ephemeral: true,
      });
    }
  },
};
