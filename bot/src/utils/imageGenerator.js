import hubClient from "../api/hubClient.js";
import fetch from "node-fetch";
import { getPaletteFromURL, getColorFromURL } from "color-thief-bun";

// Cache for processImageColors results
const colorCache = new Map();
const COLOR_CACHE_MAX_SIZE = 50;

// Helper function to manage color cache size
function manageColorCache() {
  while (colorCache.size > COLOR_CACHE_MAX_SIZE) {
    const oldestKey = colorCache.keys().next().value;
    colorCache.delete(oldestKey);
  }
}

// Helper function to format values
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

  // Handle numbers
  if (typeof value === "number") {
    return value;
  }

  // Handle bigint
  if (typeof value === "bigint") {
    return value.toString();
  }

  // Handle arrays
  if (Array.isArray(value)) {
    return value.map(formatValue);
  }

  // Handle objects
  if (typeof value === "object") {
    const formatted = {};
    for (const [key, val] of Object.entries(value)) {
      formatted[key] = formatValue(val);
    }
    return formatted;
  }

  return value;
}

// Process image colors function (kept for compatibility)
export async function processImageColors(imageUrl, options = {}) {
  const {
    paletteSize = 5,
    quality = 10,
    ignoreWhite = true,
    returnDominant = false,
  } = options;

  // Create cache key
  const cacheKey = `${imageUrl}-${paletteSize}-${quality}-${ignoreWhite}-${returnDominant}`;

  // Check cache first
  if (colorCache.has(cacheKey)) {
    return colorCache.get(cacheKey);
  }

  try {
    // Use hub client for color processing
    const result = await hubClient.processImageColors(imageUrl, options);

    // Cache the result
    manageColorCache();
    colorCache.set(cacheKey, result);

    return result;
  } catch (error) {
    console.error("Hub color processing failed, falling back to local:", error);

    // Fallback to local color processing
    try {
      let palette, dominantColor;

      if (returnDominant) {
        [palette, dominantColor] = await Promise.all([
          getPaletteFromURL(imageUrl, paletteSize, quality),
          getColorFromURL(imageUrl, quality),
        ]);
      } else {
        palette = await getPaletteFromURL(imageUrl, paletteSize, quality);
      }

      // Filter out white/light colors if requested
      if (ignoreWhite && palette) {
        palette = palette.filter(([r, g, b]) => {
          const brightness = (r * 299 + g * 587 + b * 114) / 1000;
          return brightness < 240; // Filter out very light colors
        });
      }

      const result = returnDominant ? { palette, dominantColor } : palette;

      // Cache the result
      manageColorCache();
      colorCache.set(cacheKey, result);

      return result;
    } catch (fallbackError) {
      console.error("Local color processing also failed:", fallbackError);
      throw fallbackError;
    }
  }
}

// Main image generation function using hub client
export async function generateImage(
  component,
  props = {},
  scaling = { image: 1, emoji: 1, debug: false },
  i18n,
  options = {},
) {
  try {
    console.log("Generating image via hub rendering service");

    // Use hub client to generate image
    const result = await hubClient.generateImage(
      component,
      props,
      scaling,
      i18n?.getLocale() || "en",
      options,
    );

    return result;
  } catch (error) {
    console.error("Hub image generation failed:", error);
    throw error;
  }
}

// Cleanup function
export async function cleanup(forceGC = true) {
  colorCache.clear();
  if (forceGC && global.gc) {
    global.gc();
  }
}

// Export for compatibility
export { generateImage as default };
