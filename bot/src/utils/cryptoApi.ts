import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

type CmcMapCoin = {
  id: number;
  symbol: string;
};

type MexcTicker = {
  symbol: string;
  lastPrice: string;
  highPrice: string;
  lowPrice: string;
  priceChangePercent: string;
  volume: string;
  quoteVolume: string;
  closeTime: number;
};

type TickerResultEntry = {
  symbol: string;
  lastPrice: number;
  markPrice: number;
  highPrice24h: number;
  lowPrice24h: number;
  price24hPcnt: number;
  volume24h: number;
  turnover24h: number;
  lastUpdated: number;
};

type TickerResult = {
  timestamp: number;
  fromCache: boolean;
  stale?: boolean;
  [symbol: string]: TickerResultEntry | number | boolean | undefined;
};

type CategoryRecord = Record<string, unknown>;

type CategoryCache = {
  allCategories: CategoryRecord[] | null;
  categoryCoins: Record<string, CategoryRecord[] | null>;
  timestamp: number;
  maxAge: number;
};

const CMC_API_URL = "https://pro-api.coinmarketcap.com/v1";
const CMC_API_KEY = process.env.COINMARKETCAP_API_KEY || "";
const MEXC_API_URL = "https://api.mexc.com/api/v3";

let validCmcSymbols = new Set<string>();
let validCmcSymbolMap = new Map<string, number>();

const priceCache: {
  data: Record<string, TickerResult>;
  timestamps: Record<string, number>;
  maxAge: number;
} = {
  data: {},
  timestamps: {},
  maxAge: 30000,
};

const categoryCache: CategoryCache = {
  allCategories: null,
  categoryCoins: {},
  timestamp: 0,
  maxAge: 60 * 60 * 1000,
};

async function initializeSymbolMapping(): Promise<void> {
  if (!CMC_API_KEY) {
    console.warn("[cryptoApi] CoinMarketCap API key not found in environment variables.");
    return;
  }

  try {
    const response = await axios.get<{ data: CmcMapCoin[] }>(
      `${CMC_API_URL}/cryptocurrency/map`,
      {
        headers: {
          "X-CMC_PRO_API_KEY": CMC_API_KEY,
        },
        params: { listing_status: "active" },
      }
    );

    if (response.status !== 200) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = response.data.data;
    validCmcSymbols = new Set(data.map((coin) => coin.symbol));
    validCmcSymbolMap = new Map(data.map((coin) => [coin.symbol, coin.id]));

    console.log(
      `[cryptoApi] Symbol mapping initialized successfully with ${validCmcSymbols.size} active symbols.`
    );
  } catch (error) {
    console.error("[cryptoApi] Error initializing symbol mapping:", error);
  }
}

function getValidCmcSymbols(): Set<string> {
  return validCmcSymbols;
}

function getValidCmcSymbolMap(): Map<string, number> {
  return validCmcSymbolMap;
}

