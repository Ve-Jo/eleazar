import satori from "satori";
import sharp from "sharp";
import { createSatoriConfig } from "../../render-server/config/satori-config.js";
import { createElement } from "react";
import twemoji from "@twemoji/api";
import axios from "axios";
import fs from "fs/promises";
import path from "path";
import i18n from "./../i18n.js";
import { createFontConfig } from "./fontLoader.js";
import { extractGifFrames, createGif } from "./gifProcessor.js";

// Constants for resource management
const TEMP_DIR = path.join(
  __dirname,
  "..",
  "..",
  "render-server",
  "temp",
  "emoji"
);
const MAX_INPUT_PIXELS = 100 * 1024 * 1024; // 100MP limit
const MAX_BANNER_SIZE = 5 * 1024 * 1024; // 5MB limit
const BANNER_TIMEOUT = 5000; // 5 seconds
const MAX_EMOJI_SIZE = 50 * 1024; // 50KB for emoji SVGs
const EMOJI_TIMEOUT = 3000; // 3 seconds
const MAX_EMOJI_CACHE_SIZE = 100;

const COMPONENTS_WITH_BANNER_SUPPORT = [
  "Balance",
  "Cooldown",
  "Daily",
  "Level",
  "Transfer",
];

// Configure sharp for better performance
sharp.cache(false);
sharp.concurrency(1);
sharp.simd(true);

// LRU cache implementation for emoji SVGs
class LRUCache {
  constructor(maxSize) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }

  get(key) {
    if (!this.cache.has(key)) return null;
    // Move to front
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Remove oldest
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  clear() {
    this.cache.clear();
  }
}

// Cache for resources
const cache = {
  emoji: new LRUCache(MAX_EMOJI_CACHE_SIZE),
  fonts: null,
  satoriConfig: null,
  lastCustomConfig: null,
};

// Deep compare objects
function isConfigChanged(newConfig, oldConfig) {
  if (!oldConfig) return true;
  return JSON.stringify(newConfig) !== JSON.stringify(oldConfig);
}

let isInitialized = false;

// Ensure temp directory exists
async function ensureTempDir() {
  try {
    await fs.access(TEMP_DIR);
  } catch {
    await fs.mkdir(TEMP_DIR, { recursive: true });
  }
}

async function fetchEmojiSvg(emoji, emojiScaling) {
  const emojiCode = twemoji.convert.toCodePoint(emoji);
  const cacheKey = `${emojiCode}-${emojiScaling}`;

  // Check memory cache first
  const cached = cache.emoji.get(cacheKey);
  if (cached) return cached;

  const cacheFilePath = path.join(TEMP_DIR, `${cacheKey}.png`);

  try {
    // Try disk cache first
    const cachedData = await fs.readFile(cacheFilePath);
    const base64 = `data:image/png;base64,${cachedData.toString("base64")}`;
    cache.emoji.set(cacheKey, base64);
    return base64;
  } catch {
    // Fetch from CDN if not cached
    const svgUrl = `https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/${emojiCode}.svg`;

    try {
      const { data } = await axios.get(svgUrl, {
        responseType: "arraybuffer",
        timeout: EMOJI_TIMEOUT,
        maxContentLength: MAX_EMOJI_SIZE,
      });

      const scaledSize = Math.round(64 * emojiScaling);
      if (isNaN(scaledSize) || scaledSize <= 0) {
        throw new Error(`Invalid scaled size: ${scaledSize}`);
      }

      const pngBuffer = await sharp(data, {
        limitInputPixels: MAX_INPUT_PIXELS,
      })
        .resize(scaledSize, scaledSize, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
          fastShrinkOnLoad: true,
        })
        .png({ compressionLevel: 9 })
        .toBuffer();

      await fs.writeFile(cacheFilePath, pngBuffer);
      const base64 = `data:image/png;base64,${pngBuffer.toString("base64")}`;
      cache.emoji.set(cacheKey, base64);

      return base64;
    } catch (error) {
      console.error(`Failed to load emoji ${emoji}:`, error);
      return null;
    }
  }
}

function cleanupMemory() {
  if (typeof Bun !== "undefined") {
    Bun.gc(true);
  } else if (global.gc) {
    global.gc();
  }

  sharp.cache(false);
  sharp.concurrency(1);
}

