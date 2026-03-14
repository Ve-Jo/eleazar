import { ButtonBuilder, ButtonStyle, ActionRowBuilder } from "discord.js";
import { generateImage } from "../utils/imageGenerator.ts";
import hubClient from "../api/hubClient.ts";
import { handleLevelUp } from "../utils/levelUpHandler.ts";

type TranslatorLike = {
  __: (key: string, variables?: Record<string, unknown>) => Promise<string>;
  getLocale?: () => string;
};

type LevelDataLike = {
  level: number;
  currentXP: number;
  requiredXP: number;
  totalXP: number;
};

type SnakeSegment = {
  x: number;
  y: number;
};

type SnakeFood = {
  x: number;
  y: number;
};

type UserDataLike = {
  economy?: {
    balance?: number | string;
  } | null;
  Level?: {
    xp?: number | string;
    gameXp?: number | string;
  } | null;
  levelProgress?: unknown;
  [key: string]: unknown;
};

type SnakeGameState = {
  gridSize: number;
  grid: number[][];
  score: number;
  gameOver: boolean;
  snake: SnakeSegment[];
  direction: "up" | "down" | "left" | "right";
  food: SnakeFood | null;
  moves: number;
  startTime: number;
  earning: number;
  userData: UserDataLike | null;
  balance: number;
  chatLevelData: LevelDataLike | null;
  gameLevelData: LevelDataLike | null;
  lastLevel: number;
  earningGameXP: number;
  baseGameXP?: number;
  gameXP?: number;
};

type MessageLike = {
  id: string;
  edit: (payload: Record<string, unknown>) => Promise<unknown>;
  createMessageComponentCollector: () => CollectorLike;
};

type CollectorInteractionLike = {
  customId: string;
  user: { id: string };
  channel: {
    messages: {
      fetch: (messageId: string | null) => Promise<MessageLike>;
    };
  };
  reply: (payload: { content: string; ephemeral?: boolean }) => Promise<unknown>;
  deferUpdate: () => Promise<unknown>;
};

type CollectorLike = {
  on: ((
    event: "collect",
    handler: (interaction: CollectorInteractionLike) => unknown
  ) => void) &
    ((event: "end", handler: () => unknown) => void);
  stop: () => void;
};

type RoleManagerLike = {
  add: (roleId: string) => Promise<unknown>;
  remove: (roleIds: string[]) => Promise<unknown>;
};

type MessageChannelLike = {
  send: (payload: {
    content?: string;
    embeds?: unknown[];
    files?: unknown[];
  }) => Promise<unknown>;
};

type ChannelLike = {
  name: string;
  type: number;
  messages?: { cache: { size: number } };
  send?: (payload: {
    content?: string;
    embeds?: unknown[];
    files?: unknown[];
  }) => Promise<unknown>;
  permissionsFor?: (member: unknown) => { has: (permission: string) => boolean };
};

type GuildLike = {
  name: string;
  preferredLocale?: string | null;
  systemChannel?: ChannelLike | null;
  members: {
    fetch: (userId: string) => Promise<{
      id: string;
      displayName: string;
      preferredLocale?: string | null;
      user: { username: string };
      roles: RoleManagerLike;
      send: (payload: { embeds: unknown[]; files: unknown[] }) => Promise<unknown>;
      displayAvatarURL: (options: { extension: string; size: number }) => string;
    } | null>;
    me?: unknown;
  };
  channels: {
    cache: {
      find: (predicate: (channel: ChannelLike) => boolean) => ChannelLike | undefined;
    };
  };
  iconURL: (options: { extension: string; size: number }) => string | null;
};

type ClientLike = {
  guilds: {
    fetch: (guildId: string) => Promise<GuildLike | null>;
  };
};

type GameInteractionLike = {
  channelId: string;
  guildId?: string | null;
  locale: string;
  deferred?: boolean;
  replied?: boolean;
  channel: MessageChannelLike | null;
  guild: {
    id: string;
    name: string;
    iconURL: (options?: { extension?: string; size?: number }) => string | null;
  };
  user: {
    id: string;
    username: string;
    displayName: string;
    displayAvatarURL: (options?: { extension?: string; size?: number }) => string;
  };
  client: ClientLike;
  deferReply: () => Promise<unknown>;
  followUp: (payload: Record<string, unknown>) => Promise<MessageLike>;
  reply: (payload: { content: string; ephemeral?: boolean }) => Promise<unknown>;
};

