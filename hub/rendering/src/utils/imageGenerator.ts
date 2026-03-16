// @ts-nocheck
import dotenv from "dotenv";
import sharp from "sharp";
import twemoji from "@twemoji/api";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";
import fetch from "node-fetch";
import { getPaletteFromURL, getColorFromURL } from "color-thief-bun";
import {
  rasterizeSvgToWebp,
  renderWithSatori,
  renderWithTakumi,
} from "./renderBackends.js";

// Load environment variables
dotenv.config({ path: "../../.env" });

// Configure Bun's garbage collector if available
if (typeof Bun !== "undefined" && Bun.gc) {
  // Lower GC threshold for more frequent collection
  Bun.gc(true);
}

const __dirname = dirname(fileURLToPath(import.meta.url));

const TEMP_DIR = join(__dirname, "..", "temp");
const EMOJI_DIR = join(TEMP_DIR, "emoji");
const MAX_BANNER_SIZE = 5 * 1024 * 1024; // 5MB limit
const BANNER_TIMEOUT = 5000; // 5 seconds

// Enhanced cache instances with TTL and metrics
const emojiCache = new Map();
const colorCache = new Map(); // Cache for processImageColors results
const imageAssetCache = new Map();

// Cache configuration
const COLOR_CACHE_MAX_SIZE = 50; // Increased cache size slightly
const COLOR_CACHE_TTL = 2 * 60 * 60 * 1000; // 2 hours TTL (increased from 30 minutes)
const CACHE_COMPRESSION_ENABLED = true;
const DEBUG_CACHE = parseBooleanEnv(process.env.RENDER_DEBUG_CACHE, false);
const IMAGE_ASSET_CACHE_TTL_MS =
  parseInt(process.env.IMAGE_ASSET_CACHE_TTL_MS, 10) || 10 * 60 * 1000;
const DEFAULT_RENDER_ASSET_BASE_URL =
  process.env.RENDER_ASSET_BASE_URL ||
  process.env.BASE_URL ||
  "http://localhost:2333";

// AVIF and sharp tuning (configurable via env)
const DEFAULT_AVIF_QUALITY = parseInt(process.env.AVIF_QUALITY) || 100;
const DEFAULT_AVIF_EFFORT = parseInt(process.env.AVIF_EFFORT) || 1;
const DEFAULT_AVIF_SUBSAMPLE = process.env.AVIF_SUBSAMPLING || "4:2:0";
const SHARP_CONCURRENCY = parseInt(process.env.SHARP_CONCURRENCY) || 2;
function parseBooleanEnv(value, fallback) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}
const USE_RESVG_RASTER = parseBooleanEnv(process.env.USE_RESVG_RASTER, true);
const RENDER_BACKEND = (process.env.RENDER_BACKEND || "takumi").toLowerCase();
const PERF_LOGGING = parseBooleanEnv(process.env.RENDER_PERF_LOGGING, false);

// Per-user gradient cache and in-flight deduplication
const userGradientCache = new Map();
const USER_GRADIENT_TTL_MS = 60 * 1000; // 1 minute TTL for per-user gradient processing
const inflightColorRequests = new Map();

// Cache metrics
const cacheMetrics = {
  hits: 0,
  misses: 0,
  evictions: 0,
  expirations: 0,
  size: 0,
  memoryUsage: 0,
};

// Per-user gradient cache metrics
const userCacheMetrics = {
  hits: 0,
  misses: 0,
  expirations: 0,
  size: 0,
};

// Cache entry structure
class CacheEntry {
  constructor(data, ttl = COLOR_CACHE_TTL) {
    this.data = data;
    this.timestamp = Date.now();
    this.ttl = ttl;
    this.accessCount = 0;
    this.lastAccess = Date.now();
    this.size = this.calculateSize();
  }

  calculateSize() {
    // Rough size calculation in bytes
    const dataString = JSON.stringify(this.data);
    return new Blob([dataString]).size;
  }

  isExpired() {
    return Date.now() - this.timestamp > this.ttl;
  }

  access() {
    this.accessCount++;
    this.lastAccess = Date.now();
  }
}

function bufferToArrayBuffer(buffer) {
  if (buffer instanceof ArrayBuffer) return buffer;
  if (Buffer.isBuffer(buffer)) {
    return buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength
    );
  }
  return new ArrayBuffer(0);
}

// Fonts configuration
let fonts = null;
const componentModuleCache = new Map();

// Initialize sharp (needed for color processing and potentially output)
sharp.cache(false);
sharp.concurrency(SHARP_CONCURRENCY);

// Initialize fonts
const defaultFontConfig = [
  { name: "Inter400", file: "Inter_28pt-Regular.ttf", weight: 400 },
  { name: "Inter500", file: "Inter_28pt-Medium.ttf", weight: 500 },
  { name: "Inter600", file: "Inter_28pt-SemiBold.ttf", weight: 600 },
  { name: "Inter700", file: "Inter_28pt-Bold.ttf", weight: 700 },
  { name: "Inter800", file: "Inter_28pt-ExtraBold.ttf", weight: 800 },
  { name: "Inter300", file: "Inter_28pt-Light.ttf", weight: 300 },
  { name: "Inter200", file: "Inter_28pt-ExtraLight.ttf", weight: 200 },
  { name: "Inter100", file: "Inter_28pt-Thin.ttf", weight: 100 },
  { name: "Roboto", file: "Roboto-Medium.ttf", weight: 500 },
].map((config) => ({
  ...config,
  style: "normal",
  path: join(__dirname, "..", "public", "fonts", config.file),
}));

// Initialize temp directory
export async function ensureTempDir() {
  try {
    await fs.stat(TEMP_DIR);
  } catch {
    await fs.mkdir(TEMP_DIR, { recursive: true });
  }

  // Ensure emoji directory exists
  try {
    await fs.stat(EMOJI_DIR);
  } catch {
    await fs.mkdir(EMOJI_DIR, { recursive: true });
  }
}

// Load fonts only once
async function loadFonts() {
  if (fonts) return fonts;

  try {
    fonts = await Promise.all(
      defaultFontConfig.map(async (font) => ({
        name: font.name,
        data: await fs.readFile(font.path),
        weight: font.weight,
        style: font.style,
      }))
    );
    return fonts;
  } catch (error) {
    console.error("Failed to load fonts:", error);
    throw error;
  }
}

// Enhanced cleanup function with GC trigger and cache metrics reset
export async function cleanup(forceGC = true) {
  // Log cache statistics before cleanup

  if (forceGC) {
    // Full cleanup only when forced: clear caches and reset metrics
    emojiCache.clear();
    colorCache.clear();
    imageAssetCache.clear();
    userGradientCache.clear();
    inflightColorRequests.clear();

    cacheMetrics.hits = 0;
    cacheMetrics.misses = 0;
    cacheMetrics.evictions = 0;
    cacheMetrics.expirations = 0;
    cacheMetrics.size = 0;
    cacheMetrics.memoryUsage = 0;

    userCacheMetrics.hits = 0;
    userCacheMetrics.misses = 0;
    userCacheMetrics.expirations = 0;
    userCacheMetrics.size = 0;
  } else {
    // Light cleanup between renders: prune expired entries and keep caches intact
    manageColorCache();
  }

  sharp.cache(false);
  if (forceGC && global.gc) {
    global.gc();
  }
  // Consider if Bun.gc needs explicit call here too if issues persist
}

