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
} from "discord.js";
import { Prisma } from "@prisma/client"; // Import Prisma Decimal helper
import Database from "../../database/client.js"; // Use the main DB
import { generateImage } from "../../utils/imageGenerator.js";
import {
  getTickers,
  getValidCmcSymbols,
  getCategories,
  getCategoryCoins,
} from "../../utils/cryptoApi.js"; // Import API utilities
import { ComponentBuilder } from "../../utils/componentConverter.js"; // Import ComponentBuilder
import axios from "axios"; // Add axios import

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
    uk: "Ця гра використовує віртуальну валюту бота для симуляції торгівлі на основі реальних ринкових даних. **Це НЕ реальні гроші і НЕ фінансовий радник.** Торгівля пов'язана з ризиком, і минула продуктивність не гарантує майбутніх результатів. Веселової гри!",
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
  selectCategory: {
    en: "Select a coin category...",
    ru: "Выберите категорию монет...",
    uk: "Виберіть категорію монет...",
  },
  categoryLabel: {
    en: "Category: {{category}}",
    ru: "Категория: {{category}}",
    uk: "Категорія: {{category}}",
  },
  selectCategoryPrompt: {
    en: "Please select a category to view available coins",
    ru: "Пожалуйста, выберите категорию для просмотра доступных монет",
    uk: "Будь ласка, виберіть категорію для перегляду доступних монет",
  },
  buttonBackToCategories: {
    // New Key
    en: "⬅️ Back to Categories",
    ru: "⬅️ Назад к Категориям",
    uk: "⬅️ Назад до Категорій",
  },
  selectMenuOptionCatPrev: {
    // New Key
    en: "⬅️ Previous Categories",
    ru: "⬅️ Пред. Категории",
    uk: "⬅️ Попер. Категорії",
  },
  selectMenuOptionCatNext: {
    // New Key
    en: "Next Categories ➡️",
    ru: "След. Категории ➡️",
    uk: "Наст. Категорії ➡️",
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

// --- Helper function to add the coin selection menu ---
// Removed async, as it no longer fetches data directly
function addCoinSelectionMenu(
  builder,
  i18n,
  userId,
  coinPage,
  allTickerData,
  filteredBaseSymbols = null
) {
  // Use filtered symbols if provided, otherwise use all symbols
  const allSymbols =
    filteredBaseSymbols || Array.from(getValidCmcSymbols()).sort();
  const symbolsPerPage = 8; // Max is 10 options, but reserve 2 for prev/next
  const totalCoinPages = Math.ceil(allSymbols.length / symbolsPerPage);
  const startIndex = (coinPage - 1) * symbolsPerPage;
  const endIndex = startIndex + symbolsPerPage;
  const baseSymbolsToShow = allSymbols.slice(startIndex, endIndex);

  // Convert base symbols (BTC) to the format needed for tickers (BTCUSDT)
  const usdtSymbolsToShow = baseSymbolsToShow.map((symbol) => `${symbol}USDT`);

  // Filter symbols using the pre-fetched allTickerData
  let availableSymbols = [];
  if (allTickerData) {
    // Check if ticker data was successfully passed
    availableSymbols = usdtSymbolsToShow.filter(
      (symbol) => allTickerData[symbol] && allTickerData[symbol].lastPrice
    );
  } else {
    console.warn(
      `[crypto2] addCoinSelectionMenu called without valid allTickerData for page ${coinPage}.`
    );
  }

  let coinPreviewOptions = []; // Initialize options array

  // Build options ONLY from available symbols using the passed data
  if (availableSymbols.length > 0 && allTickerData) {
    // Also check allTickerData exists
    coinPreviewOptions = availableSymbols.map((symbol) => {
      const price = allTickerData[symbol]?.lastPrice; // Use pre-fetched data
      const formattedPrice = price
        ? price >= 1
          ? parseFloat(price).toFixed(2)
          : parseFloat(price).toFixed(4)
        : "N/A";
      const label = `${symbol} - $${formattedPrice}`.substring(0, 100);
      return { label, value: symbol };
    });
  }

  // Ensure coinPreviewOptions doesn't exceed 8 (to leave room for pagination)
  if (coinPreviewOptions.length > 8) {
    coinPreviewOptions = coinPreviewOptions.slice(0, 8);
  }

  // Prepare pagination options separately (logic remains the same)
  const paginationOptions = [];
  if (totalCoinPages > 1) {
    if (coinPage > 1) {
      paginationOptions.unshift({
        label:
          i18n.__("games.crypto2.selectMenuOptionPrev") || "⬅️ Previous Page",
        value: `prev_page_${coinPage}`,
      });
    }
    if (coinPage < totalCoinPages) {
      paginationOptions.push({
        label: i18n.__("games.crypto2.selectMenuOptionNext") || "Next Page ➡️",
        value: `next_page_${coinPage}`,
      });
    }
  }

  // Combine coin options and pagination options
  const finalOptions = [...coinPreviewOptions, ...paginationOptions];

  // Add the "Back to Categories" option
  const backOption = {
    label:
      i18n.__("games.crypto2.buttonBackToCategories") ||
      "⬅️ Back to Categories",
    value: `back_to_categories`, // Simple value to identify the back action
  };
  finalOptions.unshift(backOption); // Add it to the beginning

  // Add the select menu ONLY if there are options (either coins or pagination)
  if (finalOptions.length > 0) {
    // Ensure we never exceed 25 options total (Discord limit)
    if (finalOptions.length > 25) {
      console.warn(
        `[crypto2] Too many options (${finalOptions.length}) for coin select menu on page ${coinPage}. Slicing.`
      );
      finalOptions.length = 25;
    }

    builder.addStringSelectMenu(
      `crypto2_coin_select_${userId}_${coinPage}`, // Changed custom ID prefix
      i18n.__("games.crypto2.selectMenuPlaceholder") ||
        "Select a symbol to trade...",
      finalOptions // Use the combined list
    );
  } else if (baseSymbolsToShow.length > 0) {
    // Log if the page had base symbols but none met the criteria or fetched data
    console.log(
      `[crypto2] No available tickers meeting criteria for page ${coinPage}. Base symbols on page: ${baseSymbolsToShow.join(
        ", "
      )}`
    );
    // Optionally, you could add text feedback here if desired:
    // builder.addText("No coins meet the criteria on this page.", "small");
  }
}

// Function to generate the main menu message content
async function generateMainMenu(
  guildId,
  userId,
  i18n,
  interaction,
  page = 1,
  selectedPosition = null,
  selectedCategoryId = null,
  categoryPage = 1 // New parameter for category pagination
) {
  console.log(
    `[generateMainMenu] Received selectedPosition: ${selectedPosition}`
  ); // Log 1
  const userData = await Database.getUser(guildId, userId, true);
  const positions = await Database.getUserCryptoPositions(guildId, userId);

  // Fetch ALL categories initially
  let allCategories = [];
  try {
    allCategories = await getCategories();
    if (!allCategories || !Array.isArray(allCategories)) {
      console.warn("[crypto2] Failed to load coin categories");
      allCategories = [];
    } else {
      // Sort categories alphabetically by name
      allCategories.sort((a, b) => a.name.localeCompare(b.name));
    }
  } catch (error) {
    console.error("[crypto2] Error loading categories:", error);
  }

  // Define variables for coin data
  let filteredBaseSymbols = [];
  let allTickerData = {};

  // Only fetch coins if a category is selected
  if (selectedCategoryId) {
    try {
      const categoryData = await getCategoryCoins(selectedCategoryId);
      if (
        categoryData &&
        categoryData.coins &&
        Array.isArray(categoryData.coins)
      ) {
        // Extract symbols from the category
        const categoryCoins = categoryData.coins.map((coin) => coin.symbol);

        // Only add symbols that are valid from the API mapping
        const validSymbols = new Set(getValidCmcSymbols());
        filteredBaseSymbols = categoryCoins.filter((sym) =>
          validSymbols.has(sym)
        );

        // Only fetch ticker data if we have symbols to fetch
        if (filteredBaseSymbols.length > 0) {
          // Convert to USDT format and fetch prices only for this category's coins
          const symbolsToFetch = filteredBaseSymbols.map((s) => `${s}USDT`);
          console.log(
            `[crypto2] Fetching prices for ${filteredBaseSymbols.length} coins in selected category`
          );

          // Only fetch a reasonable number of symbols at once to avoid rate limits
          const maxSymbolsPerRequest = 100; // Adjust based on API limits

          // Fetch in smaller batches if needed
          if (symbolsToFetch.length <= maxSymbolsPerRequest) {
            allTickerData = (await getTickers(symbolsToFetch)) || {};
          } else {
            // For large categories, only fetch the first batch to avoid rate limits
            const firstBatch = symbolsToFetch.slice(0, maxSymbolsPerRequest);
            allTickerData = (await getTickers(firstBatch)) || {};
            console.log(
              `[crypto2] Category has ${symbolsToFetch.length} coins, only fetched first ${maxSymbolsPerRequest} to avoid rate limits`
            );
          }
        }
      }
    } catch (error) {
      console.error(
        `[crypto2] Error loading coins for category ${selectedCategoryId}:`,
        error
      );
    }
  } else {
    // No category selected, we won't show any coins yet
    console.log("[crypto2] No category selected, skipping coin fetching");
  }

  // Fetch market data for positions (always needed for PnL display)
  let currentPrices = {};
  if (positions.length > 0) {
    const positionSymbols = [...new Set(positions.map((p) => p.symbol))];

    // Check if all position symbols are already in the fetched data
    const allPositionSymbolsPresent = positionSymbols.every(
      (sym) => allTickerData[sym]
    );

    if (allPositionSymbolsPresent) {
      currentPrices = allTickerData;
      console.log("[crypto2] Using category ticker data for positions");
    } else {
      // Need to fetch position data separately
      console.log("[crypto2] Fetching data specifically for open positions");
      const positionTickerData = await getTickers(positionSymbols);
      if (positionTickerData) {
        currentPrices = positionTickerData;
      } else {
        console.error("[crypto2] Failed to fetch ticker data for positions");
        currentPrices = allTickerData || {}; // Fallback
      }
    }
  } else {
    // No positions, can just use the already fetched data
    currentPrices = allTickerData;
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
      // Add translations for position-specific buttons if needed
      closePositionButtonLabel:
        i18n.__("games.crypto2.buttonClosePosition") || "Close Position",
      averagePositionButtonLabel:
        i18n.__("games.crypto2.buttonAveragePosition") || "Average Position",
      setTpSlButtonLabel: i18n.__("games.crypto2.buttonSetTpSl") || "Set TP/SL",
      backButtonLabel: i18n.__("games.crypto2.buttonBack") || "Back",
      // Add category information if selected
      selectedCategory: selectedCategoryId
        ? allCategories.find((c) => c.id === selectedCategoryId)?.name || // Use allCategories
          "Selected Category"
        : null,
    },
    balance: userData?.economy?.balance?.toString() ?? "0.00",
    openPositions: positions.map((p) => {
      // Use currentPrices which now might be from allTickerData or specific fetch
      const currentPriceData = currentPrices[p.symbol];
      const currentPrice =
        currentPriceData?.markPrice || currentPriceData?.lastPrice;
      const pnlPercent = calculatePnlPercent(
        p.entryPrice,
        currentPrice, // Use the potentially missing price
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
        currentPrice, // Use the potentially missing price
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
        pnlPercent: currentPrice ? pnlPercent.toFixed(2) : "N/A",
        stakeValue: stakeValue.toFixed(2), // Stake value doesn't depend on current price
        pnlAmount: currentPrice ? pnlAmount.toFixed(2) : "N/A", // PnL amount depends on current price
      };
    }),
    viewType: "main_menu",
    selectedPositionId: selectedPosition, // Pass the selected position ID
    returnDominant: true,
    // Add data needed for Coin Preview Selector
    coinPage: page,
    // Removed totalCoinPages as it's calculated during menu building
  };

  const [pngBuffer, dominantColor] = await generateImage(
    "Crypto2",
    componentData,
    { image: 1, emoji: 1 },
    i18n // Pass the main i18n object here for generateImage's internal use if needed
  );
  const attachmentName = `crypto_portfolio_${userId}.avif`; // Use .avif

  // --- Build Components using ComponentBuilder ---
  const builder = new ComponentBuilder({
    color: dominantColor?.embedColor ?? process.env.EMBED_COLOR,
  })
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

  // --- Conditional Category / Coin Selection ---
  if (selectedCategoryId) {
    // --- Show Coin Selection for Selected Category ---
    const selectedCategory = allCategories.find(
      (c) => c.id === selectedCategoryId
    );
    if (selectedCategory) {
      // Add category label
      builder.addText(
        i18n.__("games.crypto2.categoryLabel", {
          category: selectedCategory.name,
        }) || `Category: ${selectedCategory.name}`,
        "small"
      );

      // Add coin selection menu (includes back button)
      addCoinSelectionMenu(
        builder,
        i18n,
        userId,
        page,
        allTickerData,
        filteredBaseSymbols
      );
    } else {
      // Should not happen if ID is valid, but handle gracefully
      builder.addText("Error: Could not find selected category info.", "small");
      // Optionally add back the category selector here as a fallback
    }
  } else {
    // --- Show Category Selection ---
    if (allCategories.length > 0) {
      const categoriesPerPage = 23; // Max 25 options - 2 for pagination
      const totalCategoryPages = Math.ceil(
        allCategories.length / categoriesPerPage
      );
      const catStartIndex = (categoryPage - 1) * categoriesPerPage;
      const catEndIndex = catStartIndex + categoriesPerPage;
      const categoriesToShow = allCategories.slice(catStartIndex, catEndIndex);

      let categoryOptions = categoriesToShow.map((category) => ({
        label: category.name.slice(0, 100),
        value: category.id,
        description: `${category.num_tokens} coins`.slice(0, 100),
      }));

      // Add pagination options if needed
      const categoryPaginationOptions = [];
      if (totalCategoryPages > 1) {
        if (categoryPage > 1) {
          categoryPaginationOptions.unshift({
            label:
              i18n.__("games.crypto2.selectMenuOptionCatPrev") ||
              "⬅️ Previous Categories",
            value: `prev_category_page_${categoryPage}`,
          });
        }
        if (categoryPage < totalCategoryPages) {
          categoryPaginationOptions.push({
            label:
              i18n.__("games.crypto2.selectMenuOptionCatNext") ||
              "Next Categories ➡️",
            value: `next_category_page_${categoryPage}`,
          });
        }
      }

      const finalCategoryOptions = [
        ...categoryOptions,
        ...categoryPaginationOptions,
      ];

      // Limit options if needed (shouldn't exceed 25 with the logic above)
      if (finalCategoryOptions.length > 25) {
        console.warn(`[crypto2] Exceeded 25 category options, slicing.`);
        finalCategoryOptions.length = 25;
      }

      if (finalCategoryOptions.length > 0) {
        builder.addStringSelectMenu(
          `crypto2_category_select_${interaction.id}_${categoryPage}`, // Include page in ID
          i18n.__("games.crypto2.selectCategory") ||
            "Select a coin category...",
          finalCategoryOptions // Use the combined list with pagination
        );
      } else {
        builder.addText("No categories found on this page.", "small");
      }
    } else {
      builder.addText("Could not load coin categories.", "small");
    }
  }

  // --- Position Selection (if positions exist) ---
  if (positions.length > 0) {
    let positionOptions = positions.map((p) => {
      // Use currentPrices which now might be from allTickerData or specific fetch
      const currentPriceData = currentPrices[p.symbol];
      const currentPrice =
        currentPriceData?.markPrice || currentPriceData?.lastPrice;
      const pnlPercent = calculatePnlPercent(
        p.entryPrice,
        currentPrice, // Use potentially missing price
        p.direction,
        p.leverage
      );
      const pnlString = currentPrice ? `${pnlPercent.toFixed(2)}%` : "N/A";

      const isDefault = p.id === selectedPosition;
      console.log(
        `[generateMainMenu] Checking position ${p.id} against selected ${selectedPosition}. Is default: ${isDefault}`
      ); // Log 2
      return {
        label: `${p.direction} ${p.symbol} (${p.leverage}x)`,
        description: `Entry: ${p.entryPrice.toFixed(2)} | PnL: ${pnlString}`,
        value: p.id,
        default: isDefault, // Set default based on passed parameter
      };
    });

    // Add string select menu directly
    // Limit position options to 10 to comply with Discord's restrictions
    if (positionOptions.length > 10) {
      positionOptions = positionOptions.slice(0, 10);
    }

    builder.addStringSelectMenu(
      `crypto2_position_select_${userId}`,
      i18n.__("games.crypto2.selectPositionPrompt") ||
        "Select a position to manage...",
      positionOptions
    );
  }

  // --- Add Position Action Buttons if a position is selected ---
  console.log(
    `[generateMainMenu] Checking if selectedPosition (${selectedPosition}) is truthy to add buttons.`
  ); // Log 3
  if (selectedPosition) {
    // Check if the parameter is truthy
    const closeButton = new ButtonBuilder()
      .setCustomId(`crypto2_close_${selectedPosition}`)
      .setLabel(
        i18n.__("games.crypto2.buttonClosePosition") || "Close Position"
      )
      .setStyle(ButtonStyle.Danger);
    const averageButton = new ButtonBuilder()
      .setCustomId(`crypto2_average_${selectedPosition}`)
      .setLabel(
        i18n.__("games.crypto2.buttonAveragePosition") || "Average Position"
      )
      .setStyle(ButtonStyle.Primary);
    const tpslButton = new ButtonBuilder()
      .setCustomId(`crypto2_tpsl_${selectedPosition}`)
      .setLabel(i18n.__("games.crypto2.buttonSetTpSl") || "Set TP/SL")
      .setStyle(ButtonStyle.Success);
    const backButton = new ButtonBuilder()
      .setCustomId(`crypto2_back_${userId}`) // Back button resets selection
      .setLabel(i18n.__("games.crypto2.buttonBack") || "Back")
      .setStyle(ButtonStyle.Secondary);

    const actionRow = new ActionRowBuilder().addComponents(
      closeButton,
      averageButton,
      tpslButton,
      backButton
    );
    builder.addActionRow(actionRow);
    // Add separator after position actions - REMOVED to stay within limit
    // builder.addSeparator();
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
    // --- Test MEXC API Connectivity ---
    await testMexcApi(); // Add the test call here

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
          const initialContent = await generateMainMenu(
            // Updated call
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
        const initialContent = await generateMainMenu(
          // Updated call
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

// --- Helper function to test MEXC API connectivity ---
async function testMexcApi() {
  try {
    const MEXC_API_BASE_URL = "https://api.mexc.com";
    const response = await axios.get(`${MEXC_API_BASE_URL}/api/v3/time`);
    if (response.status === 200 && response.data && response.data.serverTime) {
      console.log(
        `[crypto2] MEXC API Test successful. Server Time: ${response.data.serverTime}`
      );
      return true;
    } else {
      console.warn(
        `[crypto2] MEXC API Test failed. Status: ${response.status}, Data:`,
        response.data
      );
      return false;
    }
  } catch (error) {
    console.error(
      "[crypto2] Error during MEXC API Test:",
      error.message || error
    );
    return false;
  }
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

  // --- State for the collector ---
  let currentSelectedCategoryId = null; // Keep track of the selected category
  let currentCategoryPage = 1; // Keep track of the category page
  let currentSelectedPositionId = null; // Keep track of the selected position

  collector.on("collect", async (i) => {
    // let currentCoinPage = 1; // Page state handled within generateMainMenu
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

                // 9. Refresh the main menu view (reset category)
                try {
                  currentSelectedCategoryId = null; // Reset category after opening position
                  currentSelectedPositionId = null; // Clear selected position
                  const menuContent = await generateMainMenu(
                    guildId,
                    userId,
                    i18n,
                    originalInteraction,
                    1, // Start at coin page 1
                    currentSelectedPositionId, // Pass null (cleared above)
                    null, // No category selected
                    1 // Start at category page 1
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
            currentSelectedPositionId = null; // Clear selected position
            const menuContent = await generateMainMenu(
              guildId,
              userId,
              i18n,
              originalInteraction,
              1, // Start at coin page 1
              null, // Pass null directly instead of using the state variable
              currentSelectedCategoryId, // Keep current category if one was selected
              currentCategoryPage // Keep category page
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
          // Extract position ID from customId (format: crypto2_average_POSITION_ID)
          const parts = customId.split("_");
          const positionId = parts[2];

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

            // Create the Average Modal
            const modalSubmitId = `crypto2_average_modal_${i.id}`;
            const modal = new ModalBuilder()
              .setCustomId(modalSubmitId)
              .setTitle(i18n.__("games.crypto2.averageModalTitle"));

            const averagePriceInput = new TextInputBuilder()
              .setCustomId("averagePriceInput")
              .setLabel(i18n.__("games.crypto2.averagePriceInputLabel"))
              .setStyle(TextInputStyle.Short)
              .setPlaceholder("e.g., 20000")
              .setRequired(true);

            modal.addComponents(
              new ActionRowBuilder().addComponents(averagePriceInput)
            );

            // Show the modal
            await i.showModal(modal);

            // Handle modal submission
            i.awaitModalSubmit({
              filter: (modalInteraction) =>
                modalInteraction.customId === modalSubmitId &&
                modalInteraction.user.id === userId,
              time: modalTimeoutDuration,
            })
              .then(async (modalInteraction) => {
                await modalInteraction.deferReply({ ephemeral: true });
                try {
                  // Get Modal Data
                  const averagePriceString = modalInteraction.fields
                    .getTextInputValue("averagePriceInput")
                    .trim();

                  // Validate Input
                  const averagePrice = parseFloat(averagePriceString);
                  if (isNaN(averagePrice) || averagePrice <= 0) {
                    await modalInteraction.editReply(
                      i18n.__("games.crypto2.errorInvalidAveragePrice")
                    );
                    return;
                  }

                  // Update the position's average price
                  await Database.client.cryptoPosition.update({
                    where: { id: position.id },
                    data: { averagePrice: new Prisma.Decimal(averagePrice) },
                  });

                  // Send Success Confirmation
                  await modalInteraction.editReply(
                    i18n.__("games.crypto2.averagePriceSetSuccess", {
                      symbol: position.symbol,
                      averagePrice,
                    })
                  );

                  // Refresh the main menu with the position still selected
                  try {
                    currentSelectedPositionId = position.id; // Keep position selected
                    const menuContent = await generateMainMenu(
                      guildId,
                      userId,
                      i18n,
                      originalInteraction,
                      1, // Start page 1 for coins in this category
                      position.id, // Pass position.id directly instead of the state variable
                      currentSelectedCategoryId, // Keep category selected
                      currentCategoryPage // Keep category page
                    );
                    await message.edit(menuContent);
                  } catch (refreshError) {
                    console.error(
                      "Error refreshing main menu after setting average price:",
                      refreshError
                    );
                  }
                } catch (error) {
                  console.error(
                    "Error processing average price modal submission:",
                    error
                  );
                  if (!modalInteraction.replied && !modalInteraction.deferred) {
                    await modalInteraction
                      .deferReply({ ephemeral: true })
                      .catch(() => {});
                  }
                  await modalInteraction
                    .editReply(
                      i18n.__("games.crypto2.errorSettingAveragePrice")
                    )
                    .catch(() => {});
                }
              })
              .catch(async (err) => {
                console.log(
                  `Average Price Modal timed out or failed for user ${userId}:`,
                  err.message
                );
                await i
                  .followUp({ content: "Modal timed out.", ephemeral: true })
                  .catch(() => {});
              });
          } catch (error) {
            console.error(`Error opening average price modal:`, error);
            await i.followUp({
              content:
                "❌ An error occurred while opening the average price modal.",
              ephemeral: true,
            });
          }
        } else if (customId.startsWith(`crypto2_tpsl_`)) {
          // Extract position ID from customId (format: crypto2_tpsl_POSITION_ID)
          const parts = customId.split("_");
          const positionId = parts[2];

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

            // Create the TP/SL Modal
            const modalSubmitId = `crypto2_tpsl_modal_${i.id}`;
            const modal = new ModalBuilder()
              .setCustomId(modalSubmitId)
              .setTitle(i18n.__("games.crypto2.tpslModalTitle"));

            const tpInput = new TextInputBuilder()
              .setCustomId("tpInput")
              .setLabel(i18n.__("games.crypto2.tpInputLabel"))
              .setStyle(TextInputStyle.Short)
              .setPlaceholder("e.g., 20000")
              .setRequired(false);

            const slInput = new TextInputBuilder()
              .setCustomId("slInput")
              .setLabel(i18n.__("games.crypto2.slInputLabel"))
              .setStyle(TextInputStyle.Short)
              .setPlaceholder("e.g., 19000")
              .setRequired(false);

            modal.addComponents(
              new ActionRowBuilder().addComponents(tpInput),
              new ActionRowBuilder().addComponents(slInput)
            );

            // Show the modal
            await i.showModal(modal);

            // Handle modal submission
            i.awaitModalSubmit({
              filter: (modalInteraction) =>
                modalInteraction.customId === modalSubmitId &&
                modalInteraction.user.id === userId,
              time: modalTimeoutDuration,
            })
              .then(async (modalInteraction) => {
                await modalInteraction.deferReply({ ephemeral: true });
                try {
                  // Get Modal Data
                  const tpString = modalInteraction.fields
                    .getTextInputValue("tpInput")
                    .trim();
                  const slString = modalInteraction.fields
                    .getTextInputValue("slInput")
                    .trim();

                  // Validate Input
                  const tp = parseFloat(tpString);
                  const sl = parseFloat(slString);
                  if ((isNaN(tp) || tp <= 0) && (isNaN(sl) || sl <= 0)) {
                    await modalInteraction.editReply(
                      i18n.__("games.crypto2.errorInvalidTpSl")
                    );
                    return;
                  }

                  // Update the position's TP/SL
                  const updateData = {};
                  if (!isNaN(tp) && tp > 0) {
                    updateData.takeProfit = new Prisma.Decimal(tp);
                  }
                  if (!isNaN(sl) && sl > 0) {
                    updateData.stopLoss = new Prisma.Decimal(sl);
                  }
                  await Database.client.cryptoPosition.update({
                    where: { id: position.id },
                    data: updateData,
                  });

                  // Send Success Confirmation
                  const confirmationMessage = [];
                  if (!isNaN(tp) && tp > 0) {
                    confirmationMessage.push(
                      i18n.__("games.crypto2.tpSetSuccess", { tp })
                    );
                  }
                  if (!isNaN(sl) && sl > 0) {
                    confirmationMessage.push(
                      i18n.__("games.crypto2.slSetSuccess", { sl })
                    );
                  }
                  await modalInteraction.editReply(
                    confirmationMessage.join("\n")
                  );

                  // Refresh the main menu with the position still selected
                  try {
                    currentSelectedPositionId = position.id; // Keep position selected
                    const menuContent = await generateMainMenu(
                      guildId,
                      userId,
                      i18n,
                      originalInteraction,
                      1, // Start page 1 for coins
                      position.id, // Pass position.id directly instead of the state variable
                      currentSelectedCategoryId, // Keep category selected
                      currentCategoryPage // Keep category page
                    );
                    await message.edit(menuContent);
                  } catch (refreshError) {
                    console.error(
                      "Error refreshing main menu after setting TP/SL:",
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
                    .editReply(i18n.__("games.crypto2.errorSettingTpSl"))
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
          } catch (error) {
            console.error(`Error opening TP/SL modal:`, error);
            await i.followUp({
              content: "❌ An error occurred while opening the TP/SL modal.",
              ephemeral: true,
            });
          }
        } else if (customId === `crypto2_back_${userId}`) {
          // Back button (typically for selected position)
          await i.deferUpdate();
          try {
            // Regenerate the main menu, keeping category if selected
            currentSelectedPositionId = null; // Clear selected position
            const menuContent = await generateMainMenu(
              guildId,
              userId,
              i18n,
              originalInteraction,
              1, // Start at coin page 1
              currentSelectedPositionId, // Pass null (cleared above)
              currentSelectedCategoryId, // Keep current category
              currentCategoryPage // Keep category page
            );
            await message.edit(menuContent);
          } catch (error) {
            console.error(`Error handling back button:`, error);
            await i.followUp({
              content: "❌ An error occurred while handling the back button.",
              ephemeral: true,
            });
          }
        } else if (customId.startsWith(`crypto2_refresh_${userId}`)) {
          await i.deferUpdate();
          try {
            // Liquidation check
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

            // Then generate refreshed menu with updated prices
            currentSelectedPositionId = null; // Refresh clears selected position
            const menuContent = await generateMainMenu(
              guildId,
              userId,
              i18n,
              originalInteraction,
              1, // Start at coin page 1
              currentSelectedPositionId, // Pass null (cleared above)
              currentSelectedCategoryId, // Keep category selected
              currentCategoryPage // Keep category page
            );

            await message.edit(menuContent);
          } catch (error) {
            console.error(`Error refreshing menu:`, error);
            await i.followUp({
              content: "❌ An error occurred while refreshing the menu.",
              ephemeral: true,
            });
          }
        }
        // --- Position Select Menu Handler (Unchanged) ---
        if (customId.startsWith(`crypto2_position_select_`)) {
          await i.deferUpdate();
          if (!i.isStringSelectMenu()) return;
          const selectedPositionId = i.values[0];
          console.log(`[Collector] Position selected: ${selectedPositionId}`); // Log 4
          currentSelectedPositionId = selectedPositionId; // Update state
          try {
            // Fetch the position details (optional, could remove if not needed for validation here)
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
            const menuContent = await generateMainMenu(
              guildId,
              userId,
              i18n,
              originalInteraction,
              1, // Start at coin page 1
              selectedPositionId, // Pass the selected position ID directly, not the state variable
              currentSelectedCategoryId, // Keep current category
              currentCategoryPage // Keep category page
            );
            await message.edit(menuContent);
          } catch (error) {
            console.error("Error handling position selection:", error);
            await i.followUp({
              content: "❌ An error occurred while selecting the position.",
              ephemeral: true,
            });
          }
        }

        // --- Category Select Menu Handler ---
        if (customId.startsWith(`crypto2_category_select_`)) {
          await i.deferUpdate();
          if (!i.isStringSelectMenu()) return;

          const selectedValue = i.values[0];

          // Handle Pagination First
          if (selectedValue.startsWith("prev_category_page_")) {
            const pageParts = selectedValue.split("_");
            const currentPage = parseInt(pageParts[pageParts.length - 1]) || 1;
            currentCategoryPage = Math.max(1, currentPage - 1);
            currentSelectedCategoryId = null; // Ensure no category is selected when paginating
          } else if (selectedValue.startsWith("next_category_page_")) {
            const pageParts = selectedValue.split("_");
            const currentPage = parseInt(pageParts[pageParts.length - 1]) || 1;
            currentCategoryPage = currentPage + 1; // Max page check is in generateMainMenu
            currentSelectedCategoryId = null; // Ensure no category is selected when paginating
          } else {
            // It's a category selection
            currentSelectedCategoryId = selectedValue; // Update state
            currentCategoryPage = 1; // Reset category page when selecting a category
          }

          // Generate menu with updated category/page state
          try {
            const menuContent = await generateMainMenu(
              guildId,
              userId,
              i18n,
              originalInteraction,
              1, // Reset to coin page 1
              null, // Clear selected position
              currentSelectedCategoryId, // Pass the potentially updated category ID
              currentCategoryPage // Pass the potentially updated category page
            );
            await message.edit(menuContent);
          } catch (error) {
            console.error("Error generating category view:", error);
            await i.followUp({
              content: "❌ Failed to load category coins.",
              ephemeral: true,
            });
          }
        }

        // --- Coin Select Menu Handler (within a category) ---
        if (customId.startsWith(`crypto2_coin_select_`)) {
          if (!i.isStringSelectMenu()) return;
          const selectedValue = i.values[0];
          const parts = customId.split("_");
          const currentPage = parseInt(parts[parts.length - 1]) || 1;

          try {
            // --- Handle Back to Categories ---
            if (selectedValue === "back_to_categories") {
              await i.deferUpdate();
              currentSelectedCategoryId = null; // Reset category state
              currentSelectedPositionId = null; // Clear position state
              const menuContent = await generateMainMenu(
                guildId,
                userId,
                i18n,
                originalInteraction,
                1, // Reset page
                null, // No position selected
                null, // Pass null category ID to show category list
                1 // Reset category page
              );
              await message.edit(menuContent);
            }
            // --- Handle Pagination ---
            else if (
              selectedValue.startsWith("prev_page_") ||
              selectedValue.startsWith("next_page_")
            ) {
              await i.deferUpdate();
              let newPage = 1;
              if (selectedValue.startsWith("prev_page_")) {
                newPage = Math.max(1, currentPage - 1);
              } else {
                newPage = currentPage + 1; // Max page check done in generateMainMenu
              }

              // Regenerate menu with new page, keeping category
              const menuContent = await generateMainMenu(
                guildId,
                userId,
                i18n,
                originalInteraction,
                newPage, // Use new page number
                null, // No position selected when paginating coins
                currentSelectedCategoryId, // KEEP category selected
                currentCategoryPage // Keep category page
              );
              await message.edit(menuContent);
            }
            // --- Handle Coin Selection ---
            else {
              // This is a coin selection - open trading modal directly
              // Do NOT defer the update here
              const selectedSymbol = selectedValue;

              // Create the trading modal
              const modalSubmitId = `crypto2_open_modal_${i.id}`;
              const modal = new ModalBuilder()
                .setCustomId(modalSubmitId)
                .setTitle(
                  i18n.__("games.crypto2.openPositionModalTitle") ||
                    "Open New Position"
                ); // Fallback

              const symbolInput = new TextInputBuilder()
                .setCustomId("symbolInput")
                .setLabel(
                  i18n.__("games.crypto2.symbolInputLabel") ||
                    "Symbol (e.g., BTCUSDT)"
                ) // Fallback
                .setStyle(TextInputStyle.Short)
                .setValue(selectedSymbol) // Pre-fill with selected symbol
                .setRequired(true)
                .setMinLength(6)
                .setMaxLength(15);

              const directionInput = new TextInputBuilder()
                .setCustomId("directionInput")
                .setLabel(
                  i18n.__("games.crypto2.directionInputLabel") ||
                    "Direction (LONG or SHORT)"
                ) // Fallback
                .setStyle(TextInputStyle.Short)
                .setPlaceholder("LONG or SHORT")
                .setRequired(true)
                .setMinLength(4)
                .setMaxLength(5);

              const stakeInput = new TextInputBuilder()
                .setCustomId("stakeInput")
                .setLabel(
                  i18n.__("games.crypto2.stakeInputLabel") || "Stake Amount"
                ) // Fallback
                .setStyle(TextInputStyle.Short)
                .setPlaceholder("e.g., 10.50")
                .setRequired(true);

              const leverageInput = new TextInputBuilder()
                .setCustomId("leverageInput")
                .setLabel(
                  i18n.__("games.crypto2.leverageInputLabel") ||
                    "Leverage (e.g., 10)"
                ) // Fallback
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

              // Handle modal submission
              i.awaitModalSubmit({
                filter: (modalInteraction) =>
                  modalInteraction.customId === modalSubmitId &&
                  modalInteraction.user.id === userId,
                time: modalTimeoutDuration, // Restore the time parameter
              }).then(async (modalInteraction) => {
                // --- Start: Re-inserted Modal Processing Logic ---
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
                      i18n.__("games.crypto2.errorInvalidSymbol") ||
                        "Invalid symbol format."
                    );
                    return;
                  }
                  if (direction !== "LONG" && direction !== "SHORT") {
                    await modalInteraction.editReply(
                      i18n.__("games.crypto2.errorInvalidDirection") ||
                        "Invalid direction."
                    );
                    return;
                  }
                  const stake = parseFloat(stakeString);
                  if (isNaN(stake) || stake <= 0) {
                    await modalInteraction.editReply(
                      i18n.__("games.crypto2.errorInvalidStake") ||
                        "Invalid stake."
                    );
                    return;
                  }
                  const leverage = parseInt(leverageString);
                  if (isNaN(leverage) || leverage <= 0 || leverage > 100) {
                    await modalInteraction.editReply(
                      i18n.__("games.crypto2.errorInvalidLeverage") ||
                        "Invalid leverage."
                    );
                    return;
                  }

                  // 3. Check Balance
                  const userData = await Database.getUser(
                    guildId,
                    userId,
                    true
                  );
                  const userBalance = new Prisma.Decimal(
                    userData?.economy?.balance ?? 0
                  );
                  const stakeDecimal = new Prisma.Decimal(stake);
                  if (userBalance.lt(stakeDecimal)) {
                    await modalInteraction.editReply(
                      i18n.__("games.crypto2.errorInsufficientBalance") ||
                        "Insufficient balance."
                    );
                    return;
                  }

                  // 4. Fetch Current Price
                  const tickerData = await getTickers([symbol]);
                  if (!tickerData || !tickerData[symbol]) {
                    await modalInteraction.editReply(
                      i18n.__("games.crypto2.errorApiSymbolNotFound", {
                        symbol,
                      }) || `Cannot find data for ${symbol}.`
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
                    }) || `✅ Position opened for ${symbol}.` // Fallback
                  );
                } catch (error) {
                  console.error(
                    `[DEBUG] Error processing modal ${modalInteraction.customId}:`,
                    error
                  );
                  if (!modalInteraction.replied && !modalInteraction.deferred) {
                    await modalInteraction
                      .deferReply({ ephemeral: true })
                      .catch(() => {});
                  }
                  await modalInteraction
                    .editReply(
                      i18n.__("games.crypto2.errorCreatingPosition") ||
                        "Error creating position."
                    ) // Fallback
                    .catch(() => {});
                }
                // --- End: Re-inserted Modal Processing Logic ---

                // 9. Refresh the main menu view (reset category)
                try {
                  currentSelectedCategoryId = null; // Reset category state after trade
                  currentSelectedPositionId = null; // Clear selected position
                  const menuContent = await generateMainMenu(
                    guildId,
                    userId,
                    i18n,
                    originalInteraction,
                    1, // Reset page
                    currentSelectedPositionId, // Pass null (cleared above)
                    null, // Reset category ID
                    1 // Reset category page
                  );
                  await message.edit(menuContent);
                } catch (refreshError) {
                  console.error(
                    "Failed to refresh menu after trade:",
                    refreshError
                  );
                }
              });
            }
          } catch (error) {
            console.error(`Error handling coin selection/pagination:`, error);
            await i.followUp({
              content: `❌ An error occurred processing your selection.`,
              ephemeral: true,
            });
          }
        }
      } catch (error) {
        // --- General Error Handling ---
        console.error(
          `Error handling crypto component interaction ${i?.customId}:`,
          error
        );
        if (i && !i.replied && !i.deferred) {
          // Check if 'i' exists before accessing properties
          await i.deferUpdate().catch(() => {}); // Attempt to defer if not already
        }
        if (i) {
          // Check if 'i' exists before trying to follow up
          await i
            .followUp({
              content: "An error occurred processing your action.",
              ephemeral: true,
            })
            .catch(() => {
              console.error(
                `Failed to send follow-up error message for interaction ${i?.customId}`
              );
            });
        }
        // Optionally, try to reset the menu to a safe state
        try {
          currentSelectedCategoryId = null; // Reset state on error
          currentSelectedPositionId = null; // Reset state on error
          const menuContent = await generateMainMenu(
            guildId,
            userId,
            i18n,
            originalInteraction,
            1, // Start at coin page 1
            currentSelectedPositionId, // Pass null (cleared above)
            null, // No category selected
            1 // Start at category page 1
          );
          await message.edit(menuContent).catch((menuError) => {
            console.error("Failed to reset menu after error:", menuError);
          });
        } catch (menuError) {
          console.error(
            "Failed to generate reset menu after error:",
            menuError
          );
        }
      } // End of main try...catch block for interaction handling
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
}
