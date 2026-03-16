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
  rasterizeSvgToPng,
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
const PERF_LOGGING = parseBooleanEnv(process.env.RENDER_PERF_LOGGING, false);

// Per-user gradient cache and in-flight deduplication
const userGradientCache = new Map();
const USER_GRADIENT_TTL_MS = 60 * 1000; // 1 minute TTL for per-user gradient processing
const inflightColorRequests = new Map();

// Texture pattern cache for performance
const textureCache = new Map();
const TEXTURE_CACHE_MAX_SIZE = 20;

// Color conversion cache for performance
const hslCache = new Map();
const HSL_CACHE_MAX_SIZE = 100;

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
  { name: "Inter", file: "Inter-VariableFont_opsz,wght.ttf", weight: 400 },
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
    textureCache.clear(); // Clear texture cache
    hslCache.clear(); // Clear HSL cache

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

async function getOrProcessImageColorsDedup(url, options = {}) {
  // Prefer URL-based color cache first
  const cached = getCachedColor(url);
  if (cached) return cached;

  const key = normalizeUrl(url);
  if (inflightColorRequests.has(key)) {
    return inflightColorRequests.get(key);
  }

  const promise = (async () => {
    try {
      const res = await processImageColors(url, options);
      return res;
    } finally {
      inflightColorRequests.delete(key);
    }
  })();

  inflightColorRequests.set(key, promise);
  return promise;
}

