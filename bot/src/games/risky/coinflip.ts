import {
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ComponentType,
} from "discord.js";
import { generateImage } from "../../utils/imageGenerator.ts";
import hubClient from "../../api/hubClient.ts";

type TranslatorLike = {
  __: (key: string, variables?: Record<string, unknown>) => Promise<string>;
  setLocale?: (locale: string) => string;
  getLocale?: () => string;
};

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
};

type RecentGameLike = {
  bet: number;
  result: "win" | "lose" | "none";
  change: number;
  timestamp: number;
};

type MessageLike = {
  id: string;
  edit: (payload: Record<string, unknown>) => Promise<unknown>;
  createMessageComponentCollector: (options: {
    componentType: ComponentType;
    filter: (interaction: CollectorInteractionLike) => boolean;
    time: number;
  }) => CollectorLike;
};

type ModalSubmitInteractionLike = {
  customId: string;
  user: { id: string };
  fields: {
    getTextInputValue: (name: string) => string;
  };
  reply: (payload: { content: string; ephemeral?: boolean }) => Promise<unknown>;
};

type CollectorInteractionLike = {
  customId: string;
  user: { id: string };
  replied?: boolean;
  deferred?: boolean;
  showModal: (modal: ModalBuilder) => Promise<unknown>;
  awaitModalSubmit: (options: {
    filter: (interaction: ModalSubmitInteractionLike) => boolean;
    time: number;
  }) => Promise<ModalSubmitInteractionLike>;
  deferUpdate: () => Promise<unknown>;
  followUp: (payload: { content: string; ephemeral?: boolean }) => Promise<unknown>;
  update: (payload: Record<string, unknown>) => Promise<unknown>;
  reply: (payload: { content: string; ephemeral?: boolean }) => Promise<unknown>;
};

type CollectorLike = {
  on: ((
    event: "collect",
    handler: (interaction: CollectorInteractionLike) => Promise<void>
  ) => void) &
    ((event: "end", handler: (collected: unknown, reason: string) => Promise<void>) => void);
  stop: () => void;
};

type InteractionLike = {
  channelId: string;
  guildId?: string | null;
  guildLocale?: string;
  locale?: string;
  deferred?: boolean;
  replied?: boolean;
  user: {
    id: string;
    displayAvatarURL: (options?: { extension?: string; size?: number }) => string;
  };
  deferReply: () => Promise<unknown>;
  followUp: (payload: Record<string, unknown>) => Promise<MessageLike>;
  reply: (payload: { content: string; ephemeral?: boolean }) => Promise<unknown>;
};

type CoinflipGameStateResult = "win" | "lose" | "none";

const activeGames = new Map<string, GameState>();

// --- Constants ---
const WIN_PROFIT_MULTIPLIER = 0.95; // Payout is 1.95x bet (Profit = 0.95x bet)
const HOUSE_EDGE_FACTOR = 0.95; // Renamed for clarity with variable probability
const HOUSE_EDGE_PERCENTAGE = ((1 - HOUSE_EDGE_FACTOR) * 100).toFixed(1);
const PROBABILITY_OPTIONS = [0.75, 0.5, 0.25]; // Available win probabilities (e.g., 75%, 50%, 25%)

class GameState {
  channelId: string;
  userId: string;
  guildId?: string | null;
  messageId: string | null;
  betAmount: number;
  winProbability: number;
  lastResult: CoinflipGameStateResult;
  recentGames: RecentGameLike[];
  totalWon: number;
  totalLost: number;
  sessionChange: number;
  lastUpdateTime: number;

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
    this.betAmount = 0;
    this.winProbability = 0.5; // Default to 50%
    this.lastResult = "none"; // 'win', 'lose', 'none'
    this.recentGames = []; // Store last 3 games: { bet: number, result: 'win'|'lose', change: number, timestamp: number }
    this.totalWon = 0;
    this.totalLost = 0;
    this.sessionChange = 0; // Total balance change during this session
    this.lastUpdateTime = Date.now();
  }

  addGameResult(bet: number, result: CoinflipGameStateResult, change: number): void {
    this.recentGames.unshift({ bet, result, change, timestamp: Date.now() });
    if (this.recentGames.length > 3) {
      this.recentGames.pop(); // Keep only the last 3
    }
  }

  updateTimestamp() {
    this.lastUpdateTime = Date.now();
  }
}

