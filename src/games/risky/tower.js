import {
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ComponentType,
  StringSelectMenuBuilder,
  EmbedBuilder,
} from "discord.js";
import i18n from "../../utils/newI18n.js";
import { generateImage } from "../../utils/imageGenerator.js";
import Database from "../../database/client.js";

// --- Game Constants ---
const MAX_FLOORS = 10;
const TILE_COUNTS = {
  easy: 3,
  medium: 4,
  hard: 5,
};
const BOMB_COUNTS = {
  easy: 1,
  medium: 2,
  hard: 4,
};
// Adjusted multipliers for a slight house edge, increasing with difficulty
const BASE_MULTIPLIERS = {
  // easy: P(win) = 2/3. Fair base = 1.5. Target Edge ~3% (Factor 0.97)
  easy: [1.46, 2.18, 3.28, 4.91, 7.37, 11.06, 16.59, 24.88, 37.32, 55.98],
  // medium: P(win) = 2/4 = 1/2. Fair base = 2.0. Target Edge ~4% (Factor 0.96)
  medium: [
    1.92, 3.84, 7.68, 15.36, 30.72, 61.44, 122.88, 245.76, 491.52, 983.04,
  ],
  // hard: P(win) = 1/5. Fair base = 5.0. Target Edge ~5% (Factor 0.95)
  hard: [
    4.75, 22.56, 107.17, 509.06, 2418.05, 11485.74, 54557.26, 259146.99,
    1230948.2, 5847003.95,
    // Note: These multipliers become extremely high very quickly!
  ],
};

// --- Game State Management ---
const activeGames = new Map();

class GameState {
  constructor(channelId, userId, messageId, guildId) {
    this.channelId = channelId;
    this.userId = userId;
    this.guildId = guildId;
    this.messageId = messageId;

    this.difficulty = null; // 'easy' or 'hard'
    this.betAmount = 0;
    this.currentFloor = 0;
    this.tilesPerRow = 0;
    this.bombPositions = {}; // { floor: [bombIndex1, bombIndex2,...] }
    this.currentPrize = 0;
    this.gameOver = false;
    this.lastAction = "start"; // e.g., 'start', 'safe', 'bomb', 'prize'
    this.lastUpdateTime = Date.now();
  }

  // Generate bomb position for the next floor if it doesn't exist
  ensureBombPosition(floor) {
    if (!this.bombPositions[floor]) {
      const bombCount = BOMB_COUNTS[this.difficulty];
      const tileCount = this.tilesPerRow;
      const bombs = [];
      while (bombs.length < bombCount) {
        const pos = Math.floor(Math.random() * tileCount);
        if (!bombs.includes(pos)) {
          bombs.push(pos);
        }
      }
      bombs.sort((a, b) => a - b);
      this.bombPositions[floor] = bombs;
      console.log(
        `[Tower] Bombs for floor ${floor} (user ${
          this.userId
        }) set to indices: ${bombs.join(", ")}`
      );
    }
  }

  calculatePrize(floor) {
    if (floor < 0) return 0;
    const multipliers = BASE_MULTIPLIERS[this.difficulty];
    const multiplier =
      multipliers[floor] || multipliers[multipliers.length - 1];
    return parseFloat((this.betAmount * multiplier).toFixed(2));
  }

  updateTimestamp() {
    this.lastUpdateTime = Date.now();
  }
}

function getGameKey(channelId, userId) {
  return `tower-${channelId}-${userId}`;
}

