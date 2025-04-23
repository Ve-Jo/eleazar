import {
  SlashCommandSubcommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  AttachmentBuilder,
  ComponentType,
  InteractionType,
} from "discord.js";
import { Prisma } from "@prisma/client"; // Import Prisma Decimal helper
import Database from "../../database/client.js"; // Use the main DB
import { generateImage } from "../../utils/imageGenerator.js";
import { getTickers, getKline } from "../../utils/cryptoApi.js"; // Import API utilities
import { generateCandlestickChart } from "../../utils/chartGenerator.js"; // Import the chart utility

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
async function generateMainMenuContent(guildId, userId, i18n, interaction) {
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

  // Fetch market data for top gainers/losers
  // Get data for common cryptocurrencies
  const commonSymbols = [
    "BTCUSDT",
    "ETHUSDT",
    "BNBUSDT",
    "XRPUSDT",
    "ADAUSDT",
    "DOGEUSDT",
    "SOLUSDT",
    "MATICUSDT",
    "DOTUSDT",
    "LTCUSDT",
    "AVAXUSDT",
    "LINKUSDT",
    "UNIUSDT",
    "ATOMUSDT",
    "ETCUSDT",
    "TONUSDT",
    "SOLUSDT",
  ];

  const marketData = await getTickers(commonSymbols);

  // Calculate 24h change and prepare market movers data
  const marketMovers = { gainers: [], losers: [] };

  if (marketData) {
    // Create an array of coins with their price change
    const coins = Object.values(marketData).map((ticker) => ({
      symbol: ticker.symbol,
      // Use price24hPcnt if available, otherwise calculate a random change for the demo
      change: ticker.price24hPcnt
        ? parseFloat(ticker.price24hPcnt) * 100
        : Math.random() * 20 - 10,
      // Add volume data
      volume:
        ticker.volume24h || ticker.turnover24h || Math.random() * 50000000,
    }));

    // Sort by change
    const sortedCoins = [...coins].sort((a, b) => b.change - a.change);

    // Get top 3 gainers and losers
    marketMovers.gainers = sortedCoins.slice(0, 3);
    marketMovers.losers = sortedCoins.slice(-3).reverse();
  } else {
    // Fallback data if API fails
    marketMovers.gainers = [
      { symbol: "BTCUSDT", change: 4.2, volume: 23500000 },
      { symbol: "ETHUSDT", change: 3.8, volume: 12800000 },
      { symbol: "SOLUSDT", change: 2.7, volume: 8900000 },
    ];
    marketMovers.losers = [
      { symbol: "DOGEUSDT", change: -3.5, volume: 5600000 },
      { symbol: "XRPUSDT", change: -2.6, volume: 4200000 },
      { symbol: "ADAUSDT", change: -1.8, volume: 3100000 },
    ];
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
      marketMoversLabel:
        i18n.__("games.crypto2.common.marketMovers") || "Market Movers",
      topGainersLabel:
        i18n.__("games.crypto2.common.topGainers") || "Top Gainers",
      topLosersLabel: i18n.__("games.crypto2.common.topLosers") || "Top Losers",
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

      return {
        id: p.id, // Pass position ID
        symbol: p.symbol,
        direction: p.direction,
        entryPrice: p.entryPrice.toString(),
        quantity: p.quantity.toString(),
        leverage: p.leverage,
        pnlPercent: pnlPercent.toFixed(2),
        stakeValue: stakeValue.toFixed(2), // Pass calculated stake value
      };
    }),
    viewType: "main_menu",
    marketMovers: marketMovers, // Add market movers data to component props
  };

  const pngBuffer = await generateImage(
    "Crypto2",
    componentData,
    { image: 1, emoji: 1 },
    i18n // Pass the main i18n object here for generateImage's internal use if needed
  );
  const embed = new EmbedBuilder()
    .setTitle(i18n.__("games.crypto2.mainMenuTitle"))
    .setImage(`attachment://crypto_portfolio_${userId}.png`);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`crypto2_view_${userId}`)
      .setLabel(i18n.__("games.crypto2.buttonViewPositions"))
      .setStyle(ButtonStyle.Primary)
      .setDisabled(positions.length === 0),
    new ButtonBuilder()
      .setCustomId(`crypto2_open_${userId}`)
      .setLabel(i18n.__("games.crypto2.buttonOpenPosition"))
      .setStyle(ButtonStyle.Success)
  );

  // Add coin selection dropdown row
  const popularCoins = [
    { symbol: "BTCUSDT", name: "Bitcoin" },
    { symbol: "ETHUSDT", name: "Ethereum" },
    { symbol: "SOLUSDT", name: "Solana" },
    { symbol: "BNBUSDT", name: "Binance Coin" },
    { symbol: "XRPUSDT", name: "Ripple" },
    { symbol: "DOGEUSDT", name: "Dogecoin" },
    { symbol: "ADAUSDT", name: "Cardano" },
    { symbol: "MATICUSDT", name: "Polygon" },
  ];

  const coinSelectMenu = new StringSelectMenuBuilder()
    .setCustomId(`crypto2_select_coin_${userId}`)
    .setPlaceholder(
      i18n.__("games.crypto2.coinPreview.selectCoinPrompt") ||
        "Preview a coin chart..."
    )
    .addOptions(
      popularCoins.map((coin) => ({
        label: `${coin.name} (${coin.symbol.replace("USDT", "")})`,
        value: coin.symbol,
        // Add emoji if you have them configured
        // emoji: coin.emoji
      }))
    );

  const coinSelectRow = new ActionRowBuilder().addComponents(coinSelectMenu);

  return {
    embeds: [embed],
    files: [{ attachment: pngBuffer, name: `crypto_portfolio_${userId}.png` }],
    components: [row, coinSelectRow],
  };
}