const activeGames = new Map<string, GameState>();

class GameState {
  channelId: string;
  userId: string;
  guildId?: string | null;
  messageId: string | null;
  lastUpdateTime: number;
  lastImageGenTime: number;
  state: SnakeGameState;
  forceRenderFrame: boolean;

  constructor(
    channelId: string,
    userId: string,
    messageId: string | null,
    guildId?: string | null
  ) {
    this.channelId = channelId;
    this.userId = userId;
    this.guildId = guildId;
    this.messageId = messageId;
    this.lastUpdateTime = Date.now();
    this.lastImageGenTime = Date.now();
    this.state = this.createInitialState();
    this.forceRenderFrame = false;
  }

  createInitialState(): SnakeGameState {
    const state: SnakeGameState = {
      gridSize: 5,
      grid: Array(5)
        .fill(0)
        .map(() => Array(5).fill(0)),
      score: 0,
      gameOver: false,
      snake: [{ x: 2, y: 2 }],
      direction: "right",
      food: null,
      moves: 0,
      startTime: Date.now(),
      earning: 0,
      userData: null, // Store complete user data
      balance: 0,
      chatLevelData: null,
      gameLevelData: null,
      lastLevel: 1, // Track last known level for updates
      earningGameXP: 0, // Track XP earned during this game session for display
    };

    return state;
  }

  updateTimestamp() {
    this.lastUpdateTime = Date.now();
  }

  updateImageTimestamp() {
    this.lastImageGenTime = Date.now();
  }

  // Simple XP calculation for display purposes only
  updateEarningGameXP(scoreDifference: number): number {
    // Calculate XP based on score difference to prevent duplication
    const xpGained = scoreDifference * 5; // 5 XP per point gained
    this.state.earningGameXP += xpGained;

    // Update gameLevelData.currentXP for display (without affecting actual level calculation)
    if (this.state.gameLevelData) {
      this.state.gameLevelData.currentXP += xpGained;
    }

    return xpGained;
  }

  // Get current game level data based on total XP
  getCurrentGameLevelData(): LevelDataLike | null {
    return this.state.gameLevelData;
  }
}

function getGameKey(channelId: string, userId: string): string {
  return `${channelId}-${userId}`;
}