// Updated to handle pre-game state
async function generateTowerImage(
  interaction,
  i18n,
  pendingState // { bet: number, difficulty: string, isPreGame: boolean }
) {
  const props = {
    interaction: {
      user: {
        id: interaction.user.id,
        avatarURL: interaction.user.displayAvatarURL({
          extension: "png",
          size: 128,
        }),
      },
    },
    // Pass pending state for pre-game display
    betAmount: pendingState.bet,
    difficulty: pendingState.difficulty,
    isPreGame: pendingState.isPreGame,
    // Other props needed for pre-game might be minimal or default
    currentFloor: 0,
    tilesPerRow: TILE_COUNTS[pendingState.difficulty] || TILE_COUNTS.easy,
    currentPrize: 0,
    nextPrize: 0,
    maxFloors: MAX_FLOORS,
    lastAction: "setup",
    gameOver: false,
    locale: interaction.locale || interaction.guildLocale || "en",
    dominantColor: "user",
    floorMultipliers:
      BASE_MULTIPLIERS[pendingState.difficulty] || BASE_MULTIPLIERS.easy,
  };

  // Use the actual component name
  return generateImage("Tower", props, { image: 1.5, emoji: 1 }, i18n);
}

// Function to generate image for active game state
async function generateActiveTowerImage(gameInstance, interaction, i18n) {
  const props = {
    interaction: {
      user: {
        id: interaction.user.id,
        avatarURL: interaction.user.displayAvatarURL({
          extension: "png",
          size: 128,
        }),
      },
    },
    difficulty: gameInstance.difficulty,
    betAmount: gameInstance.betAmount,
    currentFloor: gameInstance.currentFloor,
    tilesPerRow: gameInstance.tilesPerRow,
    currentPrize: gameInstance.currentPrize,
    nextPrize: gameInstance.calculatePrize(gameInstance.currentFloor + 1),
    maxFloors: MAX_FLOORS,
    lastAction: gameInstance.lastAction,
    gameOver: gameInstance.gameOver,
    isPreGame: false, // Explicitly false for active game
    selectedTiles: gameInstance.selectedTiles || [],
    floorMultipliers: BASE_MULTIPLIERS[gameInstance.difficulty],
    locale: interaction.locale || interaction.guildLocale || "en",
    dominantColor: "user",
  };
  return generateImage("Tower", props, { image: 1.5, emoji: 1 }, i18n);
}

// Function to create restart button for game over state
const createGameOverButtons = (userId) => {
  const restartButton = new ButtonBuilder()
    .setCustomId(`tower_restart_game_${userId}`)
    .setLabel(i18n.__("games.tower.restartButtonLabel"))
    .setStyle(ButtonStyle.Primary);

  return [new ActionRowBuilder().addComponents(restartButton)];
};

