import { ButtonBuilder, ButtonStyle, ActionRowBuilder } from "discord.js";
import i18n from "../utils/i18n.js";
import { generateRemoteImage } from "../utils/remoteImageGenerator.js";
import Database from "../database/client.js";

export default {
  id: "2048",
  title: "2048",
  emoji: "🎲",
  async execute(interaction) {
    // Initialize game state
    const gameState = {
      grid: Array(4)
        .fill()
        .map(() => Array(4).fill(0)),
      score: 0,
      gameOver: false,
      moves: 0,
      startTime: Date.now(),
      earning: 0,
    };

    // Calculate earning based on score, time and moves efficiency
    const calculateEarning = (state) => {
      const timeInMinutes = (Date.now() - state.startTime) / 60000;
      const moveEfficiency = state.score / (state.moves || 1);

      // Combined formula that takes into account:
      // - Base earning (1% of score)
      // - Move efficiency (higher score per move = higher multiplier)
      // - Time bonus (faster completion = higher multiplier)
      const earning =
        state.score *
        0.01 * // Base earning
        (1 + moveEfficiency / 10) * // Move efficiency multiplier
        (1 + (5 - timeInMinutes) / 5); // Time multiplier

      // Ensure minimum earning of 1
      return earning;
    };

    // Add initial tiles
    addRandomTile(gameState);
    addRandomTile(gameState);

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
      // Generate board image
      const { buffer } = await generateRemoteImage(
        "2048",
        {
          grid: gameState.grid,
          score: gameState.score,
          earning: gameState.earning,
          locale: interaction.locale,
          interaction: {
            user: {
              avatarURL: interaction.user.displayAvatarURL({
                extension: "png",
                size: 1024,
              }),
            },
          },
        },
        { width: 400, height: 490 },
        { image: 2, emoji: 1 }
      );

      // Send initial game board
      const message = await interaction.followUp({
        content: i18n.__("games.2048.startMessage"),
        files: [{ attachment: buffer, name: "2048.png" }],
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
            const { buffer: finalBoard } = await generateRemoteImage(
              "2048",
              {
                grid: gameState.grid,
                score: gameState.score,
                earning: gameState.earning,
                locale: interaction.locale,
                interaction: {
                  user: {
                    avatarURL: interaction.user.displayAvatarURL({
                      extension: "png",
                      size: 1024,
                    }),
                  },
                },
              },
              { width: 400, height: 490 },
              { image: 2, emoji: 1 }
            );

            // Add earnings to user's balance
            await Database.addBalance(
              interaction.guildId,
              interaction.user.id,
              gameState.earning
            );

            await message.edit({
              content: `${i18n.__("games.2048.timesOut", {
                score: gameState.score,
              })} (+${gameState.earning.toFixed(1)} 💵)`,
              files: [{ attachment: finalBoard, name: "2048.png" }],
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
            content: i18n.__("games.2048.notYourGame"),
            ephemeral: true,
          });
          return;
        }

        resetInactivityTimer();

        let moved = false;
        if (i.customId === "up") moved = moveUp(gameState);
        if (i.customId === "down") moved = moveDown(gameState);
        if (i.customId === "left") moved = moveLeft(gameState);
        if (i.customId === "right") moved = moveRight(gameState);

        if (moved) {
          gameState.moves++;
          gameState.earning = calculateEarning(gameState);
        }

        if (moved && !gameState.gameOver) {
          addRandomTile(gameState);
          if (checkGameOver(gameState)) {
            const { buffer: finalBoard } = await generateRemoteImage(
              "2048",
              {
                grid: gameState.grid,
                score: gameState.score,
                earning: gameState.earning,
                locale: i.locale,
                interaction: {
                  user: {
                    avatarURL: i.user.displayAvatarURL({
                      extension: "png",
                      size: 1024,
                    }),
                  },
                },
              },
              { width: 400, height: 490 },
              { image: 2, emoji: 1 }
            );

            // Add earnings to user's balance
            await Database.addBalance(
              interaction.guildId,
              interaction.user.id,
              gameState.earning
            );

            await i.update({
              content: `${i18n.__("games.2048.gameOver", {
                score: gameState.score,
              })} (+${gameState.earning.toFixed(1)} 💵)`,
              files: [{ attachment: finalBoard, name: "2048.png" }],
              components: [],
            });
            if (inactivityTimeout) clearTimeout(inactivityTimeout);
            collector.stop();
            return;
          }
        }

        const { buffer: newBoard } = await generateRemoteImage(
          "2048",
          {
            grid: gameState.grid,
            score: gameState.score,
            earning: gameState.earning,
            locale: interaction.locale,
            interaction: {
              user: {
                avatarURL: interaction.user.displayAvatarURL({
                  extension: "png",
                  size: 1024,
                }),
              },
            },
          },
          { width: 400, height: 490 },
          { image: 2, emoji: 1 }
        );

        await i.update({
          content: moved
            ? `${i18n.__("games.2048.score", { score: gameState.score })}`
            : `${i18n.__("games.2048.invalidMove")}`,
          files: [{ attachment: newBoard, name: "2048.png" }],
          components: [row],
        });
      });

      collector.on("end", () => {
        if (inactivityTimeout) clearTimeout(inactivityTimeout);
      });
    } catch (error) {
      console.error("Error executing game 2048:", error);
      if (!interaction.replied) {
        await interaction.reply({
          content: i18n.__("games.2048.error"),
          ephemeral: true,
        });
      }
    }
  },
  localization_strings: {
    name: {
      en: "2048",
      ru: "2048",
      uk: "2048",
    },
    startMessage: {
      en: "Use the arrows to slide tiles and combine matching numbers!",
      ru: "Используйте стрелки чтобы двигать и объединять одинаковые числа!",
      uk: "Використовуйте стрілки щоб рухати та об'єднувати однакові числа!",
    },
    description: {
      en: "Play the classic 2048 puzzle game",
      ru: "Играйте в классическую игру-головоломку 2048",
      uk: "Грайте в класичну гру-головоломку 2048",
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
function addRandomTile(state) {
  const emptyCells = [];
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      if (state.grid[row][col] === 0) {
        emptyCells.push({ row, col });
      }
    }
  }

  if (emptyCells.length > 0) {
    const { row, col } =
      emptyCells[Math.floor(Math.random() * emptyCells.length)];
    state.grid[row][col] = Math.random() < 0.9 ? 2 : 4;
  }
}