async function processStaticBanner(bannerBuffer, width, height, overlayBuffer) {
  try {
    console.log("Processing static banner");
    console.log(`Target dimensions: ${width}x${height}`);

    // Process banner image
    const processedBanner = await sharp(bannerBuffer, {
      limitInputPixels: MAX_INPUT_PIXELS,
    })
      .resize(width, height, {
        fit: "cover",
        position: "center",
        fastShrinkOnLoad: true,
      })
      .ensureAlpha()
      .png({ compressionLevel: 9 })
      .toBuffer();

    // Process overlay
    const processedOverlay = await sharp(overlayBuffer, {
      limitInputPixels: MAX_INPUT_PIXELS,
    })
      .resize(width, height, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .ensureAlpha()
      .png({ compressionLevel: 9 })
      .toBuffer();

    // Composite images
    const result = await sharp(processedBanner, {
      limitInputPixels: MAX_INPUT_PIXELS,
    })
      .composite([
        {
          input: processedOverlay,
          blend: "over",
          gravity: "center",
        },
      ])
      .png({ compressionLevel: 9 })
      .toBuffer();

    return result;
  } catch (error) {
    console.error("Error in processStaticBanner:", error);
    throw error;
  }
}

async function processBannerImage(
  props,
  newWidth,
  newHeight,
  componentPngBuffer
) {
  try {
    const { data: bannerBuffer } = await axios.get(props.database.banner_url, {
      responseType: "arraybuffer",
      maxContentLength: MAX_BANNER_SIZE,
      timeout: BANNER_TIMEOUT,
    });

    const metadata = await sharp(bannerBuffer).metadata();
    const isGif = metadata.format === "gif" && metadata.pages > 1;
    console.log(
      "Banner type:",
      isGif ? "GIF" : "Static image",
      "Format:",
      metadata.format
    );

    const bannerWidth = isGif ? Math.round(newWidth / 2) : newWidth;
    const bannerHeight = isGif ? Math.round(newHeight / 2) : newHeight;

    if (isGif) {
      const frames = await extractGifFrames(bannerBuffer);
      return await createGif(frames, bannerWidth, bannerHeight, {
        overlayBuffer: componentPngBuffer,
        overlayAlpha: 1.0,
      });
    } else {
      return await processStaticBanner(
        bannerBuffer,
        bannerWidth,
        bannerHeight,
        componentPngBuffer
      );
    }
  } catch (error) {
    console.error("Error processing banner:", error);
    throw error;
  }
}

export async function generateImage(
  Component,
  props = {},
  customConfig = {},
  scaling = { image: 2, emoji: 1 }
) {
  try {
    // Initialize on first run
    if (!isInitialized) {
      await ensureTempDir();
      cache.fonts = await createFontConfig();
      console.log("✅ Initialized with configured fonts");
      isInitialized = true;
    }

    // Setup i18n
    const locale = props.locale || "en";
    if (i18n.getLocales().includes(locale)) {
      i18n.setLocale(locale);
    } else {
      i18n.setLocale("en");
    }

    // Create component props with i18n
    const componentProps = {
      ...props,
      i18n: {
        __: (phrase) => i18n.__({ phrase, locale }),
        getLocale: () => locale,
      },
    };

    // Get or update Satori config
    // Update only if customConfig actually changed
    const needsNewConfig =
      !cache.satoriConfig ||
      isConfigChanged(customConfig, cache.lastCustomConfig);

    if (needsNewConfig) {
      cache.satoriConfig = await createSatoriConfig(
        {
          ...customConfig,
          loadAdditionalAsset: async (code, segment) =>
            code === "emoji"
              ? await fetchEmojiSvg(segment, scaling.emoji)
              : null,
        },
        cache.fonts
      );
      cache.lastCustomConfig = { ...customConfig };
      console.log(
        cache.satoriConfig
          ? "Updated Satori config"
          : "Created new Satori config"
      );
    }

    const svg = await satori(
      createElement(Component, componentProps),
      cache.satoriConfig
    );
    const svgBuffer = Buffer.from(svg);

    // Get dimensions
    const dimensions = svgBuffer
      .toString("utf-8")
      .match(/<svg[^>]+width="(\d+)"[^>]+height="(\d+)"/);
    const newWidth = Math.round(parseInt(dimensions[1]) * scaling.image);
    const newHeight = Math.round(parseInt(dimensions[2]) * scaling.image);

    // Check banner support
    const componentName =
      Component.name ||
      Component.displayName ||
      Component.toString().match(/function ([^\(]+)/)?.[1] ||
      "UnknownComponent";
    const supportsBanners =
      COMPONENTS_WITH_BANNER_SUPPORT.includes(componentName);

    // Generate base image
    const componentPngBuffer = await sharp(svgBuffer, {
      limitInputPixels: MAX_INPUT_PIXELS,
      sequentialRead: true,
    })
      .resize(newWidth, newHeight)
      .ensureAlpha()
      .png({ compressionLevel: 9 })
      .toBuffer();

    // Process banner if supported and provided
    if (props.database?.banner_url && supportsBanners) {
      return await processBannerImage(
        props,
        newWidth,
        newHeight,
        componentPngBuffer
      );
    }

    return componentPngBuffer;
  } catch (error) {
    console.error("Error generating image:", error);
    throw error;
  } finally {
    cleanupMemory();
  }
}