// --- Command Export ---
export default {
  id: "tower",
  title: "Tower",
  emoji: "🗼",
  async execute(interaction, i18n) {
    const channelId = interaction.channelId;
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const gameKey = getGameKey(channelId, userId);

    const locale = interaction.locale || interaction.guildLocale || "en";
    if (i18n && typeof i18n.setLocale === "function") {
      i18n.setLocale(locale);
    }

    // Interaction is already deferred from work.js

    if (activeGames.has(gameKey)) {
      return interaction.followUp({
        content: i18n.__("games.tower.alreadyRunning"),
        ephemeral: true,
      });
    }

    // --- Initial Setup Phase ---
    let pendingBet = 0;
    let pendingDifficulty = "easy"; // Default difficulty
    let setupMessage = null;
    let setupCollector = null; // Add this to the outer scope

    // Create a reusable function for setting up the game
    const setupGame = async (initialBet = 0, initialDifficulty = "easy") => {
      pendingBet = initialBet;
      pendingDifficulty = initialDifficulty;

      // Generate initial pre-game image
      const initialBuffer = await generateTowerImage(interaction, i18n, {
        bet: pendingBet,
        difficulty: pendingDifficulty,
        isPreGame: true,
      });

      // If setupMessage already exists, edit it, otherwise create a new one
      if (setupMessage) {
        await setupMessage.edit({
          content: i18n.__("games.tower.setupPrompt"),
          files: [{ attachment: initialBuffer, name: "tower_setup.png" }],
          components: [createSetupComponents()],
        });
      } else {
        setupMessage = await interaction.followUp({
          content: i18n.__("games.tower.setupPrompt"),
          files: [{ attachment: initialBuffer, name: "tower_setup.png" }],
          components: [createSetupComponents()],
          fetchReply: true,
        });
      }

      // Create a setup collector
      setupCollector = createSetupCollector();
      return setupCollector;
    };

    // Reusable function to create setup components
    const createSetupComponents = () => {
      const setBetButton = new ButtonBuilder()
        .setCustomId(`tower_set_bet_pregame_${userId}`)
        .setLabel(i18n.__("games.tower.setBetButtonLabel"))
        .setStyle(ButtonStyle.Primary);

      const changeDifficultyButton = new ButtonBuilder()
        .setCustomId(`tower_change_difficulty_pregame_${userId}`)
        .setLabel(
          i18n.__("games.tower.difficultyLabelShort", {
            difficulty: pendingDifficulty,
          })
        )
        .setStyle(ButtonStyle.Secondary);

      const startGameButton = new ButtonBuilder()
        .setCustomId(`tower_start_game_${userId}`)
        .setLabel(i18n.__("games.tower.startButtonLabel"))
        .setStyle(ButtonStyle.Success)
        .setDisabled(pendingBet <= 0); // Disable if bet not set

      return new ActionRowBuilder().addComponents(
        setBetButton,
        changeDifficultyButton,
        startGameButton
      );
    };

    // Create filter function for setup collector
    const setupCollectorFilter = (i) =>
      i.user.id === userId && i.message.id === setupMessage.id;

    // Create restart collector function
    const createRestartCollector = (gameInstance) => {
      // Clean up any previous restart collectors that might exist
      if (setupMessage.createMessageComponentCollector) {
        // Get all active collectors on the message
        const collectors = setupMessage.collectors || [];

        // Stop any collectors that might be for restart buttons
        collectors.forEach((collector) => {
          if (
            collector.options &&
            collector.options.filter &&
            collector.filter &&
            collector.options.componentType === ComponentType.Button
          ) {
            try {
              // Only stop collectors that aren't our new one
              collector.stop("replaced");
            } catch (err) {
              console.error("[Tower] Error stopping previous collector:", err);
            }
          }
        });
      }

      // Create new collector with proper filter
      const restartCollector = setupMessage.createMessageComponentCollector({
        filter: (i) =>
          i.user.id === userId && i.customId === `tower_restart_game_${userId}`,
        componentType: ComponentType.Button,
        time: 60000 * 15, // 15 minutes to decide to restart
      });

      restartCollector.on("collect", async (restartInteraction) => {
        try {
          // Stop collecting restart button clicks immediately to prevent duplicate handling
          restartCollector.stop("restart_clicked");

          // Always defer the update first thing
          await restartInteraction.deferUpdate().catch((err) => {
            console.error("[Tower] Error deferring restart interaction:", err);
            // If we can't defer, the interaction might already be acknowledged
            // Just continue with the restart process
          });

          // Re-initialize with the previous settings
          const prevBet = gameInstance.betAmount;
          const prevDifficulty = gameInstance.difficulty;

          // Start a new setup with the previous settings
          await setupGame(prevBet, prevDifficulty);
        } catch (error) {
          console.error("[Tower] Error in restart collector:", error);
          // Don't try to respond to the interaction if there's an error
          // as it might already be acknowledged
        }
      });

      restartCollector.on("end", (collected, reason) => {
        console.log(`[Tower] Restart collector ended. Reason: ${reason}`);
      });

      return restartCollector;
    };

    // Create and setup the collector for the setup phase
    const createSetupCollector = () => {
      // Clean up any previous collectors that might exist
      if (setupMessage.createMessageComponentCollector) {
        const collectors = setupMessage.collectors || [];
        collectors.forEach((collector) => {
          try {
            collector.stop("new_setup");
          } catch (err) {
            console.error("[Tower] Error stopping previous collector:", err);
          }
        });
      }

      const newSetupCollector = setupMessage.createMessageComponentCollector({
        filter: setupCollectorFilter,
        componentType: ComponentType.Button,
        time: 60000 * 5, // 5 minutes for setup
      });

      newSetupCollector.on("collect", handleSetupInteraction);
      newSetupCollector.on("end", (collected, reason) => {
        // Clean up setup message if game didn't start
        if (
          reason !== "user" &&
          reason !== "game_started" &&
          !activeGames.has(gameKey) &&
          setupMessage.editable
        ) {
          setupMessage
            .edit({
              content: "Tower setup timed out.",
              components: [],
              embeds: [],
            })
            .catch(console.error);
        }
        console.log(
          `[Tower] Setup collector ended for ${userId}. Reason: ${reason}`
        );
      });

      return newSetupCollector;
    };

    // Handle all setup phase interactions
    const handleSetupInteraction = async (i) => {
      try {
        // --- Set Bet Button ---
        if (i.customId === `tower_set_bet_pregame_${userId}`) {
          const betModal = new ModalBuilder()
            .setCustomId(`tower_bet_modal_${userId}`)
            .setTitle(i18n.__("games.tower.setBetTitle"));
          const amountInput = new TextInputBuilder()
            .setCustomId("bet_amount")
            .setLabel(i18n.__("games.tower.betAmountLabel"))
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("100")
            .setValue(pendingBet > 0 ? pendingBet.toString() : "") // Pre-fill with current bet if exists
            .setRequired(true);
          betModal.addComponents(
            new ActionRowBuilder().addComponents(amountInput)
          );
          await i.showModal(betModal);

          const modalFilter = (modalInteraction) =>
            modalInteraction.customId === `tower_bet_modal_${userId}` &&
            modalInteraction.user.id === userId;

          const modalSubmission = await i.awaitModalSubmit({
            filter: modalFilter,
            time: 60000,
          });
          const betAmountStr =
            modalSubmission.fields.getTextInputValue("bet_amount");
          const betAmount = parseInt(betAmountStr);

          if (isNaN(betAmount) || betAmount <= 0) {
            await modalSubmission.reply({
              content: i18n.__("games.tower.invalidBet"),
              ephemeral: true,
            });
            return;
          }
          // Check balance only when setting bet
          const userData = await Database.getUser(guildId, userId);
          const userBalance = parseFloat(userData?.economy?.balance || 0);
          if (!userData || !userData.economy || userBalance < betAmount) {
            await modalSubmission.reply({
              content: i18n.__("games.tower.notEnoughMoney", {
                balance: userBalance.toFixed(2),
                bet: betAmount,
              }),
              ephemeral: true,
            });
            return;
          }

          pendingBet = betAmount;

          const updatedBuffer = await generateTowerImage(interaction, i18n, {
            bet: pendingBet,
            difficulty: pendingDifficulty,
            isPreGame: true,
          });
          await modalSubmission.update({
            files: [{ attachment: updatedBuffer, name: "tower_setup.png" }],
            components: [createSetupComponents()], // Update buttons (Start might enable)
          });
        }
        // --- Change Difficulty Button ---
        else if (i.customId === `tower_change_difficulty_pregame_${userId}`) {
          const difficulties = ["easy", "medium", "hard"];
          const currentIndex = difficulties.indexOf(pendingDifficulty);
          pendingDifficulty =
            difficulties[(currentIndex + 1) % difficulties.length];

          const updatedBuffer = await generateTowerImage(interaction, i18n, {
            bet: pendingBet,
            difficulty: pendingDifficulty,
            isPreGame: true,
          });
          await i.update({
            files: [{ attachment: updatedBuffer, name: "tower_setup.png" }],
            components: [createSetupComponents()], // Update button label
          });
        }
        // --- Start Game Button ---
        else if (i.customId === `tower_start_game_${userId}`) {
          if (pendingBet <= 0) {
            await i.reply({
              content: i18n.__("games.tower.noBetSet"),
              ephemeral: true,
            });
            return;
          }

          // Final balance check before starting
          const userDataStart = await Database.getUser(guildId, userId);
          const userBalanceStart = parseFloat(
            userDataStart?.economy?.balance || 0
          );
          if (
            !userDataStart ||
            !userDataStart.economy ||
            userBalanceStart < pendingBet
          ) {
            await i.reply({
              content: i18n.__("games.tower.notEnoughMoney", {
                balance: userBalanceStart.toFixed(2),
                bet: pendingBet,
              }),
              ephemeral: true,
            });
            return;
          }

          // Initialize actual Game State
          const gameInstance = new GameState(
            channelId,
            userId,
            setupMessage.id,
            guildId
          );
          gameInstance.betAmount = pendingBet;
          gameInstance.difficulty = pendingDifficulty;
          gameInstance.tilesPerRow = TILE_COUNTS[pendingDifficulty];
          gameInstance.currentPrize = pendingBet; // Start prize is the bet
          gameInstance.ensureBombPosition(0);

          // Initialize selectedTiles array to track selections
          gameInstance.selectedTiles = [];

          activeGames.set(gameKey, gameInstance);

          // Deduct bet
          await Database.addBalance(guildId, userId, -gameInstance.betAmount);

          // Update message to game state
          await i.deferUpdate(); // Defer this interaction before editing message

          // Stop the setup collector
          if (setupCollector) {
            setupCollector.stop("game_started");
          }

          const gameBuffer = await generateActiveTowerImage(
            gameInstance,
            interaction,
            i18n
          );

          // Start the active game
          await startActiveGame(gameInstance, gameBuffer);
        }
      } catch (error) {
        console.error("[Tower] Error during setup collector:", error);
        if (!i.replied && !i.deferred) {
          await i
            .reply({
              content: "An error occurred during setup.",
              ephemeral: true,
            })
            .catch(console.error);
        } else {
          await i
            .followUp({
              content: "An error occurred during setup.",
              ephemeral: true,
            })
            .catch(console.error);
        }
      }
    };

    // Start an active game
    const startActiveGame = async (gameInstance, initialBuffer) => {
      // --- Create Gameplay Buttons ---
      const createGameButtons = (floor) => {
        const tileButtons = Array.from(
          { length: gameInstance.tilesPerRow },
          (_, idx) =>
            new ButtonBuilder()
              .setCustomId(`tower_tile_${idx}`)
              .setLabel(`${idx + 1}`)
              .setStyle(ButtonStyle.Secondary)
        );
        const takePrizeButton = new ButtonBuilder()
          .setCustomId("tower_take_prize")
          .setLabel(i18n.__("games.tower.takePrizeButton"))
          .setStyle(ButtonStyle.Success)
          .setDisabled(floor < 0); // Enable take prize immediately

        return [
          new ActionRowBuilder().addComponents(tileButtons),
          new ActionRowBuilder().addComponents(takePrizeButton),
        ];
      };

      await setupMessage.edit({
        content: i18n.__("games.tower.gameStartedPrompt"),
        files: [{ attachment: initialBuffer, name: "tower_game.png" }],
        components: createGameButtons(gameInstance.currentFloor),
        embeds: [], // Remove setup embed
      });

      // --- Start Main Game Collector ---
      const gameCollector = setupMessage.createMessageComponentCollector({
        filter: (gameInteraction) =>
          gameInteraction.user.id === userId &&
          gameInteraction.message.id === setupMessage.id,
        componentType: ComponentType.Button,
        time: 60000 * 5, // 5 minutes play time
      });

      gameCollector.on("collect", async (gameInteraction) => {
        try {
          const gameInstance = activeGames.get(gameKey);

          if (!gameInstance || gameInstance.gameOver) {
            await gameInteraction.reply({
              content: i18n.__("games.tower.ended"),
              ephemeral: true,
            });
            return;
          }

          // Handle restart button (shouldn't happen during active game)
          if (gameInteraction.customId === `tower_restart_game_${userId}`) {
            await gameInteraction.reply({
              content: i18n.__("games.tower.cantRestartActiveGame"),
              ephemeral: true,
            });
            return;
          }

          // Handle Take Prize button
          if (gameInteraction.customId === "tower_take_prize") {
            // Can only take prize after floor 0
            if (gameInstance.currentFloor < 1) {
              await gameInteraction.reply({
                content: i18n.__("games.tower.cantTakePrizeYet"),
                ephemeral: true,
              });
              return;
            }

            // Take the prize
            gameInstance.gameOver = true;
            gameInstance.lastAction = "prize";

            // Add prize to balance
            const prizeTaken = gameInstance.currentPrize;
            await Database.addBalance(guildId, userId, prizeTaken);

            // Update UI
            await gameInteraction.deferUpdate();

            const finalBuffer = await generateActiveTowerImage(
              gameInstance,
              interaction,
              i18n
            );

            // Show game over message
            await setupMessage.edit({
              content: i18n.__("games.tower.prizeTakenMessage", {
                prize: prizeTaken.toFixed(2),
                floor: gameInstance.currentFloor,
              }),
              files: [{ attachment: finalBuffer, name: "tower_end.png" }],
              components: createGameOverButtons(userId),
            });

            // End the game
            gameCollector.stop("prize");
            activeGames.delete(gameKey);

            // Create a restart collector
            createRestartCollector(gameInstance);
          }

          // Handle Tile Selection
          if (gameInteraction.customId.startsWith("tower_tile_")) {
            const tileIndex = parseInt(gameInteraction.customId.split("_")[2]);

            // Store the selected tile
            gameInstance.selectedTiles[gameInstance.currentFloor] = tileIndex;

            // Check if bomb hit
            const bombPositions =
              gameInstance.bombPositions[gameInstance.currentFloor];
            const hitBomb = bombPositions.includes(tileIndex);

            if (hitBomb) {
              // Hit a bomb - game over
              gameInstance.gameOver = true;
              gameInstance.lastAction = "bomb";

              // Update UI
              await gameInteraction.deferUpdate();

              const finalBuffer = await generateActiveTowerImage(
                gameInstance,
                interaction,
                i18n
              );

              // Show game over message
              await setupMessage.edit({
                content: i18n.__("games.tower.bombHitMessage", {
                  floor: gameInstance.currentFloor + 1,
                  bet: gameInstance.betAmount,
                }),
                files: [{ attachment: finalBuffer, name: "tower_end.png" }],
                components: createGameOverButtons(userId),
              });

              // End the game
              gameCollector.stop("bomb");
              activeGames.delete(gameKey);

              // Create a restart collector
              createRestartCollector(gameInstance);
            } else {
              // Safe tile - move to next floor or win if at top
              gameInstance.lastAction = "safe";
              gameInstance.currentFloor += 1;

              // Check if reached top floor
              if (gameInstance.currentFloor >= MAX_FLOORS) {
                // Reached the top - win the max prize
                gameInstance.gameOver = true;
                const maxPrize = gameInstance.calculatePrize(MAX_FLOORS - 1);

                // Add prize to balance
                await Database.addBalance(guildId, userId, maxPrize);

                // Update UI
                await gameInteraction.deferUpdate();

                const finalBuffer = await generateActiveTowerImage(
                  gameInstance,
                  interaction,
                  i18n
                );

                // Show win message
                await setupMessage.edit({
                  content: i18n.__("games.tower.maxFloorReachedMessage", {
                    floor: MAX_FLOORS,
                    prize: maxPrize.toFixed(2),
                  }),
                  files: [{ attachment: finalBuffer, name: "tower_win.png" }],
                  components: createGameOverButtons(userId),
                });

                // End the game
                gameCollector.stop("win");
                activeGames.delete(gameKey);

                // Create a restart collector
                createRestartCollector(gameInstance);
              } else {
                // Continue to next floor
                gameInstance.currentPrize = gameInstance.calculatePrize(
                  gameInstance.currentFloor
                );
                gameInstance.ensureBombPosition(gameInstance.currentFloor);

                // Update UI
                await gameInteraction.deferUpdate();

                const nextBuffer = await generateActiveTowerImage(
                  gameInstance,
                  interaction,
                  i18n
                );

                await setupMessage.edit({
                  content: i18n.__("games.tower.nextFloorMessage", {
                    floor: gameInstance.currentFloor + 1,
                    nextPrize: gameInstance
                      .calculatePrize(gameInstance.currentFloor)
                      .toFixed(2),
                  }),
                  files: [{ attachment: nextBuffer, name: "tower_next.png" }],
                  components: createGameButtons(gameInstance.currentFloor),
                });
              }
            }
          }

          // Update timestamp to prevent timeout
          gameInstance.updateTimestamp();
        } catch (error) {
          console.error("[Tower] Error during game collector:", error);
          if (!gameInteraction.replied && !gameInteraction.deferred) {
            await gameInteraction
              .reply({
                content: i18n.__("games.tower.error"),
                ephemeral: true,
              })
              .catch(console.error);
          }
        }
      });

      // Timeout handler
      gameCollector.on("end", (collected, reason) => {
        const gameInstance = activeGames.get(gameKey);
        if (gameInstance && !gameInstance.gameOver) {
          // Game timed out, update UI
          setupMessage
            .edit({
              content: i18n.__("games.tower.timesOut"),
              components: [],
            })
            .catch(console.error);

          // Clean up
          activeGames.delete(gameKey);
        }
        console.log(
          `[Tower] Game collector ended for ${userId}. Reason: ${reason}`
        );
      });

      console.log(
        `[Tower] Game started actively for ${userId}. Bet: ${gameInstance.betAmount}, Diff: ${gameInstance.difficulty}`
      );
    };

    try {
      // Start initial game setup
      await setupGame();
    } catch (error) {
      console.error("[Tower] Error during initial setup message:", error);
      // Handle error sending the initial setup message
      if (!interaction.replied && !interaction.deferred) {
        await interaction
          .reply({ content: i18n.__("games.tower.error"), ephemeral: true })
          .catch(console.error);
      } else {
        await interaction
          .followUp({ content: i18n.__("games.tower.error"), ephemeral: true })
          .catch(console.error);
      }
    }
  },

  localization_strings: {
    alreadyRunning: {
      en: "A Tower game is already running!",
      ru: "Игра Башня уже запущена!",
      uk: "Гру Башта вже запущено!",
    },
    setupTitle: {
      en: "Tower Setup",
      ru: "Настройка Башни",
      uk: "Налаштування Башти",
    },
    betAmountLabel: {
      en: "Amount to bet",
      ru: "Сумма ставки",
      uk: "Сума ставки",
    },
    difficultyLabel: {
      en: "Difficulty (easy / medium / hard)",
      ru: "Сложность (easy / medium / hard)",
      uk: "Складність (easy / medium / hard)",
    },
    invalidBet: {
      en: "Invalid bet amount. Please enter a positive number.",
      ru: "Неверная сумма ставки. Введите положительное число.",
      uk: "Невірна сума ставки. Введіть додатне число.",
    },
    notEnoughMoney: {
      en: "You don't have enough money! Your balance: {{balance}} 💵, Bet: {{bet}} 💵",
      ru: "У вас недостаточно денег! Ваш баланс: {{balance}} 💵, Ставка: {{bet}} 💵",
      uk: "У вас недостатньо грошей! Ваш баланс: {{balance}} 💵, Ставка: {{bet}} 💵",
    },
    takePrizeButton: {
      en: "Take Prize",
      ru: "Забрать приз",
      uk: "Забрати приз",
    },
    bombHitMessage: {
      en: "💥 BOOM! You hit a bomb on floor {{floor}} and lost your bet of {{bet}} 💵!",
      ru: "💥 БУМ! Вы попали на бомбу на этаже {{floor}} и потеряли ставку {{bet}} 💵!",
      uk: "💥 БУМ! Ви потрапили на бомбу на поверсі {{floor}} і втратили ставку {{bet}} 💵!",
    },
    prizeTakenMessage: {
      en: "🎉 Congratulations! You took a prize of {{prize}} 💵 on floor {{floor}}!",
      ru: "🎉 Поздравляем! Вы забрали приз {{prize}} 💵 на этаже {{floor}}!",
      uk: "🎉 Вітаємо! Ви забрали приз {{prize}} 💵 на поверсі {{floor}}!",
    },
    maxFloorReachedMessage: {
      en: "🏆 Incredible! You reached the top (Floor {{floor}}) and won {{prize}} 💵!",
      ru: "🏆 Невероятно! Вы достигли вершины (Этаж {{floor}}) и выиграли {{prize}} 💵!",
      uk: "🏆 Неймовірно! Ви досягли вершини (Поверх {{floor}}) і виграли {{prize}} 💵!",
    },
    error: {
      en: "An error occurred during the Tower game.",
      ru: "Произошла ошибка во время игры в Башню.",
      uk: "Сталася помилка під час гри в Башту.",
    },
    timesOut: {
      en: "Tower game ended due to inactivity.",
      ru: "Игра Башня завершена из-за неактивности.",
      uk: "Гру Башта завершено через неактивність.",
    },
    ended: {
      en: "Tower game session ended.",
      ru: "Игровая сессия Башни завершена.",
      uk: "Ігрову сесію Башти завершено.",
    },
    name: {
      en: "Tower",
      ru: "Башня",
      uk: "Башта",
    },
    description: {
      en: "Climb the tower, avoid bombs, and win big!",
      ru: "Поднимайтесь по башне, избегайте бомб и выигрывайте по-крупному!",
      uk: "Піднімайтесь по вежі, уникайте бомб і вигравайте по-крупному!",
    },
    initialSetupDescription: {
      en: "Welcome to the Tower! Click below to set your bet and difficulty.",
      ru: "Добро пожаловать в Башню! Нажмите ниже, чтобы установить ставку и сложность.",
      uk: "Ласкаво просимо до Башти! Натисніть нижче, щоб встановити ставку та складність.",
    },
    setupButtonLabel: {
      en: "Setup Game",
      ru: "Настроить Игру",
      uk: "Налаштувати Гру",
    },
    setupPrompt: {
      en: "Configure your Tower game below!",
      ru: "Настройте игру Башня ниже!",
      uk: "Налаштуйте гру Башта нижче!",
    },
    setBetButtonLabel: {
      en: "Set Bet",
      ru: "Ставка",
      uk: "Ставка",
    },
    difficultyLabelShort: {
      en: "Difficulty: {{difficulty}}",
      ru: "Сложность: {{difficulty}}",
      uk: "Складність: {{difficulty}}",
    },
    startButtonLabel: {
      en: "Start Game",
      ru: "Начать Игру",
      uk: "Почати Гру",
    },
    setBetTitle: {
      en: "Set Your Bet",
      ru: "Установить Ставку",
      uk: "Встановити Ставку",
    },
    noBetSet: {
      en: "Please set a bet amount first!",
      ru: "Сначала установите ставку!",
      uk: "Спочатку встановіть ставку!",
    },
    gameStartedPrompt: {
      en: "The Tower game has started! Choose a tile or take your prize.",
      ru: "Игра Башня началась! Выберите плитку или заберите приз.",
      uk: "Гру Башта розпочато! Оберіть плитку або заберіть приз.",
    },
    cantTakePrizeYet: {
      en: "You must clear at least one floor before taking a prize!",
      ru: "Вы должны пройти хотя бы один этаж, прежде чем забрать приз!",
      uk: "Ви повинні пройти принаймні один поверх, перш ніж забрати приз!",
    },
    nextFloorMessage: {
      en: "You reached floor {{floor}}! Next prize: {{nextPrize}} 💵",
      ru: "Вы достигли этажа {{floor}}! Следующий приз: {{nextPrize}} 💵",
      uk: "Ви досягли поверху {{floor}}! Наступний приз: {{nextPrize}} 💵",
    },
    restartButtonLabel: {
      en: "Restart Game",
      ru: "Начать заново",
      uk: "Почати знову",
    },
    cantRestartActiveGame: {
      en: "You cannot restart an active game!",
      ru: "Вы не можете начать новую игру, так как она уже началась!",
      uk: "Ви не можете почати нову гру, так як вона вже розпочалась!",
    },
    restarting: {
      en: "Restarting game...",
      ru: "Перезапуск игры...",
      uk: "Перезапуск гри...",
    },
  },
};