function moveLeft(state) {
  let moved = false;
  for (let row = 0; row < 4; row++) {
    // Remove zeros
    let nums = state.grid[row].filter((x) => x !== 0);

    // Merge tiles
    for (let i = 0; i < nums.length - 1; i++) {
      if (nums[i] === nums[i + 1]) {
        nums[i] *= 2;
        state.score += nums[i];
        nums[i + 1] = 0;
        moved = true;
      }
    }

    // Remove zeros again
    nums = nums.filter((x) => x !== 0);

    // Pad with zeros
    while (nums.length < 4) nums.push(0);

    // Only update if the row changed
    if (nums.some((val, idx) => val !== state.grid[row][idx])) {
      state.grid[row] = nums;
      moved = true;
    }
  }
  return moved;
}

function moveRight(state) {
  state.grid.forEach((row) => row.reverse());
  const moved = moveLeft(state);
  state.grid.forEach((row) => row.reverse());
  return moved;
}

function moveUp(state) {
  transpose(state.grid);
  const moved = moveLeft(state);
  transpose(state.grid);
  return moved;
}

function moveDown(state) {
  transpose(state.grid);
  const moved = moveRight(state);
  transpose(state.grid);
  return moved;
}

function transpose(matrix) {
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < row; col++) {
      [matrix[row][col], matrix[col][row]] = [
        matrix[col][row],
        matrix[row][col],
      ];
    }
  }
}

function checkGameOver(state) {
  // First check if there are any empty cells
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      if (state.grid[row][col] === 0) return false;
    }
  }

  // Then check if any adjacent tiles can be merged
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      if (col < 3 && state.grid[row][col] === state.grid[row][col + 1])
        return false;
      if (row < 3 && state.grid[row][col] === state.grid[row + 1][col])
        return false;
    }
  }

  state.gameOver = true;
  return true;
}