async function getTickers(
  symbols: string[] = [],
  _forceRefresh = false
): Promise<TickerResult | Record<string, never> | null> {
  if (!symbols || symbols.length === 0) {
    return {};
  }

  const now = Date.now();
  const cacheKey = [...symbols].sort().join(",");

  try {
    const MAX_SYMBOLS_PER_MEXC_REQUEST = 100;
    let requestedSymbols = symbols;

    if (requestedSymbols.length > MAX_SYMBOLS_PER_MEXC_REQUEST) {
      console.warn(
        `[cryptoApi] Requested ${requestedSymbols.length} symbols, but MEXC API limit is ${MAX_SYMBOLS_PER_MEXC_REQUEST}. Only fetching the first ${MAX_SYMBOLS_PER_MEXC_REQUEST}. Consider batching if this happens often.`
      );
      requestedSymbols = requestedSymbols.slice(0, MAX_SYMBOLS_PER_MEXC_REQUEST);
    }

    const symbolsParam = encodeURIComponent(JSON.stringify(requestedSymbols));
    const url = `${MEXC_API_URL}/ticker/24hr?symbols=${symbolsParam}`;

    console.log(`[cryptoApi] Fetching ${requestedSymbols.length} tickers from MEXC...`);

    const response = await axios.get<MexcTicker[]>(url);

    if (response.status !== 200 || !Array.isArray(response.data)) {
      console.error(
        `[cryptoApi] MEXC API error! Status: ${response.status}, Data: ${JSON.stringify(response.data)}`
      );
      throw new Error(`MEXC API error! status: ${response.status}`);
    }

    const mexcTickerMap = new Map(response.data.map((ticker) => [ticker.symbol, ticker]));
    const results: TickerResult = {
      timestamp: now,
      fromCache: false,
    };
    let symbolsFound = 0;

    requestedSymbols.forEach((requestedSymbol) => {
      const tickerData = mexcTickerMap.get(requestedSymbol);

      if (tickerData) {
        symbolsFound += 1;
        results[requestedSymbol] = {
          symbol: tickerData.symbol,
          lastPrice: parseFloat(tickerData.lastPrice),
          markPrice: parseFloat(tickerData.lastPrice),
          highPrice24h: parseFloat(tickerData.highPrice),
          lowPrice24h: parseFloat(tickerData.lowPrice),
          price24hPcnt: parseFloat(tickerData.priceChangePercent),
          volume24h: parseFloat(tickerData.volume),
          turnover24h: parseFloat(tickerData.quoteVolume),
          lastUpdated: tickerData.closeTime,
        };
      }
    });

    console.log(
      `[cryptoApi] Processed ${symbolsFound}/${requestedSymbols.length} requested symbols from MEXC response.`
    );

    return results;
  } catch (error) {
    const typedError = error as Error;
    console.error(
      "[cryptoApi] Error fetching tickers from MEXC:",
      typedError.message || error
    );

    if (priceCache.data[cacheKey]) {
      const staleData = priceCache.data[cacheKey];
      staleData.timestamp = priceCache.timestamps[cacheKey] ?? now;
      staleData.fromCache = true;
      staleData.stale = true;
      console.warn("[cryptoApi] Returning stale price cache data due to error.");
      return staleData;
    }

    return null;
  }
}

async function getCategories(forceRefresh = false): Promise<CategoryRecord[] | null> {
  if (
    !forceRefresh &&
    categoryCache.allCategories &&
    Date.now() - categoryCache.timestamp < categoryCache.maxAge
  ) {
    return categoryCache.allCategories;
  }

  if (!CMC_API_KEY) {
    console.error("[cryptoApi] CoinMarketCap API key not found for category lookup");
    return null;
  }

  try {
    const response = await axios.get<{ data?: CategoryRecord[] }>(
      `${CMC_API_URL}/cryptocurrency/categories`,
      {
        headers: { "X-CMC_PRO_API_KEY": CMC_API_KEY },
      }
    );

    if (response.status !== 200 || !response.data.data) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    categoryCache.allCategories = response.data.data;
    categoryCache.timestamp = Date.now();

    return response.data.data;
  } catch (error) {
    console.error("[cryptoApi] Error fetching categories:", error);
    return categoryCache.allCategories || [];
  }
}

async function getCategoryCoins(
  categoryId: string,
  forceRefresh = false
): Promise<CategoryRecord[] | null> {
  if (
    !forceRefresh &&
    categoryCache.categoryCoins[categoryId] &&
    Date.now() - categoryCache.timestamp < categoryCache.maxAge
  ) {
    return categoryCache.categoryCoins[categoryId];
  }

  try {
    const response = await axios.get<{ data?: CategoryRecord[] }>(
      `${CMC_API_URL}/cryptocurrency/category`,
      {
        headers: { "X-CMC_PRO_API_KEY": CMC_API_KEY },
        params: {
          id: categoryId,
          limit: 200,
        },
      }
    );

    if (response.status !== 200 || !response.data.data) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    categoryCache.categoryCoins[categoryId] = response.data.data;

    return response.data.data;
  } catch (error) {
    console.error(`[cryptoApi] Error fetching coins for category ${categoryId}:`, error);
    return categoryCache.categoryCoins[categoryId] || null;
  }
}

void initializeSymbolMapping();

export {
  initializeSymbolMapping,
  getValidCmcSymbols,
  getValidCmcSymbolMap,
  getTickers,
  getCategories,
  getCategoryCoins,
};
