import {
  SlashCommandSubcommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ComponentType,
  InteractionType,
  MessageFlags,
} from "discord.js";
import { Prisma } from "@prisma/client"; // Import Prisma Decimal helper
import Database from "../../database/client.js"; // Use the main DB
import { generateImage } from "../../utils/imageGenerator.js";
import { getTickers, getValidCmcSymbols } from "../../utils/cryptoApi.js"; // Import API utilities
import { ComponentBuilder } from "../../utils/componentConverter.js"; // Import ComponentBuilder

// --- Game Metadata ---
const game_info = {
  id: "crypto2", // Make sure this matches the filename
  name: "Crypto Futures", // Default name
  emoji: "📈",
  description: "Trade crypto futures with leverage (Demo)", // Default description
};

// --- Localization Strings ---
const localization_strings = {
  name: {
    en: "Crypto Futures",
    ru: "Крипто Фьючерсы",
    uk: "Крипто Ф'ючерси",
  },
  description: {
    en: "Trade crypto futures with leverage (Demo Account)",
    ru: "Торгуйте крипто-фьючерсами с плечом (Демо-счет)",
    uk: "Торгуйте крипто-ф'ючерсами з плечем (Демо-рахунок)",
  },
  disclaimerTitle: {
    en: "⚠️ Important Disclaimer",
    ru: "⚠️ Важное предупреждение",
    uk: "⚠️ Важне предупредження",
  },
  disclaimerText: {
    en: "This game uses the bot's virtual currency for simulated trading based on real market data. **This is NOT real money or financial advice.** Trading involves risk, and past performance is not indicative of future results. Have fun!",
    ru: "Эта игра использует виртуальную валюту бота для симуляции торговли на основе реальных рыночных данных. **Это НЕ настоящие деньги и НЕ финансовый совет.** Торговля сопряжена с риском, и прошлые результаты не гарантируют будущих. Удачи!",
    uk: "Ця гра використовує віртуальну валюту бота для симуляції торгівлі на основі реальних ринкових даних. **Це НЕ реальні гроші і НЕ фінансовий радник.** Торгівля пов'язана з ризиком, і минула продуктивність не гарантує майбутніх результатів. Веселої гри!",
  },
  mainMenuTitle: {
    en: "Crypto Portfolio",
    ru: "Крипто Портфель",
    uk: "Крипто Портфель",
  },
  chartViewTitle: {
    en: "{{symbol}} Chart & Position",
    ru: "График и Позиция {{symbol}}",
    uk: "Графік і Позиція {{symbol}}",
  },
  errorFetchData: {
    en: "Error fetching market data. Please try again later.",
    ru: "Ошибка загрузки рыночных данных. Пожалуйста, попробуйте позже.",
    uk: "Помилка завантаження ринкових даних. Будь ласка, спробуйте пізніше.",
  },
  errorRender: {
    en: "Error rendering the view.",
    ru: "Ошибка отображения.",
    uk: "Помилка відображення.",
  },
  errorNoPositions: {
    en: "You have no open positions.",
    ru: "У вас нет открытых позиций.",
    uk: "У вас немає відкритих позицій.",
  },
  selectPositionPrompt: {
    en: "Select a position to view its chart",
    ru: "Выберите позицию для просмотра графика",
    uk: "Виберіть позицію для перегляду графіка",
  },
  positionSelectLabel: {
    en: "{{direction}} {{symbol}} @ {{entryPrice}} ({{leverage}}x)",
    ru: "{{direction}} {{symbol}} @ {{entryPrice}} ({{leverage}}x)",
    uk: "{{direction}} {{symbol}} @ {{entryPrice}} ({{leverage}}x)",
  },
  errorFetchChartData: {
    en: "Error fetching chart data for {{symbol}}.",
    ru: "Ошибка загрузки данных графика для {{symbol}}.",
    uk: "Помилка завантаження даних графіка для {{symbol}}.",
  },
  buttonViewPositions: {
    en: "View Positions",
    ru: "Посмотреть Позиции",
    uk: "Переглянути Позиції",
  },
  buttonOpenPosition: {
    en: "Open New Position",
    ru: "Открыть Позицию",
    uk: "Відкрити Нову Позицію",
  },
  buttonViewChart: {
    en: "View Chart",
    ru: "График",
    uk: "Графік",
  },
  buttonBackToMenu: {
    en: "Back to Menu",
    ru: "Назад в Меню",
    uk: "Назад в Меню",
  },
  buttonRefresh: {
    en: "Refresh Chart",
    ru: "Обновить График",
    uk: "Оновити Графік",
  },
  common: {
    // Add common translations if needed by component
    balance: {
      en: "Balance",
      ru: "Баланс",
      uk: "Баланс",
    },
    openOrders: {
      en: "Open Orders",
      ru: "Открытые ордера",
      uk: "Відкриті ордери",
    },
    coin: {
      en: "Coin",
      ru: "Монета",
      uk: "Монета",
    },
    stake: {
      en: "Stake",
      ru: "Ставка",
      uk: "Ставка",
    },
    noOpenPositions: {
      en: "No open positions yet.",
      ru: "Пока нет открытых позиций.",
      uk: "Поки немає відкритих позицій.",
    },
    marketMovers: {
      en: "Biggest Movers",
      ru: "Наибольшие изменения",
      uk: "Найбільші зміни",
    },
    topGainers: {
      en: "Top Gainers",
      ru: "Наибольший прирост",
      uk: "Найбільший приріст",
    },
    topLosers: {
      en: "Top Losers",
      ru: "Наибольший спад",
      uk: "Найбільший спад",
    },
    chartTitleSuffix: {
      en: "Chart",
      ru: "Графік",
      uk: "Графік",
    },
  },
  timeframe: {
    selectPlaceholder: {
      en: "Select Timeframe",
      ru: "Выбрать Таймфрейм",
      uk: "Вибрати Таймфрейм",
    },
    intervals: {
      oneMinute: {
        en: "1 Minute",
        ru: "1 Минута",
        uk: "1 Хвилина",
      },
      fiveMinutes: {
        en: "5 Minutes",
        ru: "5 Минут",
        uk: "5 Хвилин",
      },
      fifteenMinutes: {
        en: "15 Minutes",
        ru: "15 Минут",
        uk: "15 Хвилин",
      },
      thirtyMinutes: {
        en: "30 Minutes",
        ru: "30 Минут",
        uk: "30 Хвилин",
      },
      oneHour: {
        en: "1 Hour",
        ru: "1 Час",
        uk: "1 Година",
      },
      fourHours: {
        en: "4 Hours",
        ru: "4 Часа",
        uk: "4 Години",
      },
      oneDay: {
        en: "1 Day",
        ru: "1 День",
        uk: "1 День",
      },
      oneWeek: {
        en: "1 Week",
        ru: "1 Неделя",
        uk: "1 Тиждень",
      },
    },
  },
  details: {
    en: "Details",
    ru: "Детали",
    uk: "Деталі",
  },
  entryPrice: {
    en: "Entry",
    ru: "Вход",
    uk: "Вхід",
  },
  currentPrice: {
    en: "Current",
    ru: "Текущая",
    uk: "Поточна",
  },
  quantity: {
    en: "Quantity",
    ru: "Кол-во",
    uk: "Кількість",
  },
  pnl: {
    en: "PnL",
    ru: "PnL",
    uk: "PnL",
  },
  leverage: {
    en: "Leverage",
    ru: "Плечо",
    uk: "Плече",
  },
  takeProfit: {
    en: "Take Profit",
    ru: "Тейк Профит",
    uk: "Тейк Профіт",
  },
  stopLoss: {
    en: "Stop Loss",
    ru: "Стоп Лосс",
    uk: "Стоп Лосс",
  },
  notSet: {
    en: "Not Set",
    ru: "Не уст.",
    uk: "Не уст.",
  },
  buttonClose: {
    en: "Close",
    ru: "Закрыть",
    uk: "Закрити",
  },
  buttonAverage: {
    en: "Average",
    ru: "Усреднить",
    uk: "Усереднити",
  },
  buttonSetTpsl: {
    en: "TP / SL",
    ru: "TP / SL",
    uk: "TP / SL",
  },
  openPositionModalTitle: {
    en: "Open New Crypto Position",
    ru: "Открыть Новую Крипто Позицию",
    uk: "Відкрити Нову Крипто Позицію",
  },
  symbolInputLabel: {
    en: "Symbol (e.g., BTCUSDT)",
    ru: "Символ (напр., BTCUSDT)",
  },
  directionInputLabel: {
    en: "Direction (LONG or SHORT)",
    ru: "Направление (LONG или SHORT)",
    uk: "Напрямок (LONG або SHORT)",
  },
  stakeInputLabel: {
    en: "Stake Amount (Your Balance)",
    ru: "Сумма Ставки (Ваш Баланс)",
    uk: "Сума Ставки (Ваш Баланс)",
  },
  leverageInputLabel: {
    en: "Leverage (e.g., 5, 10, 25)",
    ru: "Плечо (напр., 5, 10, 25)",
    uk: "Плече (напр., 5, 10, 25)",
  },
  positionOpenedSuccess: {
    en: "✅ Successfully opened {{direction}} position for {{symbol}}!",
    ru: "✅ Успешно открыта {{direction}} позиция по {{symbol}}!",
    uk: "✅ Успішно відкрита {{direction}} позиція по {{symbol}}!",
  },
  errorInvalidSymbol: {
    en: "❌ Invalid symbol format. Please use format like BTCUSDT.",
    ru: "❌ Неверный формат символа. Используйте формат типа BTCUSDT.",
    uk: "❌ Неверний формат символа. Використовуйте формат типу BTCUSDT.",
  },
  errorInvalidDirection: {
    en: "❌ Invalid direction. Use LONG or SHORT.",
    ru: "❌ Неверное направление. Используйте LONG или SHORT.",
    uk: "❌ Неверне напрямок. Використовуйте LONG або SHORT.",
  },
  errorInvalidStake: {
    en: "❌ Invalid stake amount. Please enter a positive number.",
    ru: "❌ Неверная сумма ставки. Введите положительное число.",
    uk: "❌ Неверна сума ставки. Введіть додатне число.",
  },
  errorInvalidLeverage: {
    en: "❌ Invalid leverage. Please enter a positive integer (e.g., 1-100).",
    ru: "❌ Неверное плечо. Введите целое положительное число (напр., 1-100).",
    uk: "❌ Неверне плече. Введіть ціле додатне число (напр., 1-100).",
  },
  errorInsufficientBalance: {
    en: "❌ Insufficient balance to open this position with the specified stake.",
    ru: "❌ Недостаточно средств для открытия позиции с указанной ставкой.",
    uk: "❌ Недостатньо коштів для відкриття позиції з вказаною ставкою.",
  },
  errorApiSymbolNotFound: {
    en: "❌ Could not find market data for the symbol: {{symbol}}.",
    ru: "❌ Не удалось найти рыночные данные для символа: {{symbol}}.",
    uk: "❌ Не вдалося знайти ринкові дані для символа: {{symbol}}.",
  },
  errorCreatingPosition: {
    en: "❌ An error occurred while creating the position in the database.",
    ru: "❌ Произошла ошибка при создании позиции в базе данных.",
    uk: "❌ Виникла помилка при створенні позиції в базі даних.",
  },
  setTpslModalTitle: {
    en: "Set Take Profit / Stop Loss for {{symbol}}",
    ru: "Установить TP / SL для {{symbol}}",
    uk: "Встановити TP / SL для {{symbol}}",
  },
  takeProfitInputLabel: {
    en: "Take Profit Price (Leave empty to remove)",
    ru: "Цена Take Profit (Пусто для удаления)",
  },
  stopLossInputLabel: {
    en: "Stop Loss Price (Leave empty to remove)",
    ru: "Цена Stop Loss (Пусто для удаления)",
    uk: "Ціна Стоп Лосс (Пусто для видалення)",
  },
  tpslSetSuccess: {
    en: "✅ Successfully updated Take Profit / Stop Loss for {{symbol}} position.",
    ru: "✅ Успешно обновлены Take Profit / Stop Loss для позиции {{symbol}}.",
    uk: "✅ Успішно оновлені Take Profit / Stop Loss для позиції {{symbol}}.",
  },
  errorInvalidTpPrice: {
    en: "❌ Invalid Take Profit price. For LONG, it must be above entry. For SHORT, below entry.",
    ru: "❌ Неверная цена Take Profit. Для LONG должна быть выше входа, для SHORT - ниже.",
    uk: "❌ Неверна ціна Take Profit. Для LONG вона повинна бути вище входу, для SHORT - нижче.",
  },
  errorInvalidSlPrice: {
    en: "❌ Invalid Stop Loss price. For LONG, it must be below entry. For SHORT, above entry.",
    ru: "❌ Неверная цена Stop Loss. Для LONG должна быть ниже входа, для SHORT - выше.",
    uk: "❌ Неверна ціна Стоп Лосс. Для LONG вона повинна бути нижче входу, для SHORT - вище.",
  },
  errorUpdatingTpsl: {
    en: "❌ An error occurred while updating TP/SL.",
    ru: "❌ Произошла ошибка при обновлении TP/SL.",
    uk: "❌ Виникла помилка при оновленні TP/SL.",
  },
  averagePositionModalTitle: {
    en: "Average Position: {{symbol}}",
    ru: "Усреднить Позицию: {{symbol}}",
    uk: "Усереднити Позицію: {{symbol}}",
  },
  additionalStakeInputLabel: {
    en: "Additional Stake Amount",
    ru: "Сумма Дополнительной Ставки",
    uk: "Сума Додаткової Ставки",
  },
  positionAveragedSuccess: {
    en: "✅ Successfully averaged position for {{symbol}}! New entry price: {{newEntryPrice}}",
    ru: "✅ Успешно усреднена позиция по {{symbol}}! Новая цена входа: {{newEntryPrice}}",
    uk: "✅ Успішно усереднена позиція по {{symbol}}! Нова ціна входу: {{newEntryPrice}}",
  },
  errorAveragingPosition: {
    en: "❌ An error occurred while averaging the position.",
    ru: "❌ Произошла ошибка при усреднении позиции.",
    uk: "❌ Виникла помилка при усередненні позиції.",
  },
  liquidationNotification: {
    en: "⚠️ Liquidation Alert! Your {{direction}} position for {{symbol}} was automatically closed due to reaching -100% PnL.",
    ru: "⚠️ Оповещение о Ликвидации! Ваша {{direction}} позиция по {{symbol}} была автоматически закрыта из-за достижения -100% PnL.",
    uk: "⚠️ Оповіщення про Ликвідацію! Ваша {{direction}} позиція по {{symbol}} була автоматично закрита через досягнення -100% PnL.",
  },
  // New coin preview related translations
  coinPreview: {
    title: {
      en: "{symbol} Market Preview",
      ru: "Предпросмотр рынка {symbol}",
      uk: "Попередній перегляд ринку {symbol}",
    },
    selectCoinPrompt: {
      en: "Preview a coin chart...",
      ru: "Просмотреть график монеты...",
      uk: "Переглянути графік монети...",
    },
    priceInfoLabel: {
      en: "Price Information",
      ru: "Информация о цене",
      uk: "Інформація про ціну",
    },
    currentPriceLabel: {
      en: "Current Price",
      ru: "Текущая цена",
      uk: "Поточна ціна",
    },
    price24hChangeLabel: {
      en: "24h Change",
      ru: "Изменение за 24ч",
      uk: "Зміна за 24г",
    },
    volumeLabel: {
      en: "24h Volume",
      ru: "Объем за 24ч",
      uk: "Обсяг за 24г",
    },
    readyToTradeLabel: {
      en: "Ready to trade?",
      ru: "Готовы торговать?",
      uk: "Готові торгувати?",
    },
    longExplanation: {
      en: "Buy if you expect price to rise",
      ru: "Покупайте, если ожидаете роста цены",
      uk: "Купуйте, якщо очікуєте зростання ціни",
    },
    shortExplanation: {
      en: "Sell if you expect price to fall",
      ru: "Продавайте, если ожидаете падения цены",
      uk: "Продавайте, якщо очікуєте падіння ціни",
    },
    buttonBackToMenu: {
      en: "Back to Menu",
      ru: "Вернуться в меню",
      uk: "Повернутися до меню",
    },
    buttonOpenPositionFromPreview: {
      en: "Open Position",
      ru: "Открыть позицию",
      uk: "Відкрити позицію",
    },
  },
  buttonClosePosition: {
    en: "Close Position",
    ru: "Закрыть позицию",
    uk: "Закрити позицію",
  },
  buttonAveragePosition: {
    en: "Average Position",
    ru: "Усреднить позицию",
    uk: "Усереднити позицію",
  },
  buttonSetTpSl: {
    en: "Set TP/SL",
    ru: "Установить TP/SL",
    uk: "Встановити TP/SL",
  },
  buttonBack: {
    en: "Back",
    ru: "Назад",
    uk: "Назад",
  },
  buttonCoinPrevPage: {
    en: "🔼 Prev Page",
    ru: "🔼 Пред. Стр",
    uk: "🔼 Попер. Стор",
  },
  buttonCoinNextPage: {
    en: "Next Page 🔽",
    ru: "След. Стр 🔽",
    uk: "Наст. Стор 🔽",
  },
  // New select menu options
  selectMenuPlaceholder: {
    en: "Select a symbol to trade...",
    ru: "Выберите символ для торговли...",
    uk: "Виберіть символ для торгівлі...",
  },
  selectMenuOptionPrev: {
    en: "⬅️ Previous Page",
    ru: "⬅️ Пред. Страница",
    uk: "⬅️ Попер. Сторінка",
  },
  selectMenuOptionNext: {
    en: "Next Page ➡️",
    ru: "След. Страница ➡️",
    uk: "Наст. Сторінка ➡️",
  },
};