function getGameKey(channelId: string, userId: string): string {
  return `${channelId}-${userId}`;
}

async function generateCoinflipImage(
  gameInstance: GameState,
  interaction: InteractionLike,
  i18n: TranslatorLike,
  balance: number,
  levelProgress: LevelProgressLike = { chat: null, game: null },
) {
  // Calculate potential profit multiplier for display
  let potentialProfitMultiplier = 0;
  if (gameInstance.winProbability > 0) {
    potentialProfitMultiplier =
      (1 / gameInstance.winProbability) * HOUSE_EDGE_FACTOR - 1;
    potentialProfitMultiplier = Math.max(0, potentialProfitMultiplier);
  }

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
    betAmount: gameInstance.betAmount,
    winProbability: gameInstance.winProbability, // Pass selected probability
    potentialProfitMultiplier: potentialProfitMultiplier, // Pass calculated multiplier
    lastResult: gameInstance.lastResult,
    recentGames: gameInstance.recentGames,
    balance: balance, // Pass the current balance
    sessionChange: gameInstance.sessionChange, // Pass total session change
    levelProgress: levelProgress, // Pass level progress data
    locale: interaction.locale || interaction.guildLocale || "en",
    dominantColor: "user", // Use user avatar color
  };

  return generateImage("Coinflip", props, { image: 2, emoji: 3 }, i18n);
}