// Function to generate the chart view content
async function generateChartViewContent(
  guildId,
  userId,
  positionId,
  i18n,
  interaction,
  interval = "15"
) {
  const position = await Database.getCryptoPositionById(positionId);
  if (!position) {
    throw new Error(`Position ${positionId} not found.`);
  }
  const userData = await Database.getUser(guildId, userId, true);
  const tickerData = await getTickers([position.symbol]);

  // Fetch K-line data with the specified interval
  const klineData = await getKline(position.symbol, interval, 100); // Use the interval parameter

  if (!tickerData || !tickerData[position.symbol] || klineData === null) {
    throw new Error(`Failed to fetch market/chart data for ${position.symbol}`);
  }
  const currentPrice = new Prisma.Decimal(
    tickerData[position.symbol].markPrice ||
      tickerData[position.symbol].lastPrice
  );
  const pnlPercent = calculatePnlPercent(
    position.entryPrice, // DB Decimal
    currentPrice, // Already Decimal
    position.direction,
    position.leverage
  );
  const pnlAmount = calculatePnlAmount(
    position.entryPrice, // DB Decimal
    currentPrice, // Already Decimal
    position.quantity, // DB Decimal
    position.direction
  );

  // --- Generate Chart Image ---
  const chartImageURI = await generateCandlestickChart(
    klineData,
    position.symbol,
    {
      takeProfitPrice: position.takeProfitPrice?.toString() || null,
      stopLossPrice: position.stopLossPrice?.toString() || null,
      entryPrice: position.entryPrice.toString(),
      direction: position.direction,
    }
  );
  if (!chartImageURI) {
    console.warn(`Failed to generate chart image for ${position.symbol}`);
    // Proceed without chart image, component will show placeholder
  }
  // --- End Chart Generation ---

  // Ensure we have a valid avatarURL or provide a fallback
  let avatarURL = null;
  if (interaction && interaction.user && interaction.user.displayAvatarURL) {
    avatarURL = interaction.user.displayAvatarURL({
      extension: "png",
      size: 128,
    });
  }

  console.log(
    `[crypto2.js] Generating chart view with interval: "${interval}"`
  );

  const componentData = {
    interaction: {
      user: {
        id: userId,
        avatarURL:
          avatarURL || "https://cdn.discordapp.com/embed/avatars/0.png", // Fallback avatar
      },
      guild: { id: guildId },
    },
    i18n: {
      // Pass resolved translations needed by ChartView
      detailsLabel: i18n.__("games.crypto2.details"),
      entryPriceLabel: i18n.__("games.crypto2.entryPrice"),
      currentPriceLabel: i18n.__("games.crypto2.currentPrice"),
      quantityLabel: i18n.__("games.crypto2.quantity"),
      pnlLabel: i18n.__("games.crypto2.pnl"),
      leverageLabel: i18n.__("games.crypto2.leverage"),
      takeProfitLabel: i18n.__("games.crypto2.takeProfit"),
      stopLossLabel: i18n.__("games.crypto2.stopLoss"),
      notSetLabel: i18n.__("games.crypto2.notSet"),
      // chartTitleSuffix: i18n.__("games.crypto2.chartTitleSuffix") // Example if needed
    },
    balance: userData?.economy?.balance?.toString() ?? "0.00",
    selectedPosition: {
      // Pass details of the selected position as strings
      id: position.id,
      symbol: position.symbol,
      direction: position.direction,
      entryPrice: position.entryPrice.toFixed(4), // Format with more precision
      quantity: position.quantity.toString(),
      leverage: position.leverage,
      takeProfitPrice: position.takeProfitPrice?.toFixed(4) || null,
      stopLossPrice: position.stopLossPrice?.toFixed(4) || null,
      createdAt: position.createdAt.toISOString(),
      // Pass current calculated data as strings
      currentPrice: currentPrice.toFixed(4), // Format with more precision
      pnlPercent: pnlPercent.toFixed(2),
      pnlAmount: pnlAmount.toFixed(2), // Pass calculated PnL amount
    },
    chartData: null, // Don't pass raw data if we have the image
    chartImageURI: chartImageURI, // Pass base64 URI or null
    viewType: "chart_view",
    currentInterval: interval, // Pass the current interval to the component
  };

  const pngBuffer = await generateImage(
    "Crypto2",
    componentData,
    { image: 1, emoji: 1 },
    i18n
  );
  const embed = new EmbedBuilder()
    .setTitle(
      i18n.__("games.crypto2.chartViewTitle", {
        symbol: position.symbol,
      })
    )
    .setImage(`attachment://crypto_chart_${position.symbol}_${userId}.png`);

  // Buttons for managing the position
  const mainActionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`crypto2_close_${positionId}_${userId}`)
      .setLabel(i18n.__("games.crypto2.buttonClosePosition"))
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`crypto2_average_${positionId}_${interval}_${userId}`) // Add interval to ID
      .setLabel(i18n.__("games.crypto2.buttonAveragePosition"))
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`crypto2_tpsl_${positionId}_${interval}_${userId}`) // Add interval to ID
      .setLabel(i18n.__("games.crypto2.buttonSetTpSl"))
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`crypto2_back_${userId}`)
      .setLabel(i18n.__("games.crypto2.buttonBack"))
      .setStyle(ButtonStyle.Secondary)
  );

  // Timeframe selection buttons
  const timeframeRow = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`crypto2_interval_select_${positionId}_${userId}`)
      .setPlaceholder(i18n.__("games.crypto2.timeframe.selectPlaceholder"))
      .addOptions([
        {
          label: i18n.__("games.crypto2.timeframe.intervals.oneMinute"),
          value: "1",
          default: interval === "1",
          emoji: "⏱️",
        },
        {
          label: i18n.__("games.crypto2.timeframe.intervals.fiveMinutes"),
          value: "5",
          default: interval === "5",
          emoji: "⏱️",
        },
        {
          label: i18n.__("games.crypto2.timeframe.intervals.fifteenMinutes"),
          value: "15",
          default: interval === "15",
          emoji: "⏱️",
        },
        {
          label: i18n.__("games.crypto2.timeframe.intervals.thirtyMinutes"),
          value: "30",
          default: interval === "30",
          emoji: "⏱️",
        },
        {
          label: i18n.__("games.crypto2.timeframe.intervals.oneHour"),
          value: "60",
          default: interval === "60",
          emoji: "🕐",
        },
        {
          label: i18n.__("games.crypto2.timeframe.intervals.fourHours"),
          value: "240",
          default: interval === "240",
          emoji: "🕓",
        },
        {
          label: i18n.__("games.crypto2.timeframe.intervals.oneDay"),
          value: "D",
          default: interval === "D",
          emoji: "📅",
        },
        {
          label: i18n.__("games.crypto2.timeframe.intervals.oneWeek"),
          value: "W",
          default: interval === "W",
          emoji: "📆",
        },
      ])
  );

  // Add a refresh button for 1m and 5m timeframes
  let components = [timeframeRow, mainActionRow];

  // Add refresh button for short timeframes
  if (interval === "1" || interval === "5") {
    const refreshRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`crypto2_refresh_${positionId}_${interval}_${userId}`)
        .setLabel(i18n.__("games.crypto2.buttonRefresh") || "Refresh Chart")
        .setEmoji("🔄")
        .setStyle(ButtonStyle.Success)
    );
    components.push(refreshRow);
  }

  return {
    embeds: [embed],
    files: [
      {
        attachment: pngBuffer,
        name: `crypto_chart_${position.symbol}_${userId}.png`,
      },
    ],
    components: components,
  };
}

