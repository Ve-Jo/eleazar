import { ButtonBuilder, ButtonStyle, ActionRowBuilder } from "discord.js";
import i18n from "../utils/i18n.js";
import { generateImage } from "../utils/imageGenerator.js";
import Database from "../database/client.js";

// Game state management for multi-user synchronization
const activeGames = new Map();

// GameState manager for handling synchronized states
class GameState {
  constructor(channelId, userId, messageId, guildId) {
    this.channelId = channelId;
    this.userId = userId;
    this.guildId = guildId;
    this.messageId = messageId;
    this.lastUpdateTime = Date.now();
    this.lastImageGenTime = Date.now();
    this.state = this.createInitialState();
    this.forceRenderFrame = false;
  }

  createInitialState() {
    return {
      gridSize: 5,
      grid: Array(5)
        .fill()
        .map(() => Array(5).fill(0)),
      score: 0,
      gameOver: false,
      snake: [{ x: 2, y: 2 }],
      direction: "right",
      food: null,
      moves: 0,
      startTime: Date.now(),
      earning: 0,
    };
  }

  updateTimestamp() {
    this.lastUpdateTime = Date.now();
  }

  updateImageTimestamp() {
    this.lastImageGenTime = Date.now();
  }
}

// Change game state management to use composite key
function getGameKey(channelId, userId) {
  return `${channelId}-${userId}`;
}

