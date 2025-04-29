import axios from "axios";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// API configurations
const CMC_API_URL = "https://pro-api.coinmarketcap.com/v1";
const CMC_API_KEY = process.env.COINMARKETCAP_API_KEY || "";

// Cache for valid symbols from CMC
let validCmcSymbols = new Set();

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
    // Store valid base symbols from CMC
    validCmcSymbols = new Set(data.map((coin) => coin.symbol));

    console.log(
      `[cryptoApi] Symbol mapping initialized successfully with ${validCmcSymbols.size} symbols.`
    );
  } catch (error) {
    console.error("[cryptoApi] Error initializing symbol mapping:", error);
  }
}

/**
 * Returns the set of valid base symbols fetched from CoinMarketCap.
 * @returns {Set<string>} A set containing valid base cryptocurrency symbols (e.g., 'BTC', 'ETH').
 */
export function getValidCmcSymbols() {
  return validCmcSymbols;
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
    // Extract base symbols (e.g., BTC from BTCUSDT)
    const baseSymbolsToQuery = [
      ...new Set( // Use Set to avoid duplicate API calls for the same base symbol
        symbols
          .map((symbol) => symbol.replace(/USDT$/, "")) // Remove 'USDT' suffix
          .filter((baseSymbol) => baseSymbol) // Ensure not empty after replace
      ),
    ];

    if (baseSymbolsToQuery.length === 0) {
      console.warn("[cryptoApi] No valid base symbols derived from input");
      return {};
    }

    // Get quotes from CoinMarketCap using base symbols
    const url = `${CMC_API_URL}/cryptocurrency/quotes/latest`;
    const response = await axios.get(url, {
      headers: {
        "X-CMC_PRO_API_KEY": CMC_API_KEY,
      },
      params: {
        symbol: baseSymbolsToQuery.join(","), // Use the extracted base symbols
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

    // Convert CoinMarketCap response back to the original USDT format
    symbols.forEach((originalSymbol) => {
      const baseSymbol = originalSymbol.replace(/USDT$/, ""); // Get base symbol again
      if (baseSymbol && data[baseSymbol]) {
        // Check if data exists for the base symbol
        const coinData = data[baseSymbol];
        const quote = coinData.quote.USD;

        results[originalSymbol] = {
          // Use originalSymbol as the key
          symbol: originalSymbol, // Store the original symbol
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

    // Check if all requested symbols were found (using original symbols)
    for (const symbol of symbols) {
      if (!results[symbol]) {
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
