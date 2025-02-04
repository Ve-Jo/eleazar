import { ButtonBuilder, ButtonStyle, ActionRowBuilder } from "discord.js";
import i18n from "../utils/i18n.js";
import { generateRemoteImage } from "../utils/remoteImageGenerator.js";
import Database from "../database/client.js";

export default {
  id: "snake",
  title: "Snake",
  emoji: "🐍",
  async execute(interaction) {
    // Initialize game state
    const gameState = {
      gridSize: 5,
      grid: Array(5)
        .fill()
        .map(() => Array(5).fill(0)),
      score: 0,
      gameOver: false,
      snake: [{ x: 2, y: 2 }], // Start snake in middle
      direction: "right",
      food: null,
      moves: 0,
      startTime: Date.now(),
      earning: 0,
    };

    // Add initial food
    addFood(gameState);

    // Calculate earning based on score and time
    const calculateEarning = (state) => {
      const timeInMinutes = (Date.now() - state.startTime) / 60000;
      const moveEfficiency = state.score / (state.moves || 1);

      const earning =
        state.score *
        0.01 * // Base earning
        (1 + moveEfficiency / 10) * // Move efficiency multiplier
        (1 + (5 - timeInMinutes) / 5); // Time multiplier

      return Math.max(1, earning); // Minimum earning of 1
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
      return generateRemoteImage(
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
        { width: 400, height: 490 },
        { image: 2, emoji: 1 }
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
      // Generate initial board
      const { buffer } = await generateGameBoard(
        gameState,
        interaction.locale,
        interaction.user.displayAvatarURL({ extension: "png", size: 1024 })
      );

      // Send initial game board
      const message = await interaction.followUp({
        content: i18n.__("games.snake.startMessage"),
        files: [{ attachment: buffer, name: "snake.png" }],
        components: [row],
        fetchReply: true,
      });

      // Handle moves
      const collector = message.createMessageComponentCollector();
      let inactivityTimeout;

      const resetInactivityTimer = () => {
        if (inactivityTimeout) clearTimeout(inactivityTimeout);
        inactivityTimeout = setTimeout(async () => {
          if (!gameState.gameOver) {
            gameState.earning = calculateEarning(gameState);
            const { buffer: finalBoard } = await generateGameBoard(
              gameState,
              interaction.locale,
              interaction.user.displayAvatarURL({
                extension: "png",
                size: 1024,
              })
            );

            // Add earnings to user's balance
            await Database.addBalance(
              interaction.guildId,
              interaction.user.id,
              gameState.earning
            );

            await message.edit({
              content: `${i18n.__("games.snake.timesOut", {
                score: gameState.score,
              })} (+${gameState.earning.toFixed(1)} 💵)`,
              files: [{ attachment: finalBoard, name: "snake.png" }],
              components: [],
            });
            collector.stop();
          }
        }, 30000);
      };

      resetInactivityTimer();

      collector.on("collect", async (i) => {
        if (i.user.id !== interaction.user.id) {
          await i.reply({
            content: i18n.__("games.snake.notYourGame"),
            ephemeral: true,
          });
          return;
        }

        resetInactivityTimer();

        const prevDirection = gameState.direction;
        let validMove = true;

        // Check if the move is valid (not reversing direction)
        switch (i.customId) {
          case "up":
            validMove = prevDirection !== "down";
            if (validMove) gameState.direction = "up";
            break;
          case "down":
            validMove = prevDirection !== "up";
            if (validMove) gameState.direction = "down";
            break;
          case "left":
            validMove = prevDirection !== "right";
            if (validMove) gameState.direction = "left";
            break;
          case "right":
            validMove = prevDirection !== "left";
            if (validMove) gameState.direction = "right";
            break;
        }

        if (validMove) {
          gameState.moves++;
          gameState.earning = calculateEarning(gameState);

          // Move snake
          const head = { ...gameState.snake[0] };

          // Update coordinates based on direction
          switch (gameState.direction) {
            case "up":
              head.y = wrapCoordinate(head.y - 1, gameState.gridSize);
              break;
            case "down":
              head.y = wrapCoordinate(head.y + 1, gameState.gridSize);
              break;
            case "left":
              head.x = wrapCoordinate(head.x - 1, gameState.gridSize);
              break;
            case "right":
              head.x = wrapCoordinate(head.x + 1, gameState.gridSize);
              break;
          }

          // Check if snake hit itself
          if (checkCollision(head, gameState.snake)) {
            gameState.gameOver = true;
          } else {
            // Add new head
            gameState.snake.unshift(head);

            // Check if snake ate food
            if (head.x === gameState.food.x && head.y === gameState.food.y) {
              gameState.score += 10;
              // Check if grid needs to expand
              if (
                gameState.snake.length >
                gameState.gridSize * gameState.gridSize * 0.75
              ) {
                expandGrid(gameState);
              }
              addFood(gameState);
            } else {
              // Remove tail if no food eaten
              gameState.snake.pop();
            }
          }
        }

        const { buffer: newBoard } = await generateGameBoard(
          gameState,
          interaction.locale,
          interaction.user.displayAvatarURL({ extension: "png", size: 1024 })
        );

        if (gameState.gameOver) {
          // Add earnings to user's balance
          await Database.addBalance(
            interaction.guildId,
            interaction.user.id,
            gameState.earning
          );

          await i.update({
            content: `${i18n.__("games.snake.gameOver", {
              score: gameState.score,
            })} (+${gameState.earning.toFixed(1)} 💵)`,
            files: [{ attachment: newBoard, name: "snake.png" }],
            components: [],
          });
          if (inactivityTimeout) clearTimeout(inactivityTimeout);
          collector.stop();
          return;
        }

        await i.update({
          content: validMove
            ? `${i18n.__("games.snake.score", { score: gameState.score })}`
            : `${i18n.__("games.snake.invalidMove")}`,
          files: [{ attachment: newBoard, name: "snake.png" }],
          components: [row],
        });
      });

      collector.on("end", () => {
        if (inactivityTimeout) clearTimeout(inactivityTimeout);
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
