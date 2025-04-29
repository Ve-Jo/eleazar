import axios from "axios";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// API configurations
const CMC_API_URL = "https://pro-api.coinmarketcap.com/v1";
const CMC_API_KEY = process.env.COINMARKETCAP_API_KEY || "";

// Cache for valid symbols from CMC
let validCmcSymbols = new Set();
let validCmcSymbolMap = new Map(); // Added: Map symbol to CMC ID

// Price cache with expiration
const priceCache = {
  data: {},
  timestamps: {},
  maxAge: 2 * 60 * 1000, // 2 minutes cache expiry
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

    // --- Batch API calls if needed ---
    const MAX_SYMBOLS_PER_CALL = 100; // Adjust based on API limits if necessary
    const results = {
      timestamp: now,
      fromCache: false,
    };
    let processingError = false; // Flag to track if any batch failed

    for (let i = 0; i < baseSymbolsToQuery.length; i += MAX_SYMBOLS_PER_CALL) {
      const batchSymbols = baseSymbolsToQuery.slice(
        i,
        i + MAX_SYMBOLS_PER_CALL
      );
      console.log(
        `[cryptoApi] Fetching batch ${
          i / MAX_SYMBOLS_PER_CALL + 1
        } for symbols: ${batchSymbols.join(",")}`
      );

      try {
        const url = `${CMC_API_URL}/cryptocurrency/quotes/latest`;
        const response = await axios.get(url, {
          headers: {
            "X-CMC_PRO_API_KEY": CMC_API_KEY,
          },
          params: {
            symbol: batchSymbols.join(","), // Use the extracted base symbols
          },
        });

        if (response.status !== 200) {
          console.error(
            `[cryptoApi] Batch HTTP error! Status: ${
              response.status
            } for symbols ${batchSymbols.join(",")}`
          );
          processingError = true;
          continue; // Skip this batch
        }

        const data = response.data.data;

        // Convert CoinMarketCap response back to the original USDT format for this batch
        symbols.forEach((originalSymbol) => {
          const baseSymbol = originalSymbol.replace(/USDT$/, ""); // Get base symbol again
          if (batchSymbols.includes(baseSymbol) && data[baseSymbol]) {
            // Process if in current batch and response
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
                quote.price *
                (1 - Math.max(0, -quote.percent_change_24h / 100)), // Estimated low
              price24hPcnt: quote.percent_change_24h / 100, // Convert to decimal
              volume24h: quote.volume_24h,
              turnover24h: quote.volume_24h, // Using volume as turnover
              lastUpdated: quote.last_updated,
            };
          }
        });
      } catch (batchError) {
        console.error(
          `[cryptoApi] Error fetching batch ${
            i / MAX_SYMBOLS_PER_CALL + 1
          } for symbols ${batchSymbols.join(",")}:`,
          batchError.message || batchError
        );
        processingError = true;
      }
    } // --- End batch loop ---

    // Check if all originally requested symbols were found (using original symbols)
    for (const symbol of symbols) {
      if (!results[symbol]) {
        // This might be expected if a batch failed or CMC didn't return data
        // console.warn(`[cryptoApi] Ticker data not found or failed to fetch for symbol: ${symbol}`);
      }
    }

    // Cache the results ONLY if there were no processing errors
    if (!processingError) {
      priceCache.data[cacheKey] = results;
      priceCache.timestamps[cacheKey] = now;
      console.log(
        `[cryptoApi] Cached prices for key: ${cacheKey.substring(0, 50)}...`
      );
    } else {
      console.warn(`[cryptoApi] Not caching prices due to processing errors.`);
    }

    return results; // Return whatever was successfully fetched
  } catch (error) {
    console.error("[cryptoApi] Error fetching tickers (overall):", error);

    // If we have stale cache data, return it as fallback with a flag
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