// Enhanced cache management with TTL and LRU
function normalizeUrl(url) {
  if (!url) return url;

  try {
    const urlObj = new URL(url);

    // Remove query parameters and fragments for caching
    urlObj.search = "";
    urlObj.hash = "";

    // Aggressive hostname normalization
    urlObj.hostname = urlObj.hostname.toLowerCase().replace(/^www\./, "");

    // Remove default ports
    if (
      (urlObj.protocol === "http:" && urlObj.port === "80") ||
      (urlObj.protocol === "https:" && urlObj.port === "443")
    ) {
      urlObj.port = "";
    }

    // Remove trailing slashes from pathname
    let pathname = urlObj.pathname;
    if (pathname.length > 1 && pathname.endsWith("/")) {
      pathname = pathname.slice(0, -1);
    }
    urlObj.pathname = pathname;

    // Convert to lowercase for consistency (excluding protocol)
    const normalized = urlObj.toString();

    if (DEBUG_CACHE) {
      console.log(`[ColorCache Debug] Normalize: "${url}" -> "${normalized}"`);
    }

    return normalized;
  } catch {
    // If URL parsing fails, return lowercase original
    const fallback = url.toLowerCase();
    if (DEBUG_CACHE) {
      console.log(
        `[ColorCache Debug] Parse failed, using fallback: "${url}" -> "${fallback}"`
      );
    }
    return fallback;
  }
}

function updateCacheMetrics() {
  cacheMetrics.size = colorCache.size;

  // Calculate approximate memory usage
  let totalSize = 0;
  colorCache.forEach((entry) => {
    totalSize += entry.size;
  });
  cacheMetrics.memoryUsage = totalSize;
}

function cleanupExpiredEntries() {
  const now = Date.now();
  let expiredCount = 0;

  for (const [key, entry] of colorCache.entries()) {
    if (entry.isExpired()) {
      colorCache.delete(key);
      expiredCount++;
    }
  }

  if (expiredCount > 0) {
    cacheMetrics.expirations += expiredCount;
    console.log(`[ColorCache] Cleaned up ${expiredCount} expired entries`);
  }
}

function manageColorCache() {
  // Clean expired entries first
  cleanupExpiredEntries();

  // LRU eviction if over max size
  while (colorCache.size > COLOR_CACHE_MAX_SIZE) {
    let oldestKey = null;
    let oldestAccess = Infinity;

    // Find least recently used entry
    for (const [key, entry] of colorCache.entries()) {
      if (entry.lastAccess < oldestAccess) {
        oldestAccess = entry.lastAccess;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      colorCache.delete(oldestKey);
      cacheMetrics.evictions++;
    } else {
      // Fallback to first entry if LRU fails
      const firstKey = colorCache.keys().next().value;
      if (firstKey) {
        colorCache.delete(firstKey);
        cacheMetrics.evictions++;
      }
      break;
    }
  }

  updateCacheMetrics();
}

// Per-user gradient caching helpers
function getCachedUserGradient(userId) {
  if (!userId) return null;
  const entry = userGradientCache.get(userId);
  if (!entry) {
    userCacheMetrics.misses++;
    userCacheMetrics.size = userGradientCache.size;
    return null;
  }
  if (Date.now() - entry.timestamp > USER_GRADIENT_TTL_MS) {
    userGradientCache.delete(userId);
    userCacheMetrics.expirations++;
    userCacheMetrics.size = userGradientCache.size;
    return null;
  }
  userCacheMetrics.hits++;
  return entry.data;
}

function setCachedUserGradient(userId, data) {
  if (!userId) return data;
  userGradientCache.set(userId, { data, timestamp: Date.now() });
  userCacheMetrics.size = userGradientCache.size;
  return data;
}

async function getOrProcessImageColorsDedup(url) {
  // Prefer URL-based color cache first
  const cached = getCachedColor(url);
  if (cached) return cached;

  const key = normalizeUrl(url);
  if (inflightColorRequests.has(key)) {
    return inflightColorRequests.get(key);
  }

  const promise = (async () => {
    try {
      const res = await processImageColors(url);
      return res;
    } finally {
      inflightColorRequests.delete(key);
    }
  })();

  inflightColorRequests.set(key, promise);
  return promise;
}

async function getOrProcessUserGradient(userId, imageUrl) {
  const cachedUser = getCachedUserGradient(userId);
  if (cachedUser) {
    return cachedUser;
  }

  const result = await getOrProcessImageColorsDedup(imageUrl);
  setCachedUserGradient(userId, result);
  return result;
}

// Enhanced cache get/set operations
function getCachedColor(url) {
  const normalizedUrl = normalizeUrl(url);
  const entry = colorCache.get(normalizedUrl);

  if (entry) {
    if (entry.isExpired()) {
      colorCache.delete(normalizedUrl);
      cacheMetrics.misses++;
      return null;
    }

    entry.access();
    cacheMetrics.hits++;
    return entry.data;
  }

  cacheMetrics.misses++;
  return null;
}

function setCachedColor(url, data) {
  const normalizedUrl = normalizeUrl(url);
  const entry = new CacheEntry(data);

  colorCache.set(normalizedUrl, entry);
  manageColorCache();

  return data;
}

// Enhanced emoji handling with proper resource cleanup and file storage
export async function fetchEmojiSvg(emoji, emojiScaling = 1) {
  if (!emoji) return null;

  const emojiCode = twemoji.convert.toCodePoint(emoji);
  if (!emojiCode) return null;

  // Remove variation selector for base character consistency
  const cleanEmojiCode = emojiCode.replace(/-fe0f$/, "");

  // Clamp scaling
  const validatedScaling = Math.min(Math.max(emojiScaling, 0.5), 3);
  const cleanCacheKey = `${cleanEmojiCode}-${validatedScaling}`;
  const cleanEmojiFilePath = join(
    EMOJI_DIR,
    `${cleanEmojiCode}-${validatedScaling}.svg`
  );

  // In-memory cache
  if (emojiCache.has(cleanCacheKey)) {
    return emojiCache.get(cleanCacheKey);
  }

  // Disk cache
  try {
    const fileBuffer = await fs.readFile(cleanEmojiFilePath);
    const base64 = `data:image/svg+xml;base64,${fileBuffer.toString("base64")}`;
    emojiCache.set(cleanCacheKey, base64);
    return base64;
  } catch {}

  // Fetch from CDN and scale attributes
  console.time(`[imageGenerator] emoji-fetch-${emoji}`);
  let svgUrl = `https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/${cleanEmojiCode}.svg`;
  let response = await fetch(svgUrl);
  if (!response.ok) {
    svgUrl = `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/${cleanEmojiCode}.svg`;
    response = await fetch(svgUrl);
    if (!response.ok) {
      console.timeEnd(`[imageGenerator] emoji-fetch-${emoji}`);
      return null;
    }
  }

  const svgData = await response.text();
  const scaledSize = Math.round(64 * validatedScaling);
  let scaledSvg = svgData
    .replace(/width="([^"]+)"/, `width="${scaledSize}"`)
    .replace(/height="([^"]+)"/, `height="${scaledSize}"`);
  if (!scaledSvg.includes("viewBox")) {
    scaledSvg = scaledSvg.replace(
      "<svg",
      `<svg viewBox="0 0 ${scaledSize} ${scaledSize}"`
    );
  }

  const svgBuffer = Buffer.from(scaledSvg, "utf-8");
  const base64 = `data:image/svg+xml;base64,${svgBuffer.toString("base64")}`;

  // Persist to disk for future renders
  try {
    await fs.writeFile(cleanEmojiFilePath, svgBuffer);
  } catch {}

  emojiCache.set(cleanCacheKey, base64);
  console.timeEnd(`[imageGenerator] emoji-fetch-${emoji}`);
  return base64;
}