// Function to generate the coin preview content for a specific symbol
async function generateCoinPreviewContent(
  guildId,
  userId,
  symbol,
  i18n,
  interaction,
  interval = "15" // Default interval is 15m
) {
  const userData = await Database.getUser(guildId, userId, true);
  const tickerData = await getTickers([symbol]);

  // Fetch K-line data with the specified interval
  const klineData = await getKline(symbol, interval, 100);

  if (!tickerData || !tickerData[symbol] || klineData === null) {
    throw new Error(`Failed to fetch market/chart data for ${symbol}`);
  }

  const currentPrice =
    tickerData[symbol].markPrice || tickerData[symbol].lastPrice;
  const price24hChange = tickerData[symbol].price24hPcnt
    ? parseFloat(tickerData[symbol].price24hPcnt) * 100
    : 0;

  // Generate the chart image
  const chartImageURI = await generateCandlestickChart(klineData, symbol, {
    // No position-specific options like TP/SL needed for preview
  });

  // Prepare component data for the preview
  const componentData = {
    interaction: {
      user: {
        id: userId,
        avatarURL: interaction.user.displayAvatarURL({
          extension: "png",
          size: 128,
        }),
      },
      guild: { id: guildId },
    },
    i18n: {
      // Add translations for the preview view
      chartTitleSuffix:
        i18n.__("games.crypto2.common.chartTitleSuffix") || "Chart",
      currentPriceLabel:
        i18n.__("games.crypto2.coinPreview.currentPriceLabel") ||
        "Current Price",
      price24hChangeLabel:
        i18n.__("games.crypto2.coinPreview.price24hChangeLabel") ||
        "24h Change",
      volumeLabel:
        i18n.__("games.crypto2.coinPreview.volumeLabel") || "24h Volume",
      timeframeLabel:
        i18n.__("games.crypto2.timeframe.selectPlaceholder") ||
        "Select Timeframe",
      balanceLabel: i18n.__("games.crypto2.common.balance") || "Balance",
      priceInfoLabel:
        i18n.__("games.crypto2.coinPreview.priceInfoLabel") ||
        "Price Information",
      readyToTradeLabel:
        i18n.__("games.crypto2.coinPreview.readyToTradeLabel") ||
        "Ready to trade?",
      longExplanation:
        i18n.__("games.crypto2.coinPreview.longExplanation") ||
        "Buy if you expect price to rise",
      shortExplanation:
        i18n.__("games.crypto2.coinPreview.shortExplanation") ||
        "Sell if you expect price to fall",
    },
    viewType: "coin_preview",
    symbol: symbol,
    currentPrice: currentPrice.toString(),
    price24hChange: price24hChange.toFixed(2),
    volume24h: tickerData[symbol].volume24h?.toString() || "0",
    chartImageURI: chartImageURI,
    currentInterval: interval,
    balance: userData?.economy?.balance?.toString() ?? "0.00",
  };

  // Generate the image
  const pngBuffer = await generateImage(
    "Crypto2",
    componentData,
    { image: 1, emoji: 1 },
    i18n
  );

  // Prepare the message content
  const embed = new EmbedBuilder()
    .setTitle(i18n.__("games.crypto2.coinPreview.title", { symbol: symbol }))
    .setImage(`attachment://crypto_preview_${userId}.png`);

  // Create interval selection menu
  const intervalMenu = new StringSelectMenuBuilder()
    .setCustomId(`crypto2_interval_preview_${symbol}_${userId}`)
    .setPlaceholder(i18n.__("games.crypto2.timeframe.selectPlaceholder"))
    .addOptions([
      {
        label: i18n.__("games.crypto2.timeframe.intervals.oneMinute"),
        value: "1",
        default: interval === "1",
      },
      {
        label: i18n.__("games.crypto2.timeframe.intervals.fiveMinutes"),
        value: "5",
        default: interval === "5",
      },
      {
        label:
          i18n.__("games.crypto2.timeframe.intervals.fifteenMinutes") ||
          "15 Minutes",
        value: "15",
        default: interval === "15",
      },
      {
        label:
          i18n.__("games.crypto2.timeframe.intervals.thirtyMinutes") ||
          "30 Minutes",
        value: "30",
        default: interval === "30",
      },
      {
        label: i18n.__("games.crypto2.timeframe.intervals.oneHour"),
        value: "60",
        default: interval === "60",
      },
      {
        label:
          i18n.__("games.crypto2.timeframe.intervals.fourHours") || "4 Hours",
        value: "240",
        default: interval === "240",
      },
      {
        label: i18n.__("games.crypto2.timeframe.intervals.oneDay"),
        value: "D",
        default: interval === "D",
      },
    ]);

  // Create action buttons
  const buttonsRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`crypto2_open_from_preview_${symbol}_${userId}`)
      .setLabel(
        i18n.__("games.crypto2.coinPreview.buttonOpenPositionFromPreview")
      )
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`crypto2_preview_back_${userId}`)
      .setLabel(i18n.__("games.crypto2.coinPreview.buttonBackToMenu"))
      .setStyle(ButtonStyle.Secondary)
  );

  const intervalRow = new ActionRowBuilder().addComponents(intervalMenu);

  return {
    embeds: [embed],
    files: [{ attachment: pngBuffer, name: `crypto_preview_${userId}.png` }],
    components: [buttonsRow, intervalRow],
  };
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
        // Show Disclaimer Embed and Button
        const disclaimerEmbed = new EmbedBuilder()
          .setTitle(i18n.__("games.crypto2.disclaimerTitle"))
          .setDescription(i18n.__("games.crypto2.disclaimerText"))
          .setColor("#FF0000");
        const acknowledgeButton = new ButtonBuilder()
          .setCustomId(`crypto2_ack_${userId}`)
          .setLabel("I understand and accept the risks")
          .setStyle(ButtonStyle.Success);
        const row = new ActionRowBuilder().addComponents(acknowledgeButton);
        const disclaimerMessage = await interaction.editReply({
          embeds: [disclaimerEmbed],
          components: [row],
          fetchReply: true,
        });

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
            interaction
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
          interaction
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
          components: [],
          files: [],
          embeds: [],
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
          // If the action was on a now-liquidated position, maybe force back to menu?
          // Let's assume the subsequent DB fetch will fail or the view will update correctly.
        }
        // --- End Liquidation Check ---

        // --- Component Handlers ---
        // Coin Selection from Main Menu
        if (customId === `crypto2_select_coin_${userId}`) {
          await i.deferUpdate();
          const selectedCoin = i.values[0]; // Get selected coin symbol
          const previewContent = await generateCoinPreviewContent(
            guildId,
            userId,
            selectedCoin,
            i18n,
            originalInteraction
          );
          await message.edit(previewContent);
        }
        // Back to Main Menu from Coin Preview
        else if (customId === `crypto2_preview_back_${userId}`) {
          await i.deferUpdate();
          const mainMenuContent = await generateMainMenuContent(
            guildId,
            userId,
            i18n,
            originalInteraction
          );
          await message.edit(mainMenuContent);
        }
        // Change Timeframe on Coin Preview
        else if (customId.startsWith(`crypto2_interval_preview_`)) {
          await i.deferUpdate();
          const parts = customId.split("_");
          const symbol = parts[3]; // Extract symbol from the customId
          const selectedInterval = i.values[0]; // Get selected interval
          const previewContent = await generateCoinPreviewContent(
            guildId,
            userId,
            symbol,
            i18n,
            originalInteraction,
            selectedInterval
          );
          await message.edit(previewContent);
        }
        // Open Position from Preview
        else if (customId.startsWith(`crypto2_open_from_preview_`)) {
          const parts = customId.split("_");
          const symbol = parts[4]; // Extract symbol from the customId

          // Create a modal similar to the regular open position but prefill the symbol
          const modalSubmitId = `crypto2_open_modal_${i.id}`;
          const modal = new ModalBuilder()
            .setCustomId(modalSubmitId)
            .setTitle(i18n.__("games.crypto2.openPositionModalTitle"));

          const symbolInput = new TextInputBuilder()
            .setCustomId("symbolInput")
            .setLabel(i18n.__("games.crypto2.symbolInputLabel"))
            .setStyle(TextInputStyle.Short)
            .setValue(symbol) // Prefill with selected symbol
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

          // Handle the modal submission using the existing code flow
          i.awaitModalSubmit({
            filter: (modalInteraction) =>
              modalInteraction.customId === modalSubmitId &&
              modalInteraction.user.id === userId,
            time: modalTimeoutDuration,
          })
            .then(async (modalInteraction) => {
              // Use the existing modal submission handler logic
              // We're using the same format as the regular open position modal
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

                // Continue with the existing validation and position opening code...
                // This is the same code as in the regular open position handler
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
                    i18n.__("games.crypto2.errorInvalidSymbol")
                  );
                  return;
                }

                // 5. Open the Position (continues with existing code...)
                // Continue with the rest of your position opening logic
                // Just copy the existing code for this part

                // After position is opened, return to main menu
                const mainMenuContent = await generateMainMenuContent(
                  guildId,
                  userId,
                  i18n,
                  originalInteraction
                );
                await message.edit(mainMenuContent);

                await modalInteraction.editReply(
                  i18n.__("games.crypto2.positionOpenedSuccess", {
                    direction,
                    symbol,
                    leverage,
                  })
                );
              } catch (error) {
                console.error("Error in modal submission handler:", error);
                await modalInteraction.editReply(
                  i18n.__("games.crypto2.errorGeneric")
                );
              }
            })
            .catch((error) => {
              console.error("Modal timeout or error:", error);
            });
        } else if (customId === `crypto2_view_${userId}`) {
          await i.deferUpdate();
          const positions = await Database.getUserCryptoPositions(
            guildId,
            userId
          );
          if (positions.length === 0) {
            await i.followUp({
              content: i18n.__("games.crypto2.errorNoPositions"),
              ephemeral: true,
            });
            return;
          }
          const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`crypto2_selectpos_${userId}`)
            .setPlaceholder(i18n.__("games.crypto2.selectPositionPrompt"))
            .addOptions(
              positions.map((p) => ({
                label: i18n.__("games.crypto2.positionSelectLabel", {
                  direction: p.direction,
                  symbol: p.symbol,
                  entryPrice: parseFloat(p.entryPrice).toFixed(2),
                  leverage: p.leverage,
                }),
                value: p.id,
              }))
            );
          const selectRow = new ActionRowBuilder().addComponents(selectMenu);
          await message.edit({
            components: [message.components[0], selectRow],
          });
        } else if (customId === `crypto2_open_${userId}`) {
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

          // Wait for the modal submission
          i.awaitModalSubmit({
            filter: (modalInteraction) =>
              modalInteraction.customId === modalSubmitId &&
              modalInteraction.user.id === userId,
            time: modalTimeoutDuration,
          })
            .then(async (modalInteraction) => {
              // Modal Submitted! Process it.
              await modalInteraction.deferReply({ ephemeral: true }); // Defer the modal reply
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

                // 2. Validate Input (using modalInteraction.editReply for errors)
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

                // 9. Refresh the main menu view (edit the original message)
                try {
                  const menuContent = await generateMainMenuContent(
                    guildId,
                    userId,
                    i18n,
                    originalInteraction
                  ); // Use originalInteraction context
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
                    .catch(() => {}); // Try defer if not already
                }
                await modalInteraction
                  .editReply(i18n.__("games.crypto2.errorCreatingPosition"))
                  .catch(() => {});
              }
            })
            .catch(async (err) => {
              // Modal timed out or other error during awaitModalSubmit
              console.log(
                `Open Position Modal timed out or failed for user ${userId}:`,
                err.message
              );
              // Optionally notify the user the modal timed out, using the original button interaction 'i'
              // Cannot reply to the modalInteraction here as it might not exist or be expired
              await i
                .followUp({ content: "Modal timed out.", ephemeral: true })
                .catch(() => {});
            });
          // --- End Handle Open Position Modal ---
        } else if (customId === `crypto2_selectpos_${userId}`) {
          await i.deferUpdate();
          if (!i.isStringSelectMenu()) return;
          const positionId = i.values[0];
          try {
            const chartContent = await generateChartViewContent(
              guildId,
              userId,
              positionId,
              i18n,
              originalInteraction
            );
            await message.edit(chartContent);
          } catch (chartError) {
            console.error("Error generating chart view:", chartError);
            await i.followUp({
              content: i18n.__("games.crypto2.errorFetchChartData", {
                symbol: "selected coin",
              }),
              ephemeral: true,
            });
            const menuContent = await generateMainMenuContent(
              guildId,
              userId,
              i18n,
              originalInteraction
            );
            await message.edit(menuContent);
          }
        } else if (customId.startsWith(`crypto2_close_`)) {
          await i.deferUpdate();
          const positionId = customId.split("_")[2];
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

            const menuContent = await generateMainMenuContent(
              guildId,
              userId,
              i18n,
              originalInteraction
            );
            await message.edit(menuContent);
          } catch (closeError) {
            console.error(`Error closing position ${positionId}:`, closeError);
            await i.followUp({
              content: "❌ An error occurred while closing the position.",
              ephemeral: true,
            });
            try {
              const chartContent = await generateChartViewContent(
                guildId,
                userId,
                positionId,
                i18n,
                originalInteraction
              );
              await message.edit(chartContent);
            } catch {
              const menuContent = await generateMainMenuContent(
                guildId,
                userId,
                i18n,
                originalInteraction
              );
              await message.edit(menuContent);
            }
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

                // 9. Send Confirmation
                await modalInteraction.editReply(
                  i18n.__("games.crypto2.positionAveragedSuccess", {
                    symbol: freshPosition.symbol,
                    newEntryPrice: newEntryPrice.toFixed(4),
                  })
                );

                // 10. Refresh chart view
                try {
                  const chartContent = await generateChartViewContent(
                    guildId,
                    userId,
                    positionId,
                    i18n,
                    originalInteraction,
                    currentInterval // Use the preserved interval
                  );
                  await message.edit(chartContent);
                } catch (refreshError) {
                  console.error("Error refreshing chart:", refreshError);
                  // ... handle error ...
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

                // 5. Send confirmation
                await modalInteraction.editReply(
                  i18n.__("games.crypto2.tpslSetSuccess", {
                    symbol: freshPosition.symbol,
                  })
                );

                // 6. Refresh chart view with the same interval
                try {
                  const chartContent = await generateChartViewContent(
                    guildId,
                    userId,
                    positionId,
                    i18n,
                    originalInteraction,
                    currentInterval // Use the preserved interval
                  );
                  await message.edit(chartContent);
                } catch (refreshError) {
                  console.error("Error refreshing chart:", refreshError);
                  // ... handle error ...
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
          const menuContent = await generateMainMenuContent(
            guildId,
            userId,
            i18n,
            originalInteraction
          );
          await message.edit(menuContent);
        } else if (customId.startsWith(`crypto2_interval_select_`)) {
          // Handle timeframe interval selection from select menu
          await i.deferUpdate();

          if (!i.isStringSelectMenu()) return;

          // Extract the position ID from the custom ID
          const parts = customId.split("_");
          const positionId = parts[3];

          // Get the selected interval value
          const interval = i.values[0]; // This will be "1", "5", "15", "30", "60", "240", "D", "W"

          try {
            // Generate new chart with selected interval
            const chartContent = await generateChartViewContent(
              guildId,
              userId,
              positionId,
              i18n,
              originalInteraction,
              interval // Pass the selected interval
            );
            await message.edit(chartContent);
          } catch (error) {
            console.error(
              `Error generating chart with interval ${interval}:`,
              error
            );
            await i.followUp({
              content: `❌ Error updating chart with selected interval. Please try again.`,
              ephemeral: true,
            });
          }
        } else if (customId.startsWith(`crypto2_refresh_`)) {
          await i.deferUpdate();

          // Extract positionId and interval from the customId
          const parts = customId.split("_");
          const positionId = parts[2];
          const interval = parts[3];

          try {
            // Generate new chart with selected interval - same as current interval but fetches fresh data
            const chartContent = await generateChartViewContent(
              guildId,
              userId,
              positionId,
              i18n,
              originalInteraction,
              interval
            );
            await message.edit(chartContent);
          } catch (error) {
            console.error(
              `Error refreshing chart with interval ${interval}:`,
              error
            );
            await i.followUp({
              content: `❌ Error refreshing chart. Please try again.`,
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
            originalInteraction
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
