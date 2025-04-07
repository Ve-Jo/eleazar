import { ButtonBuilder, ButtonStyle, ActionRowBuilder } from "discord.js";
import i18n from "../utils/newI18n.js";
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
  }

  createInitialState() {
    const state = {
      grid: Array(4)
        .fill()
        .map(() => Array(4).fill(0)),
      score: 0,
      gameOver: false,
      moves: 0,
      startTime: Date.now(),
      earning: 0,
    };

    // Add initial tiles
    addRandomTile(state);
    addRandomTile(state);

    return state;
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
  id: "2048",
  title: "2048",
  emoji: "🎲",
  async execute(interaction) {
    const channelId = interaction.channelId;
    const userId = interaction.user.id;
    const gameKey = getGameKey(channelId, userId);

    // Access enhanced i18n either from this.i18n or create a local reference
    // The enhanced i18n is injected by loadGames.js in getGameModule
    const gameI18n = this.i18n || i18n;

    // Set locale based on interaction
    const locale = interaction.locale || interaction.guildLocale || "en";
    console.log(`[2048] Using locale: ${locale}`);

    // Add safety check for interaction state
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }

    // Check if user already has a running game
    const hasRunningGame = activeGames.has(gameKey);

    if (hasRunningGame) {
      return interaction.followUp({
        content: gameI18n.__("alreadyRunning"),
        ephemeral: true,
      });
    }

    const initialState = new GameState(
      channelId,
      userId,
      null,
      interaction.guildId
    );

    // Calculate earning based on score and time
    const calculateEarning = async (state) => {
      // Get user data to check for games_earning upgrade
      const userData = await Database.getUser(
        interaction.guildId,
        interaction.user.id
      );

      // Apply games earning upgrade
      const gamesEarningUpgrade = userData.upgrades.find(
        (u) => u.type === "games_earning"
      );
      const gamesEarningLevel = gamesEarningUpgrade?.level || 1;
      const earningMultiplier = 1 + (gamesEarningLevel - 1) * 0.1; // 10% increase per level

      const timeInMinutes = (Date.now() - state.startTime) / 60000;
      const moveEfficiency = state.score / (state.moves || 1);

      const baseEarning =
        state.score *
        0.01 * // Base earning
        (1 + moveEfficiency / 10) * // Move efficiency multiplier
        (1 + (5 - timeInMinutes) / 5); // Time multiplier

      // Apply the games earning multiplier
      const earning = baseEarning * earningMultiplier;

      return earning;
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
      const currentHighScore = gameRecords?.["2048"]?.highScore || 0;

      const buffer = await generateImage(
        "2048",
        {
          grid: initialState.state.grid,
          score: initialState.state.score,
          earning: initialState.state.earning,
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
        { image: 1, emoji: 1 }
      );

      // Send initial game board
      const message = await interaction.followUp({
        content:
          gameI18n.__("startMessage") + `\nHigh Score: ${currentHighScore}`,
        files: [{ attachment: buffer, name: "2048.png" }],
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
          const gameInstance = activeGames.get(gameKey);
          if (!gameInstance?.state.gameOver) {
            gameInstance.state.earning = await calculateEarning(
              gameInstance.state
            );
            const finalBoard = await generateImage(
              "2048",
              {
                grid: gameInstance.state.grid,
                score: gameInstance.state.score,
                earning: gameInstance.state.earning,
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

            // Calculate game XP for timeout case
            const timePlayed =
              (Date.now() - gameInstance.state.startTime) / 1000;
            const gameXP = Math.floor(
              timePlayed * 2 + // Base XP from time
                gameInstance.state.score * 0.5 // Score bonus
            );

            await Database.addGameXP(
              interaction.guildId,
              interaction.user.id,
              gameXP,
              "2048"
            );

            await Database.addBalance(
              interaction.guildId,
              interaction.user.id,
              gameInstance.state.earning
            );

            await message.edit({
              content: `${gameI18n.__("timesOut", {
                score: gameInstance.state.score,
              })} (+${gameInstance.state.earning.toFixed(
                1
              )} 💵, +${gameXP} Game XP)`,
              files: [{ attachment: finalBoard, name: "2048.png" }],
              components: [],
            });
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
            content: gameI18n.__("notYourGame"),
            ephemeral: true,
          });
          return;
        }

        // Defer the button interaction
        await i.deferUpdate();

        resetInactivityTimer();

        const state = gameInstance.state;
        let moved = false;

        // Update game state timestamp
        gameInstance.updateTimestamp();

        // Handle moves based on direction
        switch (i.customId) {
          case "up":
            moved = moveUp(state);
            break;
          case "down":
            moved = moveDown(state);
            break;
          case "left":
            moved = moveLeft(state);
            break;
          case "right":
            moved = moveRight(state);
            break;
        }

        if (moved) {
          state.moves++;
          state.earning = await calculateEarning(state);
          addRandomTile(state);

          // Generate new game board image after valid move
          const buffer = await generateImage(
            "2048",
            {
              grid: state.grid,
              score: state.score,
              earning: state.earning,
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
            { image: 1, emoji: 1 }
          );

          // Update the message with new game state
          await message.edit({
            content: gameI18n.__("score", { score: state.score }),
            files: [{ attachment: buffer, name: "2048.png" }],
            components: [row],
          });

          if (checkGameOver(state)) {
            state.gameOver = true;

            try {
              // Calculate final values
              const timePlayed = (Date.now() - state.startTime) / 1000;
              const gameXP = Math.floor(timePlayed * 0.5 + state.score * 0.25);

              // Update high score
              const highScoreResult = await Database.updateGameHighScore(
                interaction.guildId,
                interaction.user.id,
                "2048",
                state.score
              );

              const isNewRecord = highScoreResult.isNewRecord;

              // Only add XP if there's something to add
              if (gameXP > 0) {
                await Database.addGameXP(
                  interaction.guildId,
                  interaction.user.id,
                  gameXP,
                  "2048"
                );
              }

              // Only add balance if there's something to add
              if (state.earning > 0) {
                await Database.addBalance(
                  interaction.guildId,
                  interaction.user.id,
                  state.earning
                );
              }

              // Generate final game board
              const finalBoard = await generateImage(
                "2048",
                {
                  grid: state.grid,
                  score: state.score,
                  earning: state.earning,
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
                { image: 1, emoji: 1 }
              );

              await message.edit({
                content: `${gameI18n.__("gameOver", {
                  score: state.score,
                })} (+${state.earning.toFixed(1)} 💵, +${gameXP} Game XP)${
                  isNewRecord ? " 🏆 New High Score!" : ""
                }`,
                files: [{ attachment: finalBoard, name: "2048.png" }],
                components: [],
              });

              cleanup();
              collector.stop();
            } catch (error) {
              console.error("Error executing game 2048:", error);
              if (!interaction.replied) {
                await interaction.reply({
                  content: gameI18n.__("error"),
                  ephemeral: true,
                });
              }
            }
          }
        } else {
          // For invalid moves, just update the message content
          await message.edit({
            content: gameI18n.__("invalidMove"),
            components: [row],
          });
        }
      });

      collector.on("end", () => {
        cleanup();
      });
    } catch (error) {
      console.error("Error executing game 2048:", error);
      if (!interaction.replied) {
        await interaction.reply({
          content: gameI18n.__("error"),
          ephemeral: true,
        });
      }
    }
  },
  localization_strings: {
    alreadyRunning: {
      en: "A 2048 game is already running in this channel!",
      ru: "Игра 2048 уже запущена в этом канале!",
      uk: "Гра 2048 вже запущена в цьому каналі!",
    },
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