// PnL Calculation Helper
function calculatePnlPercent(entryPrice, currentPrice, direction, leverage) {
  entryPrice = parseFloat(entryPrice);
  currentPrice = parseFloat(currentPrice);
  leverage = parseInt(leverage);

  if (
    !entryPrice ||
    !currentPrice ||
    !leverage ||
    isNaN(entryPrice) ||
    isNaN(currentPrice) ||
    isNaN(leverage)
  ) {
    return 0;
  }

  let pnlRatio = 0;
  if (direction === "LONG") {
    pnlRatio = (currentPrice - entryPrice) / entryPrice;
  } else if (direction === "SHORT") {
    pnlRatio = (entryPrice - currentPrice) / entryPrice;
  }

  // Clamp loss at -100% (liquidation)
  const pnlPercent = Math.max(-100, pnlRatio * leverage * 100);
  return pnlPercent;
}

// PnL Calculation Helper (Amount)
function calculatePnlAmount(entryPrice, currentPrice, quantity, direction) {
  // Ensure inputs are Prisma Decimal or convert strings/numbers
  const entry = new Prisma.Decimal(entryPrice);
  const current = new Prisma.Decimal(currentPrice);
  const qty = new Prisma.Decimal(quantity);

  if (direction === "LONG") {
    // PnL = (Current Price - Entry Price) * Quantity
    return current.minus(entry).times(qty);
  } else if (direction === "SHORT") {
    // PnL = (Entry Price - Current Price) * Quantity
    return entry.minus(current).times(qty);
  }
  return new Prisma.Decimal(0); // Should not happen
}

