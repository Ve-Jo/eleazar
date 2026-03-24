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
import { generateImage } from "../../utils/imageGenerator.ts";

import hubClient from "../../api/hubClient.ts";
import { awardGameCoins } from "../../utils/gameDailyEarnings.ts";
import { calculateRiskyGameXp } from "../../utils/riskyGameXp.ts";
import { getEconomyTuningConfig } from "../../../../hub/shared/src/economyTuning.ts";

type TranslatorLike = {
  __: (key: string, variables?: Record<string, unknown>) => Promise<string>;
  setLocale?: (locale: string) => string;
  getLocale?: () => string;
};

type TowerDifficulty = "easy" | "medium" | "hard";

type LevelDataLike = {
  level: number;
  currentXP: number;
  requiredXP: number;
  totalXP: number;
};

type LevelProgressLike = {
  chat: LevelDataLike | null;
  game: LevelDataLike | null;
};

type UserRecordLike = {
  economy?: {
    balance?: string | number | null;
  } | null;
  Level?: {
    xp?: string | number | null;
    gameXp?: string | number | null;
  } | null;
  levelProgress?: unknown;
};

type TowerPendingState = {
  bet: number;
  difficulty: TowerDifficulty;
  isPreGame: boolean;
  balance: number;
  levelProgress: LevelProgressLike;
  sessionChange: number;
};

type TowerCollectorRecord = {
  options?: {
    filter?: unknown;
    componentType?: ComponentType;
  };
  filter?: unknown;
  stop: (reason?: string) => void;
};

type ModalSubmissionLike = {
  customId: string;
  user: { id: string };
  fields: {
    getTextInputValue: (name: string) => string;
  };
  reply: (payload: { content: string; ephemeral?: boolean }) => Promise<unknown>;
  update: (payload: Record<string, unknown>) => Promise<unknown>;
};

type SetupInteractionLike = {
  customId: string;
  user: { id: string };
  message: { id: string };
  replied?: boolean;
  deferred?: boolean;
  showModal: (modal: ModalBuilder) => Promise<unknown>;
  awaitModalSubmit: (options: {
    filter: (interaction: ModalSubmissionLike) => boolean;
    time: number;
  }) => Promise<ModalSubmissionLike>;
  update: (payload: Record<string, unknown>) => Promise<unknown>;
  reply: (payload: { content: string; ephemeral?: boolean }) => Promise<unknown>;
  followUp: (payload: { content: string; ephemeral?: boolean }) => Promise<unknown>;
  deferUpdate: () => Promise<unknown>;
};

type GameInteractionLike = {
  customId: string;
  user: { id: string };
  message: { id: string };
  replied?: boolean;
  deferred?: boolean;
  reply: (payload: { content: string; ephemeral?: boolean }) => Promise<unknown>;
  deferUpdate: () => Promise<unknown>;
};

type CollectorLike = {
  on: ((
    event: "collect",
    handler: (interaction: SetupInteractionLike) => Promise<void>
  ) => void) &
    ((event: "end", handler: (collected: unknown, reason: string) => unknown) => void);
  stop: (reason?: string) => void;
};

type GameCollectorLike = {
  on: ((
    event: "collect",
    handler: (interaction: GameInteractionLike) => Promise<void>
  ) => void) &
    ((event: "end", handler: (collected: unknown, reason: string) => unknown) => void);
  stop: (reason?: string) => void;
};

type MessageLike = {
  id: string;
  editable?: boolean;
  collectors?: TowerCollectorRecord[];
  edit: (payload: Record<string, unknown>) => Promise<unknown>;
  createMessageComponentCollector: (options: {
    filter: (interaction: SetupInteractionLike | GameInteractionLike) => boolean;
    componentType: ComponentType;
    time: number;
  }) => CollectorLike | GameCollectorLike;
};

type CommandInteractionLike = {
  channelId: string;
  guildId?: string | null;
  guildLocale?: string;
  locale?: string;
  replied?: boolean;
  deferred?: boolean;
  user: {
    id: string;
    displayAvatarURL: (options?: { extension?: string; size?: number }) => string;
  };
  followUp: (payload: Record<string, unknown>) => Promise<MessageLike>;
  reply: (payload: { content: string; ephemeral?: boolean }) => Promise<unknown>;
};

type TowerGameState = {
  channelId: string;
  userId: string;
  guildId?: string | null;
  messageId: string | null;
  difficulty: TowerDifficulty | null;
  betAmount: number;
  currentFloor: number;
  tilesPerRow: number;
  bombPositions: Record<number, number[]>;
  currentPrize: number;
  gameOver: boolean;
  lastAction: "start" | "safe" | "bomb" | "prize";
  lastUpdateTime: number;
  sessionChange: number;
  initialBalance: number;
  selectedTiles: number[];
  vaultGuardReduction: number;
};

function parseBalance(value: string | number | null | undefined): number {
  return parseFloat(String(value ?? 0));
}