export default {
  id: "snake",
  title: "Snake",
  emoji: "🐍",
  async execute(interaction) {
    const channelId = interaction.channelId;
    const userId = interaction.user.id;
    const gameKey = getGameKey(channelId, userId);

    // Check if user already has a running game
    const hasRunningGame = activeGames.has(gameKey);

    if (hasRunningGame) {
      return interaction.reply({
        content: i18n.__("games.snake.alreadyRunning"),
        ephemeral: true,
      });
    }

    // Initialize game state with guild ID
    const initialState = new GameState(
      channelId,
      userId,
      null,
      interaction.guildId
    );
    addFood(initialState.state);

    // Calculate earning based on score and time
    const calculateEarning = (state) => {
      const timeInMinutes = (Date.now() - state.startTime) / 60000;
      const moveEfficiency = state.score / (state.moves || 1);

      const earning =
        state.score *
        0.01 * // Base earning
        (1 + moveEfficiency / 10) * // Move efficiency multiplier
        (1 + (5 - timeInMinutes) / 5); // Time multiplier

      return earning;
    };

    // Helper function to wrap coordinates around grid edges
    const wrapCoordinate = (coord, size) => {
      // Handle negative numbers by adding size until positive
      while (coord < 0) coord += size;
      return coord % size;
    };

    // Helper function to generate game board image
    const generateGameBoard = async (state, userLocale, userAvatarURL) => {
      updateGridState(state);
      return generateImage(
        "Snake",
        {
          grid: state.grid,
          score: state.score,
          earning: state.earning,
          locale: userLocale,
          interaction: {
            user: {
              avatarURL: userAvatarURL,
            },
          },
        },
        { image: 1, emoji: 1 }
      );
    };

    // Create game controls
    const buttons = [
      new ButtonBuilder()
        .setCustomId("up")
        .setLabel("↑")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("left")
        .setLabel("←")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("right")
        .setLabel("→")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("down")
        .setLabel("↓")
        .setStyle(ButtonStyle.Primary),
    ];

    const row = new ActionRowBuilder().addComponents(buttons);

    try {
      // Get current stats to display high score at start
      const gameRecords = await Database.getGameRecords(
        interaction.guildId,
        interaction.user.id
      );
      const currentHighScore = gameRecords?.snake?.highScore || 0;

      const buffer = await generateGameBoard(
        initialState.state,
        interaction.locale,
        interaction.user.displayAvatarURL({ extension: "png", size: 1024 })
      );

      // Send initial game board
      const message = await interaction.followUp({
        content:
          i18n.__("games.snake.startMessage") +
          `\nHigh Score: ${currentHighScore}`,
        files: [{ attachment: buffer, name: "snake.png" }],
        components: [row],
        fetchReply: true,
      });

      // Store game state with message ID
      initialState.messageId = message.id;
      activeGames.set(gameKey, initialState);

      // Clean up on game end
      const cleanup = () => {
        if (inactivityTimeout) clearTimeout(inactivityTimeout);
        activeGames.delete(gameKey);
      };

      // Handle moves
      const collector = message.createMessageComponentCollector();
      let inactivityTimeout;

      const resetInactivityTimer = () => {
        if (inactivityTimeout) clearTimeout(inactivityTimeout);
        inactivityTimeout = setTimeout(async () => {
          if (!initialState.state.gameOver) {
            initialState.state.earning = calculateEarning(initialState.state);
            const finalBoard = await generateGameBoard(
              initialState.state,
              interaction.locale,
              interaction.user.displayAvatarURL({
                extension: "png",
                size: 1024,
              })
            );

            const timePlayed =
              (Date.now() - initialState.state.startTime) / 1000;
            const gameXP = Math.floor(
              timePlayed * 2 + initialState.state.score * 5
            );

            try {
              // Save high score first
              const isNewRecord = await Database.updateGameHighScore(
                interaction.guildId,
                interaction.user.id,
                "snake",
                initialState.state.score
              );

              // Add XP
              await Database.addGameXP(
                interaction.guildId,
                interaction.user.id,
                gameXP,
                "snake"
              );

              // Add earnings
              await Database.addBalance(
                interaction.guildId,
                interaction.user.id,
                initialState.state.earning
              );

              await message.edit({
                content: `${i18n.__("games.snake.timesOut", {
                  score: initialState.state.score,
                })} (+${initialState.state.earning.toFixed(
                  1
                )} 💵, +${gameXP} Game XP)${
                  isNewRecord ? " 🏆 New High Score!" : ""
                }`,
                files: [{ attachment: finalBoard, name: "snake.png" }],
                components: [],
              });
            } catch (error) {
              console.error("Error saving timeout results:", error);
            }

            cleanup();
            collector.stop();
          }
        }, 30000);
      };

      resetInactivityTimer();

      collector.on("collect", async (i) => {
        const gameInstance = activeGames.get(gameKey);

        // Validate game exists and user has permission
        if (!gameInstance || i.user.id !== gameInstance.userId) {
          await i.reply({
            content: i18n.__("games.snake.notYourGame"),
            ephemeral: true,
          });
          return;
        }

        // Defer the button interaction
        await i.deferUpdate();

        resetInactivityTimer();

        const state = gameInstance.state;
        const prevDirection = state.direction;
        let validMove = true;

        // Update game state timestamp
        gameInstance.updateTimestamp();

        // Check if the move is valid (not reversing direction)
        switch (i.customId) {
          case "up":
            validMove = prevDirection !== "down";
            if (validMove) state.direction = "up";
            break;
          case "down":
            validMove = prevDirection !== "up";
            if (validMove) state.direction = "down";
            break;
          case "left":
            validMove = prevDirection !== "right";
            if (validMove) state.direction = "left";
            break;
          case "right":
            validMove = prevDirection !== "left";
            if (validMove) state.direction = "right";
            break;
        }

        if (validMove) {
          state.moves++;
          state.earning = calculateEarning(state);

          // Move snake
          const head = { ...state.snake[0] };

          // Update coordinates based on direction
          switch (state.direction) {
            case "up":
              head.y = wrapCoordinate(head.y - 1, state.gridSize);
              break;
            case "down":
              head.y = wrapCoordinate(head.y + 1, state.gridSize);
              break;
            case "left":
              head.x = wrapCoordinate(head.x - 1, state.gridSize);
              break;
            case "right":
              head.x = wrapCoordinate(head.x + 1, state.gridSize);
              break;
          }

          // Check if snake hit itself
          if (checkCollision(head, state.snake)) {
            state.gameOver = true;
          } else {
            // Add new head
            state.snake.unshift(head);

            // Check if snake ate food
            if (head.x === state.food.x && head.y === state.food.y) {
              state.score += 10;
              // Check if grid needs to expand
              if (state.snake.length > state.gridSize * state.gridSize * 0.75) {
                expandGrid(state);
              }
              addFood(state);
            } else {
              // Remove tail if no food eaten
              state.snake.pop();
            }
          }
        }

        // Prepare message update
        let messageContent, messageFiles, messageComponents;

        if (!state.gameOver) {
          messageContent = validMove
            ? `${i18n.__("games.snake.score", { score: state.score })}`
            : `${i18n.__("games.snake.invalidMove")}`;
          messageComponents = [row];

          const newBoard = await generateGameBoard(
            state,
            interaction.locale,
            interaction.user.displayAvatarURL({
              extension: "png",
              size: 1024,
            })
          );
          gameInstance.updateImageTimestamp();
          messageFiles = [{ attachment: newBoard, name: "snake.png" }];
        } else {
          console.log("Game over, final score:", state.score);

          try {
            // Generate final game over board first
            const gameOverBoard = await generateGameBoard(
              state,
              interaction.locale,
              interaction.user.displayAvatarURL({
                extension: "png",
                size: 1024,
              })
            );

            // Calculate XP
            const timePlayed = (Date.now() - state.startTime) / 1000;
            const gameXP = Math.floor(timePlayed * 2 + state.score * 5);

            // Save high score first
            const isNewRecord = await Database.updateGameHighScore(
              interaction.guildId,
              interaction.user.id,
              "snake",
              state.score
            );

            // Add XP
            await Database.addGameXP(
              interaction.guildId,
              interaction.user.id,
              gameXP,
              "snake"
            );

            // Add earnings
            await Database.addBalance(
              interaction.guildId,
              interaction.user.id,
              state.earning
            );

            await message.edit({
              content: `${i18n.__("games.snake.gameOver", {
                score: state.score,
              })} (+${state.earning.toFixed(1)} 💵, +${gameXP} Game XP)${
                isNewRecord ? " 🏆 New High Score!" : ""
              }`,
              files: [{ attachment: gameOverBoard, name: "snake.png" }],
              components: [],
            });

            cleanup();
            collector.stop();
          } catch (error) {
            console.error("Error saving game results:", error);
            await message.edit({
              content: i18n.__("games.snake.error"),
              components: [],
            });
          }
          return;
        }

        // Get and update the game message
        const gameMessage = await i.channel.messages.fetch(
          gameInstance.messageId
        );
        await gameMessage.edit({
          content: messageContent,
          files: messageFiles,
          components: messageComponents,
        });

        if (state.gameOver) {
          cleanup();
          collector.stop();
        }
      });

      collector.on("end", () => {
        cleanup();
      });
    } catch (error) {
      console.error("Error executing game snake:", error);
      if (!interaction.replied) {
        await interaction.reply({
          content: i18n.__("games.snake.error"),
          ephemeral: true,
        });
      }
    }
  },
  localization_strings: {
    alreadyRunning: {
      en: "A snake game is already running in this channel!",
      ru: "Игра в змейку уже запущена в этом канале!",
      uk: "Гра в змійку вже запущена в цьому каналі!",
    },
    name: {
      en: "Snake",
      ru: "Змейка",
      uk: "Змійка",
    },
    startMessage: {
      en: "Use the arrows to move the snake! 🐍",
      ru: "Используйте стрелки для управления змейкой! 🐍",
      uk: "Використовуйте стрілки для керування змійкою! 🐍",
    },
    description: {
      en: "Play classic snake game",
      ru: "Играйте в классическую игру змейка",
      uk: "Грайте в класичну гру змійка",
    },
    score: {
      en: "Your Score: {{score}}",
      ru: "Ваш счет: {{score}}",
      uk: "Ваш рахунок: {{score}}",
    },
    gameOver: {
      en: "Game Over! Final Score: {{score}}",
      ru: "Игра окончена! Финальный счет: {{score}}",
      uk: "Гра закінчилася! Фінальний рахунок: {{score}}",
    },
    invalidMove: {
      en: "Invalid move!",
      ru: "Неверный ход!",
      uk: "Невірний хід!",
    },
    timesOut: {
      en: "Game ended due to inactivity! Final Score: {{score}}",
      ru: "Игра завершена из-за неактивности! Финальный счет: {{score}}",
      uk: "Гра завершена через неактивність! Фінальний рахунок: {{score}}",
    },
    notYourGame: {
      en: "This game is not for you!",
      ru: "Эта игра не для вас!",
      uk: "Ця гра не для вас!",
    },
    error: {
      en: "There was an error starting the game. Please try again.",
      ru: "Произошла ошибка при запуске игры. Пожалуйста, попробуйте снова.",
      uk: "Сталася помилка при запуску гри. Будь ласка, спробуйте знову.",
    },
  },
};
// Game logic functions

