import axios from "axios";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// API configurations
const CMC_API_URL = "https://pro-api.coinmarketcap.com/v1";
const CMC_API_KEY = process.env.COINMARKETCAP_API_KEY || "";
const COINGECKO_API_URL = "https://api.coingecko.com/api/v3";

// Symbol mapping from Bybit format to other APIs
const SYMBOL_MAPPING = {
  BTCUSDT: { cmc: "BTC", gecko: "bitcoin" },
  ETHUSDT: { cmc: "ETH", gecko: "ethereum" },
  SOLUSDT: { cmc: "SOL", gecko: "solana" },
  DOGEUSDT: { cmc: "DOGE", gecko: "dogecoin" },
  ADAUSDT: { cmc: "ADA", gecko: "cardano" },
  XRPUSDT: { cmc: "XRP", gecko: "ripple" },
  AVAXUSDT: { cmc: "AVAX", gecko: "avalanche-2" },
  DOTUSDT: { cmc: "DOT", gecko: "polkadot" },
  MATICUSDT: { cmc: "MATIC", gecko: "matic-network" },
  BNBUSDT: { cmc: "BNB", gecko: "binancecoin" },
  APTUSDT: { cmc: "APT", gecko: "aptos" },
  // Add more mappings as needed
};

// Cache for symbol to ID mapping
let symbolToIdCache = {};

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
 * Get CoinMarketCap ID for a symbol
 * @param {string} symbol - Symbol in Bybit format (e.g., 'BTCUSDT')
 * @returns {number|null} CoinMarketCap ID or null if not found
 */
function getSymbolId(symbol) {
  const cmcSymbol = SYMBOL_MAPPING[symbol]?.cmc;
  if (!cmcSymbol) return null;

  return symbolToIdCache[cmcSymbol] || null;
}

/**
 * Fetches the latest ticker information for given symbols using CoinMarketCap.
 * @param {string[]} symbols - Array of symbols in Bybit format (e.g., ['BTCUSDT', 'ETHUSDT'])
 * @returns {Promise<object|null>} Object mapping symbol to its ticker data, or null on error.
 */
export async function getTickers(symbols = []) {
  if (!symbols || symbols.length === 0) {
    return {};
  }

  if (!CMC_API_KEY) {
    console.error(
      "[cryptoApi] CoinMarketCap API key not found in environment variables."
    );
    return null;
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
    const results = {};

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
        };
      }
    });

    // Check if all requested symbols were found
    for (const symbol of symbols) {
      if (!results[symbol] && SYMBOL_MAPPING[symbol]) {
        console.warn(`[cryptoApi] Ticker data not found for symbol: ${symbol}`);
      }
    }

    return results;
  } catch (error) {
    console.error("[cryptoApi] Error fetching tickers:", error);
    return null; // Indicate error
  }
}

/**
 * Fetches historical K-line (candlestick) data for a symbol using CoinGecko (free API).
 * @param {string} symbol - The trading symbol in Bybit format (e.g., 'BTCUSDT').
 * @param {string} interval - Candlestick interval (e.g., '1', '5', '15', '60', 'D').
 * @param {number} limit - Number of candles to fetch.
 * @returns {Promise<Array<object>|null>} Array of candles or null on error.
 */
export async function getKline(symbol, interval = "15", limit = 100) {
  try {
    const geckoId = SYMBOL_MAPPING[symbol]?.gecko;

    if (!geckoId) {
      console.warn(
        `[cryptoApi] No CoinGecko mapping found for symbol: ${symbol}`
      );
      return null;
    }

    // Convert Bybit interval to CoinGecko days parameter
    let days = 1;
    if (interval === "D") {
      days = limit;
    } else {
      // Calculate days based on interval (in minutes) and limit
      const intervalMinutes = interval === "1" ? 1 : parseInt(interval);
      days = Math.ceil((intervalMinutes * limit) / (24 * 60));
      // Ensure reasonable range
      days = Math.max(1, Math.min(days, 90));
    }

    // Get market chart data from CoinGecko
    const url = `${COINGECKO_API_URL}/coins/${geckoId}/market_chart`;
    const response = await axios.get(url, {
      params: {
        vs_currency: "usd",
        days: days,
        interval: days > 30 ? "daily" : undefined, // For longer periods, daily is enforced
      },
    });

    if (response.status !== 200) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const { prices, total_volumes } = response.data;

    if (!prices || prices.length === 0) {
      console.warn(`[cryptoApi] No historical data returned for ${symbol}`);
      return [];
    }

    // Resample the data to match the requested interval
    // This is a simplified approach; for production, use a more sophisticated resampling method
    const sampleRate = Math.max(1, Math.floor(prices.length / limit));

    // Convert CoinGecko format to match expected Bybit format
    const candles = [];
    for (let i = 0; i < prices.length; i += sampleRate) {
      if (candles.length >= limit) break;

      const timestamp = prices[i][0]; // Timestamp in ms
      const close = prices[i][1]; // Price at this timestamp

      // For volume, find the corresponding entry in total_volumes
      const volumeEntry = total_volumes.find((v) => v[0] === timestamp);
      const volume = volumeEntry ? volumeEntry[1] : 0;

      // For OHLC, we only have close prices in this simplified approach
      // In a real implementation, you would need to aggregate the data properly
      candles.push([
        timestamp,
        close, // Using close as open (simplified)
        close, // Using close as high (simplified)
        close, // Using close as low (simplified)
        close,
        volume,
        volume, // Using volume as turnover (simplified)
      ]);
    }

    return candles;
  } catch (error) {
    console.error(`[cryptoApi] Error fetching K-line for ${symbol}:`, error);
    // If CoinGecko fails, we could try other free alternatives here
    return null;
  }
}

// Call initializeSymbolMapping when the module is loaded
initializeSymbolMapping();

// Add more functions as needed (e.g., getOrderbook, placeOrder simulation if complex)
