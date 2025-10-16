import axios from "axios";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// API configurations
const CMC_API_URL = "https://pro-api.coinmarketcap.com/v1";
const CMC_API_KEY = process.env.COINMARKETCAP_API_KEY || "";
const MEXC_API_URL = "https://api.mexc.com/api/v3"; // Added MEXC URL

// Cache for valid symbols from CMC
let validCmcSymbols = new Set();
let validCmcSymbolMap = new Map(); // Added: Map symbol to CMC ID

// Price cache with expiration
const priceCache = {
  data: {},
  timestamps: {},
  maxAge: 30000, // 30 seconds cache expiry (for potential future CMC use)
};

// Category cache
const categoryCache = {
  allCategories: null,
  categoryCoins: {}, // Cache coins per category ID
  timestamp: 0,
  maxAge: 60 * 60 * 1000, // Cache categories/coins for 1 hour
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
      params: { listing_status: "active" }, // Fetch only active coins
    });

    if (response.status !== 200) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = response.data.data;
    // Store valid base symbols from CMC
    validCmcSymbols = new Set(data.map((coin) => coin.symbol));
    // Store map from symbol to ID
    validCmcSymbolMap = new Map(data.map((coin) => [coin.symbol, coin.id]));

    console.log(
      `[cryptoApi] Symbol mapping initialized successfully with ${validCmcSymbols.size} active symbols.`
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
 * Returns the Map of valid base symbols to their CoinMarketCap IDs.
 * @returns {Map<string, number>} A map from symbol to ID (e.g., 'BTC' -> 1).
 */
export function getValidCmcSymbolMap() {
  return validCmcSymbolMap;
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

  // CMC API Key check removed - MEXC public ticker endpoint doesn't require auth

  const now = Date.now();

  /* --- Cache Check Removed for MEXC ---
  // Create a cache key based on the symbols
  const cacheKey = symbols.sort().join(",");

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
    console.log(
      `[cryptoApi] Returning cached prices (MEXC) for key: ${cacheKey.substring(
        0,
        50
      )}...`
    );
    return cachedData;
  }
  */

  // --- MEXC Implementation ---
  try {
    const MAX_SYMBOLS_PER_MEXC_REQUEST = 100;
    if (symbols.length > MAX_SYMBOLS_PER_MEXC_REQUEST) {
      console.warn(
        `[cryptoApi] Requested ${symbols.length} symbols, but MEXC API limit is ${MAX_SYMBOLS_PER_MEXC_REQUEST}. Only fetching the first ${MAX_SYMBOLS_PER_MEXC_REQUEST}. Consider batching if this happens often.`
      );
      symbols = symbols.slice(0, MAX_SYMBOLS_PER_MEXC_REQUEST); // Trim symbols for this request
    }

    // Format symbols for the API query: URL-encoded JSON array string
    const symbolsParam = encodeURIComponent(JSON.stringify(symbols));
    const url = `${MEXC_API_URL}/ticker/24hr?symbols=${symbolsParam}`;

    console.log(`[cryptoApi] Fetching ${symbols.length} tickers from MEXC...`);

    const response = await axios.get(url); // Fetch specific tickers

    if (response.status !== 200 || !Array.isArray(response.data)) {
      console.error(
        `[cryptoApi] MEXC API error! Status: ${
          response.status
        }, Data: ${JSON.stringify(response.data)}`
      );
      throw new Error(`MEXC API error! status: ${response.status}`);
    }

    const mexcTickers = response.data; // Response is now an array of requested tickers
    const mexcTickerMap = new Map(
      mexcTickers.map((ticker) => [ticker.symbol, ticker])
    );

    const results = {
      timestamp: now,
      fromCache: false,
    };
    let symbolsFound = 0;

    // Filter and map the response for the requested symbols
    symbols.forEach((requestedSymbol) => {
      const tickerData = mexcTickerMap.get(requestedSymbol);

      if (tickerData) {
        symbolsFound++;
        results[requestedSymbol] = {
          symbol: tickerData.symbol,
          lastPrice: parseFloat(tickerData.lastPrice),
          markPrice: parseFloat(tickerData.lastPrice), // Using lastPrice as mark price
          highPrice24h: parseFloat(tickerData.highPrice),
          lowPrice24h: parseFloat(tickerData.lowPrice),
          // MEXC provides priceChangePercent as a string like "0.05" for 5% - needs conversion
          price24hPcnt: parseFloat(tickerData.priceChangePercent), // Already a decimal factor
          volume24h: parseFloat(tickerData.volume), // Base asset volume
          turnover24h: parseFloat(tickerData.quoteVolume), // Quote asset volume
          lastUpdated: tickerData.closeTime, // Timestamp of 24h window close
        };
      } else {
        // console.warn(`[cryptoApi] Ticker data not found in MEXC response for symbol: ${requestedSymbol}`);
      }
    });

    console.log(
      `[cryptoApi] Processed ${symbolsFound}/${symbols.length} requested symbols from MEXC response.`
    );

    /* --- Cache Write Removed for MEXC ---
    // Cache the filtered results for the specific requested symbols
    priceCache.data[cacheKey] = results;
    priceCache.timestamps[cacheKey] = now;
    console.log(
      `[cryptoApi] Cached MEXC prices for key: ${cacheKey.substring(0, 50)}...`
    );
    */

    return results; // Return the filtered results
  } catch (error) {
    console.error(
      "[cryptoApi] Error fetching tickers from MEXC:",
      error.message || error
    );

    // If we have stale cache data for this specific key, return it as fallback
    if (priceCache.data[cacheKey]) {
      const staleData = priceCache.data[cacheKey];
      staleData.timestamp = priceCache.timestamps[cacheKey];
      staleData.fromCache = true;
      staleData.stale = true;
      console.warn(
        "[cryptoApi] Returning stale price cache data due to error."
      );
      return staleData;
    }

    return null; // Indicate error
  }
}

/**
 * Fetches all available cryptocurrency categories from CoinMarketCap
 * @param {boolean} forceRefresh - Force refresh cache
 * @returns {Promise<Array>} Array of category objects with id, name, etc.
 */
export async function getCategories(forceRefresh = false) {
  // Check cache first
  if (
    !forceRefresh &&
    categoryCache.allCategories &&
    Date.now() - categoryCache.timestamp < categoryCache.maxAge
  ) {
    return categoryCache.allCategories;
  }

  if (!CMC_API_KEY) {
    console.error(
      "[cryptoApi] CoinMarketCap API key not found for category lookup"
    );
    return null;
  }

  try {
    const response = await axios.get(
      `${CMC_API_URL}/cryptocurrency/categories`,
      {
        headers: { "X-CMC_PRO_API_KEY": CMC_API_KEY },
      }
    );

    if (response.status !== 200 || !response.data?.data) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Store in cache
    categoryCache.allCategories = response.data.data;
    categoryCache.timestamp = Date.now();

    return response.data.data;
  } catch (error) {
    console.error("[cryptoApi] Error fetching categories:", error);
    return categoryCache.allCategories || []; // Return cached data or empty array
  }
}

/**
 * Fetches coins for a specific category from CoinMarketCap
 * @param {string} categoryId - The category ID
 * @param {boolean} forceRefresh - Force refresh cache
 * @returns {Promise<Object>} Category data with coins array
 */
export async function getCategoryCoins(categoryId, forceRefresh = false) {
  // Check cache
  if (
    !forceRefresh &&
    categoryCache.categoryCoins[categoryId] &&
    Date.now() - categoryCache.timestamp < categoryCache.maxAge
  ) {
    return categoryCache.categoryCoins[categoryId];
  }

  try {
    const response = await axios.get(`${CMC_API_URL}/cryptocurrency/category`, {
      headers: { "X-CMC_PRO_API_KEY": CMC_API_KEY },
      params: {
        id: categoryId,
        limit: 200, // Get a substantial number of coins per category
      },
    });

    if (response.status !== 200 || !response.data?.data) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Cache the result
    categoryCache.categoryCoins[categoryId] = response.data.data;

    return response.data.data;
  } catch (error) {
    console.error(
      `[cryptoApi] Error fetching coins for category ${categoryId}:`,
      error
    );
    return categoryCache.categoryCoins[categoryId] || null;
  }
}

// Call initializeSymbolMapping when the module is loaded
initializeSymbolMapping();
