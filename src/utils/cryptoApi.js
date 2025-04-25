import axios from "axios";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// API configurations
const CMC_API_URL = "https://pro-api.coinmarketcap.com/v1";
const CMC_API_KEY = process.env.COINMARKETCAP_API_KEY || "";

// Symbol mapping from Bybit format to other APIs
const SYMBOL_MAPPING = {
  BTCUSDT: { cmc: "BTC" },
  ETHUSDT: { cmc: "ETH" },
  SOLUSDT: { cmc: "SOL" },
  DOGEUSDT: { cmc: "DOGE" },
  ADAUSDT: { cmc: "ADA" },
  XRPUSDT: { cmc: "XRP" },
  AVAXUSDT: { cmc: "AVAX" },
  DOTUSDT: { cmc: "DOT" },
  MATICUSDT: { cmc: "MATIC" },
  BNBUSDT: { cmc: "BNB" },
  APTUSDT: { cmc: "APT" },
  // Add more mappings as needed
};

// Cache for symbol to ID mapping
let symbolToIdCache = {};

// Price cache with expiration
const priceCache = {
  data: {},
  timestamps: {},
  maxAge: 2 * 60 * 1000, // 2 minutes cache expiry
};

/**
 * Initialize the symbol to ID mapping cache
 * @returns {Promise<void>}
 */
export async function initializeSymbolMapping() {
  if (!CMC_API_KEY) {
    console.warn(
      "[cryptoApi] CoinMarketCap API key not found in environment variables."
    );
    return;
  }

  try {
    const response = await axios.get(`${CMC_API_URL}/cryptocurrency/map`, {
      headers: {
        "X-CMC_PRO_API_KEY": CMC_API_KEY,
      },
    });

    if (response.status !== 200) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = response.data.data;
    symbolToIdCache = data.reduce((acc, coin) => {
      acc[coin.symbol] = coin.id;
      return acc;
    }, {});

    console.log("[cryptoApi] Symbol mapping initialized successfully");
  } catch (error) {
    console.error("[cryptoApi] Error initializing symbol mapping:", error);
  }
}

/**
 * Fetches the latest ticker information for given symbols using CoinMarketCap.
 * @param {string[]} symbols - Array of symbols in Bybit format (e.g., ['BTCUSDT', 'ETHUSDT'])
 * @param {boolean} forceRefresh - Force refresh data from API ignoring cache
 * @returns {Promise<object|null>} Object mapping symbol to its ticker data, or null on error.
 */
export async function getTickers(symbols = [], forceRefresh = false) {
  if (!symbols || symbols.length === 0) {
    return {};
  }

  if (!CMC_API_KEY) {
    console.error(
      "[cryptoApi] CoinMarketCap API key not found in environment variables."
    );
    return null;
  }

  // Create a cache key based on the symbols
  const cacheKey = symbols.sort().join(",");
  const now = Date.now();

  // Check if we have valid cached data
  if (
    !forceRefresh &&
    priceCache.data[cacheKey] &&
    priceCache.timestamps[cacheKey] &&
    now - priceCache.timestamps[cacheKey] < priceCache.maxAge
  ) {
    // Add the timestamp to the result
    const cachedData = priceCache.data[cacheKey];
    cachedData.timestamp = priceCache.timestamps[cacheKey];
    cachedData.fromCache = true;

    return cachedData;
  }

  try {
    // Map Bybit symbols to CoinMarketCap symbols
    const cmcSymbols = symbols
      .map((symbol) => SYMBOL_MAPPING[symbol]?.cmc)
      .filter((symbol) => symbol); // Filter out undefined mappings

    if (cmcSymbols.length === 0) {
      console.warn(
        "[cryptoApi] No valid symbol mappings found for CoinMarketCap"
      );
      return {};
    }

    // Get quotes from CoinMarketCap
    const url = `${CMC_API_URL}/cryptocurrency/quotes/latest`;
    const response = await axios.get(url, {
      headers: {
        "X-CMC_PRO_API_KEY": CMC_API_KEY,
      },
      params: {
        symbol: cmcSymbols.join(","),
      },
    });

    if (response.status !== 200) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = response.data.data;
    const results = {
      timestamp: now,
      fromCache: false,
    };

    // Convert CoinMarketCap response to match the expected format from Bybit
    symbols.forEach((symbol) => {
      const cmcSymbol = SYMBOL_MAPPING[symbol]?.cmc;
      if (cmcSymbol && data[cmcSymbol]) {
        const coinData = data[cmcSymbol];
        const quote = coinData.quote.USD;

        results[symbol] = {
          symbol: symbol,
          lastPrice: quote.price,
          markPrice: quote.price, // Using price as mark price
          highPrice24h:
            quote.price * (1 + Math.max(0, quote.percent_change_24h / 100)), // Estimated high
          lowPrice24h:
            quote.price * (1 - Math.max(0, -quote.percent_change_24h / 100)), // Estimated low
          price24hPcnt: quote.percent_change_24h / 100, // Convert to decimal
          volume24h: quote.volume_24h,
          turnover24h: quote.volume_24h, // Using volume as turnover
          lastUpdated: quote.last_updated,
        };
      }
    });

    // Check if all requested symbols were found
    for (const symbol of symbols) {
      if (!results[symbol] && SYMBOL_MAPPING[symbol]) {
        console.warn(`[cryptoApi] Ticker data not found for symbol: ${symbol}`);
      }
    }

    // Cache the results
    priceCache.data[cacheKey] = results;
    priceCache.timestamps[cacheKey] = now;

    return results;
  } catch (error) {
    console.error("[cryptoApi] Error fetching tickers:", error);

    // If we have stale cache data, return it as fallback with a flag
    if (priceCache.data[cacheKey]) {
      const staleData = priceCache.data[cacheKey];
      staleData.timestamp = priceCache.timestamps[cacheKey];
      staleData.fromCache = true;
      staleData.stale = true;
      return staleData;
    }

    return null; // Indicate error
  }
}
// Call initializeSymbolMapping when the module is loaded
initializeSymbolMapping();
