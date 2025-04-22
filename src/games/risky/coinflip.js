import {
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ComponentType,
} from "discord.js";
import i18n from "../../utils/newI18n.js"; // Assuming you have i18n configured
import { generateImage } from "../../utils/imageGenerator.js";
import Database from "../../database/client.js";

// Game state management
const activeGames = new Map();

// --- Constants ---
const WIN_PROFIT_MULTIPLIER = 0.95; // Payout is 1.95x bet (Profit = 0.95x bet)
const HOUSE_EDGE_FACTOR = 0.95; // Renamed for clarity with variable probability
const HOUSE_EDGE_PERCENTAGE = ((1 - HOUSE_EDGE_FACTOR) * 100).toFixed(1);
const PROBABILITY_OPTIONS = [0.75, 0.5, 0.25]; // Available win probabilities (e.g., 75%, 50%, 25%)

class GameState {
  constructor(channelId, userId, messageId, guildId) {
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
    this.lastUpdateTime = Date.now();
  }

  addGameResult(bet, result, change) {
    this.recentGames.unshift({ bet, result, change, timestamp: Date.now() });
    if (this.recentGames.length > 3) {
      this.recentGames.pop(); // Keep only the last 3
    }
  }

  updateTimestamp() {
    this.lastUpdateTime = Date.now();
  }
}

function getGameKey(channelId, userId) {
  return `${channelId}-${userId}`;
}

async function generateCoinflipImage(gameInstance, interaction, i18n, balance) {
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
    locale: interaction.locale || interaction.guildLocale || "en",
    dominantColor: "user", // Use user avatar color
  };

  return generateImage("Coinflip", props, { image: 2, emoji: 3 }, i18n);
}

