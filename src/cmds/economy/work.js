import {
  SlashCommandSubcommand,
  I18nCommandBuilder,
  SlashCommandOption,
  OptionType,
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
import { generateImage } from "../../utils/imageGenerator.js";
import { loadGames } from "../../utils/loadGames.js";
import { DEFAULT_VALUES } from "../../database/client.js";

export default {
  data: () => {
    const i18nBuilder = new I18nCommandBuilder("economy", "work");

    const subcommand = new SlashCommandSubcommand({
      name: i18nBuilder.getSimpleName(i18nBuilder.translate("name")),
      description: i18nBuilder.translate("description"),
      name_localizations: i18nBuilder.getLocalizations("name"),
      description_localizations: i18nBuilder.getLocalizations("description"),
      options: [
        new SlashCommandOption({
          type: OptionType.STRING,
          name: "game",
          description: i18nBuilder.translateOption("game", "description"),
          required: false,
          name_localizations: i18nBuilder.getOptionLocalizations(
            "game",
            "name"
          ),
          description_localizations: i18nBuilder.getOptionLocalizations(
            "game",
            "description"
          ),
          choices: [
            { name: "Snake", value: "snake" },
            { name: "2048", value: "2048" },
          ],
        }),
      ],
    });

    return subcommand;
  },
  async execute(interaction, i18n) {
    await interaction.deferReply();

    try {
      // Load games and convert Map to array
      const gamesMap = await loadGames(i18n);
      const gamesArray = Array.from(gamesMap.values());

      if (gamesArray.length === 0) {
        throw new Error("No games found");
      }

      // Check if a specific game was requested
      const requestedGame = interaction.options.getString("game");
      if (requestedGame) {
        const gameModule = await import(`../../games/${requestedGame}.js`);
        if (!gameModule.default) {
          await interaction.editReply({
            content: i18n.__("economy.work.gameNotFound"),
            ephemeral: true,
          });
          return;
        }
        await gameModule.default.execute(interaction);
        return;
      }

      // Get user and game records in a single operation
      const gameRecords = await Database.getGameRecords(
        interaction.guild.id,
        interaction.user.id
      );

      // Create games object with categories and include high scores
      const games = {
        [`${i18n.__("components.GameLauncher.specialForCategory")}`]: {
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

      const generateGameMessage = async (locale) => {
        // Ensure locale is set before any i18n operations
        await i18n.setLocale(locale);

        const categoryNames = Object.keys(games);
        const currentCategoryGames =
          games[categoryNames[currentCategory]].games_list;
        const currentGame = currentCategoryGames[highlightedGame];

        // Generate game launcher image
        const [pngBuffer, dominantColor] = await generateImage("GameLauncher", {
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
          database: userData,
          games: games,
          selectedGame,
          currentLocale: i18n.getLocale(),
          highlightedGame,
          highlightedCategory: currentCategory,
          returnDominant: true,
          i18n,
          gameStats: currentGameRecords, // Use existing game records
        });

        const attachment = new AttachmentBuilder(pngBuffer, {
          name: `work_games.png`,
        });

        const embed = new EmbedBuilder()
          .setColor(dominantColor?.embedColor)
          .setAuthor({
            name: i18n.__("economy.work.title"),
            iconURL: interaction.user.displayAvatarURL(),
          })
          .setImage(`attachment://work_games.png`)
          .setTimestamp();

        // Create category select menu
        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId("select_category")
          .setPlaceholder(i18n.__("economy.work.selectCategory"))
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
          .setLabel(i18n.__("economy.work.playGame"))
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

      const message = await interaction.editReply(
        await generateGameMessage(interaction.locale)
      );

      // Create collector for buttons and select menu
      const collector = message.createMessageComponentCollector({
        filter: (i) => i.user.id === interaction.user.id,
        time: 60000,
      });

      collector.on("collect", async (i) => {
        const categoryNames = Object.keys(games);
        const currentCategoryGames =
          games[categoryNames[currentCategory]]?.games_list;

        if (!currentCategoryGames || currentCategoryGames.length === 0) {
          await i.reply({
            content: i18n.__("economy.work.noGamesAvailable"),
            ephemeral: true,
          });
          return;
        }

        if (i.customId === "select_category") {
          currentCategory = parseInt(i.values[0]);
          highlightedGame = 0;
          selectedGame = null;
          await i.update(await generateGameMessage(interaction.locale));
        } else if (i.customId === "prev_game") {
          if (highlightedGame > 0) {
            highlightedGame--;
            selectedGame = null;
            await i.update(await generateGameMessage(interaction.locale));
          }
        } else if (i.customId === "next_game") {
          if (highlightedGame < currentCategoryGames.length - 1) {
            highlightedGame++;
            selectedGame = null;
            await i.update(await generateGameMessage(interaction.locale));
          }
        } else if (i.customId === "select_game") {
          const game = currentCategoryGames[highlightedGame];
          if (!game) {
            await i.reply({
              content: i18n.__("economy.work.gameNotFound"),
              ephemeral: true,
            });
            return;
          }

          selectedGame = game.id;
          // Remove components before starting game
          await i.update({ components: [] });

          try {
            // Import and execute the game module
            const gameModule = await import(`../../games/${game.id}.js`);
            await gameModule.default.execute(i);
          } catch (error) {
            console.error(`Error executing game ${game.id}:`, error);
            await i.followUp({
              content: i18n.__("economy.work.gameError", {
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
        content: i18n.__("economy.work.error"),
        ephemeral: true,
      });
    }
  },
  localization_strings: {
    name: {
      en: "work",
      ru: "работать",
      uk: "працювати",
    },
    description: {
      en: "Play games to earn money",
      ru: "Играйте в игры, чтобы заработать деньги",
      uk: "Грайте в ігри, щоб заробити гроші",
    },
    options: {
      game: {
        name: {
          en: "game",
          ru: "игра",
          uk: "гра",
        },
        description: {
          en: "Choose a specific game to play directly",
          ru: "Выберите конкретную игру для прямого запуска",
          uk: "Виберіть конкретну гру для прямого запуску",
        },
      },
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
};