// Function to generate the main menu message content
async function generateMainMenuContent(
  guildId,
  userId,
  i18n,
  interaction,
  coinPage = 1
) {
  const userData = await Database.getUser(guildId, userId, true);
  const positions = await Database.getUserCryptoPositions(guildId, userId);

  // Fetch market data for positions
  let currentPrices = {};
  if (positions.length > 0) {
    const symbolsToFetch = [...new Set(positions.map((p) => p.symbol))];
    currentPrices = await getTickers(symbolsToFetch);
    if (currentPrices === null) {
      throw new Error("Failed to fetch ticker data from API");
    }
  }

  // Fetch user avatar URL from the interaction object
  const userAvatarURL = interaction.user.displayAvatarURL({
    extension: "png",
    size: 128,
  });

  const componentData = {
    interaction: {
      user: {
        id: userId,
        // Pass the actual avatar URL
        avatarURL: userAvatarURL,
      },
      guild: { id: guildId },
    },
    i18n: {
      // Pass resolved translations for the keys used in Crypto2.jsx
      balanceLabel: i18n.__("games.crypto2.common.balance"),
      openOrdersLabel: i18n.__("games.crypto2.common.openOrders"),
      coinLabel: i18n.__("games.crypto2.common.coin"),
      stakeLabel: i18n.__("games.crypto2.common.stake"),
      noOpenPositions: i18n.__("games.crypto2.common.noOpenPositions"),
      // Add translations for the new buttons
      closeButtonLabel: i18n.__("games.crypto2.buttonClose") || "Close",
      averageButtonLabel: i18n.__("games.crypto2.buttonAverage") || "Average",
      tpslButtonLabel: i18n.__("games.crypto2.buttonSetTpsl") || "TP/SL",
      // Add any other translations Crypto2.jsx MainMenu specifically needs
    },
    balance: userData?.economy?.balance?.toString() ?? "0.00",
    openPositions: positions.map((p) => {
      const currentPrice =
        currentPrices[p.symbol]?.markPrice ||
        currentPrices[p.symbol]?.lastPrice;
      const pnlPercent = calculatePnlPercent(
        p.entryPrice,
        currentPrice,
        p.direction,
        p.leverage
      );
      // Calculate stake value here to pass to component
      const stakeValue = new Prisma.Decimal(p.entryPrice || 0).times(
        new Prisma.Decimal(p.quantity || 0)
      );

      // Calculate PnL amount
      const pnlAmount = calculatePnlAmount(
        p.entryPrice,
        currentPrice,
        p.quantity,
        p.direction
      );

      return {
        id: p.id, // Pass position ID
        symbol: p.symbol,
        direction: p.direction,
        entryPrice: p.entryPrice.toString(),
        quantity: p.quantity.toString(),
        leverage: p.leverage,
        pnlPercent: pnlPercent.toFixed(2),
        stakeValue: stakeValue.toFixed(2), // Pass calculated stake value
        pnlAmount: pnlAmount.toFixed(2), // Pass calculated PnL amount
      };
    }),
    viewType: "main_menu",
    selectedPositionId: null, // No position selected by default in main menu
    // Add data needed for Coin Preview Selector
    coinPage: coinPage,
    // Total pages calculation will move to where the menu is built
  };

  const pngBuffer = await generateImage(
    "Crypto2",
    componentData,
    { image: 1, emoji: 1 },
    i18n // Pass the main i18n object here for generateImage's internal use if needed
  );
  const attachmentName = `crypto_portfolio_${userId}.avif`; // Use .avif

  // --- Build Components using ComponentBuilder ---
  const builder = new ComponentBuilder({ color: process.env.EMBED_COLOR })
    .addText(i18n.__("games.crypto2.mainMenuTitle"), "header3") // Use addText for title
    .addImage(`attachment://${attachmentName}`); // Add image

  // Add first row with primary actions
  const openButton = new ButtonBuilder()
    .setCustomId(`crypto2_open_${userId}`)
    .setLabel(i18n.__("games.crypto2.buttonOpenPosition"))
    .setStyle(ButtonStyle.Success);
  const refreshButton = new ButtonBuilder()
    .setCustomId(`crypto2_refresh_${userId}`)
    .setLabel(i18n.__("games.crypto2.buttonRefresh") || "Refresh")
    .setStyle(ButtonStyle.Secondary);
  const row1 = new ActionRowBuilder().addComponents(openButton, refreshButton);
  builder.addActionRow(row1);

  // Only add position select if there are any positions
  if (positions.length > 0) {
    const positionOptions = positions.map((p) => ({
      label: `${p.direction} ${p.symbol} (${p.leverage}x)`,
      description: `Entry: ${p.entryPrice.toFixed(
        2
      )} | PnL: ${calculatePnlPercent(
        p.entryPrice,
        currentPrices[p.symbol]?.markPrice ||
          currentPrices[p.symbol]?.lastPrice,
        p.direction,
        p.leverage
      ).toFixed(2)}%`,
      value: p.id,
    }));

    // Add string select menu directly
    builder.addStringSelectMenu(
      `crypto2_position_select_${userId}`,
      i18n.__("games.crypto2.selectPositionPrompt") ||
        "Select a position to manage...",
      positionOptions
    );
  }

  // --- Add Coin Preview Selector & Pagination ---
  const allSymbols = Array.from(getValidCmcSymbols()).sort(); // Get and sort symbols
  const symbolsPerPage = 23;
  const totalCoinPages = Math.ceil(allSymbols.length / symbolsPerPage);
  const startIndex = (coinPage - 1) * symbolsPerPage;
  const endIndex = startIndex + symbolsPerPage;
  const symbolsToShow = allSymbols.slice(startIndex, endIndex);

  if (symbolsToShow.length > 0) {
    const coinPreviewOptions = symbolsToShow.map((symbol) => ({
      label: `${symbol}USDT`, // Display as full USDT pair
      value: `${symbol}USDT`, // Value is the full symbol
    }));

    // Add pagination options if needed
    if (totalCoinPages > 1) {
      // Add "Previous Page" option if not on first page
      if (coinPage > 1) {
        coinPreviewOptions.unshift({
          label:
            i18n.__("games.crypto2.selectMenuOptionPrev") || "⬅️ Previous Page",
          value: `prev_page_${coinPage}`,
          description: `Go to page ${coinPage - 1}`,
        });
      }

      // Add "Next Page" option if not on last page
      if (coinPage < totalCoinPages) {
        coinPreviewOptions.push({
          label:
            i18n.__("games.crypto2.selectMenuOptionNext") || "Next Page ➡️",
          value: `next_page_${coinPage}`,
          description: `Go to page ${coinPage + 1}`,
        });
      }
    }

    builder.addStringSelectMenu(
      `crypto2_preview_select_${userId}_${coinPage}`, // Include page in ID
      i18n.__("games.crypto2.selectMenuPlaceholder") ||
        "Select a symbol to trade...",
      coinPreviewOptions
    );
  }

  return builder.toReplyOptions({
    files: [{ attachment: pngBuffer, name: attachmentName }],
  });
}