export default {
  id: "coinflip",
  title: "Coinflip",
  emoji: "🪙",
  async execute(interaction: InteractionLike, i18n: TranslatorLike) {
    const channelId = interaction.channelId;
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const gameKey = getGameKey(channelId, userId);

    // Set locale based on interaction
    const locale = interaction.locale || interaction.guildLocale || "en";
    console.log(`[Coinflip] Using locale: ${locale}`);
    // Ensure i18n instance has the locale set if it's passed
    if (i18n && typeof i18n.setLocale === "function") {
      i18n.setLocale(locale);
    }

    // Helper function to safely get translation with fallback
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

    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }

    if (activeGames.has(gameKey)) {
      return interaction.followUp({
        content: await getTranslation("games.coinflip.alreadyRunning"),
        ephemeral: true,
      });
    }

    const gameInstance = new GameState(channelId, userId, null, guildId);
    activeGames.set(gameKey, gameInstance);

    const createComponents = async (betSet = false) => {
      const flipButton = new ButtonBuilder()
        .setCustomId("coinflip_flip")
        .setLabel(await getTranslation("games.coinflip.flipButton"))
        .setStyle(ButtonStyle.Success)
        .setDisabled(!betSet || gameInstance.betAmount <= 0);

      const setBetButton = new ButtonBuilder()
        .setCustomId("coinflip_set_bet")
        .setLabel(await getTranslation("games.coinflip.setBetButton"))
        .setStyle(ButtonStyle.Primary);

      // Button to change win probability
      const changeChanceButton = new ButtonBuilder()
        .setCustomId("coinflip_change_chance")
        // Display current chance on the button
        .setLabel(
          await getTranslation("games.coinflip.chanceButton", {
            chance: gameInstance.winProbability * 100,
          }),
        )
        .setStyle(ButtonStyle.Secondary);

      const endButton = new ButtonBuilder()
        .setCustomId("coinflip_end")
        .setLabel(await getTranslation("games.coinflip.endButton"))
        .setStyle(ButtonStyle.Danger);

      return new ActionRowBuilder().addComponents(
        flipButton,
        setBetButton,
        changeChanceButton, // Add the new button
        endButton,
      );
    };

    try {
      // Fetch initial balance and level progress before generating the first image
      let initialBalance = 0;
      let chatLevelData = null;
      let gameLevelData = null;

      if (guildId) {
        try {
          // Ensure user exists in database
          await hubClient.ensureGuildUser(guildId, userId);
          const initialUserData = await hubClient.getUser(guildId, userId);
          initialBalance = parseFloat(String(initialUserData?.economy?.balance ?? 0));

          if (initialUserData?.Level) {
            const chatXP = Number(initialUserData.Level.xp || 0);
            chatLevelData = hubClient.calculateLevel(chatXP);
            const gameXP = Number(initialUserData.Level.gameXp || 0);
            gameLevelData = hubClient.calculateLevel(gameXP);
          }
        } catch (error) {
          console.error("Error fetching user data for Coinflip:", error);
        }
      }

      const initialBuffer = await generateCoinflipImage(
        gameInstance,
        interaction,
        i18n,
        // Pass the fetched initial balance and level progress
        initialBalance,
        {
          chat: chatLevelData,
          game: gameLevelData,
        },
      );

      const message = await interaction.followUp({
        content: await getTranslation("games.coinflip.startMessage"),
        files: [{ attachment: initialBuffer, name: "coinflip.avif" }],
        components: [await createComponents(false)],
        fetchReply: true,
      });

      gameInstance.messageId = message.id;

      const cleanup = () => {
        if (inactivityTimeout) clearTimeout(inactivityTimeout);
        activeGames.delete(gameKey);
        console.log(`[Coinflip] Cleaned up game for ${userId}`);
      };

      let inactivityTimeout = setTimeout(async () => {
        if (activeGames.has(gameKey)) {
          message
            .edit({
              content: await getTranslation("games.coinflip.timesOut"),
              components: [],
            })
            .catch(console.error);
          cleanup();
        }
      }, 60000 * 2); // 2 minutes inactivity timeout

      const resetInactivityTimer = () => {
        clearTimeout(inactivityTimeout);
        inactivityTimeout = setTimeout(async () => {
          if (activeGames.has(gameKey)) {
            message
              .edit({
                content: await getTranslation("games.coinflip.timesOut"),
                components: [],
              })
              .catch(console.error);
            cleanup();
          }
        }, 60000 * 2);
      };

      const collector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        filter: (i) => i.user.id === userId,
        time: 60000 * 5, // 5 minutes total collector time
      });

      collector.on("collect", async (i) => {
        resetInactivityTimer();
        gameInstance.updateTimestamp();

        try {
          if (i.customId === "coinflip_set_bet") {
            const modal = new ModalBuilder()
              .setCustomId(`coinflip_bet_modal_${userId}`)
              .setTitle(await getTranslation("games.coinflip.setBetTitle"));

            const amountInput = new TextInputBuilder()
              .setCustomId("bet_amount")
              .setLabel(await getTranslation("games.coinflip.betAmountLabel"))
              .setStyle(TextInputStyle.Short)
              .setPlaceholder("100")
              .setRequired(true);

            const firstActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(
              amountInput,
            );
            modal.addComponents(firstActionRow);

            await i.showModal(modal);

            // Wait for modal submission
            const filter = (modalInteraction: ModalSubmitInteractionLike) =>
              modalInteraction.customId === `coinflip_bet_modal_${userId}` &&
              modalInteraction.user.id === userId;

            i.awaitModalSubmit({ filter, time: 60000 })
              .then(async (modalInteraction) => {
                const betAmountStr =
                  modalInteraction.fields.getTextInputValue("bet_amount");
                const betAmount = parseInt(betAmountStr);

                if (isNaN(betAmount) || betAmount <= 0) {
                  await modalInteraction.reply({
                    content: await getTranslation("games.coinflip.invalidBet"),
                    ephemeral: true,
                  });
                  return;
                }

                // Only check balance if in a guild
                if (guildId) {
                  // Check user balance
                  const userData = await hubClient.getUser(guildId, userId);
                  const userBalance = parseFloat(
                    String(userData?.economy?.balance ?? 0),
                  );

                  if (
                    !userData ||
                    !userData.economy ||
                    userBalance < betAmount
                  ) {
                    await modalInteraction.reply({
                      content: await getTranslation(
                        "games.coinflip.notEnoughMoney",
                        {
                          balance: userBalance.toFixed(2),
                          bet: betAmount,
                        },
                      ),
                      ephemeral: true,
                    });
                    return;
                  }
                }

                // If everything is OK, set the bet
                gameInstance.betAmount = betAmount;

                // Reply to modal interaction with ephemeral message
                await modalInteraction.reply({
                  content: await getTranslation(
                    "games.coinflip.betSetSuccess",
                    {
                      bet: betAmount,
                    },
                  ),
                  ephemeral: true,
                });

                // Then update the original message
                let userBalance = 0;
                let chatLevelData = null;
                let gameLevelData = null;
                if (guildId) {
                  try {
                    const currentBalanceData = await hubClient.getUser(
                      guildId,
                      userId,
                    );
                    userBalance = parseFloat(
                      String(currentBalanceData?.economy?.balance ?? 0),
                    );

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
                      "Error fetching user data in set bet:",
                      error,
                    );
                  }
                }

                const updatedBuffer = await generateCoinflipImage(
                  gameInstance,
                  interaction,
                  i18n,
                  userBalance,
                  {
                    chat: chatLevelData,
                    game: gameLevelData,
                  },
                );
                await message.edit({
                  files: [{ attachment: updatedBuffer, name: "coinflip.avif" }],
                  components: [await createComponents(true)], // Enable flip button
                });
              })
              .catch(console.error); // Handle modal timeout/errors
          } else if (i.customId === "coinflip_change_chance") {
            // Cycle through probability options
            const currentIndex = PROBABILITY_OPTIONS.indexOf(
              gameInstance.winProbability,
            );
            const nextIndex = (currentIndex + 1) % PROBABILITY_OPTIONS.length;
            gameInstance.winProbability = PROBABILITY_OPTIONS[nextIndex] ?? 0.5;

            // Update the message with new chance and buttons
            await i.deferUpdate();
            let currentBalance = 0;
            let chatLevelData = null;
            let gameLevelData = null;
            if (guildId) {
              try {
                const currentBalanceData = await hubClient.getUser(
                  guildId,
                  userId,
                );
                currentBalance = parseFloat(
                  String(currentBalanceData?.economy?.balance ?? 0),
                );

                if (currentBalanceData?.Level) {
                  const chatXP = Number(currentBalanceData.Level.xp || 0);
                  chatLevelData = hubClient.calculateLevel(chatXP);
                  const gameXP = Number(currentBalanceData.Level.gameXp || 0);
                  gameLevelData = hubClient.calculateLevel(gameXP);
                }
              } catch (error) {
                console.error(
                  "Error fetching user data in change chance:",
                  error,
                );
              }
            }
            const updatedBuffer = await generateCoinflipImage(
              gameInstance,
              interaction,
              i18n,
              currentBalance,
              {
                chat: chatLevelData,
                game: gameLevelData,
              },
            );
            await message.edit({
              files: [{ attachment: updatedBuffer, name: "coinflip.avif" }],
              components: [await createComponents(gameInstance.betAmount > 0)],
            });
          } else if (i.customId === "coinflip_flip") {
            await i.deferUpdate(); // Acknowledge button press

            if (gameInstance.betAmount <= 0) {
              await i.followUp({
                content: await getTranslation("games.coinflip.noBetSet"),
                ephemeral: true,
              });
              return;
            }

            // Double-check balance before proceeding
            if (guildId) {
              const userDataFlip = await hubClient.getUser(guildId, userId);
              const userBalanceFlip = parseFloat(
                String(userDataFlip?.economy?.balance ?? 0),
              );

              if (
                !userDataFlip ||
                !userDataFlip.economy ||
                userBalanceFlip < gameInstance.betAmount
              ) {
                await i.followUp({
                  content: await getTranslation(
                    "games.coinflip.notEnoughMoney",
                    {
                      balance: userBalanceFlip.toFixed(2),
                      bet: gameInstance.betAmount,
                    },
                  ),
                  ephemeral: true,
                });
                return;
              }
            }

            // --- Dynamic Payout Calculation ---
            const win = Math.random() < gameInstance.winProbability;
            let messageContent = "";
            let changeAmount = 0;
            let profitMultiplier = 0;

            // Only interact with database if we have a guild
            if (guildId) {
              if (win) {
                gameInstance.lastResult = "win";
                // Calculate dynamic profit multiplier
                profitMultiplier =
                  (1 / gameInstance.winProbability) * HOUSE_EDGE_FACTOR - 1;
                // Ensure multiplier isn't negative if HOUSE_EDGE_FACTOR is aggressive and P is high
                profitMultiplier = Math.max(0, profitMultiplier);

                changeAmount = parseFloat(
                  (gameInstance.betAmount * profitMultiplier).toFixed(2),
                );
                gameInstance.totalWon += changeAmount;
                gameInstance.sessionChange += changeAmount; // Update session change
                await hubClient.addBalance(guildId, userId, changeAmount);
                messageContent = await getTranslation(
                  "games.coinflip.winMessage",
                  {
                    amount: changeAmount.toFixed(2),
                  },
                );
              } else {
                gameInstance.lastResult = "lose";
                changeAmount = -gameInstance.betAmount;
                gameInstance.totalLost += Math.abs(changeAmount);
                gameInstance.sessionChange += changeAmount; // Update session change
                await hubClient.addBalance(guildId, userId, changeAmount);
                messageContent = await getTranslation(
                  "games.coinflip.loseMessage",
                  {
                    amount: Math.abs(changeAmount).toFixed(2),
                  },
                );
              }
            } else {
              // In DM, just show the result without updating balance
              if (win) {
                gameInstance.lastResult = "win";
                profitMultiplier =
                  (1 / gameInstance.winProbability) * HOUSE_EDGE_FACTOR - 1;
                profitMultiplier = Math.max(0, profitMultiplier);
                changeAmount = parseFloat(
                  (gameInstance.betAmount * profitMultiplier).toFixed(2),
                );
                gameInstance.totalWon += changeAmount;
                gameInstance.sessionChange += changeAmount; // Update session change
                messageContent = await getTranslation(
                  "games.coinflip.winMessage",
                  {
                    amount: changeAmount.toFixed(2),
                  },
                );
              } else {
                gameInstance.lastResult = "lose";
                changeAmount = -gameInstance.betAmount;
                gameInstance.totalLost += Math.abs(changeAmount);
                gameInstance.sessionChange += changeAmount; // Update session change
                messageContent = await getTranslation(
                  "games.coinflip.loseMessage",
                  {
                    amount: Math.abs(changeAmount).toFixed(2),
                  },
                );
              }
            }

            // Add result to history (uses the actual changeAmount)
            gameInstance.addGameResult(
              gameInstance.betAmount,
              gameInstance.lastResult,
              changeAmount,
            );

            // Get updated balance and level progress AFTER the change
            let updatedBalance = 0;
            let chatLevelData = null;
            let gameLevelData = null;
            if (guildId) {
              try {
                const updatedUserData = await hubClient.getUser(
                  guildId,
                  userId,
                );
                updatedBalance = parseFloat(
                  String(updatedUserData?.economy?.balance ?? 0),
                );

                if (updatedUserData?.Level) {
                  const chatXP = Number(updatedUserData.Level.xp || 0);
                  chatLevelData = hubClient.calculateLevel(chatXP);
                  const gameXP = Number(updatedUserData.Level.gameXp || 0);
                  gameLevelData = hubClient.calculateLevel(gameXP);
                }
              } catch (error) {
                console.error("Error fetching user data after flip:", error);
              }
            }

            const updatedBuffer = await generateCoinflipImage(
              gameInstance,
              interaction,
              i18n,
              updatedBalance,
              {
                chat: chatLevelData,
                game: gameLevelData,
              },
            );
            await message.edit({
              content: messageContent,
              files: [{ attachment: updatedBuffer, name: "coinflip.avif" }],
              components: [await createComponents(true)], // Keep flip button enabled
            });
          } else if (i.customId === "coinflip_end") {
            await i.update({
              content: await getTranslation("games.coinflip.endMessage", {
                won: gameInstance.totalWon.toFixed(2),
                lost: gameInstance.totalLost.toFixed(2),
              }),
              components: [],
              files: [],
            });
            cleanup();
            collector.stop();
          }
        } catch (error) {
          console.error("[Coinflip] Error during button interaction:", error);
          if (!i.replied && !i.deferred) {
            await i
              .reply({
                content: await getTranslation("games.coinflip.error"),
                ephemeral: true,
              })
              .catch(console.error);
          } else {
            await i
              .followUp({
                content: await getTranslation("games.coinflip.error"),
                ephemeral: true,
              })
              .catch(console.error);
          }
        }
      });

      collector.on("end", async (collected, reason) => {
        if (reason !== "user") {
          // Only cleanup if ended naturally, not by user action ("coinflip_end")
          if (activeGames.has(gameKey)) {
            message
              .edit({
                content: await getTranslation("games.coinflip.ended"),
                components: [],
              })
              .catch(console.error);
            cleanup();
          }
        }
        console.log(
          `[Coinflip] Collector ended for ${userId}, reason: ${reason}`,
        );
      });
    } catch (error) {
      console.error("[Coinflip] Error executing game:", error);
      if (activeGames.has(gameKey)) {
        activeGames.delete(gameKey);
      }
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: await getTranslation("games.coinflip.error"),
          ephemeral: true,
        });
      } else {
        await interaction.followUp({
          content: await getTranslation("games.coinflip.error"),
          ephemeral: true,
        });
      }
    }
  },

  localization_strings: {
    alreadyRunning: {
      en: "A coinflip game is already running!",
      ru: "Игра Монетка уже запущена!",
      uk: "Гру Монетка вже запущено!",
    },
    startMessage: {
      en: "Set your bet and flip the coin!",
      ru: "Установите ставку и бросайте монетку!",
      uk: "Встановіть ставку та кидайте монетку!",
    },
    flipButton: {
      en: "Flip Coin",
      ru: "Бросить",
      uk: "Кинути",
    },
    setBetButton: {
      en: "Set Bet",
      ru: "Ставка",
      uk: "Ставка",
    },
    endButton: {
      en: "End Game",
      ru: "Закончить",
      uk: "Закінчити",
    },
    setBetTitle: {
      en: "Set Your Bet Amount",
      ru: "Установите сумму ставки",
      uk: "Встановіть суму ставки",
    },
    betAmountLabel: {
      en: "Amount to bet",
      ru: "Сумма ставки",
      uk: "Сума ставки",
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
    noBetSet: {
      en: "Please set a bet amount first using the 'Set Bet' button.",
      ru: "Сначала установите сумму ставки кнопкой 'Ставка'.",
      uk: "Спочатку встановіть суму ставки кнопкою 'Ставка'.",
    },
    winMessage: {
      en: "🎉 You won {{amount}} 💵!",
      ru: "🎉 Вы выиграли {{amount}} 💵!",
      uk: "🎉 Ви виграли {{amount}} 💵!",
    },
    loseMessage: {
      en: "😥 You lost {{amount}} 💵.",
      ru: "😥 Вы проиграли {{amount}} 💵.",
      uk: "😥 Ви програли {{amount}} 💵.",
    },
    endMessage: {
      en: "Coinflip ended. You won {{won}} 💵 and lost {{lost}} 💵 in total.",
      ru: "Монетка завершена. Всего вы выиграли {{won}} 💵 и проиграли {{lost}} 💵.",
      uk: "Монетку завершено. Всього ви виграли {{won}} 💵 та програли {{lost}} 💵.",
    },
    betSetSuccess: {
      en: "Bet set to {{bet}} 💵 successfully!",
      ru: "Ставка установлена на {{bet}} 💵 успешно!",
      uk: "Ставку встановлено на {{bet}} 💵 успішно!",
    },
    timesOut: {
      en: "Coinflip game ended due to inactivity.",
      ru: "Игра Монетка завершена из-за неактивности.",
      uk: "Гру Монетка завершено через неактивність.",
    },
    ended: {
      en: "Coinflip game session ended.",
      ru: "Игровая сессия Монетки завершена.",
      uk: "Ігрову сесію Монетки завершено.",
    },
    error: {
      en: "An error occurred during the Coinflip game.",
      ru: "Произошла ошибка во время игры в Монетку.",
      uk: "Сталася помилка під час гри в Монетку.",
    },
    // Localization for the component itself (if needed, though usually handled within component)
    name: {
      en: "Coinflip",
      ru: "Монетка",
      uk: "Монетка",
    },
    description: {
      en: "Flip a coin to win or lose your bet.",
      ru: "Подбросьте монетку, чтобы выиграть или проиграть ставку.",
      uk: "Підкиньте монетку, щоб виграти або програти ставку.",
    },
    chanceButton: {
      en: "{{chance}}% Chance",
      ru: "Шанс {{chance}}%",
      uk: "Шанс {{chance}}%",
    },
  },
};