// --- Game Constants ---
const MAX_FLOORS = 10;
const TILE_COUNTS: Record<TowerDifficulty, number> = {
  easy: 3,
  medium: 4,
  hard: 5,
};
const BOMB_COUNTS: Record<TowerDifficulty, number> = {
  easy: 1,
  medium: 2,
  hard: 4,
};
// Adjusted multipliers for a slight house edge, increasing with difficulty
const BASE_MULTIPLIERS: Record<TowerDifficulty, number[]> = {
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

const MAX_TOWER_PAYOUT_ABSOLUTE = 50000;
const MAX_TOWER_PAYOUT_MULTIPLIER = 50;

// --- Game State Management ---
const activeGames = new Map<string, GameState>();

class GameState {
  channelId: string;
  userId: string;
  guildId?: string | null;
  messageId: string | null;
  difficulty: TowerDifficulty | null;
  betAmount: number;
  currentFloor: number;
  tilesPerRow: number;
  bombPositions: Record<number, number[]>;
  currentPrize: number;
  gameOver: boolean;
  lastAction: "start" | "safe" | "bomb" | "prize";
  lastUpdateTime: number;
  sessionChange: number;
  initialBalance: number;
  selectedTiles: number[];
  vaultGuardReduction: number;

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

    this.difficulty = null; // 'easy' or 'hard'
    this.betAmount = 0;
    this.currentFloor = 0;
    this.tilesPerRow = 0;
    this.bombPositions = {}; // { floor: [bombIndex1, bombIndex2,...] }
    this.currentPrize = 0;
    this.gameOver = false;
    this.lastAction = "start"; // e.g., 'start', 'safe', 'bomb', 'prize'
    this.lastUpdateTime = Date.now();
    this.sessionChange = 0; // Track money won/lost during session
    this.initialBalance = 0; // Store initial balance before game starts
    this.selectedTiles = [];
    this.vaultGuardReduction = 0;
  }

  // Generate bomb position for the next floor if it doesn't exist
  ensureBombPosition(floor: number): void {
    if (!this.bombPositions[floor]) {
      if (!this.difficulty) {
        return;
      }
      const bombCount = BOMB_COUNTS[this.difficulty];
      const tileCount = this.tilesPerRow;
      const bombs: number[] = [];
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
        }) set to indices: ${bombs.join(", ")}`,
      );
    }
  }

  calculatePrize(floor: number): number {
    if (floor < 0) return 0;
    if (!this.difficulty) return 0;
    const multipliers = BASE_MULTIPLIERS[this.difficulty];
    const multiplier =
      multipliers[floor] ?? multipliers[multipliers.length - 1] ?? 0;
    const rawPrize = this.betAmount * multiplier;
    const cappedPrize = Math.min(
      rawPrize,
      this.betAmount * MAX_TOWER_PAYOUT_MULTIPLIER,
      MAX_TOWER_PAYOUT_ABSOLUTE
    );
    return parseFloat(cappedPrize.toFixed(2));
  }

  updateTimestamp() {
    this.lastUpdateTime = Date.now();
  }
}

function getGameKey(channelId: string, userId: string): string {
  return `tower-${channelId}-${userId}`;
}

// Updated to handle pre-game state
async function generateTowerImage(
  interaction: CommandInteractionLike,
  i18n: TranslatorLike,
  pendingState: TowerPendingState,
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
    // Pass balance and level progress data
    balance: pendingState.balance || 0,
    levelProgress: pendingState.levelProgress || {
      chat: null,
      game: null,
    },
    // Pass session change data (can be non-zero when restarting)
    sessionChange: pendingState.sessionChange || 0,
  };

  // Use the actual component name
  return generateImage("Tower", props, { image: 1.5, emoji: 1 }, i18n, {
    renderMode: "game",
  });
}

// Function to generate image for active game state
async function generateActiveTowerImage(
  gameInstance: GameState,
  interaction: CommandInteractionLike,
  i18n: TranslatorLike,
  balance = 0,
  levelProgress: LevelProgressLike = { chat: null, game: null },
) {
  // Calculate session change as current balance minus initial balance
  const sessionChange = balance - gameInstance.initialBalance;

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
    // Calculate the next prize correctly based on current floor
    nextPrize: gameInstance.calculatePrize(gameInstance.currentFloor),
    maxFloors: MAX_FLOORS,
    lastAction: gameInstance.lastAction,
    gameOver: gameInstance.gameOver,
    isPreGame: false, // Explicitly false for active game
    selectedTiles: gameInstance.selectedTiles || [],
    floorMultipliers: gameInstance.difficulty
      ? BASE_MULTIPLIERS[gameInstance.difficulty]
      : BASE_MULTIPLIERS.easy,
    locale: interaction.locale || interaction.guildLocale || "en",
    dominantColor: "user",
    // Pass balance and level progress data
    balance: balance || 0, // Ensure balance is always a number
    levelProgress: {
      chat: levelProgress.chat || null,
      game: levelProgress.game || null,
    },
    // Pass session change data (calculated as balance difference)
    sessionChange: sessionChange || 0,
  };
  return generateImage("Tower", props, { image: 1.5, emoji: 1 }, i18n, {
    renderMode: "game",
  });
}

// --- Command Export ---
export default {
  id: "tower",
  title: "Tower",
  emoji: "🗼",
  async execute(interaction: CommandInteractionLike, i18n: TranslatorLike) {
    const channelId = interaction.channelId;
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const gameKey = getGameKey(channelId, userId);
    const locale = interaction.locale || interaction.guildLocale || "en";
    if (i18n && typeof i18n.setLocale === "function") {
      i18n.setLocale(locale);
    }

    // Helper function to safely get translation with fallback (same as 2048.js)
    const getTranslation = async (
      key: string,
      variables: Record<string, unknown> = {}
    ): Promise<string> => {
      try {
        const result = await i18n.__(key, variables);
        return typeof result === "string" ? result : (key.split(".").pop() ?? key);
      } catch (error) {
        console.warn(`Translation error for key: ${key}`, error);
        return key.split(".").pop() ?? key;
      }
    };

    // Interaction is already deferred from work.js

    if (activeGames.has(gameKey)) {
      return interaction.followUp({
        content: await getTranslation("games.tower.alreadyRunning"),
        ephemeral: true,
      });
    }

    const getRiskyLimitStatus = async (): Promise<{
      earnedToday?: number | string;
      cap?: number | string;
      remainingToday?: number | string;
    } | null> => {
      if (!guildId) {
        return null;
      }

      try {
        return (await hubClient.getGameDailyStatus(
          guildId,
          userId,
          "tower"
        )) as {
          earnedToday?: number | string;
          cap?: number | string;
          remainingToday?: number | string;
        };
      } catch (statusError) {
        console.error("[Tower] Failed to fetch daily status:", statusError);
        return null;
      }
    };

    const initialRiskyStatus = await getRiskyLimitStatus();
    if (
      guildId &&
      initialRiskyStatus &&
      Number(initialRiskyStatus.remainingToday || 0) <= 0
    ) {
      return interaction.followUp({
        content: await getTranslation("games.tower.dailyLimitReached", {
          earned: Number(initialRiskyStatus.earnedToday || 0).toFixed(1),
          cap: Number(initialRiskyStatus.cap || 0).toFixed(1),
        }),
        ephemeral: true,
      });
    }

    // --- Initial Setup Phase ---
    let pendingBet = 0;
    let pendingDifficulty: TowerDifficulty = "easy"; // Default difficulty
    let setupMessage: MessageLike | null = null;
    let setupCollector: CollectorLike | null = null; // Add this to the outer scope

    // Create a reusable function for setting up the game
    const setupGame = async (
      initialBet = 0,
      initialDifficulty: TowerDifficulty = "easy",
      initialSessionChange = 0,
    ) => {
      pendingBet = initialBet;
      pendingDifficulty = initialDifficulty;

      // Fetch user data for balance and level progress
      let userData = null;
      let balance = 0;
      let chatLevelData = null;
      let gameLevelData = null;

      if (guildId) {
        try {
          // Ensure user exists in database
          await hubClient.ensureGuildUser(guildId, userId);
          userData = (await hubClient.getUser(guildId, userId)) as UserRecordLike | null;

          if (userData) {
            // Get wallet balance
            if (userData.economy) {
              balance = Number(userData.economy.balance || 0);
            }

            // Calculate level progress for XP bars
            if (userData.Level) {
              const chatXP = Number(userData.Level.xp || 0);
              chatLevelData = hubClient.calculateLevel(chatXP);

              const gameXP = Number(userData.Level.gameXp || 0);
              gameLevelData = hubClient.calculateLevel(gameXP);
            }
          }
        } catch (error) {
          console.error("Error fetching user data for Tower:", error);
        }
      }

      // Generate initial pre-game image
      const initialBuffer = await generateTowerImage(interaction, i18n, {
        bet: pendingBet,
        difficulty: pendingDifficulty,
        isPreGame: true,
        balance: balance || 0,
        levelProgress: {
          chat: chatLevelData || null,
          game: gameLevelData || null,
        },
        sessionChange: initialSessionChange,
      });

      // If setupMessage already exists, edit it, otherwise create a new one
      if (setupMessage) {
        await setupMessage.edit({
          content: await getTranslation("games.tower.setupPrompt"),
          files: [{ attachment: initialBuffer, name: "tower_setup.png" }],
          components: [await createSetupComponents()],
        });
      } else {
        setupMessage = await interaction.followUp({
          content: await getTranslation("games.tower.setupPrompt"),
          files: [{ attachment: initialBuffer, name: "tower_setup.png" }],
          components: [await createSetupComponents()],
          fetchReply: true,
        });
      }

      // Create a setup collector
      setupCollector = createSetupCollector();
      return setupCollector;
    };

    // Reusable function to create setup components
    const createSetupComponents = async () => {
      const setBetButton = new ButtonBuilder()
        .setCustomId(`tower_set_bet_pregame_${userId}`)
        .setLabel(await getTranslation("games.tower.setBetButtonLabel"))
        .setStyle(ButtonStyle.Primary);

      const changeDifficultyButton = new ButtonBuilder()
        .setCustomId(`tower_change_difficulty_pregame_${userId}`)
        .setLabel(
          await getTranslation("games.tower.difficultyLabelShort", {
            difficulty: pendingDifficulty,
          }),
        )
        .setStyle(ButtonStyle.Secondary);

      const startGameButton = new ButtonBuilder()
        .setCustomId(`tower_start_game_${userId}`)
        .setLabel(await getTranslation("games.tower.startButtonLabel"))
        .setStyle(ButtonStyle.Success)
        .setDisabled(pendingBet <= 0); // Disable if bet not set

      return new ActionRowBuilder().addComponents(
        setBetButton,
        changeDifficultyButton,
        startGameButton,
      );
    };

    // Create filter function for setup collector
    const setupCollectorFilter = (i: SetupInteractionLike) =>
      i.user.id === userId && i.message.id === setupMessage?.id;

    // Create restart collector function
    const createRestartCollector = (gameInstance: GameState) => {
      if (!setupMessage) {
        return null;
      }
      const currentSetupMessage = setupMessage;

      const collectors = currentSetupMessage.collectors || [];
      collectors.forEach((collector) => {
        if (
          collector.options &&
          collector.options.filter &&
          collector.filter &&
          collector.options.componentType === ComponentType.Button
        ) {
          try {
            collector.stop("replaced");
          } catch (err) {
            console.error("[Tower] Error stopping previous collector:", err);
          }
        }
      });

      const restartCollector = currentSetupMessage.createMessageComponentCollector({
        filter: (i: SetupInteractionLike | GameInteractionLike) =>
          i.user.id === userId && i.customId === `tower_restart_game_${userId}`,
        componentType: ComponentType.Button,
        time: 60000 * 15, // 15 minutes to decide to restart
      }) as CollectorLike;

      restartCollector.on("collect", async (restartInteraction: SetupInteractionLike) => {
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
          const prevDifficulty = gameInstance.difficulty ?? "easy";

          // Start a new setup with the previous settings, including sessionChange from previous game
          await setupGame(prevBet, prevDifficulty, gameInstance.sessionChange);
        } catch (error) {
          console.error("[Tower] Error in restart collector:", error);
          // Don't try to respond to the interaction if there's an error
          // as it might already be acknowledged
        }
      });

      restartCollector.on("end", (_collected, reason) => {
        console.log(`[Tower] Restart collector ended. Reason: ${reason}`);
      });

      return restartCollector;
    };

    // Create and setup the collector for the setup phase
    const createSetupCollector = () => {
      if (!setupMessage) {
        return null;
      }
      const currentSetupMessage = setupMessage;
      const collectors = currentSetupMessage.collectors || [];
      collectors.forEach((collector) => {
        try {
          collector.stop("new_setup");
        } catch (err) {
          console.error("[Tower] Error stopping previous collector:", err);
        }
      });

      const newSetupCollector = currentSetupMessage.createMessageComponentCollector({
        filter: (interaction: SetupInteractionLike | GameInteractionLike) =>
          setupCollectorFilter(interaction as SetupInteractionLike),
        componentType: ComponentType.Button,
        time: 60000 * 5, // 5 minutes for setup
      }) as CollectorLike;

      newSetupCollector.on("collect", handleSetupInteraction);
      newSetupCollector.on("end", async (_collected, reason) => {
        // Clean up setup message if game didn't start
        if (
          reason !== "user" &&
          reason !== "game_started" &&
          !activeGames.has(gameKey) &&
          currentSetupMessage.editable
        ) {
          currentSetupMessage
            .edit({
              content: await getTranslation("games.tower.setupTimeout"),
              components: [],
              embeds: [],
            })
            .catch(console.error);
        }
        console.log(
          `[Tower] Setup collector ended for ${userId}. Reason: ${reason}`,
        );
      });

      return newSetupCollector;
    };

    // Handle all setup phase interactions
    const handleSetupInteraction = async (i: SetupInteractionLike) => {
      try {
        // --- Set Bet Button ---
        if (i.customId === `tower_set_bet_pregame_${userId}`) {
          const betModal = new ModalBuilder()
            .setCustomId(`tower_bet_modal_${userId}`)
            .setTitle(await getTranslation("games.tower.setBetTitle"));
          const amountInput = new TextInputBuilder()
            .setCustomId("bet_amount")
            .setLabel(await getTranslation("games.tower.betAmountLabel"))
            .setStyle(TextInputStyle.Short)
            .setPlaceholder(await getTranslation("games.tower.betPlaceholder"))
            .setValue(pendingBet > 0 ? pendingBet.toString() : "") // Pre-fill with current bet if exists
            .setRequired(true);
          betModal.addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(amountInput),
          );
          await i.showModal(betModal);

          const modalFilter = (modalInteraction: ModalSubmissionLike) =>
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
              content: await getTranslation("games.tower.invalidBet"),
              ephemeral: true,
            });
            return;
          }
          // Check balance only when setting bet and only if in a guild
          if (guildId) {
            const userData = (await hubClient.getUser(
              guildId,
              userId,
            )) as UserRecordLike | null;
            const userBalance = parseBalance(userData?.economy?.balance);
            if (!userData || !userData.economy || userBalance < betAmount) {
              await modalSubmission.reply({
                content: await getTranslation("games.tower.notEnoughMoney", {
                  balance: userBalance.toFixed(2),
                  bet: betAmount,
                }),
                ephemeral: true,
              });
              return;
            }
          }

          pendingBet = betAmount;

          // Fetch updated balance and level progress after setting bet
          let updatedBalance = 0;
          let chatLevelData = null;
          let gameLevelData = null;

          if (guildId) {
            try {
              const currentBalanceData = await hubClient.getUser(
                guildId,
                userId,
              );
              updatedBalance = parseBalance(currentBalanceData?.economy?.balance);

              if (currentBalanceData?.Level) {
                const chatXP = Number(currentBalanceData.Level.xp || 0);
                chatLevelData = hubClient.calculateLevel(chatXP);
                const gameXP = Number(currentBalanceData.Level.gameXp || 0);
                gameLevelData = hubClient.calculateLevel(gameXP);
              }
            } catch (error) {
              console.error(
                "Error fetching user data after setting bet:",
                error,
              );
            }
          }

          const updatedBuffer = await generateTowerImage(interaction, i18n, {
            bet: pendingBet,
            difficulty: pendingDifficulty,
            isPreGame: true,
            balance: updatedBalance,
            levelProgress: {
              chat: chatLevelData,
              game: gameLevelData,
            },
            sessionChange: 0, // Reset to 0 when setting new bet
          });
          await modalSubmission.update({
            files: [{ attachment: updatedBuffer, name: "tower_setup.png" }],
            components: [await createSetupComponents()], // Update buttons (Start might enable)
          });
        }
        // --- Change Difficulty Button ---
        else if (i.customId === `tower_change_difficulty_pregame_${userId}`) {
          const difficulties: TowerDifficulty[] = ["easy", "medium", "hard"];
          const currentIndex = difficulties.indexOf(pendingDifficulty);
          pendingDifficulty =
            difficulties[(currentIndex + 1) % difficulties.length] ?? "easy";

          // Fetch current balance and level progress for the updated image
          let currentBalance = 0;
          let chatLevelData = null;
          let gameLevelData = null;

          if (guildId) {
            try {
              const currentBalanceData = await hubClient.getUser(
                guildId,
                userId,
              );
              currentBalance = parseBalance(currentBalanceData?.economy?.balance);

              if (currentBalanceData?.Level) {
                const chatXP = Number(currentBalanceData.Level.xp || 0);
                chatLevelData = hubClient.calculateLevel(chatXP);
                const gameXP = Number(currentBalanceData.Level.gameXp || 0);
                gameLevelData = hubClient.calculateLevel(gameXP);
              }
            } catch (error) {
              console.error(
                "Error fetching user data after changing difficulty:",
                error,
              );
            }
          }

          const updatedBuffer = await generateTowerImage(interaction, i18n, {
            bet: pendingBet,
            difficulty: pendingDifficulty,
            isPreGame: true,
            balance: currentBalance,
            levelProgress: {
              chat: chatLevelData,
              game: gameLevelData,
            },
            sessionChange: 0, // Reset to 0 when changing difficulty
          });
          await i.update({
            files: [{ attachment: updatedBuffer, name: "tower_setup.png" }],
            components: [await createSetupComponents()], // Update button label
          });
        }
        // --- Start Game Button ---
        else if (i.customId === `tower_start_game_${userId}`) {
          if (pendingBet <= 0) {
            await i.reply({
              content: await getTranslation("games.tower.noBetSet"),
              ephemeral: true,
            });
            return;
          }

          if (guildId) {
            const riskyStatus = await getRiskyLimitStatus();
            if (riskyStatus && Number(riskyStatus.remainingToday || 0) <= 0) {
              await i.reply({
                content: await getTranslation("games.tower.dailyLimitReached", {
                  earned: Number(riskyStatus.earnedToday || 0).toFixed(1),
                  cap: Number(riskyStatus.cap || 0).toFixed(1),
                }),
                ephemeral: true,
              });
              return;
            }
          }

          // Final balance check before starting
          if (guildId) {
            const userDataStart = await hubClient.getUser(guildId, userId);
            const userBalanceStart = parseBalance(userDataStart?.economy?.balance);
            if (
              !userDataStart ||
              !userDataStart.economy ||
              userBalanceStart < pendingBet
            ) {
              await i.reply({
                content: await getTranslation("games.tower.notEnoughMoney", {
                  balance: userBalanceStart.toFixed(2),
                  bet: pendingBet,
                }),
                ephemeral: true,
              });
              return;
            }
          }

          if (!setupMessage) {
            return;
          }
          const currentSetupMessage = setupMessage;

          // Initialize actual Game State
          const gameInstance = new GameState(
            channelId,
            userId,
            currentSetupMessage.id,
            guildId,
          );
          gameInstance.betAmount = pendingBet;
          gameInstance.difficulty = pendingDifficulty;
          gameInstance.tilesPerRow = TILE_COUNTS[pendingDifficulty];
          gameInstance.currentPrize = pendingBet; // Start prize is the bet
          gameInstance.ensureBombPosition(0);

          // Initialize selectedTiles array to track selections
          // Store initial balance before deducting bet
          let initialBalance = 0;
          if (guildId) {
            try {
              const userDataStart = await hubClient.getUser(guildId, userId);
              initialBalance = parseBalance(userDataStart?.economy?.balance);
              const userUpgrades = Array.isArray(userDataStart?.upgrades)
                ? userDataStart.upgrades
                : [];
              const vaultGuardLevel =
                userUpgrades.find(
                  (upgrade: { type?: string; level?: number }) =>
                    upgrade.type === "vault_guard"
                )?.level || 1;
              const tuning = getEconomyTuningConfig();
              gameInstance.vaultGuardReduction = Math.min(
                Math.max(0, Number(tuning.guardrails.towerMaxVaultRefundReduction || 0.2)),
                Math.max(0, vaultGuardLevel - 1) *
                  Math.max(0, Number(tuning.guardrails.towerVaultRefundPerLevel || 0.04))
              );
            } catch (error) {
              console.error("Error fetching initial balance:", error);
            }
          }
          gameInstance.initialBalance = initialBalance;

          activeGames.set(gameKey, gameInstance);

          // Deduct bet if in a guild
          if (guildId) {
            const tuning = getEconomyTuningConfig();
            await hubClient.addBalance(
              guildId,
              userId,
              -gameInstance.betAmount,
              "tower_bet_placed",
              {
                difficulty: gameInstance.difficulty,
                tuningVersion: tuning.version,
              }
            );
          }

          // Update message to game state
          await i.deferUpdate(); // Defer this interaction before editing message

          // Stop the setup collector
          if (setupCollector) {
            setupCollector.stop("game_started");
          }

          // Fetch updated balance and level progress after deducting bet
          let updatedBalance = 0;
          let chatLevelData = null;
          let gameLevelData = null;

          if (guildId) {
            try {
              const currentBalanceData = await hubClient.getUser(
                guildId,
                userId,
              );
              updatedBalance = parseBalance(currentBalanceData?.economy?.balance);

              if (currentBalanceData?.Level) {
                const chatXP = Number(currentBalanceData.Level.xp || 0);
                chatLevelData = hubClient.calculateLevel(chatXP);
                const gameXP = Number(currentBalanceData.Level.gameXp || 0);
                gameLevelData = hubClient.calculateLevel(gameXP);
              }
            } catch (error) {
              console.error(
                "Error fetching user data after starting game:",
                error,
              );
            }
          }

          const gameBuffer = await generateActiveTowerImage(
            gameInstance,
            interaction,
            i18n,
            updatedBalance,
            {
              chat: chatLevelData,
              game: gameLevelData,
            },
          );

          // Start the active game
          await startActiveGame(gameInstance, gameBuffer, currentSetupMessage);
        }
      } catch (error) {
        console.error("[Tower] Error during setup collector:", error);
        if (!i.replied && !i.deferred) {
          await i
            .reply({
              content: await getTranslation("games.tower.setupError"),
              ephemeral: true,
            })
            .catch(console.error);
        } else {
          await i
            .followUp({
              content: await getTranslation("games.tower.setupError"),
              ephemeral: true,
            })
            .catch(console.error);
        }
      }
    };

    // Function to create restart button for game over state
    const createGameOverButtons = async (userId: string) => {
      const restartButton = new ButtonBuilder()
        .setCustomId(`tower_restart_game_${userId}`)
        .setLabel(await getTranslation("games.tower.restartButtonLabel"))
        .setStyle(ButtonStyle.Primary);

      return [new ActionRowBuilder().addComponents(restartButton)];
    };

    // Start an active game
    const startActiveGame = async (
      gameInstance: GameState,
      initialBuffer: unknown,
      currentSetupMessage: MessageLike
    ) => {
      // --- Create Gameplay Buttons ---
      const createGameButtons = async (floor: number) => {
        const tileButtons = Array.from(
          { length: gameInstance.tilesPerRow },
          (_, idx) =>
            new ButtonBuilder()
              .setCustomId(`tower_tile_${idx}`)
              .setLabel(`${idx + 1}`)
              .setStyle(ButtonStyle.Secondary),
        );
        const takePrizeButton = new ButtonBuilder()
          .setCustomId("tower_take_prize")
          .setLabel(await getTranslation("games.tower.takePrizeButton"))
          .setStyle(ButtonStyle.Success)
          .setDisabled(floor < 0); // Enable take prize immediately

        return [
          new ActionRowBuilder().addComponents(tileButtons),
          new ActionRowBuilder().addComponents(takePrizeButton),
        ];
      };

      await currentSetupMessage.edit({
        content: await getTranslation("games.tower.gameStartedPrompt"),
        files: [{ attachment: initialBuffer, name: "tower_game.png" }],
        components: await createGameButtons(gameInstance.currentFloor),
        embeds: [], // Remove setup embed
      });

      // --- Start Main Game Collector ---
      const gameCollector = currentSetupMessage.createMessageComponentCollector({
        filter: (gameInteraction: SetupInteractionLike | GameInteractionLike) =>
          gameInteraction.user.id === userId &&
          gameInteraction.message.id === currentSetupMessage.id,
        componentType: ComponentType.Button,
        time: 60000 * 5, // 5 minutes play time
      }) as GameCollectorLike;

      gameCollector.on("collect", async (gameInteraction: GameInteractionLike) => {
        try {
          const gameInstance = activeGames.get(gameKey);

          if (!gameInstance || gameInstance.gameOver) {
            await gameInteraction.reply({
              content: await getTranslation("games.tower.ended"),
              ephemeral: true,
            });
            return;
          }

          // Handle restart button (shouldn't happen during active game)
          if (gameInteraction.customId === `tower_restart_game_${userId}`) {
            await gameInteraction.reply({
              content: await getTranslation(
                "games.tower.cantRestartActiveGame",
              ),
              ephemeral: true,
            });
            return;
          }

          // Handle Take Prize button
          if (gameInteraction.customId === "tower_take_prize") {
            // Can only take prize after floor 0
            if (gameInstance.currentFloor < 1) {
              await gameInteraction.reply({
                content: await getTranslation("games.tower.cantTakePrizeYet"),
                ephemeral: true,
              });
              return;
            }

            // Take the prize
            gameInstance.gameOver = true;
            gameInstance.lastAction = "prize";

            // Add prize to balance
            let prizeTaken = gameInstance.currentPrize;
            if (guildId) {
              const payoutResult = await awardGameCoins(
                guildId,
                userId,
                "tower",
                prizeTaken,
              );
              gameInstance.currentPrize = Number(payoutResult.awardedAmount || 0);
              prizeTaken = gameInstance.currentPrize;

              const riskyGameXp = calculateRiskyGameXp({
                riskedAmount: gameInstance.betAmount,
                netChange: prizeTaken - gameInstance.betAmount,
                difficulty: gameInstance.difficulty,
                floorsCleared: gameInstance.currentFloor,
              });
              if (riskyGameXp > 0) {
                try {
                  await hubClient.addGameXP(guildId, userId, "tower", riskyGameXp);
                } catch (xpError) {
                  console.error("[Tower] Failed to add game XP on take prize:", xpError);
                }
              }
            }

            // Session change is now calculated automatically based on balance difference
            // No need to manually set it

            // Update UI
            await gameInteraction.deferUpdate();

            // Fetch updated balance and level progress after bomb hit
            let updatedBalance = 0;
            let chatLevelData = null;
            let gameLevelData = null;

            if (guildId) {
              try {
                const currentBalanceData = await hubClient.getUser(
                  guildId,
                  userId,
                );
                updatedBalance = parseBalance(currentBalanceData?.economy?.balance);

                if (currentBalanceData?.Level) {
                  const chatXP = Number(currentBalanceData.Level.xp || 0);
                  chatLevelData = hubClient.calculateLevel(chatXP);
                  const gameXP = Number(currentBalanceData.Level.gameXp || 0);
                  gameLevelData = hubClient.calculateLevel(gameXP);
                }
              } catch (error) {
                console.error(
                  "Error fetching user data after bomb hit:",
                  error,
                );
              }
            }

            const finalBuffer = await generateActiveTowerImage(
              gameInstance,
              interaction,
              i18n,
              updatedBalance,
              {
                chat: chatLevelData,
                game: gameLevelData,
              },
            );

            // Show game over message
            await currentSetupMessage.edit({
              content: await getTranslation("games.tower.prizeTakenMessage", {
                prize: prizeTaken.toFixed(2),
                floor: gameInstance.currentFloor,
              }),
              files: [{ attachment: finalBuffer, name: "tower_end.png" }],
              components: await createGameOverButtons(userId),
            });

            // End the game
            gameCollector.stop("prize");
            activeGames.delete(gameKey);

            // Create a restart collector
            createRestartCollector(gameInstance);
          }

          // Handle Tile Selection
          if (gameInteraction.customId.startsWith("tower_tile_")) {
            const tilePart = gameInteraction.customId.split("_")[2];
            const tileIndex = parseInt(tilePart ?? "", 10);
            if (Number.isNaN(tileIndex)) {
              return;
            }

            // Store the selected tile
            gameInstance.selectedTiles[gameInstance.currentFloor] = tileIndex;

            // Check if bomb hit
            const bombPositions =
              gameInstance.bombPositions[gameInstance.currentFloor] ?? [];
            const hitBomb = bombPositions.includes(tileIndex);

            if (hitBomb) {
              // Hit a bomb - game over
              gameInstance.gameOver = true;
              gameInstance.lastAction = "bomb";

              let refundAmount = 0;
              if (guildId && gameInstance.vaultGuardReduction > 0) {
                const tuning = getEconomyTuningConfig();
                const riskyLossMultiplier = Math.max(
                  0.5,
                  Number(tuning.sinks.riskyLossMultiplier || 1)
                );
                refundAmount = parseFloat(
                  (
                    (gameInstance.betAmount * gameInstance.vaultGuardReduction) /
                    riskyLossMultiplier
                  ).toFixed(2)
                );
                if (refundAmount > 0) {
                  await hubClient.addBalance(guildId, userId, refundAmount, "tower_bomb_refund", {
                    difficulty: gameInstance.difficulty,
                    tuningVersion: tuning.version,
                  });
                }
              }

              if (guildId) {
                const riskyGameXp = calculateRiskyGameXp({
                  riskedAmount: gameInstance.betAmount,
                  netChange: -gameInstance.betAmount + refundAmount,
                  difficulty: gameInstance.difficulty,
                  floorsCleared: gameInstance.currentFloor,
                });
                if (riskyGameXp > 0) {
                  try {
                    await hubClient.addGameXP(guildId, userId, "tower", riskyGameXp);
                  } catch (xpError) {
                    console.error("[Tower] Failed to add game XP on bomb:", xpError);
                  }
                }
              }

              // Session change is now calculated automatically based on balance difference
              // No need to manually set it

              // Update UI
              await gameInteraction.deferUpdate();

              // Fetch updated balance and level progress after reaching max floor
              let updatedBalance = 0;
              let chatLevelData = null;
              let gameLevelData = null;

              if (guildId) {
                try {
                  const currentBalanceData = await hubClient.getUser(
                    guildId,
                    userId,
                  );
                  updatedBalance = parseBalance(currentBalanceData?.economy?.balance);

                  if (currentBalanceData?.Level) {
                    const chatXP = Number(currentBalanceData.Level.xp || 0);
                    chatLevelData = hubClient.calculateLevel(chatXP);
                    const gameXP = Number(currentBalanceData.Level.gameXp || 0);
                    gameLevelData = hubClient.calculateLevel(gameXP);
                  }
                } catch (error) {
                  console.error(
                    "Error fetching user data after max floor:",
                    error,
                  );
                }
              }

              const finalBuffer = await generateActiveTowerImage(
                gameInstance,
                interaction,
                i18n,
                updatedBalance,
                {
                  chat: chatLevelData,
                  game: gameLevelData,
                },
              );

              // Show game over message
              await currentSetupMessage.edit({
                content: await getTranslation("games.tower.bombHitMessage", {
                  floor: gameInstance.currentFloor + 1,
                  bet: gameInstance.betAmount,
                }),
                files: [{ attachment: finalBuffer, name: "tower_end.png" }],
                components: await createGameOverButtons(userId),
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
                let maxPrize = gameInstance.calculatePrize(MAX_FLOORS - 1);

                // Add prize to balance
                if (guildId) {
                  const payoutResult = await awardGameCoins(
                    guildId,
                    userId,
                    "tower",
                    maxPrize,
                  );
                  gameInstance.currentPrize = Number(payoutResult.awardedAmount || 0);
                  maxPrize = gameInstance.currentPrize;

                  const riskyGameXp = calculateRiskyGameXp({
                    riskedAmount: gameInstance.betAmount,
                    netChange: maxPrize - gameInstance.betAmount,
                    difficulty: gameInstance.difficulty,
                    floorsCleared: MAX_FLOORS,
                  });
                  if (riskyGameXp > 0) {
                    try {
                      await hubClient.addGameXP(guildId, userId, "tower", riskyGameXp);
                    } catch (xpError) {
                      console.error("[Tower] Failed to add game XP on max floor:", xpError);
                    }
                  }
                }

                // Session change is now calculated automatically based on balance difference
                // No need to manually set it

                // Update UI
                await gameInteraction.deferUpdate();

                // Fetch updated balance and level progress after reaching max floor
                let updatedBalance = 0;
                let chatLevelData = null;
                let gameLevelData = null;

                if (guildId) {
                  try {
                    const currentBalanceData = await hubClient.getUser(
                      guildId,
                      userId,
                    );
                    updatedBalance = parseBalance(currentBalanceData?.economy?.balance);

                    if (currentBalanceData?.Level) {
                      const chatXP = Number(currentBalanceData.Level.xp || 0);
                      chatLevelData = hubClient.calculateLevel(chatXP);
                      const gameXP = Number(
                        currentBalanceData.Level.gameXp || 0,
                      );
                      gameLevelData = hubClient.calculateLevel(gameXP);
                    }
                  } catch (error) {
                    console.error(
                      "Error fetching user data after max floor:",
                      error,
                    );
                  }
                }

                const finalBuffer = await generateActiveTowerImage(
                  gameInstance,
                  interaction,
                  i18n,
                  updatedBalance,
                  {
                    chat: chatLevelData,
                    game: gameLevelData,
                  },
                );

                // Show win message
                await currentSetupMessage.edit({
                  content: await getTranslation(
                    "games.tower.maxFloorReachedMessage",
                    {
                      floor: MAX_FLOORS,
                      prize: maxPrize.toFixed(2),
                    },
                  ),
                  files: [{ attachment: finalBuffer, name: "tower_win.png" }],
                  components: await createGameOverButtons(userId),
                });

                // End the game
                gameCollector.stop("win");
                activeGames.delete(gameKey);

                // Create a restart collector
                createRestartCollector(gameInstance);
              } else {
                // Continue to next floor
                // Calculate the current prize based on the floor that was just completed
                gameInstance.currentPrize = gameInstance.calculatePrize(
                  gameInstance.currentFloor - 1,
                );
                gameInstance.ensureBombPosition(gameInstance.currentFloor);

                // Update UI
                await gameInteraction.deferUpdate();

                // Fetch updated balance and level progress after safe tile
                let updatedBalance = 0;
                let chatLevelData = null;
                let gameLevelData = null;

                if (guildId) {
                  try {
                    const currentBalanceData = await hubClient.getUser(
                      guildId,
                      userId,
                    );
                    updatedBalance = parseBalance(currentBalanceData?.economy?.balance);

                    if (currentBalanceData?.Level) {
                      const chatXP = Number(currentBalanceData.Level.xp || 0);
                      chatLevelData = hubClient.calculateLevel(chatXP);
                      const gameXP = Number(
                        currentBalanceData.Level.gameXp || 0,
                      );
                      gameLevelData = hubClient.calculateLevel(gameXP);
                    }
                  } catch (error) {
                    console.error(
                      "Error fetching user data after safe tile:",
                      error,
                    );
                  }
                }

                const nextBuffer = await generateActiveTowerImage(
                  gameInstance,
                  interaction,
                  i18n,
                  updatedBalance,
                  {
                    chat: chatLevelData,
                    game: gameLevelData,
                  },
                );

                await currentSetupMessage.edit({
                  content: await getTranslation(
                    "games.tower.nextFloorMessage",
                    {
                      floor: gameInstance.currentFloor + 1,
                      nextPrize: gameInstance
                        .calculatePrize(gameInstance.currentFloor)
                        .toFixed(2),
                    },
                  ),
                  files: [{ attachment: nextBuffer, name: "tower_next.png" }],
                  components: await createGameButtons(
                    gameInstance.currentFloor,
                  ),
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
                content: await getTranslation("games.tower.error"),
                ephemeral: true,
              })
              .catch(console.error);
          }
        }
      });

      // Timeout handler
      gameCollector.on("end", async (_collected, reason) => {
        const gameInstance = activeGames.get(gameKey);
        if (gameInstance && !gameInstance.gameOver) {
          // Game timed out, update UI
          currentSetupMessage
            .edit({
              content: await getTranslation("games.tower.timesOut"),
              components: [],
            })
            .catch(console.error);

          // Clean up
          activeGames.delete(gameKey);
        }
        console.log(
          `[Tower] Game collector ended for ${userId}. Reason: ${reason}`,
        );
      });

      console.log(
        `[Tower] Game started actively for ${userId}. Bet: ${gameInstance.betAmount}, Diff: ${gameInstance.difficulty}`,
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
          .reply({
            content: await getTranslation("games.tower.error"),
            ephemeral: true,
          })
          .catch(console.error);
      } else {
        await interaction
          .followUp({
            content: await getTranslation("games.tower.error"),
            ephemeral: true,
          })
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
    dailyLimitReached: {
      en: "Daily risky limit reached ({{earned}}/{{cap}}). Tower is locked until reset.",
      ru: "Достигнут дневной лимит риск-игры ({{earned}}/{{cap}}). Башня заблокирована до сброса.",
      uk: "Досягнуто денний ліміт ризикової гри ({{earned}}/{{cap}}). Башту заблоковано до скидання.",
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
    setupTimeout: {
      en: "Tower setup timed out.",
      ru: "Время настройки Башни истекло.",
      uk: "Час налаштування Башти минув.",
    },
    betPlaceholder: {
      en: "100",
      ru: "100",
      uk: "100",
    },
    setupError: {
      en: "An error occurred during setup.",
      ru: "Произошла ошибка во время настройки.",
      uk: "Сталася помилка під час налаштування.",
    },
  },
};