// Add a new function to generate main menu with a selected position
async function generateMainMenuWithSelectedPosition(
  guildId,
  userId,
  i18n,
  interaction,
  selectedPositionId,
  coinPage = 1 // Add coin page state here too
) {
  // This is mostly the same as generateMainMenuContent but with a selected position
  const userData = await Database.getUser(guildId, userId, true);
  const positions = await Database.getUserCryptoPositions(guildId, userId);

  // Fetch market data for positions
  let currentPrices = {};
  if (positions.length > 0) {
    const symbolsToFetch = [...new Set(positions.map((p) => p.symbol))];
    currentPrices = await getTickers(symbolsToFetch);
    if (currentPrices === null) {
      throw new Error("Failed to fetch ticker data from API");
    }
  }

  // Fetch user avatar URL from the interaction object
  const userAvatarURL = interaction.user.displayAvatarURL({
    extension: "png",
    size: 128,
  });

  const componentData = {
    interaction: {
      user: {
        id: userId,
        // Pass the actual avatar URL
        avatarURL: userAvatarURL,
      },
      guild: { id: guildId },
    },
    i18n: {
      // Pass resolved translations for the keys used in Crypto2.jsx
      balanceLabel: i18n.__("games.crypto2.common.balance"),
      openOrdersLabel: i18n.__("games.crypto2.common.openOrders"),
      coinLabel: i18n.__("games.crypto2.common.coin"),
      stakeLabel: i18n.__("games.crypto2.common.stake"),
      noOpenPositions: i18n.__("games.crypto2.common.noOpenPositions"),
      // Add translations for the new buttons
      closeButtonLabel: i18n.__("games.crypto2.buttonClose") || "Close",
      averageButtonLabel: i18n.__("games.crypto2.buttonAverage") || "Average",
      tpslButtonLabel: i18n.__("games.crypto2.buttonSetTpsl") || "TP/SL",
      // Add any other translations Crypto2.jsx MainMenu specifically needs
    },
    balance: userData?.economy?.balance?.toString() ?? "0.00",
    openPositions: positions.map((p) => {
      const currentPrice =
        currentPrices[p.symbol]?.markPrice ||
        currentPrices[p.symbol]?.lastPrice;
      const pnlPercent = calculatePnlPercent(
        p.entryPrice,
        currentPrice,
        p.direction,
        p.leverage
      );
      // Calculate stake value here to pass to component
      const stakeValue = new Prisma.Decimal(p.entryPrice || 0).times(
        new Prisma.Decimal(p.quantity || 0)
      );

      // Calculate PnL amount
      const pnlAmount = calculatePnlAmount(
        p.entryPrice,
        currentPrice,
        p.quantity,
        p.direction
      );

      return {
        id: p.id,
        symbol: p.symbol,
        direction: p.direction,
        entryPrice: p.entryPrice.toString(),
        quantity: p.quantity.toString(),
        leverage: p.leverage,
        pnlPercent: pnlPercent.toFixed(2),
        stakeValue: stakeValue.toFixed(2),
        pnlAmount: pnlAmount.toFixed(2), // Add PnL amount
      };
    }),
    viewType: "main_menu",
    selectedPositionId: selectedPositionId,
    // Add data needed for Coin Preview Selector
    coinPage: coinPage,
    totalCoinPages: Math.ceil(getValidCmcSymbols().size / 25),
  };

  const pngBuffer = await generateImage(
    "Crypto2",
    componentData,
    { image: 1, emoji: 1 },
    i18n // Pass the main i18n object here for generateImage's internal use if needed
  );
  const attachmentName = `crypto_portfolio_${userId}.avif`;

  // --- Build Components using ComponentBuilder ---
  const builder = new ComponentBuilder({ color: process.env.EMBED_COLOR })
    .addText(i18n.__("games.crypto2.mainMenuTitle"), "header3")
    .addImage(`attachment://${attachmentName}`);

  // Add first row with primary actions
  const openButton = new ButtonBuilder()
    .setCustomId(`crypto2_open_${userId}`)
    .setLabel(i18n.__("games.crypto2.buttonOpenPosition"))
    .setStyle(ButtonStyle.Success);
  const refreshButton = new ButtonBuilder()
    .setCustomId(`crypto2_refresh_${userId}`)
    .setLabel(i18n.__("games.crypto2.buttonRefresh") || "Refresh")
    .setStyle(ButtonStyle.Secondary);
  const firstRow = new ActionRowBuilder().addComponents(
    openButton,
    refreshButton
  );
  builder.addActionRow(firstRow);

  // Only add position select if there are any positions
  if (positions.length > 0) {
    const positionOptions = positions.map((p) => ({
      label: `${p.direction} ${p.symbol} (${p.leverage}x)`,
      description: `Entry: ${p.entryPrice.toFixed(
        2
      )} | PnL: ${calculatePnlPercent(
        p.entryPrice,
        currentPrices[p.symbol]?.markPrice ||
          currentPrices[p.symbol]?.lastPrice,
        p.direction,
        p.leverage
      ).toFixed(2)}%`,
      value: p.id,
      default: p.id === selectedPositionId, // Set default if selected
    }));

    builder.addStringSelectMenu(
      `crypto2_position_select_${userId}`,
      i18n.__("games.crypto2.selectPositionPrompt") ||
        "Select a position to manage...",
      positionOptions
    );
  }

  // If a position is selected, add action buttons for it
  if (selectedPositionId) {
    const closeButton = new ButtonBuilder()
      .setCustomId(`crypto2_close_${selectedPositionId}`)
      .setLabel(
        i18n.__("games.crypto2.buttonClosePosition") || "Close Position"
      )
      .setStyle(ButtonStyle.Danger);
    const averageButton = new ButtonBuilder()
      .setCustomId(`crypto2_average_${selectedPositionId}`)
      .setLabel(
        i18n.__("games.crypto2.buttonAveragePosition") || "Average Position"
      )
      .setStyle(ButtonStyle.Primary);
    const tpslButton = new ButtonBuilder()
      .setCustomId(`crypto2_tpsl_${selectedPositionId}`)
      .setLabel(i18n.__("games.crypto2.buttonSetTpSl") || "Set TP/SL")
      .setStyle(ButtonStyle.Success);
    const backButton = new ButtonBuilder()
      .setCustomId(`crypto2_back_${userId}`)
      .setLabel(i18n.__("games.crypto2.buttonBack") || "Back")
      .setStyle(ButtonStyle.Secondary);

    const actionRow = new ActionRowBuilder().addComponents(
      closeButton,
      averageButton,
      tpslButton,
      backButton
    );
    builder.addActionRow(actionRow);
  }

  // --- Add Coin Preview Selector & Pagination (copied from generateMainMenuContent) ---
  const allSymbols = Array.from(getValidCmcSymbols()).sort(); // Get and sort symbols
  const symbolsPerPage = 25;
  const totalCoinPages = Math.ceil(allSymbols.length / symbolsPerPage);
  const startIndex = (coinPage - 1) * symbolsPerPage;
  const endIndex = startIndex + symbolsPerPage;
  const symbolsToShow = allSymbols.slice(startIndex, endIndex);

  if (symbolsToShow.length > 0) {
    const coinPreviewOptions = symbolsToShow.map((symbol) => ({
      label: `${symbol}USDT`, // Display as full USDT pair
      value: `${symbol}USDT`, // Value is the full symbol
      description: `Preview ${symbol} market`, // Optional description
    }));

    // Add pagination options if needed
    if (totalCoinPages > 1) {
      // Add "Previous Page" option if not on first page
      if (coinPage > 1) {
        coinPreviewOptions.unshift({
          label:
            i18n.__("games.crypto2.selectMenuOptionPrev") || "⬅️ Previous Page",
          value: `prev_page_${coinPage}`,
        });
      }

      // Add "Next Page" option if not on last page
      if (coinPage < totalCoinPages) {
        coinPreviewOptions.push({
          label:
            i18n.__("games.crypto2.selectMenuOptionNext") || "Next Page ➡️",
          value: `next_page_${coinPage}`,
        });
      }
    }

    builder.addStringSelectMenu(
      `crypto2_preview_select_${userId}_${coinPage}`, // Include page in ID
      i18n.__("games.crypto2.selectMenuPlaceholder") ||
        "Select a symbol to trade...",
      coinPreviewOptions
    );
  }

  return builder.toReplyOptions({
    files: [{ attachment: pngBuffer, name: attachmentName }],
  });
}

