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

type UserDataLike = {
  economy?: {
    balance?: number | string;
  };
  Level?: {
    xp?: number | string;
    gameXp?: number | string;
  };
  upgrades?: Array<{ type?: string; level?: number }>;
  levelProgress?: unknown;
  [key: string]: unknown;
};

type Game2048State = {
  grid: number[][];
  score: number;
  gameOver: boolean;
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
  gamesEarningLevel?: number;
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

type MessageChannelLike = {
  send: (payload: {
    content?: string;
    embeds?: unknown[];
    files?: unknown[];
  }) => Promise<unknown>;
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
  guildLocale?: string;
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
  member: {
    voice: {
      channelId?: string | null;
    };
  };
  client: ClientLike;
  deferReply: () => Promise<unknown>;
  followUp: (payload: Record<string, unknown>) => Promise<MessageLike>;
  reply: (payload: { content: string; ephemeral?: boolean }) => Promise<unknown>;
};

const activeGames = new Map<string, GameState>();
const MAX_2048_SESSION_EARNING = 2500;

class GameState {
  channelId: string;
  userId: string;
  guildId?: string | null;
  messageId: string | null;
  lastUpdateTime: number;
  lastImageGenTime: number;
  state: Game2048State;

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
  }

  createInitialState(): Game2048State {
    const state: Game2048State = {
      grid: Array(4)
        .fill(0)
        .map(() => Array(4).fill(0)),
      score: 0,
      gameOver: false,
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

  // Simple XP calculation for display purposes only
  updateEarningGameXP(scoreDifference: number): number {
    // Calculate XP based on score difference to prevent duplication
    console.log(`[2048] UPDATE EARNING GAME XP`);
    const xpGained = scoreDifference * 5; // 5 XP per point gained
    console.log(`[2048] XP GAINED`, xpGained);
    console.log(`[2048] EARNING GAME XP BEFORE`, this.state.earningGameXP);
    this.state.earningGameXP += xpGained;
    console.log(`[2048] EARNING GAME XP aFTER`, this.state.earningGameXP);

    // For visual display, we need to ensure gameLevelData exists
    // But we don't want to modify the actual user level data
    if (!this.state.gameLevelData) {
      this.state.gameLevelData = {
        level: 1,
        currentXP: 0,
        requiredXP: 100,
        totalXP: 0,
      };
    }

    this.state.gameLevelData.totalXP += xpGained;

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
  id: "2048",
  title: "2048",
  emoji: "🎲",
  async execute(interaction: GameInteractionLike, i18n: TranslatorLike) {
    const channelId = interaction.channelId;
    const userId = interaction.user.id;
    const gameKey = getGameKey(channelId, userId);

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
      const alreadyRunningText = await i18n.__(`games.2048.alreadyRunning`);
      return interaction.followUp({
        content:
          typeof alreadyRunningText === "string"
            ? alreadyRunningText
            : "A 2048 game is already running in this channel!",
        ephemeral: true,
      });
    }

    const initialState = new GameState(
      channelId,
      userId,
      null,
      interaction.guildId,
    );

    // Calculate earning based on score and time (synchronous like in Snake)
    const calculateEarning = (state: Game2048State): number => {
      // Use gamesEarningLevel from state (set during initialization)
      const gamesEarningLevel = state.gamesEarningLevel || 1;
      const earningMultiplier = 1 + (gamesEarningLevel - 1) * 0.1; // 10% increase per level

      const timeInMinutes = (Date.now() - state.startTime) / 60000;
      const moveEfficiency = state.score / (state.moves || 1);

      const baseEarning =
        state.score *
        0.005 * // Base earning
        (1 + moveEfficiency / 10) * // Move efficiency multiplier
        (1 + Math.min(timeInMinutes, 5) / 5); // Time multiplier that caps at 2x for 5+ minutes

      // Apply the games earning multiplier
      const earning = baseEarning * earningMultiplier;

      return Math.max(0, Math.min(MAX_2048_SESSION_EARNING, earning));
    };

    // Helper function to generate game board image - similar to Snake.js
    const generateGameBoard = async (
      state: Game2048State,
      userLocale: string,
      userAvatarURL: string
    ) => {
      // Prepare user data for rendering
      const userData = state.userData;
      const balance = state.balance || 0;
      const chatLevelData = state.chatLevelData;
      const gameLevelData = state.gameLevelData;
      const earningGameXP = state.earningGameXP || 0;

      return generateImage(
        "2048",
        {
          grid: state.grid,
          score: state.score,
          earning: state.earning,
          locale: userLocale,
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
                currentXP:
                  (gameLevelData?.currentXP || 0) + (state.earningGameXP || 0),
                requiredXP: gameLevelData?.requiredXP || 100,
                totalXP:
                  (gameLevelData?.totalXP || 0) + (state.earningGameXP || 0),
              },
            },
            // Pass earned game XP for visual progression - like in Snake.js
            earnedGameXP: state.earningGameXP || 0,
          },
        },
        { image: 1, emoji: 1 },
        i18n,
        { renderMode: "game", doublePass: true, renderBackend: "takumi" },
      );
    };

    const prewarmStaticBoard = async (
      state: Game2048State,
      userLocale: string,
      userAvatarURL: string
    ) => {
      const userData = state.userData;
      const balance = state.balance || 0;
      const chatLevelData = state.chatLevelData;
      const gameLevelData = state.gameLevelData;

      try {
        await generateImage(
          "2048",
          {
            grid: state.grid,
            score: state.score,
            earning: state.earning,
            locale: userLocale,
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
                balance,
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
              earnedGameXP: 0,
            },
          },
          { image: 1, emoji: 1 },
          i18n,
          {
            renderMode: "game",
            renderBackend: "takumi",
            disableThrottle: true,
            prewarmStaticLayer: true,
            prewarmStaticOnly: true,
          },
        );
      } catch (error) {
        console.warn("[2048] Static layer prewarm failed:", error);
      }
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
          gameRecords = await hubClient.getGameRecords(
            interaction.guildId,
            interaction.user.id,
          );
          currentHighScore = gameRecords?.["2048"]?.highScore || 0;
        } catch (error) {
          console.error("Error getting game records:", error);
          // Continue with default high score if API fails
          currentHighScore = 0;
        }

        // Fetch complete user data including balance and level progress
        try {
          console.log(
            `[2048] Fetching complete user data for guild ${interaction.guildId}, user ${interaction.user.id}`,
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
              console.log(`[2048] Using wallet balance: ${balance}`);
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
                `[2048] Initial base game XP set: ${gameXP}, level: ${gameLevelData?.level}`,
              );
            }

            // Store games earning upgrade level for synchronous calculation
            const typedUserData = userData as UserDataLike;
            const gamesEarningUpgrade = typedUserData.upgrades?.find(
              (u: { type?: string; level?: number }) => u.type === "games_earning",
            );
            initialState.state.gamesEarningLevel =
              gamesEarningUpgrade?.level || 1;

            console.log("[2048] Complete user data fetched:", {
              balance,
              chatLevelData,
              gameLevelData,
              gamesEarningLevel: initialState.state.gamesEarningLevel,
              levelProgress: typedUserData.levelProgress,
            });

            // Store user data in game state for future use
            initialState.state.userData = typedUserData;
            initialState.state.balance = balance;
            initialState.state.chatLevelData = chatLevelData;
            initialState.state.gameLevelData = gameLevelData;

            console.log(`[2048] Initial game level data:`, {
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

      // Prepare data for image generation
      const userAvatarURL = interaction.user.displayAvatarURL({
        extension: "png",
        size: 1024,
      });

      const PREWARM_TIMEOUT_MS = 250;
      const prewarmPromise = prewarmStaticBoard(
        initialState.state,
        interaction.locale,
        userAvatarURL,
      );
      await Promise.race([
        prewarmPromise,
        new Promise((resolve) => setTimeout(resolve, PREWARM_TIMEOUT_MS)),
      ]);

      const buffer = await generateGameBoard(
        initialState.state,
        interaction.locale,
        userAvatarURL,
      );

      // Send initial game board
      const startMessage = await i18n.__(`games.2048.startMessage`);
      const highScoreText = await i18n.__(`games.2048.highScore`, {
        score: currentHighScore,
      });
      const content = [
        typeof startMessage === "string"
          ? startMessage
          : "Use the arrows to slide tiles and combine matching numbers!",
        typeof highScoreText === "string"
          ? highScoreText
          : `High Score: ${currentHighScore}`,
      ].join("\n");

      const message = await interaction.followUp({
        content: content,
        files: [{ attachment: buffer, name: "2048.png" }],
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
          const gameInstance = activeGames.get(gameKey);
          if (!gameInstance || gameInstance.state.gameOver) {
            return;
          }
          {
            gameInstance.state.earning = calculateEarning(gameInstance.state);
            const finalBoard = await generateGameBoard(
              gameInstance.state,
              interaction.locale,
              interaction.user.displayAvatarURL({
                extension: "png",
                size: 1024,
              }),
            );

            // Use earningGameXP for timeout case
            const earningGameXP = gameInstance.state.earningGameXP || 0;
            const timeoutEarning = await calculateEarning(gameInstance.state); // Calculate earning for visual consistency

            // Only add XP and level-up if in a guild
            if (interaction.guildId && earningGameXP > 0) {
              try {
                const xpResult = await hubClient.addGameXP(
                  interaction.guildId,
                  interaction.user.id,
                  "2048",
                  earningGameXP,
                );

                // Handle level-up notification if the user leveled up
                if (xpResult && xpResult.levelUp) {
                  await handleLevelUp(
                    interaction.client,
                    interaction.guildId,
                    interaction.user.id,
                    xpResult.levelUp,
                    xpResult.type || "activity",
                    interaction.channel,
                  );
                }
              } catch (error) {
                console.error("Error adding game XP:", error);
                // Continue with game even if XP addition fails
              }
            }

            // Only add balance if in a guild
            if (interaction.guildId) {
              try {
                await hubClient.addBalance(
                  interaction.guildId,
                  interaction.user.id,
                  gameInstance.state.earning,
                );
              } catch (error) {
                console.error("Error adding balance on timeout:", error);
                // Continue with game even if balance addition fails
              }
            }

            const timeoutText = await i18n.__(`games.2048.timesOut`, {
              score: gameInstance.state.score,
            });
            const content =
              typeof timeoutText === "string"
                ? `${timeoutText} (+${timeoutEarning.toFixed(
                    1,
                  )} 💵, +${earningGameXP} Game XP)`
                : `Game ended due to inactivity! Final Score: ${
                    gameInstance.state.score
                  } (+${timeoutEarning.toFixed(
                    1,
                  )} 💵, +${earningGameXP} Game XP)`;

            await message.edit({
              content: content,
              files: [{ attachment: finalBoard, name: "2048.png" }],
              components: [],
            });
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
          const notYourGameText = await i18n.__(`games.2048.notYourGame`);
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
        let moved = false;

        // Update game state timestamp
        gameInstance.updateTimestamp();

        // Handle stop action separately from move actions
        if (i.customId === "stop") {
          // Handle game stop
          state.gameOver = true; // Mark as game over immediately
          state.earning = calculateEarning(state); // Calculate final earning

          const stopBoard = await generateGameBoard(
            state,
            interaction.locale,
            interaction.user.displayAvatarURL({ extension: "png", size: 1024 }),
          );

          // Use earningGameXP for stop case
          const earningGameXP = state.earningGameXP || 0;

          let isNewRecordStop = false;
          // Only update database if in a guild
          if (interaction.guildId) {
            // Update high score
            let isNewRecordStop = false;
            try {
              const stopHighScoreResult = await hubClient.updateGameHighScore(
                interaction.guildId,
                interaction.user.id,
                "2048",
                state.score,
              );
              isNewRecordStop = stopHighScoreResult?.isNewRecord || false;
            } catch (error) {
              console.error("Error updating high score on stop:", error);
              // Continue with game even if high score update fails
              isNewRecordStop = false;
            }

            // Add XP
            if (earningGameXP > 0) {
              try {
                const stopXpResult = await hubClient.addGameXP(
                  interaction.guildId,
                  interaction.user.id,
                  "2048",
                  earningGameXP,
                );

                if (stopXpResult && stopXpResult.levelUp) {
                  await handleLevelUp(
                    interaction.client,
                    interaction.guildId,
                    interaction.user.id,
                    stopXpResult.levelUp,
                    stopXpResult.type || "activity",
                    interaction.channel,
                  );
                }
              } catch (error) {
                console.error("Error adding game XP on stop:", error);
                // Continue with game even if XP addition fails
              }
            }
            // Add Balance
            if (state.earning > 0) {
              try {
                await hubClient.addBalance(
                  interaction.guildId,
                  interaction.user.id,
                  state.earning,
                );
              } catch (error) {
                console.error("Error adding balance on stop:", error);
                // Continue with game even if balance addition fails
              }
            }
          }

          const stoppedText = await i18n.__(`games.2048.stopped`, {
            score: state.score,
          });
          const stoppedContent =
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
            content: stoppedContent,
            files: [{ attachment: stopBoard, name: "2048.png" }],
            components: [],
          });

          cleanup();
          collector.stop();
          return;
        }

        const oldScore = state.score;

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

        // If it's a valid move, update state and generate new board
        if (moved) {
          console.log("[DEBUG] Move registered.");

          state.moves++;
          state.earning = calculateEarning(state);
          addRandomTile(state);

          // Calculate score gained from this move
          const scoreGained = state.score - oldScore;

          console.log(
            `[2048] Move processed: scoreGained=${scoreGained}, oldScore=${oldScore}, newScore=${state.score}`,
          );

          // Update earning game XP for display only when score increases
          if (state.score > oldScore) {
            console.log(
              "[DEBUG] Score increased, calling updateEarningGameXP()",
            );
            const scoreDifference = state.score - oldScore;
            console.log(
              `[2048] Score increased by ${scoreDifference}, oldScore=${oldScore}, newScore=${state.score}`,
            );
            const xpGained = gameInstance.updateEarningGameXP(scoreDifference);
            console.log(
              `[2048] Updated earningGameXP: ${gameInstance.state.earningGameXP}, gameLevelData.currentXP: ${gameInstance.state.gameLevelData?.currentXP}`,
            );
          } else {
            console.log("[DEBUG] Score NOT increased");
            console.log(state.score);
            console.log(oldScore);
          }
          const buffer = await generateGameBoard(
            state,
            interaction.locale,
            interaction.user.displayAvatarURL({ extension: "png", size: 1024 }),
          );

          // Update the message with new game state
          const scoreText = await i18n.__(`games.2048.score`, {
            score: state.score,
          });
          await message.edit({
            content:
              typeof scoreText === "string"
                ? scoreText
                : `Your Score: ${state.score}`,
            files: [{ attachment: buffer, name: "2048.png" }],
            components: [row1, row2],
          });

          if (checkGameOver(state)) {
            state.gameOver = true;

            try {
              // Use earningGameXP for game over case
              const earningGameXP = state.earningGameXP || 0;
              const finalEarning = await calculateEarning(state); // Calculate final earning for visual XP
              console.log(
                `[2048] Game over - earningGameXP: ${earningGameXP}, finalEarning: ${finalEarning}`,
              );

              // Only update high score if in a guild
              let isNewRecord = false;
              if (interaction.guildId) {
                // Update high score
                let isNewRecord = false;
                try {
                  const highScoreResult = await hubClient.updateGameHighScore(
                    interaction.guildId,
                    interaction.user.id,
                    "2048",
                    state.score,
                  );
                  isNewRecord = highScoreResult.isNewRecord || false;
                } catch (error) {
                  console.error("Error updating high score:", error);
                  // Continue with game even if high score update fails
                  isNewRecord = false;
                }

                // Only add XP if there's something to add
                if (earningGameXP > 0) {
                  try {
                    console.log(
                      `[2048] Adding game over XP: ${earningGameXP} for user ${interaction.user.id}`,
                    );
                    const xpResult = await hubClient.addGameXP(
                      interaction.guildId,
                      interaction.user.id,
                      "2048",
                      earningGameXP,
                    );

                    // Debug logging for game XP and level-up
                    console.log("2048 Game Over XP Result:", xpResult);

                    // Handle level-up notification if the user leveled up
                    if (xpResult && xpResult.levelUp) {
                      console.log(
                        `[2048] User ${interaction.user.id} leveled up on game over!`,
                        xpResult.levelUp,
                      );
                      await handleLevelUp(
                        interaction.client,
                        interaction.guildId,
                        interaction.user.id,
                        xpResult.levelUp,
                        xpResult.type || "activity",
                        interaction.channel,
                      );
                    }
                  } catch (error) {
                    console.error("Error adding game XP on game over:", error);
                    // Continue with game even if XP addition fails
                  }
                }

                // Update the visual XP for the final game board to be consistent with in-game moves
                state.earning = finalEarning; // Use the calculated final earning for visual display

                // Only add balance if there's something to add
                if (state.earning > 0) {
                  try {
                    await hubClient.addBalance(
                      interaction.guildId,
                      interaction.user.id,
                      state.earning,
                    );
                  } catch (error) {
                    console.error("Error adding balance on game over:", error);
                    // Continue with game even if balance addition fails
                  }
                }
              }

              // Generate final game board
              const finalBoard = await generateGameBoard(
                state,
                interaction.locale,
                interaction.user.displayAvatarURL({
                  extension: "png",
                  size: 1024,
                }),
              );

              const gameOverText = await i18n.__(`games.2048.gameOver`, {
                score: state.score,
              });
              const gameOverContent =
                typeof gameOverText === "string"
                  ? `${gameOverText}${
                      interaction.guildId
                        ? ` (+${state.earning.toFixed(
                            1,
                          )} 💵, +${earningGameXP} Game XP)${
                            isNewRecord ? " 🏆 New High Score!" : ""
                          }`
                        : ""
                    }`
                  : `Game Over! Final Score: ${state.score}${
                      interaction.guildId
                        ? ` (+${state.earning.toFixed(
                            1,
                          )} 💵, +${earningGameXP} Game XP)${
                            isNewRecord ? " 🏆 New High Score!" : ""
                          }`
                        : ""
                    }`;

              await message.edit({
                content: gameOverContent,
                files: [{ attachment: finalBoard, name: "2048.png" }],
                components: [],
              });

              cleanup();
              collector.stop();
            } catch (error) {
              console.error("Error in game over handling:", error);
              // Continue with cleanup even if there's an error
              cleanup();
              collector.stop();
            }
          }
        } else {
          // For invalid moves, just update the message content
          const invalidMoveText = await i18n.__(`games.2048.invalidMove`);
          await message.edit({
            content:
              typeof invalidMoveText === "string"
                ? invalidMoveText
                : "Invalid move!",
            components: [row1, row2],
          });
        }
      });

      collector.on("end", () => {
        cleanup();
      });
    } catch (error) {
      console.error("Error executing game 2048:", error);
      if (!interaction.replied) {
        const errorText = await i18n.__(`games.2048.error`);
        await interaction.reply({
          content:
            typeof errorText === "string"
              ? errorText
              : "There was an error starting the game. Please try again.",
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
    highScore: {
      en: "High Score: {{score}}",
      ru: "Рекорд: {{score}}",
      uk: "Рекорд: {{score}}",
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
    stopped: {
      en: "Game stopped! Final Score: {{score}}",
      ru: "Игра остановлена! Финальный счет: {{score}}",
      uk: "Гру зупинено! Фінальний рахунок: {{score}}",
    },
    error: {
      en: "There was an error starting the game. Please try again.",
      ru: "Произошла ошибка при запуске игры. Пожалуйста, попробуйте снова.",
      uk: "Сталася помилка при запуску гри. Будь ласка, спробуйте знову.",
    },
  },
};

// Game logic functions
function addRandomTile(state: Game2048State): void {
  const emptyCells: Array<{ row: number; col: number }> = [];
  for (let row = 0; row < 4; row++) {
    const gridRow = state.grid[row];
    if (!gridRow) {
      continue;
    }
    for (let col = 0; col < 4; col++) {
      if (gridRow[col] === 0) {
        emptyCells.push({ row, col });
      }
    }
  }

  if (emptyCells.length > 0) {
    const selectedCell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    if (!selectedCell) {
      return;
    }
    const { row, col } = selectedCell;
    const gridRow = state.grid[row];
    if (!gridRow) {
      return;
    }
    gridRow[col] = Math.random() < 0.9 ? 2 : 4;
  }
}

function moveLeft(state: Game2048State): boolean {
  let moved = false;
  for (let row = 0; row < 4; row++) {
    const gridRow = state.grid[row];
    if (!gridRow) {
      continue;
    }
    // Remove zeros
    let nums = gridRow.filter((x: number) => x !== 0);

    // Merge tiles
    for (let i = 0; i < nums.length - 1; i++) {
      const currentValue = nums[i];
      const nextValue = nums[i + 1];
      if (currentValue !== undefined && currentValue === nextValue) {
        const mergedValue = currentValue * 2;
        nums[i] = mergedValue;
        state.score += mergedValue;
        console.log(
          `[2048] DEBUG: Merged tiles, added ${mergedValue} to score. Score now: ${state.score}`,
        );
        nums[i + 1] = 0;
        moved = true;
      }
    }

    // Remove zeros again
    nums = nums.filter((x: number) => x !== 0);

    // Pad with zeros
    while (nums.length < 4) nums.push(0);

    // Only update if the row changed
    if (nums.some((val: number, idx: number) => val !== gridRow[idx])) {
      state.grid[row] = nums;
      moved = true;
    }
  }
  return moved;
}

function moveRight(state: Game2048State): boolean {
  state.grid.forEach((row: number[]) => row.reverse());
  const moved = moveLeft(state);
  state.grid.forEach((row: number[]) => row.reverse());
  return moved;
}

function moveUp(state: Game2048State): boolean {
  transpose(state.grid);
  const moved = moveLeft(state);
  transpose(state.grid);
  return moved;
}

function moveDown(state: Game2048State): boolean {
  transpose(state.grid);
  const moved = moveRight(state);
  transpose(state.grid);
  return moved;
}

function transpose(matrix: number[][]): void {
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < row; col++) {
      const rowData = matrix[row];
      const colData = matrix[col];
      if (!rowData || !colData) {
        continue;
      }
      const rowValue = rowData[col];
      const colValue = colData[row];
      if (rowValue === undefined || colValue === undefined) {
        continue;
      }
      [rowData[col], colData[row]] = [colValue, rowValue];
    }
  }
}

function checkGameOver(state: Game2048State): boolean {
  // First check if there are any empty cells
  for (let row = 0; row < 4; row++) {
    const gridRow = state.grid[row];
    if (!gridRow) {
      continue;
    }
    for (let col = 0; col < 4; col++) {
      if (gridRow[col] === 0) return false;
    }
  }

  // Then check if any adjacent tiles can be merged
  for (let row = 0; row < 4; row++) {
    const gridRow = state.grid[row];
    if (!gridRow) {
      continue;
    }
    for (let col = 0; col < 4; col++) {
      if (col < 3 && gridRow[col] === gridRow[col + 1])
        return false;
      const nextRow = state.grid[row + 1];
      if (row < 3 && gridRow[col] === nextRow?.[col])
        return false;
    }
  }

  state.gameOver = true;
  return true;
}