// Enhanced batch processing for color preparation
const batchProcessingQueue = new Map();
const MAX_CONCURRENT_BATCHES = 3;
const BATCH_SIZE = 5;
const BATCH_TIMEOUT = 10000; // 10 seconds

class BatchProcessor {
  constructor() {
    this.currentBatches = new Map();
    this.processingCount = 0;
  }

  async processBatch(urls, batchId) {
    if (this.processingCount >= MAX_CONCURRENT_BATCHES) {
      throw new Error("Maximum concurrent batches reached");
    }

    this.processingCount++;
    const batch = {
      urls,
      id: batchId,
      startTime: Date.now(),
      results: new Map(),
      errors: new Map(),
    };

    try {
      const promises = urls.map(async (url) => {
        try {
          const result = await processImageColors(url);
          batch.results.set(url, result);
        } catch (error) {
          batch.errors.set(url, error);
        }
      });

      await Promise.allSettled(promises);
      return batch;
    } finally {
      this.processingCount--;
      this.currentBatches.delete(batchId);
    }
  }

  addToBatch(urls) {
    const batchId = `batch_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    return new Promise((resolve, reject) => {
      // Set timeout for batch processing
      const timeout = setTimeout(() => {
        this.currentBatches.delete(batchId);
        reject(new Error(`Batch processing timeout after ${BATCH_TIMEOUT}ms`));
      }, BATCH_TIMEOUT);

      this.currentBatches.set(batchId, { urls, timeout, resolve, reject });

      // Process batch immediately if we have capacity, or queue it
      this.processBatch(urls, batchId)
        .then((result) => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }
}

const batchProcessor = new BatchProcessor();

// Enhanced formatValue with caching
const formatValueCache = new Map();
const FORMAT_CACHE_MAX_SIZE = 100;

function getCachedFormattedValue(value) {
  const cacheKey = JSON.stringify(value, (_, value) =>
    typeof value === "bigint" ? value.toString() : value
  );

  if (formatValueCache.has(cacheKey)) {
    return formatValueCache.get(cacheKey);
  }

  const formatted = formatValue(value);
  formatValueCache.set(cacheKey, formatted);

  // Manage cache size
  if (formatValueCache.size > FORMAT_CACHE_MAX_SIZE) {
    const firstKey = formatValueCache.keys().next().value;
    formatValueCache.delete(firstKey);
  }

  return formatted;
}

// Helper function to format values (enhanced)
export function formatValue(value) {
  // Handle null or undefined
  if (value === null || value === undefined) {
    return value;
  }

  // Handle strings that look like numbers
  if (typeof value === "string") {
    // Handle decimal numbers
    if (/^\-?\d*\.?\d+$/.test(value)) {
      const num = Number(value);
      return !isNaN(num) ? num : value;
    }
    // Handle bigint-like strings (for Discord IDs)
    if (/^\d{17,19}$/.test(value)) {
      return value;
    }
    return value;
  }

  // Handle arrays
  if (Array.isArray(value)) {
    return value.map(formatValue);
  }

  // Handle objects
  if (typeof value === "object") {
    const formatted = {};
    for (const [key, val] of Object.entries(value)) {
      // Parse JSON strings (like in cooldowns.data)
      if (key === "data" && typeof val === "string" && val.startsWith("{")) {
        try {
          formatted[key] = formatValue(JSON.parse(val));
        } catch {
          formatted[key] = val;
        }
      } else {
        formatted[key] = formatValue(val);
      }
    }
    return formatted;
  }

  return value;
}

// Batch color processing function
export async function processBatchImageColors(urls) {
  if (!Array.isArray(urls) || urls.length === 0) {
    return [];
  }

  console.log(`[BatchProcessor] Processing ${urls.length} URLs...`);

  try {
    const batch = await batchProcessor.addToBatch(urls);

    const results = urls.map((url) => {
      if (batch.errors.has(url)) {
        console.warn(
          `[BatchProcessor] Failed to process ${url}:`,
          batch.errors.get(url)
        );
        return {
          url,
          error: batch.errors.get(url),
          colors: getDefaultColors(),
        };
      }
      return { url, colors: batch.results.get(url) };
    });

    console.log(
      `[BatchProcessor] Completed batch in ${Date.now() - batch.startTime}ms`
    );
    return results;
  } catch (error) {
    console.error("[BatchProcessor] Batch processing failed:", error);
    // Fallback to individual processing
    const fallbackResults = await Promise.allSettled(
      urls.map(async (url) => ({
        url,
        colors: await processImageColors(url),
      }))
    );

    return fallbackResults.map((result, index) => {
      if (result.status === "fulfilled") {
        return result.value;
      } else {
        console.warn(
          `[BatchProcessor] Fallback failed for ${urls[index]}:`,
          result.reason
        );
        return {
          url: urls[index],
          error: result.reason,
          colors: getDefaultColors(),
        };
      }
    });
  }
}

// Helper function to validate RGB values
function validateRGB(r, g, b) {
  const isValidComponent = (c) =>
    typeof c === "number" && !isNaN(c) && c >= 0 && c <= 255;
  return isValidComponent(r) && isValidComponent(g) && isValidComponent(b);
}

// Helper function to convert RGB values to Discord color integer
function rgbToDiscordColor(r, g, b) {
  if (
    typeof r !== "number" ||
    typeof g !== "number" ||
    typeof b !== "number" ||
    !validateRGB(r, g, b)
  ) {
    return process.env.EMBED_COLOR || "#2B2D31";
  }
  const hexValue = ((r << 16) + (g << 8) + b).toString(16).toUpperCase();
  return "#" + hexValue.padStart(6, "0");
}

// LAB color space utilities for perceptually uniform color processing
function rgbToXyz(r, g, b) {
  // Convert RGB to XYZ color space
  r = r / 255;
  g = g / 255;
  b = b / 255;

  // Apply gamma correction
  r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
  g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
  b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

  // Convert to XYZ using sRGB matrix
  const x = r * 0.4124564 + g * 0.3575761 + b * 0.1804375;
  const y = r * 0.2126729 + g * 0.7151522 + b * 0.072175;
  const z = r * 0.0193339 + g * 0.119192 + b * 0.9503041;

  return [x, y, z];
}

function xyzToLab(x, y, z) {
  // Normalize by D65 illuminant
  x = x / 0.95047;
  y = y / 1.0;
  z = z / 1.08883;

  // Apply non-linear transformation
  x = x > 0.008856 ? Math.pow(x, 1 / 3) : 7.787 * x + 16 / 116;
  y = y > 0.008856 ? Math.pow(y, 1 / 3) : 7.787 * y + 16 / 116;
  z = z > 0.008856 ? Math.pow(z, 1 / 3) : 7.787 * z + 16 / 116;

  const l = 116 * y - 16;
  const a = 500 * (x - y);
  const b = 200 * (y - z);

  return [l, a, b];
}

function labToXyz(l, a, b) {
  // Convert LAB back to XYZ
  let y = (l + 16) / 116;
  let x = a / 500 + y;
  let z = y - b / 200;

  // Reverse non-linear transformation
  x = x * x * x > 0.008856 ? x * x * x : (x - 16 / 116) / 7.787;
  y = y * y * y > 0.008856 ? y * y * y : (y - 16 / 116) / 7.787;
  z = z * z * z > 0.008856 ? z * z * z : (z - 16 / 116) / 7.787;

  // Denormalize
  x = x * 0.95047;
  y = y * 1.0;
  z = z * 1.08883;

  return [x, y, z];
}

function xyzToRgb(x, y, z) {
  // Convert XYZ to RGB using inverse sRGB matrix
  let r = x * 3.2404542 + y * -1.5371385 + z * -0.4985314;
  let g = x * -0.969266 + y * 1.8760108 + z * 0.041556;
  let b = x * 0.0556434 + y * -0.2040259 + z * 1.0572252;

  // Apply inverse gamma correction
  r = r > 0.0031308 ? 1.055 * Math.pow(r, 1 / 2.4) - 0.055 : 12.92 * r;
  g = g > 0.0031308 ? 1.055 * Math.pow(g, 1 / 2.4) - 0.055 : 12.92 * g;
  b = b > 0.0031308 ? 1.055 * Math.pow(b, 1 / 2.4) - 0.055 : 12.92 * b;

  // Clamp to valid RGB range
  r = Math.max(0, Math.min(1, r));
  g = Math.max(0, Math.min(1, g));
  b = Math.max(0, Math.min(1, b));

  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function rgbToLab(r, g, b) {
  const [x, y, z] = rgbToXyz(r, g, b);
  return xyzToLab(x, y, z);
}

function labToRgb(l, a, b) {
  const [x, y, z] = labToXyz(l, a, b);
  return xyzToRgb(x, y, z);
}

// Ultra-strict color enhancement algorithm - preserves pure whites and blacks
function enhanceColorSaturation(r, g, b) {
  // Ultra-strict handling for pure white - return exact white
  if (r >= 252 && g >= 252 && b >= 252) {
    return { r: 255, g: 255, b: 255 };
  }

  // Ultra-strict handling for pure black - return exact black
  if (r <= 8 && g <= 8 && b <= 8) {
    return { r: 0, g: 0, b: 0 };
  }

  // Strict handling for near-white colors - minimal processing
  const isNearWhite = r > 245 && g > 245 && b > 245;
  if (isNearWhite) {
    // Use average to maintain neutral white, minimal adjustment
    const avg = Math.round((r + g + b) / 3);
    return {
      r: Math.min(255, avg + 1),
      g: Math.min(255, avg + 1),
      b: Math.min(255, avg + 1),
    };
  }

  // Strict handling for near-black colors - minimal processing
  const isNearBlack = r < 20 && g < 20 && b < 20;
  if (isNearBlack) {
    // Use average to maintain neutral black, minimal adjustment
    const avg = Math.round((r + g + b) / 3);
    return {
      r: Math.max(0, avg - 1),
      g: Math.max(0, avg - 1),
      b: Math.max(0, avg - 1),
    };
  }

  // For all other colors, use minimal LAB processing
  const [l, a, b_lab] = rgbToLab(r, g, b);

  // Ultra-subtle lightness adjustment
  let enhancedL = l;
  let enhancedA = a;
  let enhancedB_lab = b_lab;

  if (l > 50) {
    enhancedL = Math.min(98, l + 2); // Very slight lightening
  } else {
    enhancedL = Math.max(2, l - 2); // Very slight darkening
  }

  // Only for clearly colored content
  const chromaBoost = 1.5;
  enhancedA = a * chromaBoost;
  enhancedB_lab = b_lab * chromaBoost;

  // Strict limits to prevent color casts
  const maxChroma = 50; // Very conservative
  const currentChroma = Math.sqrt(
    enhancedA * enhancedA + enhancedB_lab * enhancedB_lab
  );
  if (currentChroma > maxChroma) {
    const scale = maxChroma / currentChroma;
    enhancedA *= scale;
    enhancedB_lab *= scale;
  }

  const [enhancedR, enhancedG, enhancedB] = labToRgb(
    enhancedL,
    enhancedA,
    enhancedB_lab
  );
  return { r: enhancedR, g: enhancedG, b: enhancedB };
}

function getLuminance(r, g, b) {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

// Softer processColors - reduced intensity for more pleasant color schemes
function processColors(dominantColorRgbArray, options = {}) {
  const { gradientAngle = Math.floor(Math.random() * 360) } = options;

  if (
    !Array.isArray(dominantColorRgbArray) ||
    dominantColorRgbArray.length < 3 ||
    !validateRGB(...dominantColorRgbArray)
  ) {
    console.warn(
      "Invalid RGB array passed to processColors:",
      dominantColorRgbArray
    );
    return getDefaultColors();
  }

  const [r, g, b] = dominantColorRgbArray;

  // Enhance saturation and contrast of the dominant color (now softer)
  const enhancedRgb = enhanceColorSaturation(r, g, b);
  const enhancedColor = `rgb(${enhancedRgb.r}, ${enhancedRgb.g}, ${enhancedRgb.b})`;

  const luminance = getLuminance(enhancedRgb.r, enhancedRgb.g, enhancedRgb.b);
  const isDarkText = luminance > 0.5;

  // Generate secondary color using LAB color space for harmonious variations
  const [primaryL, primaryA, primaryB] = rgbToLab(
    enhancedRgb.r,
    enhancedRgb.g,
    enhancedRgb.b
  );

  // Create harmonious variations in LAB space
  let secondaryL = primaryL;
  let secondaryA = primaryA;
  let secondaryB_lab = primaryB;

  // Subtle lightness variation (complementary lightness)
  if (primaryL > 50) {
    secondaryL = Math.max(20, primaryL - 15); // Make secondary slightly darker
  } else {
    secondaryL = Math.min(80, primaryL + 15); // Make secondary slightly lighter
  }

  // Gentle chroma variation - create subtle color harmony
  const primaryChroma = Math.sqrt(primaryA * primaryA + primaryB * primaryB);
  if (primaryChroma > 5) {
    // Only if there's noticeable color
    // Rotate the color slightly in LAB space for harmony
    const angle = Math.atan2(primaryB, primaryA);
    const newAngle = angle + Math.PI / 6; // 30 degree rotation for harmony
    const newChroma = primaryChroma * 0.9; // Slightly reduce chroma for softness

    secondaryA = Math.cos(newAngle) * newChroma;
    secondaryB_lab = Math.sin(newAngle) * newChroma;
  }

  // Convert secondary LAB back to RGB
  const [secondaryR, secondaryG, secondaryB] = labToRgb(
    secondaryL,
    secondaryA,
    secondaryB_lab
  );
  const secondaryColor = `rgb(${secondaryR}, ${secondaryG}, ${secondaryB})`;

  return {
    textColor: isDarkText ? "#000000" : "#FFFFFF",
    secondaryTextColor: isDarkText
      ? "rgba(0, 0, 0, 0.8)"
      : "rgba(255, 255, 255, 0.8)",
    tertiaryTextColor: isDarkText
      ? "rgba(0, 0, 0, 0.4)"
      : "rgba(255, 255, 255, 0.4)",
    isDarkText,
    // Use enhanced colors for gradient
    backgroundGradient: `linear-gradient(${gradientAngle}deg, ${enhancedColor}, ${secondaryColor})`,
    dominantColor: enhancedColor,
    secondaryColor: secondaryColor,
    overlayBackground: isDarkText
      ? "rgba(0, 0, 0, 0.1)"
      : "rgba(255, 255, 255, 0.2)",
    embedColor: rgbToDiscordColor(enhancedRgb.r, enhancedRgb.g, enhancedRgb.b), // Embed color based on enhanced dominant
  };
}

// Enhanced processImageColors with advanced caching
export async function processImageColors(imageUrl) {
  console.time(
    `[imageGenerator] color-processing-${imageUrl?.slice(-10) || "unknown"}`
  );

  // Check if imageUrl is not a valid string
  if (
    !imageUrl ||
    typeof imageUrl === "function" ||
    typeof imageUrl !== "string"
  ) {
    console.warn(
      `Invalid image URL type: ${typeof imageUrl}. Using default colors.`
    );
    console.timeEnd(
      `[imageGenerator] color-processing-${imageUrl?.slice(-10) || "unknown"}`
    );
    return getDefaultColors();
  }

  // Try to get from enhanced cache first
  const cachedColor = getCachedColor(imageUrl);
  if (cachedColor) {
    endPerf(`[imageGenerator] color-return`);
    console.timeEnd(
      `[imageGenerator] color-processing-${imageUrl.slice(-10)}`
    );
    return cachedColor;
  }

  const inflightKey = normalizeUrl(imageUrl);
  if (inflightColorRequests.has(inflightKey)) {
    const joined = await inflightColorRequests.get(inflightKey);
    console.timeEnd(
      `[imageGenerator] color-processing-${imageUrl.slice(-10)}`
    );
    return joined;
  }

  const inflightPromise = (async () => {
    try {
      // Fetch and preprocess the image with blur
      const response = await fetch(imageUrl, {
        signal: AbortSignal.timeout(BANNER_TIMEOUT),
      });
      if (!response.ok) {
        console.error(
          `Failed to fetch image: ${response.status} for ${imageUrl}`
        );
        return getDefaultColors();
      }

      const imageBuffer = Buffer.from(await response.arrayBuffer());
      console.log(`Image fetched (${imageUrl}), size:`, imageBuffer.length);

      if (imageBuffer.length > MAX_BANNER_SIZE) {
        console.warn(
          `Image ${imageUrl} exceeds size limit: ${imageBuffer.length} > ${MAX_BANNER_SIZE}`
        );
        return getDefaultColors();
      }

      console.time(
        `[imageGenerator] image-sharp-processing-${imageUrl.slice(-10)}`
      );
      const blurredBuffer = await sharp(imageBuffer)
        .resize(50, 50, { fit: "inside" }) // Keep resize small for performance
        .blur(10) // Reduced blur slightly
        .toBuffer();
      console.timeEnd(
        `[imageGenerator] image-sharp-processing-${imageUrl.slice(-10)}`
      );

      // Get dominant color from the blurred image
      startPerf(`[imageGenerator] color-return`);
      const dominantColorRgb = await getColorFromURL(blurredBuffer.buffer);
      console.timeEnd(
        `[imageGenerator] color-extraction-${imageUrl.slice(-10)}`
      );

      console.log("Extracted dominant color:", dominantColorRgb);

      if (
        !dominantColorRgb ||
        dominantColorRgb.length !== 3 ||
        !validateRGB(...dominantColorRgb)
      ) {
        console.error(
          "Invalid or no color extracted from image:",
          imageUrl,
          dominantColorRgb
        );
        return getDefaultColors();
      }

      // Use the updated processColors function
      console.time(
        `[imageGenerator] color-processing-algorithm-${imageUrl.slice(-10)}`
      );
      const processedResult = processColors(dominantColorRgb);
      console.timeEnd(
        `[imageGenerator] color-processing-algorithm-${imageUrl.slice(-10)}`
      );

      // Store result in enhanced cache
      setCachedColor(imageUrl, processedResult);

      return processedResult;
    } catch (error) {
      if (error.name === "TimeoutError") {
        console.error(`Timeout fetching image colors for ${imageUrl}`);
      } else {
        console.error(`Failed to process image colors for ${imageUrl}:`, error);
      }
      return getDefaultColors();
    } finally {
      inflightColorRequests.delete(inflightKey);
      console.timeEnd(
        `[imageGenerator] color-processing-${imageUrl.slice(-10)}`
      );
    }
  })();

  inflightColorRequests.set(inflightKey, inflightPromise);
  return inflightPromise;
}

// Helper function to provide default colors when color extraction fails
function getDefaultColors() {
  // Default to a pleasant blue color scheme
  const defaultColor = { r: 33, g: 150, b: 243 }; // Material Blue
  return {
    textColor: "#FFFFFF",
    secondaryTextColor: "rgba(255, 255, 255, 0.8)",
    tertiaryTextColor: "rgba(255, 255, 255, 0.4)",
    isDarkText: false,
    backgroundGradient: `linear-gradient(145deg, rgb(${defaultColor.r}, ${
      defaultColor.g
    }, ${defaultColor.b}), rgb(${defaultColor.r * 0.8}, ${
      defaultColor.g * 0.8
    }, ${defaultColor.b}))`,
    overlayBackground: "rgba(255, 255, 255, 0.2)",
    embedColor: rgbToDiscordColor(
      defaultColor.r,
      defaultColor.g,
      defaultColor.b
    ),
  };
}

// Helper function to load image assets (Moved from generateImage)
async function loadImageAsset(url) {
  try {
    const resolvedUrl = resolveAssetUrl(url);
    if (!resolvedUrl) return null;
    if (resolvedUrl.startsWith("data:")) {
      return resolvedUrl;
    }

    const cached = getCachedImageAsset(resolvedUrl);
    if (cached) return cached;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), BANNER_TIMEOUT);
    const response = await fetch(resolvedUrl, {
      headers: { Accept: "image/*" },
      redirect: "follow",
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) return null;

    const contentType = response.headers.get("content-type");
    const normalizedType = contentType?.split(";")[0]?.toLowerCase();
    if (normalizedType && !normalizedType.startsWith("image/")) {
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const safeContentType = normalizedType || "image/png";
    const dataUri = `data:${safeContentType};base64,${Buffer.from(
      arrayBuffer
    ).toString("base64")}`;
    setCachedImageAsset(resolvedUrl, dataUri);
    return dataUri;
  } catch (error) {
    return null;
  }
}

function dataUriToBuffer(dataUri) {
  if (typeof dataUri !== "string") return null;
  const match = dataUri.match(/^data:([^;,]+)?(;base64)?,(.*)$/i);
  if (!match) return null;
  const isBase64 = !!match[2];
  const payload = match[3] || "";
  try {
    if (isBase64) {
      return Buffer.from(payload, "base64");
    }
    return Buffer.from(decodeURIComponent(payload), "utf-8");
  } catch {
    return null;
  }
}

// Cleanup function for temporary files (Moved from generateImage)
// Consider calling this periodically (e.g., using setInterval) or on application startup/shutdown
// if temporary file accumulation becomes an issue.
async function cleanupTempFiles() {
  try {
    await ensureTempDir(); // Ensure dir exists before reading
    const files = await fs.readdir(TEMP_DIR);
    const now = Date.now();

    for (const file of files) {
      const filePath = join(TEMP_DIR, file);
      try {
        const stats = await fs.stat(filePath);
        // Delete files older than 1 hour
        if (now - stats.mtimeMs > 3600000) {
          await fs.unlink(filePath);
          console.log(`Cleaned up temp file: ${file}`);
        }
      } catch (statError) {
        // Handle cases where file might be deleted between readdir and stat
        if (statError.code !== "ENOENT") {
          console.error(`Failed to stat temp file ${filePath}:`, statError);
        }
      }
    }
  } catch (error) {
    // Handle cases where TEMP_DIR might not exist initially or other read errors
    if (error.code !== "ENOENT") {
      console.error("Failed to cleanup temporary files:", error);
    }
  }
}

function startPerf(label) {
  if (PERF_LOGGING) {
    console.time(label);
  }
}

function endPerf(label) {
  if (PERF_LOGGING) {
    console.timeEnd(label);
  }
}

function resolveThrottleMode(options = {}) {
  const mode = String(options.renderMode || options.mode || "command").toLowerCase();
  if (mode === "game") return "game";
  return "command";
}

function resolveRenderBackend(options = {}) {
  let requestedRenderBackend = String(
    options.renderBackend || RENDER_BACKEND
  ).toLowerCase();
  requestedRenderBackend = requestedRenderBackend === "satori" ? "satori" : "takumi";
  console.log('Render backend:', requestedRenderBackend)
  return requestedRenderBackend;
}

const DEFAULT_GAME_THROTTLE_MS =
  parseInt(process.env.GAME_THROTTLE_INTERVAL_MS) || 450;
const DEFAULT_COMMAND_THROTTLE_MS =
  parseInt(process.env.COMMAND_THROTTLE_INTERVAL_MS) || 0;
const MIN_GAME_THROTTLE_MS = parseInt(process.env.GAME_THROTTLE_MIN_MS) || 250;
const MAX_GAME_THROTTLE_MS = parseInt(process.env.GAME_THROTTLE_MAX_MS) || 1200;

// --- Throttling State Map ---
const throttledRequests = new Map();
// --- End Throttling State Map ---

// Generates a unique key based on component and user
function generateRequestKey(componentName, props) {
  const userId = props?.interaction?.user?.id || "guest";
  return `${componentName}-${userId}`;
}

async function loadComponentByName(componentName) {
  if (componentModuleCache.has(componentName)) {
    return componentModuleCache.get(componentName);
  }

  const componentPath = join(__dirname, "..", "components", `${componentName}.jsx`);
  const module = await import(`file://${componentPath}`);
  const loadedComponent = module.default;
  if (!loadedComponent) {
    throw new Error(`Default export not found in ${componentName}.jsx`);
  }

  componentModuleCache.set(componentName, loadedComponent);
  return loadedComponent;
}

// --- Core Image Generation Logic (extracted) ---
async function performActualGenerationLogic(
  component,
  props,
  scaling,
  i18n,
  options = {}
) {
  // This function contains the original core logic of generateImage
  let pngBuffer = null;
  let svg = null;
  let formattedProps = null; // Store formattedProps for error reporting

  try {
    await ensureTempDir();
    if (!fonts) await loadFonts();

    // Scaling validation (remains the same)
    scaling = {
      image: typeof scaling.image === "number" ? Math.max(1, scaling.image) : 2,
      emoji:
        typeof scaling.emoji === "number"
          ? Math.max(0.5, Math.min(3, scaling.emoji))
          : 1,
      debug: !!scaling.debug,
    };
    const outputFormat = "webp";
    const renderBackend = resolveRenderBackend(options);

    // --- Component Loading Logic ---
    let Component;
    if (typeof component === "string") {
      try {
        Component = await loadComponentByName(component);
      } catch (error) {
        console.error(`Failed to import component ${component}:`, error);
        throw new Error(`Component ${component} could not be loaded.`);
      }
    } else {
      Component = component;
    }
    if (typeof Component !== "function" && typeof Component !== "object") {
      console.error(
        "Loaded component is not a valid React component:",
        Component
      );
      throw new Error("Invalid component type loaded.");
    }

    // --- Props/Color Preparation ---
    startPerf(`[imageGenerator] color-preparation`);
    let colorProps;
    const defaultImageUrl = props.interaction?.user?.avatarURL
      ? props.interaction.user.avatarURL
      : null; // Safer access
    const bannerUrl = props.database?.bannerUrl; // Optional banner

    if (props.dominantColor === "user" || !props.dominantColor) {
      const imageUrl = bannerUrl || defaultImageUrl;
      if (imageUrl) {
        const userId = props?.interaction?.user?.id || "guest";
        colorProps = await getOrProcessUserGradient(userId, imageUrl);
      } else {
        console.warn(
          "No image URL found for 'user' dominant color. Using defaults."
        );
        colorProps = getDefaultColors();
      }
    } else if (
      props.dominantColor &&
      Array.isArray(props.dominantColor) &&
      props.dominantColor.length === 3
    ) {
      // Allow passing direct RGB array
      colorProps = processColors(props.dominantColor, {
        gradientAngle: props.gradientAngle,
      });
    } else {
      console.warn(
        "Invalid dominantColor prop, using defaults:",
        props.dominantColor
      );
      colorProps = getDefaultColors(); // Fallback to default if dominantColor is invalid format
    }
    endPerf(`[imageGenerator] color-preparation`);

    // Create props object with coloring added - used for dimension funcs
    const propsWithColoring = { ...props, coloring: { ...colorProps } };

    // --- Dimension Calculation (using props BEFORE sanitization) ---
    const componentWidthDef = Component.dimensions?.width;
    const componentHeightDef = Component.dimensions?.height;
    let calculatedWidth;
    if (typeof componentWidthDef === "function") {
      // Pass the pre-sanitized props to the function
      calculatedWidth = Number(componentWidthDef(propsWithColoring));
    } else {
      calculatedWidth = Number(componentWidthDef);
    }
    let calculatedHeight;
    if (typeof componentHeightDef === "function") {
      // Pass the pre-sanitized props to the function
      calculatedHeight = Number(componentHeightDef(propsWithColoring));
    } else {
      calculatedHeight = Number(componentHeightDef);
    }
    const dimensions = {
      width:
        !isNaN(calculatedWidth) && calculatedWidth > 0 ? calculatedWidth : 800,
      height:
        !isNaN(calculatedHeight) && calculatedHeight > 0
          ? calculatedHeight
          : 400,
    };
    const targetWidth = Math.round(dimensions.width * scaling.image);
    const targetHeight = Math.round(dimensions.height * scaling.image);
    // --- End Dimension Calculation ---

    const attachI18nProps = (targetProps) => {
      if (targetProps.locale && i18n) {
        if (typeof i18n.setLocale === "function") {
          i18n.setLocale(targetProps.locale);
        }
        targetProps.i18n = i18n;
        targetProps.t = async (key) => {
          if (typeof i18n.__ === "function") {
            return await i18n.__(`components.${component}.${key}`);
          }
          return key;
        };
        if (PERF_LOGGING) {
          console.log(
            `Using i18n with locale ${targetProps.locale} for component ${component}`
          );
        }
      } else if (targetProps.locale) {
        console.warn(
          "Locale provided but i18n instance is missing. Skipping localization."
        );
      }
    };

    const takumiProps = {
      ...propsWithColoring,
      style: { display: "flex" },
      renderBackend,
    };
    if (scaling.debug) {
      takumiProps.debug = scaling.debug;
    }
    attachI18nProps(takumiProps);

    // --- SVG Generation (uses dimensions and formattedProps) ---
    if (renderBackend === "takumi") {
      pngBuffer = await renderWithTakumi({
        Component,
        formattedProps: takumiProps,
        dimensions,
        scaling,
        targetWidth,
        targetHeight,
        fonts,
        quality: DEFAULT_AVIF_QUALITY,
        loadImageAsset,
        dataUriToBuffer,
        bufferToArrayBuffer,
        startPerf,
        endPerf,
      });
    }

    if (!pngBuffer) {
      startPerf(`[imageGenerator] props-sanitization`);
      let sanitizedProps;
      try {
        sanitizedProps = structuredClone(propsWithColoring);
      } catch {
        sanitizedProps = JSON.parse(
          JSON.stringify(propsWithColoring, (_, value) =>
            typeof value === "bigint" ? Number(value) : value
          )
        );
      }
      formattedProps = {
        ...formatValue(sanitizedProps),
        style: { display: "flex" },
        renderBackend: "satori",
      };
      if (scaling.debug) {
        formattedProps.debug = scaling.debug;
      }
      attachI18nProps(formattedProps);
      endPerf(`[imageGenerator] props-sanitization`);

      svg = await renderWithSatori({
        Component,
        formattedProps,
        dimensions,
        scaling,
        fonts,
        componentName: component,
        fetchEmojiSvg,
        loadImageAsset,
        startPerf,
        endPerf,
      });
    }

    if (!pngBuffer) {
      try {
        pngBuffer = await rasterizeSvgToWebp({
          svg,
          targetWidth,
          targetHeight,
          dimensions,
          useResvg: USE_RESVG_RASTER,
          quality: DEFAULT_AVIF_QUALITY,
          effort: DEFAULT_AVIF_EFFORT,
          startPerf,
          endPerf,
        });
        if (PERF_LOGGING) {
          console.log(
            `${outputFormat.toUpperCase()} Buffer created:`,
            pngBuffer?.length ?? 0,
            "bytes"
          );
        }
      } catch (sharpError) {
        console.error("Image conversion failed:", sharpError);
        throw sharpError;
      }
    } else {
      if (PERF_LOGGING) {
        console.log(
          "Using Takumi-generated buffer:",
          pngBuffer?.length ?? 0,
          "bytes"
        );
      }
    }

    // Release SVG memory
    svg = null;

    // Return final result
    const finalBuffer = pngBuffer;
    endPerf(`[imageGenerator] core-generation`);
    return props.returnDominant
      ? [finalBuffer, propsWithColoring.coloring]
      : finalBuffer;
  } catch (error) {
    console.error("Core image generation logic failed:", error);
    endPerf(`[imageGenerator] core-generation`);
    // Clean up potentially large objects from memory in case of error
    pngBuffer = null;
    svg = null;
    // Note: props/component are passed by value/reference, cleanup might not be effective here
    // await cleanup(true); // Consider if cleanup is needed here or only in the outer function
    throw {
      error: error,
      formattedProps: formattedProps,
      message: error.message,
      stack: error.stack,
    }; // Re-throw enhanced error with formattedProps
  }
}
// --- End Core Image Generation Logic ---

// --- Throttled Image Generation Execution ---
async function executeThrottled(key) {
  const state = throttledRequests.get(key);
  if (!state || !state.isQueued) {
    // If state is gone or somehow not queued anymore, do nothing
    console.warn(
      `executeThrottled called for key ${key}, but state is invalid or not queued.`
    );
    return;
  }

  // Retrieve the promise handlers and latest arguments
  const { resolve, reject, latestArgs } = state;

  // Reset queuing state *before* execution
  state.isQueued = false;
  state.promise = null;
  state.resolve = null;
  state.reject = null;
  state.latestArgs = null; // Clear the stored args

  if (!latestArgs) {
    console.warn(`executeThrottled for key ${key}: No latest arguments found.`);
    // Reject the promise if we have handlers but no args? Or resolve with null? Let's reject.
    if (reject)
      reject(
        new Error(`No latest arguments found for throttled execution of ${key}`)
      );
    return;
  }

  const { component, props, scaling, i18n, options } = latestArgs;
  const startedAt = Date.now();

  try {
    if (PERF_LOGGING) {
      console.log(`Executing throttled image generation for key: ${key}`);
    }
    const result = await performActualGenerationLogic(
      component,
      props,
      scaling,
      i18n,
      options
    );
    state.lastExecuted = Date.now(); // Update last execution time on success
    const renderDurationMs = Date.now() - startedAt;
    state.averageRenderMs =
      state.averageRenderMs <= 0
        ? renderDurationMs
        : Math.round(state.averageRenderMs * 0.7 + renderDurationMs * 0.3);
    if (state.mode === "game") {
      const adaptiveInterval = Math.round(state.averageRenderMs * 1.1);
      state.currentThrottleMs = Math.max(
        MIN_GAME_THROTTLE_MS,
        Math.min(MAX_GAME_THROTTLE_MS, adaptiveInterval)
      );
    } else {
      state.currentThrottleMs = DEFAULT_COMMAND_THROTTLE_MS;
    }
    if (resolve) resolve(result);
  } catch (error) {
    // Error is already logged in performActualGenerationLogic
    console.error(`executeThrottled caught error for key ${key}`);
    if (reject) reject(error); // Reject the promise on error
  } finally {
    // Optional: Check if the state still exists before cleanup?
    await cleanup(false);
  }
}
// --- End Throttled Image Generation Execution ---

// --- Exported generateImage Function (Always Throttled) ---
export async function generateImage(
  component,
  props = {},
  scaling = { image: 1, emoji: 1, debug: false },
  i18n,
  options = {} // Add options object
) {
  startPerf(`[imageGenerator] total-generation`);

  const { disableThrottle = false } = options;
  const mode = resolveThrottleMode(options);
  const requestedThrottleMs =
    mode === "game" ? DEFAULT_GAME_THROTTLE_MS : DEFAULT_COMMAND_THROTTLE_MS;

  // --- Direct execution if throttling is disabled ---
  if (disableThrottle) {
    if (PERF_LOGGING) {
      console.log("Executing image generation directly (throttling disabled)");
    }
    try {
      // Call the core logic directly, without using the throttle map
      const result = await performActualGenerationLogic(
        component,
        props,
        scaling,
        i18n,
        options
      );
      await cleanup(false);
      endPerf(`[imageGenerator] total-generation`);
      return result;
    } catch (error) {
      console.error("Direct image generation failed:", error);
      await cleanup(true);
      endPerf(`[imageGenerator] total-generation`);
      throw error; // Now includes formattedProps if available
    }
  }
  // --- End direct execution block ---

  // --- Original Throttling Logic Starts Here ---
  const componentName =
    typeof component === "string"
      ? component
      : component.name || "inline-component";
  const key = `${generateRequestKey(componentName, props)}-${mode}`;

  // Get or initialize throttle state
  if (!throttledRequests.has(key)) {
    throttledRequests.set(key, {
      lastExecuted: 0,
      isQueued: false,
      latestArgs: null,
      promise: null,
      resolve: null,
      reject: null,
      mode,
      averageRenderMs: 0,
      currentThrottleMs: requestedThrottleMs,
    });
  }
  const state = throttledRequests.get(key);
  state.mode = mode;
  if (mode === "command") {
    state.currentThrottleMs = DEFAULT_COMMAND_THROTTLE_MS;
  } else if (state.currentThrottleMs <= 0) {
    state.currentThrottleMs = requestedThrottleMs;
  }

  const now = Date.now();
  const elapsed = now - state.lastExecuted;

  // Store the latest arguments regardless
  state.latestArgs = { component, props, scaling, i18n, options };

  // --- Can Execute Immediately? (Based on THROTTLE_INTERVAL) ---
  if (elapsed >= state.currentThrottleMs && !state.isQueued) {
    if (PERF_LOGGING) {
      console.log(
        `Executing image generation immediately (throttle window passed) for key: ${key}`
      );
    }
    state.promise = null;
    state.resolve = null;
    state.reject = null;
    try {
      const result = await performActualGenerationLogic(
        state.latestArgs.component,
        state.latestArgs.props,
        state.latestArgs.scaling,
        state.latestArgs.i18n,
        state.latestArgs.options
      );
      state.lastExecuted = Date.now();
      state.latestArgs = null;
      await cleanup(false);
      endPerf(`[imageGenerator] total-generation`);
      return result;
    } catch (error) {
      console.error(
        `Immediate throttled execution failed for key ${key}:`,
        error
      );
      await cleanup(true);
      endPerf(`[imageGenerator] total-generation`);
      throw error; // Now includes formattedProps if available
    }
  }

  // --- Need to Throttle / Queue ---
  if (!state.isQueued) {
    if (PERF_LOGGING) {
      console.log(`Throttling image generation - scheduling for key: ${key}`);
    }
    state.isQueued = true;
    const promise = new Promise((resolve, reject) => {
      state.resolve = resolve;
      state.reject = reject;
    });
    state.promise = promise;
    const delay = Math.max(0, state.currentThrottleMs - elapsed);
    setTimeout(() => executeThrottled(key), delay);
  } else {
    if (PERF_LOGGING) {
      console.log(
        `Throttling image generation - already queued for key: ${key}. Latest args updated.`
      );
    }
  }

  return state.promise;
}
// --- End Exported generateImage Function ---

// Enhanced cache performance reporting
export function generateCachePerformanceReport() {
  // Silent report: return metrics without console logs
  const totalRequests = cacheMetrics.hits + cacheMetrics.misses;
  const hitRate =
    totalRequests > 0
      ? ((cacheMetrics.hits / totalRequests) * 100).toFixed(2)
      : "0.00";

  const totalUserRequests = userCacheMetrics.hits + userCacheMetrics.misses;
  const userHitRate =
    totalUserRequests > 0
      ? ((userCacheMetrics.hits / totalUserRequests) * 100).toFixed(2)
      : "0.00";

  return {
    metrics: { ...cacheMetrics },
    userMetrics: { ...userCacheMetrics },
    hitRate: parseFloat(hitRate),
    userHitRate: parseFloat(userHitRate),
    configuration: {
      maxSize: COLOR_CACHE_MAX_SIZE,
      ttl: COLOR_CACHE_TTL,
      compressionEnabled: CACHE_COMPRESSION_ENABLED,
    },
  };
}

// Enhanced performance report with cache metrics (silent)
export function generatePerformanceReport() {
  // Silent: return current cache performance metrics only
  return generateCachePerformanceReport();
}

// Enhanced reset function
export function resetPerformanceStats() {
  emojiCache.clear();
  colorCache.clear();

  // Reset all cache metrics
  cacheMetrics.hits = 0;
  cacheMetrics.misses = 0;
  cacheMetrics.evictions = 0;
  cacheMetrics.expirations = 0;
  cacheMetrics.size = 0;
  cacheMetrics.memoryUsage = 0;

  // timing-only policy: keep logs minimal
}

// Utility function to force cache cleanup
export function forceCacheCleanup() {
  console.log("🧹 Performing forced cache cleanup...");
  manageColorCache();
  console.log(`✅ Cache cleanup completed. Current size: ${colorCache.size}`);
}

// Function to warm up cache with popular URLs (can be called during app initialization)
export async function warmupCache(urls, maxUrls = 10) {
  console.log(
    `🔥 Warming up color cache with ${Math.min(urls.length, maxUrls)} URLs...`
  );

  const urlsToProcess = urls.slice(0, maxUrls);
  let successCount = 0;

  for (const url of urlsToProcess) {
    try {
      await processImageColors(url);
      successCount++;
      console.log(`✅ Warmed cache for: ${url}`);
    } catch (error) {
      console.warn(`⚠️ Failed to warm cache for: ${url}`, error.message);
    }
  }

  console.log(
    `🎯 Cache warmup completed: ${successCount}/${urlsToProcess.length} URLs processed`
  );
  return successCount;
}

// Cleanup function for temporary files (Moved from generateImage)