export default {
  game_info, // For loadGames
  localization_strings, // For loadGames and i18n
  isLegacy: false, // This is a new game

  async execute(interaction, i18n) {
    const guildId = interaction.guild.id;
    const userId = interaction.user.id;
    const modalSubmitOpenPositionId = `crypto2_open_modal_${interaction.id}`;
    const modalSubmitTpslId = `crypto2_tpsl_modal_${interaction.id}`;
    const modalSubmitAverageId = `crypto2_average_modal_${interaction.id}`;

    // --- Disclaimer Check ---
    try {
      // Ensure user and stats record exists or create defaults
      await Database.ensureUser(guildId, userId);
      const stats = await Database.client.statistics.upsert({
        where: { userId_guildId: { userId, guildId } },
        create: {
          crypto2DisclaimerSeen: false,
          user: {
            connect: {
              guildId_id: { guildId, id: userId },
            },
          },
        },
        update: {},
        select: { crypto2DisclaimerSeen: true },
      });

      if (!stats.crypto2DisclaimerSeen) {
        // Show Disclaimer using ComponentBuilder
        const disclaimerBuilder = new ComponentBuilder({ color: 0xff0000 }) // Red color
          .addText(i18n.__("games.crypto2.disclaimerTitle"), "header3")
          .addText(i18n.__("games.crypto2.disclaimerText"));

        const acknowledgeButton = new ButtonBuilder()
          .setCustomId(`crypto2_ack_${userId}`)
          .setLabel("I understand and accept the risks")
          .setStyle(ButtonStyle.Success);

        const disclaimerActionRow = new ActionRowBuilder().addComponents(
          acknowledgeButton
        );
        disclaimerBuilder.addActionRow(disclaimerActionRow);

        const disclaimerMessage = await interaction.editReply(
          disclaimerBuilder.toReplyOptions({ fetchReply: true }) // Use toReplyOptions
        );

        // Wait for Acknowledgment
        const buttonCollector =
          disclaimerMessage.createMessageComponentCollector({
            filter: (i) =>
              i.user.id === userId && i.customId === `crypto2_ack_${userId}`,
            componentType: ComponentType.Button,
            time: 60_000,
            max: 1,
          });

        let acknowledged = false;
        buttonCollector.on("collect", async (buttonInteraction) => {
          acknowledged = true;
          await buttonInteraction.deferUpdate();
          // Update DB flag
          await Database.client.statistics.update({
            where: { userId_guildId: { userId, guildId } },
            data: { crypto2DisclaimerSeen: true },
          });
          // Proceed to game - Initial Main Menu Render
          const initialContent = await generateMainMenuContent(
            guildId,
            userId,
            i18n,
            interaction,
            1 // Start at coin page 1
          );
          const message = await interaction.editReply(initialContent);
          setupGameInteractionCollector(
            interaction,
            message,
            i18n,
            modalSubmitOpenPositionId,
            modalSubmitTpslId,
            modalSubmitAverageId
          );
        });

        buttonCollector.on("end", async (collected) => {
          if (!collected.size) {
            await interaction.followUp({
              content: "Disclaimer acknowledgment timed out.",
              ephemeral: true,
            });
          }
        });
      } else {
        // Disclaimer already seen, proceed directly
        const initialContent = await generateMainMenuContent(
          guildId,
          userId,
          i18n,
          interaction,
          1 // Start at coin page 1
        );
        const message = await interaction.editReply(initialContent);
        setupGameInteractionCollector(
          interaction,
          message,
          i18n,
          modalSubmitOpenPositionId,
          modalSubmitTpslId,
          modalSubmitAverageId
        );
      }
    } catch (error) {
      console.error("Error during crypto2 execute:", error);
      // Edit the deferred reply with an error message
      const errorKey =
        error.message === "Failed to fetch ticker data from API"
          ? "games.crypto2.errorFetchData"
          : "games.crypto2.errorRender";
      // Check if interaction is still editable (it should be since it was deferred in work.js)
      try {
        await interaction.editReply({
          content: i18n.__(errorKey),
          components: [], // Clear components
          files: [],
          embeds: [], // Clear embeds
        });
      } catch (editError) {
        console.error(
          "Failed to edit interaction reply with error:",
          editError
        );
      }
    }
  }, // End execute
}; // End export

// --- Liquidation Check Helper ---
async function checkAndLiquidatePositions(guildId, userId, i18n) {
  const positions = await Database.getUserCryptoPositions(guildId, userId);
  if (positions.length === 0) return []; // No positions to check

  const symbolsToFetch = [...new Set(positions.map((p) => p.symbol))];
  const currentPrices = await getTickers(symbolsToFetch);
  if (!currentPrices) {
    console.warn(
      `[LiquidationCheck] Failed to fetch prices for user ${userId} in guild ${guildId}`
    );
    return []; // Cant check without prices
  }

  const liquidatedPositionsInfo = [];
  const positionsToLiquidate = [];

  for (const position of positions) {
    const currentPrice =
      currentPrices[position.symbol]?.markPrice ||
      currentPrices[position.symbol]?.lastPrice;
    if (!currentPrice) continue; // Skip if price unavailable

    const pnlPercent = calculatePnlPercent(
      position.entryPrice,
      currentPrice,
      position.direction,
      position.leverage
    );

    if (pnlPercent <= -100) {
      positionsToLiquidate.push(position);
    }
  }

  if (positionsToLiquidate.length > 0) {
    console.log(
      `[LiquidationCheck] Liquidating ${positionsToLiquidate.length} positions for user ${userId} in guild ${guildId}`
    );
    try {
      // Use transaction to delete all liquidated positions at once
      // Note: No balance is returned on liquidation in this model (stake is lost)
      await Database.client.cryptoPosition.deleteMany({
        where: {
          id: { in: positionsToLiquidate.map((p) => p.id) },
        },
      });

      // Prepare notification info
      for (const pos of positionsToLiquidate) {
        liquidatedPositionsInfo.push({
          symbol: pos.symbol,
          direction: pos.direction,
        });
      }
      // Optionally, invalidate user cache if balance *was* affected in other models
    } catch (error) {
      console.error(
        `[LiquidationCheck] Error during bulk liquidation for user ${userId} in guild ${guildId}:`,
        error
      );
      return []; // Return empty if liquidation failed
    }
  }

  return liquidatedPositionsInfo; // Return info about liquidated positions
}