// Add food at random empty position
function addFood(state) {
  const emptyCells = [];
  for (let y = 0; y < state.gridSize; y++) {
    for (let x = 0; x < state.gridSize; x++) {
      if (!state.snake.some((segment) => segment.x === x && segment.y === y)) {
        emptyCells.push({ x, y });
      }
    }
  }

  if (emptyCells.length > 0) {
    state.food = emptyCells[Math.floor(Math.random() * emptyCells.length)];
  }
}

// Check if point collides with snake body
function checkCollision(point, snake) {
  return snake.some(
    (segment) => segment.x === point.x && segment.y === point.y
  );
}

// Update grid state based on snake and food positions
function updateGridState(state) {
  // Clear grid
  state.grid = Array(state.gridSize)
    .fill()
    .map(() => Array(state.gridSize).fill(0));

  // Add snake segments (value 1 for body, 2 for head)
  state.snake.forEach((segment, i) => {
    if (i === 0) {
      state.grid[segment.y][segment.x] = 2; // Head
    } else {
      state.grid[segment.y][segment.x] = 1; // Body
    }
  });

  // Add food (value 4)
  if (state.food) {
    state.grid[state.food.y][state.food.x] = 4;
  }
}

// Expand grid when snake gets too big
function expandGrid(state) {
  state.gridSize++;
  state.grid = Array(state.gridSize)
    .fill()
    .map(() => Array(state.gridSize).fill(0));
}