export default {
  id: "snake",
  title: "Snake",
  emoji: "🐍",
  async execute(interaction: GameInteractionLike, i18n: TranslatorLike) {
    const channelId = interaction.channelId;
    const userId = interaction.user.id;
    const gameKey = getGameKey(channelId, userId);

    // Add safety check for interaction state
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }

    // Check if user already has a running game
    const hasRunningGame = activeGames.has(gameKey);

    if (hasRunningGame) {
      const alreadyRunningText = await i18n.__(`games.snake.alreadyRunning`);
      return interaction.followUp({
        content:
          typeof alreadyRunningText === "string"
            ? alreadyRunningText
            : "A snake game is already running in this channel!",
        ephemeral: true,
      });
    }

    // Initialize game state with guild ID
    const initialState = new GameState(
      channelId,
      userId,
      null,
      interaction.guildId,
    );
    addFood(initialState.state);

    // Calculate earning based on score and time
    const calculateEarning = (state: SnakeGameState): number => {
      const timeInMinutes = (Date.now() - state.startTime) / 60000;
      const moveEfficiency = state.score / (state.moves || 1);

      const earning =
        state.score *
        0.03 * // Base earning
        (1 + moveEfficiency / 10) * // Move efficiency multiplier
        (1 + Math.min(timeInMinutes, 5) / 5); // Time multiplier that caps at 2x for 5+ minutes

      return earning;
    };

    // Helper function to wrap coordinates around grid edges
    const wrapCoordinate = (coord: number, size: number): number => {
      // Handle negative numbers by adding size until positive
      while (coord < 0) coord += size;
      return coord % size;
    };

    // Helper function to generate game board image
    const generateGameBoard = async (
      state: SnakeGameState,
      userLocale: string,
      userAvatarURL: string
    ) => {
      updateGridState(state);

      // Prepare user data for rendering
      const userData = state.userData;
      const balance = state.balance || 0;
      const chatLevelData = state.chatLevelData;
      const gameLevelData = state.gameLevelData;
      const earningGameXP = state.earningGameXP || 0;

      return generateImage(
        "Snake",
        {
          grid: state.grid,
          score: state.score,
          earning: state.earning,
          locale: userLocale,
          dominantColor: "user", // Use dynamic colors based on user avatar
          interaction: {
            user: {
              id: interaction.user.id,
              username: interaction.user.username,
              displayName: interaction.user.displayName,
              avatarURL: userAvatarURL,
            },
            guild: interaction.guildId
              ? {
                  id: interaction.guild.id,
                  name: interaction.guild.name,
                  iconURL: interaction.guild.iconURL({
                    extension: "png",
                    size: 1024,
                  }),
                }
              : null,
          },
          database: {
            ...userData,
            economy: {
              ...userData?.economy,
              balance: balance, // Wallet balance only
            },
            levelProgress: {
              chat: chatLevelData,
              game: {
                level: gameLevelData?.level || 1,
                currentXP: gameLevelData?.currentXP || 0,
                requiredXP: gameLevelData?.requiredXP || 100,
                totalXP: gameLevelData?.totalXP || 0,
              },
            },
            // Pass earned game XP for visual progression
            earnedGameXP: earningGameXP,
          },
        },
        { image: 1, emoji: 1 },
        i18n,
        { disableThrottle: true },
      );
    };

    // Create game controls
    const stopButton = new ButtonBuilder()
      .setCustomId("stop")
      .setLabel("🛑")
      .setStyle(ButtonStyle.Danger);
    const upButton = new ButtonBuilder()
      .setCustomId("up")
      .setLabel("↑")
      .setStyle(ButtonStyle.Primary);
    const leftButton = new ButtonBuilder()
      .setCustomId("left")
      .setLabel("←")
      .setStyle(ButtonStyle.Primary);
    const downButton = new ButtonBuilder()
      .setCustomId("down")
      .setLabel("↓")
      .setStyle(ButtonStyle.Primary);
    const rightButton = new ButtonBuilder()
      .setCustomId("right")
      .setLabel("→")
      .setStyle(ButtonStyle.Primary);

    const row1 = new ActionRowBuilder().addComponents(stopButton, upButton);
    const row2 = new ActionRowBuilder().addComponents(
      leftButton,
      downButton,
      rightButton,
    );

    try {
      // Get current stats to display high score at start
      let gameRecords = null;
      let currentHighScore = 0;
      let userData = null;
      let chatLevelData = null;
      let gameLevelData = null;
      let balance = 0;

      if (interaction.guildId) {
        try {
          console.log(
            `[snake] Getting game records for guild ${interaction.guildId}, user ${interaction.user.id}`,
          );
          gameRecords = await hubClient.getGameRecords(
            interaction.guildId,
            interaction.user.id,
          );
          console.log("[snake] Game records result:", gameRecords);
          currentHighScore = gameRecords?.snake?.highScore || 0;
          console.log(`[snake] Current high score: ${currentHighScore}`);
        } catch (error) {
          console.error("Error getting game records:", error);
          // Continue with default high score if API fails
          currentHighScore = 0;
        }

        // Fetch complete user data including balance and level progress
        try {
          console.log(
            `[snake] Fetching complete user data for guild ${interaction.guildId}, user ${interaction.user.id}`,
          );

          // Ensure user exists in database
          await hubClient.ensureGuildUser(
            interaction.guild.id,
            interaction.user.id,
          );
          userData = await hubClient.getUser(
            interaction.guild.id,
            interaction.user.id,
          );

          if (userData) {
            // Use only wallet balance (not bank balance)
            if (userData.economy) {
              balance = Number(userData.economy.balance || 0);
              console.log(`[snake] Using wallet balance: ${balance}`);
            }

            // Calculate level progress for XP bars
            if (userData.Level) {
              const chatXP = Number(userData.Level.xp || 0);
              chatLevelData = hubClient.calculateLevel(chatXP);

              const gameXP = Number(userData.Level.gameXp || 0);
              gameLevelData = hubClient.calculateLevel(gameXP);

              // Store base game XP for session tracking (use gameXp, not totalXP)
              initialState.state.baseGameXP = Number(
                userData.Level.gameXp || 0,
              );

              console.log(
                `[snake] Initial base game XP set: ${gameXP}, level: ${gameLevelData?.level}`,
              );
            }

            console.log("[snake] Complete user data fetched:", {
              balance,
              chatLevelData,
              gameLevelData,
              levelProgress: userData.levelProgress,
            });

            // Store user data in game state for future use
            initialState.state.userData = userData as UserDataLike;
            initialState.state.balance = balance;
            initialState.state.chatLevelData = chatLevelData;
            initialState.state.gameLevelData = gameLevelData;

            console.log(`[snake] Initial game level data:`, {
              level: gameLevelData?.level,
              currentXP: gameLevelData?.currentXP,
              requiredXP: gameLevelData?.requiredXP,
              gameXP: initialState.state.gameXP,
            });
          }
        } catch (error) {
          console.error("Error fetching complete user data:", error);
          // Continue with default values if data fetching fails
          userData = null;
          balance = 0;
          initialState.state.userData = null;
          initialState.state.balance = 0;
          initialState.state.chatLevelData = null;
          initialState.state.gameLevelData = null;
        }
      }

      const buffer = await generateGameBoard(
        initialState.state,
        interaction.locale,
        interaction.user.displayAvatarURL({ extension: "png", size: 1024 }),
      );

      // Send initial game board
      const startMessage = await i18n.__("games.snake.startMessage");
      const highScoreText = await i18n.__(`games.snake.highScore`, {
        score: currentHighScore,
      });

      const message = await interaction.followUp({
        content: `${startMessage}\n${highScoreText}`,
        files: [{ attachment: buffer, name: "snake.avif" }],
        components: [row1, row2],
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
      let inactivityTimeout: ReturnType<typeof setTimeout> | undefined;

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
              }),
            );

            // Use earningGameXP for timeout case
            const earningGameXP = initialState.state.earningGameXP || 0;

            try {
              // Only save high score if in a guild
              let isNewRecord = false;
              if (interaction.guildId) {
                // Save high score first
                const highScoreResult = await hubClient.updateGameHighScore(
                  interaction.guildId,
                  interaction.user.id,
                  "snake",
                  initialState.state.score,
                );

                isNewRecord = highScoreResult.isNewRecord;

                // Only add XP if there's something to add
                if (earningGameXP > 0) {
                  console.log(
                    `[snake] Adding game XP: ${earningGameXP} for user ${interaction.user.id}`,
                  );
                  const xpResult = await hubClient.addGameXP(
                    interaction.guildId,
                    interaction.user.id,
                    "snake",
                    earningGameXP,
                  );
                  console.log("[snake] Game XP Result:", xpResult);

                  // Handle level-up notification if the user leveled up
                  if (xpResult.levelUp) {
                    await handleLevelUp(
                      interaction.client,
                      interaction.guildId,
                      interaction.user.id,
                      xpResult.levelUp,
                      xpResult.type,
                      interaction.channel,
                    );
                  }
                }

                // Only add earnings if there's something to add
                if (initialState.state.earning > 0) {
                  await hubClient.addBalance(
                    interaction.guildId,
                    interaction.user.id,
                    initialState.state.earning,
                  );
                }
              }

              const timeoutText = await i18n.__(`games.snake.timesOut`, {
                score: initialState.state.score,
              });
              const content =
                typeof timeoutText === "string"
                  ? `${timeoutText}${
                      interaction.guildId
                        ? ` (+${initialState.state.earning.toFixed(
                            1,
                          )} 💵, +${earningGameXP} Game XP)${
                            isNewRecord ? " 🏆 New High Score!" : ""
                          }`
                        : ""
                    }`
                  : `Game ended due to inactivity! Final Score: ${
                      initialState.state.score
                    }${
                      interaction.guildId
                        ? ` (+${initialState.state.earning.toFixed(
                            1,
                          )} 💵, +${earningGameXP} Game XP)${
                            isNewRecord ? " 🏆 New High Score!" : ""
                          }`
                        : ""
                    }`;

              await message.edit({
                content: content,
                files: [{ attachment: finalBoard, name: "snake.avif" }],
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

      collector.on("collect", async (i: CollectorInteractionLike) => {
        const gameInstance = activeGames.get(gameKey);

        // Validate game exists and user has permission
        if (!gameInstance || i.user.id !== gameInstance.userId) {
          const notYourGameText = await i18n.__(`games.snake.notYourGame`);
          await i.reply({
            content:
              typeof notYourGameText === "string"
                ? notYourGameText
                : "This game is not for you!",
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
        let stopped = false;

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
          case "stop":
            stopped = true;
            state.gameOver = true; // Mark game as over
            break;
          default:
            // Should not happen, but handle defensively
            console.warn("Unknown button ID in snake game:", i.customId);
            return;
        }

        if (!stopped && validMove) {
          const oldScore = state.score;
          state.moves++;
          state.earning = calculateEarning(state);

          // Move snake
          const currentHead = state.snake[0];
          if (!currentHead) {
            return;
          }
          const head: SnakeSegment = { ...currentHead };

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
            if (state.food && head.x === state.food.x && head.y === state.food.y) {
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

          // Update earning game XP for display only when score increases
          if (state.score > oldScore) {
            const scoreDifference = state.score - oldScore;
            const xpGained = gameInstance.updateEarningGameXP(scoreDifference);
            console.log(
              `[snake] Added ${xpGained} XP for display (score difference: ${scoreDifference})`,
            );

            // Log XP progression for debugging
            const currentXP = gameInstance.state.gameLevelData?.currentXP || 0;
            const requiredXP =
              gameInstance.state.gameLevelData?.requiredXP || 100;
            const xpProgress = (currentXP / requiredXP) * 100;
            console.log(
              `[snake] XP Progress: ${currentXP}/${requiredXP} (${xpProgress.toFixed(
                1,
              )}%) - Gained: ${xpGained} XP`,
            );
          }
        }

        if (stopped) {
          state.earning = calculateEarning(state);
          console.log("Game stopped by user, final score:", state.score);
          try {
            const stopBoard = await generateGameBoard(
              state,
              interaction.locale,
              interaction.user.displayAvatarURL({
                extension: "png",
                size: 1024,
              }),
            );

            // Use earningGameXP for stop case
            const earningGameXP = state.earningGameXP || 0;

            let isNewRecordStop = false;
            if (interaction.guildId) {
              // Save high score first
              const stopHighScoreResult = await hubClient.updateGameHighScore(
                interaction.guildId,
                interaction.user.id,
                "snake",
                state.score,
              );
              isNewRecordStop = stopHighScoreResult.isNewRecord;

              // Add XP
              if (earningGameXP > 0) {
                console.log(
                  `[snake] Adding stop game XP: ${earningGameXP} for user ${interaction.user.id}`,
                );
                const stopXpResult = await hubClient.addGameXP(
                  interaction.guildId,
                  interaction.user.id,
                  "snake",
                  earningGameXP,
                );
                console.log("[snake] Stop Game XP Result:", stopXpResult);
                if (stopXpResult && stopXpResult.levelUp) {
                  console.log(
                    `[snake] User ${interaction.user.id} leveled up on stop!`,
                    stopXpResult.levelUp,
                  );
                  await handleLevelUp(
                    interaction.client,
                    interaction.guildId,
                    interaction.user.id,
                    stopXpResult.levelUp,
                    stopXpResult.type || "activity",
                    interaction.channel,
                  );
                }
              }

              // Add Balance
              if (state.earning > 0) {
                await hubClient.addBalance(
                  interaction.guildId,
                  interaction.user.id,
                  state.earning,
                );
              }
            }

            const stoppedText = await i18n.__(`games.snake.stopped`, {
              score: state.score,
            });
            const content =
              typeof stoppedText === "string"
                ? `${stoppedText}${
                    interaction.guildId
                      ? ` (+${state.earning.toFixed(
                          1,
                        )} 💵, +${earningGameXP} Game XP)${
                          isNewRecordStop ? " 🏆 New High Score!" : ""
                        }`
                      : ""
                  }`
                : `Game stopped! Final Score: ${state.score}${
                    interaction.guildId
                      ? ` (+${state.earning.toFixed(
                          1,
                        )} 💵, +${earningGameXP} Game XP)${
                          isNewRecordStop ? " 🏆 New High Score!" : ""
                        }`
                      : ""
                  }`;

            await message.edit({
              content: content,
              files: [{ attachment: stopBoard, name: "snake.avif" }],
              components: [],
            });

            cleanup();
            collector.stop();
          } catch (error) {
            console.error("Error saving stopped game results:", error);
            const errorText = await i18n.__(`games.snake.error`);
            const errorContent =
              typeof errorText === "string"
                ? errorText
                : "There was an error processing your game. Please try again.";
            await message.edit({
              content: errorContent,
              components: [],
            });
          }
          return; // Exit early as the game is stopped
        }

        // --- If we reach here, game continues ---
        // These are declared earlier in the collector scope now
        const scoreText = await i18n.__(`games.snake.score`, {
          score: state.score,
        });
        const invalidMoveText = await i18n.__(`games.snake.invalidMove`);
        let messageContent = validMove
          ? typeof scoreText === "string"
            ? scoreText
            : `Your Score: ${state.score}`
          : typeof invalidMoveText === "string"
            ? invalidMoveText
            : "Invalid move!";
        let messageComponents = [row1, row2];
        let messageFiles: Array<{ attachment: unknown; name: string }> = [];

        // Only generate a new board image if the move was valid
        if (validMove) {
          const newBoard = await generateGameBoard(
            state,
            interaction.locale,
            interaction.user.displayAvatarURL({
              extension: "png",
              size: 1024,
            }),
          );
          gameInstance.updateImageTimestamp();
          messageFiles = [{ attachment: newBoard, name: "snake.avif" }];
        }

        // Fetch and edit the message
        const gameMessage = await i.channel.messages.fetch(
          gameInstance.messageId,
        );
        try {
          // Edit message: Always include 'files', even if empty
          await gameMessage.edit({
            content: messageContent,
            files: messageFiles, // Pass files array (empty if invalid move)
            components: messageComponents,
          });
        } catch (error) {
          console.error("Error editing snake game message during play:", error);
        }

        if (state.gameOver && !stopped) {
          // Check if game over from collision, not stop
          cleanup();
          collector.stop();
        }
      });

      collector.on("end", () => {
        cleanup();
      });
    } catch (error) {
      console.error("Error executing game snake:", error);
      const errorText = await i18n.__(`games.snake.error`);
      const errorContent =
        typeof errorText === "string"
          ? errorText
          : "There was an error starting the game. Please try again.";

      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: errorContent,
          ephemeral: true,
        });
      } else {
        await interaction.followUp({
          content: errorContent,
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
    highScore: {
      en: "High Score: {{score}}",
      ru: "Рекорд: {{score}}",
      uk: "Рекорд: {{score}}",
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
    stopped: {
      en: "Game stopped! Final Score: {{score}}",
      ru: "Игра остановлена! Финальный счет: {{score}}",
      uk: "Гру зупинено! Фінальний рахунок: {{score}}",
    },
  },
};
// Game logic functions

// Add food at random empty position
function addFood(state: SnakeGameState): void {
  const emptyCells: SnakeFood[] = [];
  for (let y = 0; y < state.gridSize; y++) {
    for (let x = 0; x < state.gridSize; x++) {
      if (!state.snake.some((segment: SnakeSegment) => segment.x === x && segment.y === y)) {
        emptyCells.push({ x, y });
      }
    }
  }

  if (emptyCells.length > 0) {
    const selectedFood = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    if (!selectedFood) {
      return;
    }
    state.food = selectedFood;
  }
}

// Check if point collides with snake body
function checkCollision(point: SnakeSegment, snake: SnakeSegment[]): boolean {
  return snake.some(
    (segment: SnakeSegment) => segment.x === point.x && segment.y === point.y,
  );
}

// Update grid state based on snake and food positions
function updateGridState(state: SnakeGameState): void {
  // Clear grid
  state.grid = Array(state.gridSize)
    .fill(0)
    .map(() => Array(state.gridSize).fill(0));

  // Add snake segments (value 1 for body, 2 for head)
  state.snake.forEach((segment: SnakeSegment, i: number) => {
    const gridRow = state.grid[segment.y];
    if (!gridRow) {
      return;
    }
    if (i === 0) {
      gridRow[segment.x] = 2; // Head
    } else {
      gridRow[segment.x] = 1; // Body
    }
  });

  // Add food (value 4)
  if (state.food) {
    const foodRow = state.grid[state.food.y];
    if (!foodRow) {
      return;
    }
    foodRow[state.food.x] = 4;
  }
}

// Expand grid when snake gets too big
function expandGrid(state: SnakeGameState): void {
  state.gridSize++;
  state.grid = Array(state.gridSize)
    .fill(0)
    .map(() => Array(state.gridSize).fill(0));
}