async function getOrProcessUserGradient(userId, imageUrl, options = {}) {
  const cachedUser = getCachedUserGradient(userId);
  if (cachedUser) {
    return cachedUser;
  }

  const result = await getOrProcessImageColorsDedup(imageUrl, options);
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
          const result = await processImageColors(url, {}); // Use default options for batch
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
        colors: await processImageColors(url, {}), // Use default options for fallback
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

// RGB to HSL conversion for better color control (cached)
function rgbToHsl(r, g, b) {
  // Check cache first
  const key = `${r},${g},${b}`;
  if (hslCache.has(key)) {
    return hslCache.get(key);
  }
  
  // Manage cache size
  if (hslCache.size >= HSL_CACHE_MAX_SIZE) {
    const firstKey = hslCache.keys().next().value;
    hslCache.delete(firstKey);
  }

  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  const result = [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
  
  // Cache the result
  hslCache.set(key, result);
  
  return result;
}

// HSL to RGB conversion
function hslToRgb(h, s, l) {
  h /= 360;
  s /= 100;
  l /= 100;

  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }

  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

// Create vibrant color from RGB input (optimized)
function createVibrantColor(r, g, b, intensity = 1.0) {
  // Convert to HSL for better control
  const [h, s, l] = rgbToHsl(r, g, b);
  
  // Apply vibrant boost with intensity control
  const boostedSaturation = Math.min(100, s * (1.4 * intensity)); // Boost saturation
  const boostedLightness = Math.min(85, Math.max(15, l + (5 * intensity))); // Slightly increase lightness
  
  // Warm up the color - shift hue toward warmer tones (optimized)
  let warmHue = h;
  if (h >= 180 && h <= 300) {
    // Cool colors (cyan to magenta) - warm them up
    warmHue = (h + 15) % 360;
  } else if (h >= 300 || h <= 60) {
    // Already warm colors - enhance warmth slightly
    warmHue = Math.min(360, h + 5);
  }
  
  // Remove expensive micro-variation for performance
  // Previously: const microVariation = Math.sin(Date.now() * 0.001) * 2;
  const finalHue = warmHue % 360;
  
  // Convert back to RGB
  const [vibrantR, vibrantG, vibrantB] = hslToRgb(finalHue, boostedSaturation, boostedLightness);
  
  return { r: vibrantR, g: vibrantG, b: vibrantB };
}

// Generate subtle texture pattern for depth (cached)
function generateTexture(seed = Math.random()) {
  // Check cache first
  const seedKey = typeof seed === 'number' ? seed : seed.toString();
  if (textureCache.has(seedKey)) {
    return textureCache.get(seedKey);
  }
  
  // Manage cache size
  if (textureCache.size >= TEXTURE_CACHE_MAX_SIZE) {
    const firstKey = textureCache.keys().next().value;
    textureCache.delete(firstKey);
  }

  // Create SVG noise pattern
  const noiseId = `texture-${seedKey.toString(36).substr(2, 9)}`;
  const svgPattern = `
    <svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="${noiseId}">
          <feTurbulence baseFrequency="0.9" numOctaves="4" seed="${seedKey}" />
          <feColorMatrix type="saturate" values="0"/>
          <feComponentTransfer>
            <feFuncA type="discrete" tableValues="0 0.03 0.03 0.06 0.06 0.1 0.1 0.15 0.15 0.2 0.2 0.3"/>
          </feComponentTransfer>
          <feComposite operator="over" in2="SourceGraphic"/>
        </filter>
      </defs>
      <rect width="100" height="100" filter="url(#${noiseId})" opacity="0.4"/>
    </svg>
  `;
  
  const texturePattern = `data:image/svg+xml;base64,${Buffer.from(svgPattern).toString('base64')}`;
  
  // Cache the result
  textureCache.set(seedKey, texturePattern);
  
  return texturePattern;
}

// Generate harmonious accent color
function generateAccentColor(r, g, b) {
  const [h, s, l] = rgbToHsl(r, g, b);
  
  // Split-complementary for harmonious but distinct accent
  const accentHue = (h + 150) % 360;
  const accentSaturation = Math.min(100, s * 0.8); // Slightly less saturated
  const accentLightness = Math.min(80, Math.max(20, l - 10)); // Slightly darker/lighter for contrast
  
  const [accentR, accentG, accentB] = hslToRgb(accentHue, accentSaturation, accentLightness);
  
  return { r: accentR, g: accentG, b: accentB };
}

function getLuminance(r, g, b) {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

// Process vibrant colors from RGB input (primary color processing function)
function processColors(dominantColorRgbArray, options = {}) {
  const { juicyIntensity = 1.0, enableTexture = true } = options;

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

  // Create primary vibrant color
  const vibrantColor = createVibrantColor(r, g, b, juicyIntensity);
  const vibrantColorString = `rgb(${vibrantColor.r}, ${vibrantColor.g}, ${vibrantColor.b})`;
  // Takumi-compatible gradient format
  const vibrantGradient = `linear-gradient(135deg, ${vibrantColorString}, ${vibrantColorString})`;

  // Generate harmonious accent color
  const accentColor = generateAccentColor(vibrantColor.r, vibrantColor.g, vibrantColor.b);
  const accentColorString = `rgb(${accentColor.r}, ${accentColor.g}, ${accentColor.b})`;
  // Takumi-compatible gradient format
  const accentGradient = `linear-gradient(135deg, ${accentColorString}, ${accentColorString})`;

  // Calculate luminance for text contrast
  const luminance = getLuminance(vibrantColor.r, vibrantColor.g, vibrantColor.b);
  const isDarkText = luminance > 0.5;

  // Generate texture pattern for depth
  const texturePattern = enableTexture ? generateTexture() : null;

  return {
    textColor: isDarkText ? "#000000" : "#FFFFFF",
    secondaryTextColor: isDarkText
      ? "rgba(0, 0, 0, 0.8)"
      : "rgba(255, 255, 255, 0.8)",
    tertiaryTextColor: isDarkText
      ? "rgba(0, 0, 0, 0.4)"
      : "rgba(255, 255, 255, 0.4)",
    isDarkText,
    // Takumi-compatible gradient backgrounds
    backgroundGradient: vibrantGradient,
    dominantColor: vibrantColorString,
    secondaryColor: accentGradient,
    accentColor: accentColorString,
    // Texture and intensity options
    texturePattern,
    juicyIntensity,
    overlayBackground: isDarkText
      ? "rgba(0, 0, 0, 0.1)"
      : "rgba(255, 255, 255, 0.2)",
    embedColor: rgbToDiscordColor(vibrantColor.r, vibrantColor.g, vibrantColor.b),
  };
}

// Enhanced processImageColors with advanced caching
export async function processImageColors(imageUrl, options = {}) {
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

      // Use juicy color processing (now the only system)
      console.time(
        `[imageGenerator] color-processing-algorithm-${imageUrl.slice(-10)}`
      );
      
      const processedResult = processColors(dominantColorRgb, {
        juicyIntensity: options.juicyIntensity || 1.0,
        enableTexture: options.enableTexture !== false
      });
      
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

// Helper function to provide default vibrant colors when color extraction fails
function getDefaultColors() {
  // Default to a vibrant orange color scheme (feels more "juicy")
  const defaultVibrantColor = { r: 255, g: 140, b: 0 }; // Vibrant orange
  const defaultAccentColor = { r: 255, g: 195, b: 0 }; // Golden accent
  
  const vibrantColorString = `rgb(${defaultVibrantColor.r}, ${defaultVibrantColor.g}, ${defaultVibrantColor.b})`;
  const accentColorString = `rgb(${defaultAccentColor.r}, ${defaultAccentColor.g}, ${defaultAccentColor.b})`;
  
  return {
    textColor: "#FFFFFF",
    secondaryTextColor: "rgba(255, 255, 255, 0.8)",
    tertiaryTextColor: "rgba(255, 255, 255, 0.4)",
    isDarkText: false,
    // Takumi-compatible gradient backgrounds
    backgroundGradient: `linear-gradient(135deg, ${vibrantColorString}, ${vibrantColorString})`,
    dominantColor: vibrantColorString,
    secondaryColor: `linear-gradient(135deg, ${accentColorString}, ${accentColorString})`,
    accentColor: accentColorString,
    texturePattern: generateTexture(42), // Consistent default texture
    juicyIntensity: 1.0,
    overlayBackground: "rgba(255, 255, 255, 0.2)",
    embedColor: rgbToDiscordColor(
      defaultVibrantColor.r,
      defaultVibrantColor.g,
      defaultVibrantColor.b
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
    const outputFormat = "png";

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
        colorProps = await getOrProcessUserGradient(userId, imageUrl, options);
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
      // Direct RGB array processing
      colorProps = processColors(props.dominantColor, {
        juicyIntensity: options.juicyIntensity || 1.0,
        enableTexture: options.enableTexture !== false
      });
    } else {
      console.warn(
        "Invalid dominantColor prop, using defaults:",
        props.dominantColor
      );
      colorProps = getDefaultColors();
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
    };
    if (scaling.debug) {
      takumiProps.debug = scaling.debug;
    }
    attachI18nProps(takumiProps);

    // --- Image Generation (uses dimensions and formattedProps) ---
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

    if (!pngBuffer) {
      throw new Error("Takumi rendering failed - no fallback available");
    }

    if (PERF_LOGGING) {
      console.log(
        "Using Takumi-generated buffer:",
        pngBuffer?.length ?? 0,
        "bytes"
      );
    }

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

// Export color processing functions for external use
export {
  processColors,
  createVibrantColor,
  generateTexture,
  generateAccentColor,
  getDefaultColors
};

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
      await processImageColors(url, {}); // Use default options for warmup
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