// --- Refactored Game Interaction Collector Setup ---
function setupGameInteractionCollector(
  originalInteraction,
  message,
  i18n,
  _modalSubmitOpenPositionId,
  _modalSubmitTpslId,
  _modalSubmitAverageId
) {
  const guildId = originalInteraction.guild.id;
  const userId = originalInteraction.user.id;

  const collector = message.createMessageComponentCollector({
    filter: (i) => i.user.id === userId,
    time: 10 * 60 * 1000, // Main collector timeout
  });

  // Timeout for modal submissions (e.g., 5 minutes)
  const modalTimeoutDuration = 5 * 60 * 1000;

  collector.on("collect", async (i) => {
    let currentCoinPage = 1; // Will be determined by selected menu options
    // --- Button/Select Menu Handling ---
    if (i.type === InteractionType.MessageComponent) {
      try {
        const customId = i.customId;

        // --- Liquidation Check (remains the same) ---
        const liquidatedInfos = await checkAndLiquidatePositions(
          guildId,
          userId,
          i18n
        );
        if (liquidatedInfos.length > 0) {
          // Send notifications for any liquidations that just happened
          const liquidationMessages = liquidatedInfos
            .map((info) =>
              i18n.__("games.crypto2.liquidationNotification", info)
            )
            .join("\n");
          await i
            .followUp({ content: liquidationMessages, ephemeral: true })
            .catch(console.error);
        }

        // Simplified Open Position Modal Trigger (now also handles prefill from select menu)
        if (customId.startsWith(`crypto2_open_${userId}`)) {
          // Extract optional symbol prefill from button ID (e.g., crypto2_open_USERID_BTCUSDT)
          const parts = customId.split("_");
          const prefilledSymbol = parts.length > 3 ? parts[3] : ""; // Get symbol if present

          // --- Handle Open Position Modal ---
          const modalSubmitId = `crypto2_open_modal_${i.id}`; // Use button interaction ID for uniqueness
          const modal = new ModalBuilder()
            .setCustomId(modalSubmitId) // Use unique ID for this instance
            .setTitle(i18n.__("games.crypto2.openPositionModalTitle"));

          const symbolInput = new TextInputBuilder()
            .setCustomId("symbolInput")
            .setLabel(i18n.__("games.crypto2.symbolInputLabel"))
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("BTCUSDT")
            .setRequired(true)
            .setMinLength(6)
            .setMaxLength(15);

          // Pre-fill symbol if provided
          if (prefilledSymbol) {
            symbolInput.setValue(prefilledSymbol);
          } else {
            symbolInput.setPlaceholder("BTCUSDT");
          }

          const directionInput = new TextInputBuilder()
            .setCustomId("directionInput")
            .setLabel(i18n.__("games.crypto2.directionInputLabel"))
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("LONG or SHORT")
            .setRequired(true)
            .setMinLength(4)
            .setMaxLength(5);

          const stakeInput = new TextInputBuilder()
            .setCustomId("stakeInput")
            .setLabel(i18n.__("games.crypto2.stakeInputLabel"))
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("e.g., 10.50")
            .setRequired(true);

          const leverageInput = new TextInputBuilder()
            .setCustomId("leverageInput")
            .setLabel(i18n.__("games.crypto2.leverageInputLabel"))
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("e.g., 10")
            .setValue("10")
            .setRequired(true);

          modal.addComponents(
            new ActionRowBuilder().addComponents(symbolInput),
            new ActionRowBuilder().addComponents(directionInput),
            new ActionRowBuilder().addComponents(stakeInput),
            new ActionRowBuilder().addComponents(leverageInput)
          );

          // Show the modal
          await i.showModal(modal);

          // The rest of the code remains the same...
          // Handle modal submission (same code as in crypto2_open_ handler)
          i.awaitModalSubmit({
            filter: (modalInteraction) =>
              modalInteraction.customId === modalSubmitId &&
              modalInteraction.user.id === userId,
            time: modalTimeoutDuration,
          })
            .then(async (modalInteraction) => {
              await modalInteraction.deferReply({ ephemeral: true });
              try {
                // 1. Get Modal Data
                const symbol = modalInteraction.fields
                  .getTextInputValue("symbolInput")
                  .toUpperCase()
                  .trim();
                const direction = modalInteraction.fields
                  .getTextInputValue("directionInput")
                  .toUpperCase()
                  .trim();
                const stakeString = modalInteraction.fields
                  .getTextInputValue("stakeInput")
                  .trim();
                const leverageString = modalInteraction.fields
                  .getTextInputValue("leverageInput")
                  .trim();

                // 2. Validate Input
                if (!/^[A-Z]+USDT$/.test(symbol)) {
                  await modalInteraction.editReply(
                    i18n.__("games.crypto2.errorInvalidSymbol")
                  );
                  return;
                }
                if (direction !== "LONG" && direction !== "SHORT") {
                  await modalInteraction.editReply(
                    i18n.__("games.crypto2.errorInvalidDirection")
                  );
                  return;
                }
                const stake = parseFloat(stakeString);
                if (isNaN(stake) || stake <= 0) {
                  await modalInteraction.editReply(
                    i18n.__("games.crypto2.errorInvalidStake")
                  );
                  return;
                }
                const leverage = parseInt(leverageString);
                if (isNaN(leverage) || leverage <= 0 || leverage > 100) {
                  await modalInteraction.editReply(
                    i18n.__("games.crypto2.errorInvalidLeverage")
                  );
                  return;
                }

                // 3. Check Balance
                const userData = await Database.getUser(guildId, userId, true);
                const userBalance = new Prisma.Decimal(
                  userData?.economy?.balance ?? 0
                );
                const stakeDecimal = new Prisma.Decimal(stake);
                if (userBalance.lt(stakeDecimal)) {
                  await modalInteraction.editReply(
                    i18n.__("games.crypto2.errorInsufficientBalance")
                  );
                  return;
                }

                // 4. Fetch Current Price
                const tickerData = await getTickers([symbol]);
                if (!tickerData || !tickerData[symbol]) {
                  await modalInteraction.editReply(
                    i18n.__("games.crypto2.errorApiSymbolNotFound", { symbol })
                  );
                  return;
                }
                const entryPrice = new Prisma.Decimal(
                  tickerData[symbol].markPrice || tickerData[symbol].lastPrice
                );

                // 5. Calculate Quantity
                const positionValue = stakeDecimal.times(leverage);
                const quantity = positionValue.dividedBy(entryPrice);

                // 6. Create Position in DB and Update Balance (Transaction)
                await Database.client.$transaction(async (tx) => {
                  // a. Deduct stake from balance
                  await tx.economy.update({
                    where: { userId_guildId: { userId, guildId } },
                    data: { balance: { decrement: stakeDecimal } },
                  });

                  // b. Create position record
                  await tx.cryptoPosition.create({
                    data: {
                      userId,
                      guildId,
                      symbol,
                      direction,
                      entryPrice: entryPrice, // Already Decimal
                      quantity: quantity, // Already Decimal
                      leverage,
                      // TP/SL are null by default
                    },
                  });
                });

                // 7. Invalidate User Cache (since balance changed)
                if (Database.redisClient) {
                  const userCacheKeyFull = Database._cacheKeyUser(
                    guildId,
                    userId,
                    true
                  );
                  const userCacheKeyBasic = Database._cacheKeyUser(
                    guildId,
                    userId,
                    false
                  );
                  await Database._redisDel([
                    userCacheKeyFull,
                    userCacheKeyBasic,
                  ]);
                  Database._logRedis(
                    "del",
                    `${userCacheKeyFull}, ${userCacheKeyBasic}`,
                    "Invalidated user cache on position open"
                  );
                }

                // 8. Send Success Confirmation
                await modalInteraction.editReply(
                  i18n.__("games.crypto2.positionOpenedSuccess", {
                    direction,
                    symbol,
                  })
                );

                // 9. Refresh the main menu view
                try {
                  const menuContent = await generateMainMenuContent(
                    guildId,
                    userId,
                    i18n,
                    originalInteraction,
                    1 // Start at coin page 1
                  );
                  await message.edit(menuContent);
                } catch (refreshError) {
                  console.error(
                    "Error refreshing main menu after opening position:",
                    refreshError
                  );
                }
              } catch (error) {
                console.error(
                  "Error processing open position modal submission:",
                  error
                );
                if (!modalInteraction.replied && !modalInteraction.deferred) {
                  await modalInteraction
                    .deferReply({ ephemeral: true })
                    .catch(() => {});
                }
                await modalInteraction
                  .editReply(i18n.__("games.crypto2.errorCreatingPosition"))
                  .catch(() => {});
              }
            })
            .catch(async (err) => {
              console.log(
                `Open Position Modal timed out or failed for user ${userId}:`,
                err.message
              );
              await i
                .followUp({ content: "Modal timed out.", ephemeral: true })
                .catch(() => {});
            });
        } else if (
          customId.startsWith(`crypto2_close_`) &&
          !customId.includes("_from_")
        ) {
          // Extract position ID from customId (format: crypto2_close_POSITION_ID_INTERVAL)
          const parts = customId.split("_");
          const positionId = parts[2];

          await i.deferUpdate();
          try {
            const position = await Database.getCryptoPositionById(positionId);
            if (
              !position ||
              position.userId !== userId ||
              position.guildId !== guildId
            ) {
              await i.followUp({
                content: "Position not found or you don't own it.",
                ephemeral: true,
              });
              return;
            }

            // Execute the position closing logic
            const tickerData = await getTickers([position.symbol]);
            if (!tickerData || !tickerData[position.symbol]) {
              await i.followUp({
                content: i18n.__("games.crypto2.errorFetchData"),
                ephemeral: true,
              });
              return;
            }
            const currentPrice = new Prisma.Decimal(
              tickerData[position.symbol].markPrice ||
                tickerData[position.symbol].lastPrice
            );

            const pnlAmount = calculatePnlAmount(
              position.entryPrice,
              currentPrice,
              position.quantity,
              position.direction
            );

            const originalStake = position.quantity
              .times(position.entryPrice)
              .dividedBy(position.leverage);

            const amountToAddBack = originalStake.plus(pnlAmount);

            await Database.client.$transaction(async (tx) => {
              await tx.economy.update({
                where: { userId_guildId: { userId, guildId } },
                data: { balance: { increment: amountToAddBack } },
              });
              await tx.cryptoPosition.delete({
                where: { id: position.id },
              });
            });

            if (Database.redisClient) {
              const userCacheKeyFull = Database._cacheKeyUser(
                guildId,
                userId,
                true
              );
              const userCacheKeyBasic = Database._cacheKeyUser(
                guildId,
                userId,
                false
              );
              await Database._redisDel([userCacheKeyFull, userCacheKeyBasic]);
              Database._logRedis(
                "del",
                `${userCacheKeyFull}, ${userCacheKeyBasic}`,
                "Invalidated user cache on position close"
              );
            }

            const pnlPercent = calculatePnlPercent(
              position.entryPrice,
              currentPrice,
              position.direction,
              position.leverage
            );
            const profitLossString = pnlAmount.gte(0)
              ? `profit of ${pnlAmount.toFixed(2)}`
              : `loss of ${pnlAmount.abs().toFixed(2)}`;
            await i.followUp({
              content: `✅ Closed ${position.direction} ${
                position.symbol
              } position with a ${profitLossString}💲 (${
                pnlPercent >= 0 ? "+" : ""
              }${pnlPercent.toFixed(2)}%).`,
              ephemeral: true,
            });

            // After closing, refresh the main menu without a selected position
            const menuContent = await generateMainMenuContent(
              guildId,
              userId,
              i18n,
              originalInteraction,
              1 // Start at coin page 1
            );
            await message.edit(menuContent);
          } catch (error) {
            console.error(`Error closing position:`, error);
            await i.followUp({
              content: "❌ An error occurred while closing the position.",
              ephemeral: true,
            });
          }
        } else if (customId.startsWith(`crypto2_average_`)) {
          // --- Handle Average Modal ---
          const parts = customId.split("_");
          const positionId = parts[2];
          // Extract the current interval from the button ID
          const currentInterval = parts[3] || "15"; // Default to 15m if not present

          const position = await Database.getCryptoPositionById(positionId);
          if (
            !position ||
            position.userId !== userId ||
            position.guildId !== guildId
          ) {
            await i.followUp({
              content: "Position not found or you don't own it.",
              ephemeral: true,
            });
            return;
          }

          const modalSubmitId = `crypto2_average_modal_${positionId}_${currentInterval}_${i.id}`; // Include interval in modal ID
          const modal = new ModalBuilder().setCustomId(modalSubmitId).setTitle(
            i18n.__("games.crypto2.averagePositionModalTitle", {
              symbol: position.symbol,
            })
          );

          const addStakeInput = new TextInputBuilder()
            .setCustomId(`addStakeInput_${positionId}`) // Keep this ID for field retrieval
            .setLabel(i18n.__("games.crypto2.additionalStakeInputLabel"))
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("e.g., 5.00")
            .setRequired(true);
          modal.addComponents(
            new ActionRowBuilder().addComponents(addStakeInput)
          );

          await i.showModal(modal);

          // Wait for submission
          i.awaitModalSubmit({
            filter: (modalInteraction) =>
              modalInteraction.customId === modalSubmitId &&
              modalInteraction.user.id === userId,
            time: modalTimeoutDuration,
          })
            .then(async (modalInteraction) => {
              await modalInteraction.deferReply({ ephemeral: true });
              try {
                // 1. Get Data
                const additionalStakeString = modalInteraction.fields
                  .getTextInputValue(`addStakeInput_${positionId}`)
                  .trim();
                const additionalStake = parseFloat(additionalStakeString);

                // 2. Validate Stake
                if (isNaN(additionalStake) || additionalStake <= 0) {
                  await modalInteraction.editReply(
                    i18n.__("games.crypto2.errorInvalidStake")
                  );
                  return;
                }
                const additionalStakeDecimal = new Prisma.Decimal(
                  additionalStake
                );

                // 3. Fetch position again (to be safe) and user balance
                const freshPosition = await Database.getCryptoPositionById(
                  positionId
                );
                if (!freshPosition || freshPosition.userId !== userId) {
                  await modalInteraction.editReply(
                    "Position not found or changed."
                  );
                  return;
                }
                const userData = await Database.getUser(guildId, userId, true);
                const userBalance = new Prisma.Decimal(
                  userData?.economy?.balance ?? 0
                );

                // 4. Check Balance
                if (userBalance.lt(additionalStakeDecimal)) {
                  await modalInteraction.editReply(
                    i18n.__("games.crypto2.errorInsufficientBalance")
                  );
                  return;
                }

                // 5. Fetch Current Price
                const tickerData = await getTickers([freshPosition.symbol]);
                if (!tickerData || !tickerData[freshPosition.symbol]) {
                  await modalInteraction.editReply(
                    i18n.__("games.crypto2.errorFetchData")
                  );
                  return;
                }
                const currentPrice = new Prisma.Decimal(
                  tickerData[freshPosition.symbol].markPrice ||
                    tickerData[freshPosition.symbol].lastPrice
                );

                // 6. Calculate new quantity and entry price
                const oldQuantity = freshPosition.quantity;
                const oldEntryPrice = freshPosition.entryPrice;
                const leverage = freshPosition.leverage;
                const newValueToAdd = additionalStakeDecimal.times(leverage);
                const newQuantityToAdd = newValueToAdd.dividedBy(currentPrice);
                const totalQuantity = oldQuantity.plus(newQuantityToAdd);
                const newEntryPrice = oldEntryPrice
                  .times(oldQuantity)
                  .plus(currentPrice.times(newQuantityToAdd))
                  .dividedBy(totalQuantity);

                // 7. Update DB (Transaction)
                await Database.client.$transaction(async (tx) => {
                  // a. Deduct additional stake
                  await tx.economy.update({
                    where: { userId_guildId: { userId, guildId } },
                    data: { balance: { decrement: additionalStakeDecimal } },
                  });
                  // b. Update position
                  await tx.cryptoPosition.update({
                    where: { id: positionId },
                    data: {
                      entryPrice: newEntryPrice,
                      quantity: totalQuantity,
                      // Leverage remains the same when averaging
                    },
                  });
                });

                // 8. Invalidate Cache
                if (Database.redisClient) {
                  const userCacheKeyFull = Database._cacheKeyUser(
                    guildId,
                    userId,
                    true
                  );
                  const userCacheKeyBasic = Database._cacheKeyUser(
                    guildId,
                    userId,
                    false
                  );
                  await Database._redisDel([
                    userCacheKeyFull,
                    userCacheKeyBasic,
                  ]);
                  Database._logRedis(
                    "del",
                    `${userCacheKeyFull}, ${userCacheKeyBasic}`,
                    "Invalidated user cache on position average"
                  );
                }

                // 9. Send Confirmation and refresh with selected position
                await modalInteraction.editReply(
                  i18n.__("games.crypto2.positionAveragedSuccess", {
                    symbol: freshPosition.symbol,
                    newEntryPrice: newEntryPrice.toFixed(4),
                  })
                );

                // Refresh the main menu with the position still selected
                try {
                  const menuContent =
                    await generateMainMenuWithSelectedPosition(
                      guildId,
                      userId,
                      i18n,
                      originalInteraction,
                      positionId,
                      1 // Start at coin page 1
                    );
                  await message.edit(menuContent);
                } catch (refreshError) {
                  console.error(
                    "Error refreshing menu after averaging position:",
                    refreshError
                  );
                }
              } catch (error) {
                console.error(
                  "Error processing Average modal submission:",
                  error
                );
                if (!modalInteraction.replied && !modalInteraction.deferred) {
                  await modalInteraction
                    .deferReply({ ephemeral: true })
                    .catch(() => {});
                }
                await modalInteraction
                  .editReply(i18n.__("games.crypto2.errorAveragingPosition"))
                  .catch(() => {});
              }
            })
            .catch(async (err) => {
              console.log(
                `Average Modal timed out or failed for user ${userId}:`,
                err.message
              );
              await i
                .followUp({ content: "Modal timed out.", ephemeral: true })
                .catch(() => {});
            });
          // --- End Handle Average Modal ---
        } else if (customId.startsWith(`crypto2_tpsl_`)) {
          // --- Handle TP/SL Modal ---
          const parts = customId.split("_");
          const positionId = parts[2];
          // Extract the current interval from the button ID
          const currentInterval = parts[3] || "15"; // Default to 15m if not present

          const position = await Database.getCryptoPositionById(positionId);
          if (
            !position ||
            position.userId !== userId ||
            position.guildId !== guildId
          ) {
            await i.followUp({
              content: "Position not found or you don't own it.",
              ephemeral: true,
            });
            return;
          }

          const modalSubmitId = `crypto2_tpsl_modal_${positionId}_${currentInterval}_${i.id}`; // Include interval in modal ID
          const modal = new ModalBuilder().setCustomId(modalSubmitId).setTitle(
            i18n.__("games.crypto2.setTpslModalTitle", {
              symbol: position.symbol,
            })
          );

          // Create properly configured TP/SL inputs
          const tpInput = new TextInputBuilder()
            .setCustomId(`tpInput_${positionId}`)
            .setLabel(i18n.__("games.crypto2.takeProfitInputLabel"))
            .setStyle(TextInputStyle.Short)
            .setPlaceholder(position.entryPrice.toString())
            .setRequired(false);

          const slInput = new TextInputBuilder()
            .setCustomId(`slInput_${positionId}`)
            .setLabel(i18n.__("games.crypto2.stopLossInputLabel"))
            .setStyle(TextInputStyle.Short)
            .setPlaceholder(position.entryPrice.toString())
            .setRequired(false);

          modal.addComponents(
            new ActionRowBuilder().addComponents(tpInput),
            new ActionRowBuilder().addComponents(slInput)
          );

          await i.showModal(modal);

          // Wait for submission
          i.awaitModalSubmit({
            filter: (modalInteraction) =>
              modalInteraction.customId === modalSubmitId &&
              modalInteraction.user.id === userId,
            time: modalTimeoutDuration,
          })
            .then(async (modalInteraction) => {
              await modalInteraction.deferReply({ ephemeral: true });
              try {
                // 1. Get Data
                const tpString = modalInteraction.fields
                  .getTextInputValue(`tpInput_${positionId}`)
                  .trim();
                const slString = modalInteraction.fields
                  .getTextInputValue(`slInput_${positionId}`)
                  .trim();

                // 2. Fetch position again (to be safe)
                const freshPosition = await Database.getCryptoPositionById(
                  positionId
                );
                if (!freshPosition || freshPosition.userId !== userId) {
                  await modalInteraction.editReply(
                    "Position not found or changed."
                  );
                  return;
                }

                // 3. Validate TP/SL Prices (using modalInteraction.editReply)
                let tpPrice = null;
                let slPrice = null;
                if (tpString) {
                  tpPrice = new Prisma.Decimal(parseFloat(tpString));

                  // Validate TP based on position direction
                  if (
                    freshPosition.direction === "LONG" &&
                    tpPrice.lte(freshPosition.entryPrice)
                  ) {
                    await modalInteraction.editReply(
                      i18n.__("games.crypto2.errorInvalidTpPrice")
                    );
                    return;
                  } else if (
                    freshPosition.direction === "SHORT" &&
                    tpPrice.gte(freshPosition.entryPrice)
                  ) {
                    await modalInteraction.editReply(
                      i18n.__("games.crypto2.errorInvalidTpPrice")
                    );
                    return;
                  }
                }
                if (slString) {
                  slPrice = new Prisma.Decimal(parseFloat(slString));

                  // Validate SL based on position direction
                  if (
                    freshPosition.direction === "LONG" &&
                    slPrice.gte(freshPosition.entryPrice)
                  ) {
                    await modalInteraction.editReply(
                      i18n.__("games.crypto2.errorInvalidSlPrice")
                    );
                    return;
                  } else if (
                    freshPosition.direction === "SHORT" &&
                    slPrice.lte(freshPosition.entryPrice)
                  ) {
                    await modalInteraction.editReply(
                      i18n.__("games.crypto2.errorInvalidSlPrice")
                    );
                    return;
                  }
                }

                // 4. Update DB
                await Database.updateCryptoPosition(positionId, {
                  takeProfitPrice: tpPrice,
                  stopLossPrice: slPrice,
                });

                // 5. Send confirmation and refresh with selected position
                await modalInteraction.editReply(
                  i18n.__("games.crypto2.tpslSetSuccess", {
                    symbol: freshPosition.symbol,
                  })
                );

                // Refresh the main menu with the position still selected
                try {
                  const menuContent =
                    await generateMainMenuWithSelectedPosition(
                      guildId,
                      userId,
                      i18n,
                      originalInteraction,
                      positionId,
                      1 // Start at coin page 1
                    );
                  await message.edit(menuContent);
                } catch (refreshError) {
                  console.error(
                    "Error refreshing menu after setting TP/SL:",
                    refreshError
                  );
                }
              } catch (error) {
                console.error(
                  "Error processing TP/SL modal submission:",
                  error
                );
                if (!modalInteraction.replied && !modalInteraction.deferred) {
                  await modalInteraction
                    .deferReply({ ephemeral: true })
                    .catch(() => {});
                }
                await modalInteraction
                  .editReply(i18n.__("games.crypto2.errorUpdatingTpsl"))
                  .catch(() => {});
              }
            })
            .catch(async (err) => {
              console.log(
                `TP/SL Modal timed out or failed for user ${userId}:`,
                err.message
              );
              await i
                .followUp({ content: "Modal timed out.", ephemeral: true })
                .catch(() => {});
            });
          // --- End Handle TP/SL Modal ---
        } else if (customId === `crypto2_back_${userId}`) {
          await i.deferUpdate();
          try {
            // Regenerate the main menu (which will reset all components)
            const menuContent = await generateMainMenuContent(
              guildId,
              userId,
              i18n,
              originalInteraction,
              1 // Start at coin page 1
            );
            await message.edit(menuContent);
          } catch (error) {
            console.error("Error returning to main menu:", error);
            await i
              .followUp({
                content: "❌ Failed to return to the main menu.",
                ephemeral: true,
              })
              .catch(() => {});
          }
        } else if (customId.startsWith(`crypto2_refresh_${userId}`)) {
          await i.deferUpdate();
          try {
            // First check for liquidations with fresh price data
            const liquidatedPositions = await checkAndLiquidatePositions(
              guildId,
              userId,
              i18n
            );

            if (liquidatedPositions.length > 0) {
              const liquidationMessages = liquidatedPositions
                .map((info) =>
                  i18n.__("games.crypto2.liquidationNotification", info)
                )
                .join("\n");
              await i.followUp({
                content: liquidationMessages,
                ephemeral: true,
              });
            }

            // Then generate refreshed menu with updated prices
            const menuContent = await generateMainMenuContent(
              guildId,
              userId,
              i18n,
              originalInteraction,
              1 // Start at coin page 1
            );

            await message.edit(menuContent);

            // Notify successful refresh
            await i.followUp({
              content: "✅ Portfolio refreshed with latest price data!",
              ephemeral: true,
            });
          } catch (error) {
            console.error("Error refreshing main menu:", error);
            await i
              .followUp({
                content: "❌ Failed to refresh. Please try again.",
                ephemeral: true,
              })
              .catch(() => {});
          }
        }
        if (customId.startsWith(`crypto2_position_select_`)) {
          await i.deferUpdate();
          if (!i.isStringSelectMenu()) return;

          const selectedPositionId = i.values[0];

          try {
            // Fetch the position details
            const position = await Database.getCryptoPositionById(
              selectedPositionId
            );
            if (
              !position ||
              position.userId !== userId ||
              position.guildId !== guildId
            ) {
              await i.followUp({
                content: "Position not found or you don't own it.",
                ephemeral: true,
              });
              return;
            }

            // Generate the main menu with the selected position highlighted
            const menuContent = await generateMainMenuWithSelectedPosition(
              guildId,
              userId,
              i18n,
              originalInteraction,
              selectedPositionId,
              1 // Start at coin page 1
            );

            // Update the message
            await message.edit(menuContent);
          } catch (error) {
            console.error("Error generating position actions:", error);
            await i.followUp({
              content:
                "❌ An error occurred while processing the selected position.",
              ephemeral: true,
            });
          }
        }
        if (customId.startsWith(`crypto2_page_prev_${userId}`)) {
          await i.deferUpdate();
          const newPage = Math.max(1, i.values[0] - 1);
          const menuContent = await generateMainMenuContent(
            guildId,
            userId,
            i18n,
            originalInteraction,
            newPage
          );
          await message.edit(menuContent);
        } else if (customId.startsWith(`crypto2_page_next_${userId}`)) {
          await i.deferUpdate();
          const totalPages = Math.ceil(getValidCmcSymbols().size / 25);
          const newPage = Math.min(totalPages, i.values[0] + 1);
          const menuContent = await generateMainMenuContent(
            guildId,
            userId,
            i18n,
            originalInteraction,
            newPage
          );
          await message.edit(menuContent);
        } else if (customId.startsWith(`crypto2_preview_select_`)) {
          if (!i.isStringSelectMenu()) return;
          const selectedValue = i.values[0];

          try {
            // Check if this is a pagination action
            if (
              selectedValue.startsWith("prev_page_") ||
              selectedValue.startsWith("next_page_")
            ) {
              await i.deferUpdate(); // Only defer update for pagination actions

              // Extract current page and determine new page
              let newPage = 1;
              if (selectedValue.startsWith("prev_page_")) {
                const currentPage = parseInt(selectedValue.split("_")[2]);
                newPage = Math.max(1, currentPage - 1);
              } else {
                const currentPage = parseInt(selectedValue.split("_")[2]);
                newPage = currentPage + 1;
              }

              // Regenerate menu with new page
              const menuContent = await generateMainMenuContent(
                guildId,
                userId,
                i18n,
                originalInteraction,
                newPage
              );
              await message.edit(menuContent);
            } else {
              // This is a coin selection - open trading modal directly
              // Do NOT defer the update here
              const selectedSymbol = selectedValue;

              // Create the trading modal
              const modalSubmitId = `crypto2_open_modal_${i.id}`;
              const modal = new ModalBuilder()
                .setCustomId(modalSubmitId)
                .setTitle(i18n.__("games.crypto2.openPositionModalTitle"));

              const symbolInput = new TextInputBuilder()
                .setCustomId("symbolInput")
                .setLabel(i18n.__("games.crypto2.symbolInputLabel"))
                .setStyle(TextInputStyle.Short)
                .setValue(selectedSymbol) // Pre-fill with selected symbol
                .setRequired(true)
                .setMinLength(6)
                .setMaxLength(15);

              const directionInput = new TextInputBuilder()
                .setCustomId("directionInput")
                .setLabel(i18n.__("games.crypto2.directionInputLabel"))
                .setStyle(TextInputStyle.Short)
                .setPlaceholder("LONG or SHORT")
                .setRequired(true)
                .setMinLength(4)
                .setMaxLength(5);

              const stakeInput = new TextInputBuilder()
                .setCustomId("stakeInput")
                .setLabel(i18n.__("games.crypto2.stakeInputLabel"))
                .setStyle(TextInputStyle.Short)
                .setPlaceholder("e.g., 10.50")
                .setRequired(true);

              const leverageInput = new TextInputBuilder()
                .setCustomId("leverageInput")
                .setLabel(i18n.__("games.crypto2.leverageInputLabel"))
                .setStyle(TextInputStyle.Short)
                .setPlaceholder("e.g., 10")
                .setValue("10")
                .setRequired(true);

              modal.addComponents(
                new ActionRowBuilder().addComponents(symbolInput),
                new ActionRowBuilder().addComponents(directionInput),
                new ActionRowBuilder().addComponents(stakeInput),
                new ActionRowBuilder().addComponents(leverageInput)
              );

              // Show the modal
              await i.showModal(modal);

              // The rest of the code remains the same...
            }
          } catch (error) {
            console.error(`Error handling coin selection:`, error);
            await i.followUp({
              content: `❌ An error occurred processing your selection.`,
              ephemeral: true,
            });
          }
        }
      } catch (error) {
        // --- General Error Handling (remains mostly the same) ---
        console.error(
          `Error handling crypto component interaction ${i?.customId}:`,
          error
        );
        if (i && !i.replied && !i.deferred) {
          // Check if 'i' exists before accessing properties
          await i.deferUpdate().catch(() => {});
        }
        if (i) {
          // Check if 'i' exists
          await i
            .followUp({
              content: "An error occurred processing your action.",
              ephemeral: true,
            })
            .catch(() => {});
        }
        try {
          const menuContent = await generateMainMenuContent(
            guildId,
            userId,
            i18n,
            originalInteraction,
            1 // Start at coin page 1
          );
          await message.edit(menuContent);
        } catch (menuError) {
          /* ... */
        }
      }
    } // End Component Handling
  }); // End collector.on('collect')

  // --- Collector End Handler (remains the same) ---
  collector.on("end", (collected, reason) => {
    if (message.editable) {
      message.edit({ components: [] }).catch((err) => {
        console.error("Failed to disable components on collector end:", err);
      });
    }
    console.log(`Crypto collector ended for ${userId}. Reason: ${reason}`);
  });
} // End setupGameInteractionCollector
