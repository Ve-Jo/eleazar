import fetch from "node-fetch";

const BYBIT_API_URL = "https://api.bybit.com"; // Or use testnet: https://api-testnet.bybit.com

/**
 * Fetches the latest ticker information for given symbols from Bybit.
 * @param {string[]} symbols - Array of symbols (e.g., ['BTCUSDT', 'ETHUSDT'])
 * @returns {Promise<object|null>} Object mapping symbol to its ticker data, or null on error.
 *                                  Ticker data includes lastPrice, markPrice, etc.
 */
export async function getTickers(symbols = []) {
  if (!symbols || symbols.length === 0) {
    return {};
  }

  // Bybit v5 API uses a single endpoint for multiple tickers via 'symbol' query param
  // However, it seems the 'tickers' endpoint is better suited for getting multiple symbols' last price efficiently.
  // We'll fetch all linear tickers and filter. Alternatively, fetch one by one if the list is usually small.
  const url = `${BYBIT_API_URL}/v5/market/tickers?category=linear`; // Linear USDT perpetuals

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `HTTP error! status: ${response.status} ${await response.text()}`
      );
    }
    const data = await response.json();

    if (data.retCode !== 0) {
      throw new Error(
        `Bybit API error: ${data.retMsg} (Code: ${data.retCode})`
      );
    }

    const results = {};
    const symbolSet = new Set(symbols); // For efficient lookup

    if (data.result && data.result.list) {
      data.result.list.forEach((ticker) => {
        if (symbolSet.has(ticker.symbol)) {
          results[ticker.symbol] = {
            symbol: ticker.symbol,
            lastPrice: parseFloat(ticker.lastPrice),
            markPrice: parseFloat(ticker.markPrice), // Mark price is often used for PnL in futures
            // Add other relevant fields
            highPrice24h: parseFloat(ticker.highPrice24h),
            lowPrice24h: parseFloat(ticker.lowPrice24h),
            price24hPcnt: parseFloat(ticker.price24hPcnt), // 24h change percentage
            volume24h: parseFloat(ticker.volume24h || 0), // 24h trading volume
            turnover24h: parseFloat(ticker.turnover24h || 0), // 24h turnover in USD
          };
        }
      });
    }

    // Check if all requested symbols were found
    for (const symbol of symbols) {
      if (!results[symbol]) {
        console.warn(`[cryptoApi] Ticker data not found for symbol: ${symbol}`);
        // Optionally try fetching individually as a fallback, but might be slow
      }
    }

    return results;
  } catch (error) {
    console.error("[cryptoApi] Error fetching tickers:", error);
    return null; // Indicate error
  }
}

/**
 * Fetches historical K-line (candlestick) data for a symbol.
 * @param {string} symbol - The trading symbol (e.g., 'BTCUSDT').
 * @param {string} interval - Candlestick interval (e.g., '1', '5', '15', '60', 'D').
 * @param {number} limit - Number of candles to fetch (max 1000 for Bybit v5).
 * @returns {Promise<Array<object>|null>} Array of candles or null on error.
 *                                       Each candle: [timestamp, open, high, low, close, volume, turnover]
 */
export async function getKline(symbol, interval = "15", limit = 100) {
  const url = `${BYBIT_API_URL}/v5/market/kline?category=linear&symbol=${symbol}&interval=${interval}&limit=${limit}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `HTTP error! status: ${response.status} ${await response.text()}`
      );
    }
    const data = await response.json();

    if (data.retCode !== 0) {
      throw new Error(
        `Bybit API error: ${data.retMsg} (Code: ${data.retCode})`
      );
    }

    if (data.result && data.result.list) {
      // Convert string values to numbers
      return data.result.list
        .map((k) => [
          parseInt(k[0]), // timestamp
          parseFloat(k[1]), // open
          parseFloat(k[2]), // high
          parseFloat(k[3]), // low
          parseFloat(k[4]), // close
          parseFloat(k[5]), // volume
          parseFloat(k[6]), // turnover
        ])
        .reverse(); // Bybit returns newest first, reverse to get oldest first
    } else {
      console.warn(`[cryptoApi] No K-line data returned for ${symbol}`);
      return [];
    }
  } catch (error) {
    console.error(`[cryptoApi] Error fetching K-line for ${symbol}:`, error);
    return null;
  }
}

// Add more functions as needed (e.g., getOrderbook, placeOrder simulation if complex)