export default {
  id: "coinflip",
  title: "Coinflip",
  emoji: "🪙",
  async execute(interaction, i18n) {
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

    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }

    if (activeGames.has(gameKey)) {
      return interaction.followUp({
        content: i18n.__("games.coinflip.alreadyRunning"),
        ephemeral: true,
      });
    }

    const gameInstance = new GameState(channelId, userId, null, guildId);
    activeGames.set(gameKey, gameInstance);

    const createComponents = (betSet = false) => {
      const flipButton = new ButtonBuilder()
        .setCustomId("coinflip_flip")
        .setLabel(i18n.__("games.coinflip.flipButton"))
        .setStyle(ButtonStyle.Success)
        .setDisabled(!betSet || gameInstance.betAmount <= 0);

      const setBetButton = new ButtonBuilder()
        .setCustomId("coinflip_set_bet")
        .setLabel(i18n.__("games.coinflip.setBetButton"))
        .setStyle(ButtonStyle.Primary);

      // Button to change win probability
      const changeChanceButton = new ButtonBuilder()
        .setCustomId("coinflip_change_chance")
        // Display current chance on the button
        .setLabel(
          i18n.__("games.coinflip.chanceButton", {
            chance: gameInstance.winProbability * 100,
          })
        )
        .setStyle(ButtonStyle.Secondary);

      const endButton = new ButtonBuilder()
        .setCustomId("coinflip_end")
        .setLabel(i18n.__("games.coinflip.endButton"))
        .setStyle(ButtonStyle.Danger);

      return new ActionRowBuilder().addComponents(
        flipButton,
        setBetButton,
        changeChanceButton, // Add the new button
        endButton
      );
    };

    try {
      // Fetch initial balance before generating the first image
      let initialBalance = 0;
      if (guildId) {
        const initialUserData = await Database.getUser(guildId, userId);
        initialBalance = parseFloat(initialUserData?.economy?.balance || 0);
      }

      const initialBuffer = await generateCoinflipImage(
        gameInstance,
        interaction,
        i18n,
        // Pass the fetched initial balance
        initialBalance
      );

      const message = await interaction.followUp({
        content: i18n.__("games.coinflip.startMessage"),
        files: [{ attachment: initialBuffer, name: "coinflip.png" }],
        components: [createComponents(false)],
        fetchReply: true,
      });

      gameInstance.messageId = message.id;

      const cleanup = () => {
        if (inactivityTimeout) clearTimeout(inactivityTimeout);
        activeGames.delete(gameKey);
        console.log(`[Coinflip] Cleaned up game for ${userId}`);
      };

      let inactivityTimeout = setTimeout(() => {
        if (activeGames.has(gameKey)) {
          message
            .edit({
              content: i18n.__("games.coinflip.timesOut"),
              components: [],
            })
            .catch(console.error);
          cleanup();
        }
      }, 60000 * 2); // 2 minutes inactivity timeout

      const resetInactivityTimer = () => {
        clearTimeout(inactivityTimeout);
        inactivityTimeout = setTimeout(() => {
          if (activeGames.has(gameKey)) {
            message
              .edit({
                content: i18n.__("games.coinflip.timesOut"),
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
              .setTitle(i18n.__("games.coinflip.setBetTitle"));

            const amountInput = new TextInputBuilder()
              .setCustomId("bet_amount")
              .setLabel(i18n.__("games.coinflip.betAmountLabel"))
              .setStyle(TextInputStyle.Short)
              .setPlaceholder("100")
              .setRequired(true);

            const firstActionRow = new ActionRowBuilder().addComponents(
              amountInput
            );
            modal.addComponents(firstActionRow);

            await i.showModal(modal);

            // Wait for modal submission
            const filter = (modalInteraction) =>
              modalInteraction.customId === `coinflip_bet_modal_${userId}` &&
              modalInteraction.user.id === userId;

            i.awaitModalSubmit({ filter, time: 60000 })
              .then(async (modalInteraction) => {
                const betAmountStr =
                  modalInteraction.fields.getTextInputValue("bet_amount");
                const betAmount = parseInt(betAmountStr);

                if (isNaN(betAmount) || betAmount <= 0) {
                  await modalInteraction.reply({
                    content: i18n.__("games.coinflip.invalidBet"),
                    ephemeral: true,
                  });
                  return;
                }

                // Only check balance if in a guild
                if (guildId) {
                  // Check user balance
                  const userData = await Database.getUser(guildId, userId);
                  const userBalance = parseFloat(
                    userData?.economy?.balance || 0
                  );

                  if (
                    !userData ||
                    !userData.economy ||
                    userBalance < betAmount
                  ) {
                    await modalInteraction.reply({
                      content: i18n.__("games.coinflip.notEnoughMoney", {
                        balance: userBalance.toFixed(2),
                        bet: betAmount,
                      }),
                      ephemeral: true,
                    });
                    return;
                  }
                }

                gameInstance.betAmount = betAmount;

                // Get current balance
                let userBalance = 0;
                if (guildId) {
                  const currentBalanceData = await Database.getUser(
                    guildId,
                    userId
                  );
                  userBalance = parseFloat(
                    currentBalanceData?.economy?.balance || 0
                  );
                }

                const updatedBuffer = await generateCoinflipImage(
                  gameInstance,
                  interaction,
                  i18n,
                  userBalance
                );
                await modalInteraction.update({
                  files: [{ attachment: updatedBuffer, name: "coinflip.png" }],
                  components: [createComponents(true)], // Enable flip button
                });
              })
              .catch(console.error); // Handle modal timeout/errors
          } else if (i.customId === "coinflip_change_chance") {
            // Cycle through probability options
            const currentIndex = PROBABILITY_OPTIONS.indexOf(
              gameInstance.winProbability
            );
            const nextIndex = (currentIndex + 1) % PROBABILITY_OPTIONS.length;
            gameInstance.winProbability = PROBABILITY_OPTIONS[nextIndex];

            // Update the message with new chance and buttons
            await i.deferUpdate();
            const currentBalanceData = await Database.getUser(guildId, userId);
            const currentBalance = parseFloat(
              currentBalanceData?.economy?.balance || 0
            );
            const updatedBuffer = await generateCoinflipImage(
              gameInstance,
              interaction,
              i18n,
              currentBalance
            );
            await message.edit({
              files: [{ attachment: updatedBuffer, name: "coinflip.png" }],
              components: [createComponents(gameInstance.betAmount > 0)],
            });
          } else if (i.customId === "coinflip_flip") {
            await i.deferUpdate(); // Acknowledge button press

            if (gameInstance.betAmount <= 0) {
              await i.followUp({
                content: i18n.__("games.coinflip.noBetSet"),
                ephemeral: true,
              });
              return;
            }

            // Double-check balance before proceeding
            if (guildId) {
              const userDataFlip = await Database.getUser(guildId, userId);
              const userBalanceFlip = parseFloat(
                userDataFlip?.economy?.balance || 0
              );

              if (
                !userDataFlip ||
                !userDataFlip.economy ||
                userBalanceFlip < gameInstance.betAmount
              ) {
                await i.followUp({
                  content: i18n.__("games.coinflip.notEnoughMoney", {
                    balance: userBalanceFlip.toFixed(2),
                    bet: gameInstance.betAmount,
                  }),
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
                  (gameInstance.betAmount * profitMultiplier).toFixed(2)
                );
                gameInstance.totalWon += changeAmount;
                await Database.addBalance(guildId, userId, changeAmount);
                messageContent = i18n.__("games.coinflip.winMessage", {
                  amount: changeAmount.toFixed(2),
                });
              } else {
                gameInstance.lastResult = "lose";
                changeAmount = -gameInstance.betAmount;
                gameInstance.totalLost += Math.abs(changeAmount);
                await Database.addBalance(guildId, userId, changeAmount);
                messageContent = i18n.__("games.coinflip.loseMessage", {
                  amount: Math.abs(changeAmount).toFixed(2),
                });
              }
            } else {
              // In DM, just show the result without updating balance
              if (win) {
                gameInstance.lastResult = "win";
                profitMultiplier =
                  (1 / gameInstance.winProbability) * HOUSE_EDGE_FACTOR - 1;
                profitMultiplier = Math.max(0, profitMultiplier);
                changeAmount = parseFloat(
                  (gameInstance.betAmount * profitMultiplier).toFixed(2)
                );
                gameInstance.totalWon += changeAmount;
                messageContent = i18n.__("games.coinflip.winMessage", {
                  amount: changeAmount.toFixed(2),
                });
              } else {
                gameInstance.lastResult = "lose";
                changeAmount = -gameInstance.betAmount;
                gameInstance.totalLost += Math.abs(changeAmount);
                messageContent = i18n.__("games.coinflip.loseMessage", {
                  amount: Math.abs(changeAmount).toFixed(2),
                });
              }
            }

            // Add result to history (uses the actual changeAmount)
            gameInstance.addGameResult(
              gameInstance.betAmount,
              gameInstance.lastResult,
              changeAmount
            );

            // Get updated balance AFTER the change
            let updatedBalance = 0;
            if (guildId) {
              const updatedUserData = await Database.getUser(guildId, userId);
              updatedBalance = parseFloat(
                updatedUserData?.economy?.balance || 0
              );
            }

            const updatedBuffer = await generateCoinflipImage(
              gameInstance,
              interaction,
              i18n,
              updatedBalance
            );
            await message.edit({
              content: messageContent,
              files: [{ attachment: updatedBuffer, name: "coinflip.png" }],
              components: [createComponents(true)], // Keep flip button enabled
            });
          } else if (i.customId === "coinflip_end") {
            await i.update({
              content: i18n.__("games.coinflip.endMessage", {
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
                content: i18n.__("games.coinflip.error"),
                ephemeral: true,
              })
              .catch(console.error);
          } else {
            await i
              .followUp({
                content: i18n.__("games.coinflip.error"),
                ephemeral: true,
              })
              .catch(console.error);
          }
        }
      });

      collector.on("end", (collected, reason) => {
        if (reason !== "user") {
          // Only cleanup if ended naturally, not by user action ("coinflip_end")
          if (activeGames.has(gameKey)) {
            message
              .edit({
                content: i18n.__("games.coinflip.ended"),
                components: [],
              })
              .catch(console.error);
            cleanup();
          }
        }
        console.log(
          `[Coinflip] Collector ended for ${userId}, reason: ${reason}`
        );
      });
    } catch (error) {
      console.error("[Coinflip] Error executing game:", error);
      if (activeGames.has(gameKey)) {
        activeGames.delete(gameKey);
      }
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: i18n.__("games.coinflip.error"),
          ephemeral: true,
        });
      } else {
        await interaction.followUp({
          content: i18n.__("games.coinflip.error"),
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
