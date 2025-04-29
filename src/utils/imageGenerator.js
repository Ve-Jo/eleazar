import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";
import React from "react";
import twemoji from "@twemoji/api";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";
import fetch from "node-fetch";
import { getPaletteFromURL, getColorFromURL } from "color-thief-bun";

// Configure Bun's garbage collector if available
if (typeof Bun !== "undefined" && Bun.gc) {
  // Lower GC threshold for more frequent collection
  Bun.gc(true);
}

const __dirname = dirname(fileURLToPath(import.meta.url));

const TEMP_DIR = join(__dirname, "..", "temp");
const MAX_BANNER_SIZE = 5 * 1024 * 1024; // 5MB limit
const BANNER_TIMEOUT = 5000; // 5 seconds

// Cache instances
const emojiCache = new Map();
const colorCache = new Map(); // Cache for processImageColors results
const COLOR_CACHE_MAX_SIZE = 50; // Increased cache size slightly

// Fonts configuration
let fonts = null;

// Initialize sharp (needed for color processing and potentially output)
sharp.cache(false);
sharp.concurrency(1); // Keep concurrency low for lower peak CPU

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
  path: join(__dirname, "..", "render-server", "public", "fonts", config.file),
}));

// Initialize temp directory
export async function ensureTempDir() {
  try {
    await fs.stat(TEMP_DIR);
  } catch {
    await fs.mkdir(TEMP_DIR, { recursive: true });
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

// Enhanced cleanup function with GC trigger
export async function cleanup(forceGC = true) {
  emojiCache.clear();
  colorCache.clear(); // Clear color cache too
  sharp.cache(false);
  if (forceGC && global.gc) {
    global.gc();
  }
  // Consider if Bun.gc needs explicit call here too if issues persist
}

// Helper function to manage color cache size
function manageColorCache() {
  while (colorCache.size > COLOR_CACHE_MAX_SIZE) {
    // Use while loop for safety
    const oldestKey = colorCache.keys().next().value;
    colorCache.delete(oldestKey);
  }
}

// Enhanced emoji handling with proper resource cleanup
export async function fetchEmojiSvg(emoji, emojiScaling = 1) {
  // Handle undefined/null emoji
  if (!emoji) return null;

  const emojiCode = twemoji.convert.toCodePoint(emoji);
  if (!emojiCode) return null;

  // Validate scaling factor
  const validatedScaling = Math.min(Math.max(emojiScaling, 0.5), 3);
  const cacheKey = `${emojiCode}-${validatedScaling}`;

  if (emojiCache.has(cacheKey)) {
    return emojiCache.get(cacheKey);
  }

  try {
    const svgUrl = `https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/${emojiCode}.svg`;
    const response = await fetch(svgUrl);

    if (!response.ok) {
      console.warn(`Failed to fetch emoji ${emojiCode}: ${response.status}`);
      return null;
    }

    const svgData = await response.text();
    const scaledSize = Math.round(64 * validatedScaling);

    // Fix: Ensure we're correctly replacing both width and height attributes
    // The previous regex might not match all SVG formats
    let scaledSvg = svgData;

    // Replace width attribute
    scaledSvg = scaledSvg.replace(/width="([^"]+)"/, `width="${scaledSize}"`);

    // Replace height attribute
    scaledSvg = scaledSvg.replace(/height="([^"]+)"/, `height="${scaledSize}"`);

    // Also add viewBox if it doesn't exist to ensure proper scaling
    if (!scaledSvg.includes("viewBox")) {
      scaledSvg = scaledSvg.replace(
        "<svg",
        `<svg viewBox="0 0 ${scaledSize} ${scaledSize}"`
      );
    }

    let resvg = null;
    let pngData = null;
    let base64 = null;

    try {
      resvg = new Resvg(scaledSvg, {
        fitTo: {
          mode: "width",
          value: scaledSize,
        },
      });
      pngData = resvg.render();
      const pngBuffer = pngData.asPng();

      base64 = `data:image/png;base64,${pngBuffer.toString("base64")}`;
    } catch (error) {
      console.error(`Failed to render emoji ${emoji}:`, error);
      return null;
    } finally {
      // Ensure resources are freed even if there's an error
      if (pngData) pngData.free?.();
      if (resvg) resvg.free?.();
    }

    if (emojiCache.size > 100) {
      const firstKey = emojiCache.keys().next().value;
      emojiCache.delete(firstKey);
      await cleanup(); // Trigger cleanup when cache is cleared
    }

    if (base64) {
      emojiCache.set(cacheKey, base64);
      return base64;
    }
    return null;
  } catch (error) {
    console.error(`Failed to load emoji ${emoji}:`, error);
    return null;
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

// Color processing utilities
function rgbToHsl(r, g, b) {
  // Validate RGB values
  if (!validateRGB(r, g, b)) {
    console.error("Invalid RGB values:", { r, g, b });
    return [0, 0, 0]; // Return black as fallback
  }

  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  let h,
    s,
    l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return [h, s, l];
}

function getLuminance(r, g, b) {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

// Updated processColors - minor tweaks for clarity
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
  const dominantColor = `rgb(${r}, ${g}, ${b})`; // Keep rgb string for gradient
  const luminance = getLuminance(r, g, b);
  const isDarkText = luminance > 0.5;

  // Generate secondary color based on HSL adjustments (similar logic as before)
  const primaryHsl = rgbToHsl(r, g, b);
  const secondaryHSL = [...primaryHsl];
  secondaryHSL[1] = Math.max(0.1, primaryHsl[1] * 0.9); // Slightly desaturate
  secondaryHSL[2] = Math.max(
    0.15,
    Math.min(0.85, primaryHsl[2] * (primaryHsl[2] > 0.5 ? 0.9 : 1.1))
  ); // Adjust lightness

  const hueToRgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  const [h, s, l] = secondaryHSL;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  const secondaryR = Math.round(hueToRgb(p, q, h + 1 / 3) * 255);
  const secondaryG = Math.round(hueToRgb(p, q, h) * 255);
  const secondaryB = Math.round(hueToRgb(p, q, h - 1 / 3) * 255);
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
    // Use adjusted secondary color for gradient
    backgroundGradient: `linear-gradient(${gradientAngle}deg, ${dominantColor}, ${secondaryColor})`,
    overlayBackground: isDarkText
      ? "rgba(0, 0, 0, 0.1)"
      : "rgba(255, 255, 255, 0.2)",
    embedColor: rgbToDiscordColor(r, g, b), // Embed color based on primary dominant
  };
}

// Updated processImageColors with caching
export async function processImageColors(imageUrl) {
  // Check cache first
  if (colorCache.has(imageUrl)) {
    console.log("Cache hit for image colors:", imageUrl);
    return colorCache.get(imageUrl);
  }

  console.log("Processing image colors for URL:", imageUrl); // Debug log

  try {
    // Fetch and preprocess the image with blur
    const response = await fetch(imageUrl, {
      signal: AbortSignal.timeout(BANNER_TIMEOUT),
    }); // Add timeout
    if (!response.ok) {
      console.error(
        `Failed to fetch image: ${response.status} for ${imageUrl}`
      );
      return getDefaultColors();
    }

    const imageBuffer = Buffer.from(await response.arrayBuffer());
    console.log(`Image fetched (${imageUrl}), size:`, imageBuffer.length); // Debug log
    if (imageBuffer.length > MAX_BANNER_SIZE) {
      console.warn(
        `Image ${imageUrl} exceeds size limit: ${imageBuffer.length} > ${MAX_BANNER_SIZE}`
      );
      return getDefaultColors();
    }

    const blurredBuffer = await sharp(imageBuffer)
      .resize(50, 50, { fit: "inside" }) // Keep resize small for performance
      .blur(10) // Reduced blur slightly
      .toBuffer();
    console.log("Image processed with sharp"); // Debug log

    // Get dominant color from the blurred image
    // Ensure getColorFromURL expects an ArrayBuffer
    const dominantColorRgb = await getColorFromURL(blurredBuffer.buffer);
    console.log("Extracted dominant color:", dominantColorRgb); // Debug log

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
    const processedResult = processColors(dominantColorRgb);

    // Store result in cache
    colorCache.set(imageUrl, processedResult);
    manageColorCache(); // Ensure cache size is managed

    return processedResult;
  } catch (error) {
    if (error.name === "TimeoutError") {
      console.error(`Timeout fetching image colors for ${imageUrl}`);
    } else {
      console.error(`Failed to process image colors for ${imageUrl}:`, error);
    }
    return getDefaultColors();
  }
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
    const response = await fetch(url);
    if (!response.ok) return null;

    const contentType = response.headers.get("content-type");
    // Only allow specific image types
    if (
      !contentType ||
      !["image/jpeg", "image/png", "image/gif", "image/webp"].includes(
        contentType.toLowerCase()
      )
    ) {
      console.warn(
        `Unsupported image type: ${contentType || "unknown"} for URL: ${url}`
      );
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    return `data:${contentType};base64,${Buffer.from(arrayBuffer).toString(
      "base64"
    )}`;
  } catch (error) {
    console.warn("Failed to load image asset:", error.message);
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

export async function generateImage(
  component,
  props = {},
  scaling = { image: 2, emoji: 1, debug: false },
  i18n
) {
  // Removed resvg/renderedImage declarations as sharp handles output
  let pngBuffer = null;
  let svg = null; // Keep SVG temporarily

  try {
    await ensureTempDir();
    if (!fonts) await loadFonts();

    // Ensure scaling has all required properties with valid values
    scaling = {
      image: typeof scaling.image === "number" ? Math.max(1, scaling.image) : 2,
      emoji:
        typeof scaling.emoji === "number"
          ? Math.max(0.5, Math.min(3, scaling.emoji))
          : 1,
      debug: !!scaling.debug,
    };
    console.log("Using scaling settings:", scaling);

    // --- Component Loading Logic (remains the same) ---
    let Component;
    if (typeof component === "string") {
      const componentPath = join(
        __dirname,
        "..",
        "render-server",
        "components",
        `${component}.jsx`
      );
      try {
        // Ensure dynamic import path is correct for your setup
        const module = await import(`file://${componentPath}`);
        Component = module.default;
        if (!Component)
          throw new Error(`Default export not found in ${component}.jsx`);
      } catch (error) {
        console.error(
          `Failed to import component ${component} from ${componentPath}:`,
          error
        );
        throw new Error(`Component ${component} could not be loaded.`);
      }
    } else {
      Component = component; // Assuming component is already loaded module/function
    }

    if (typeof Component !== "function" && typeof Component !== "object") {
      console.error(
        "Loaded component is not a valid React component:",
        Component
      );
      throw new Error("Invalid component type loaded.");
    }

    // --- Color Processing Logic (uses updated processImageColors/processColors) ---
    let colorProps;
    const defaultImageUrl = props.interaction?.user?.avatarURL
      ? props.interaction.user.avatarURL
      : null; // Safer access
    const bannerUrl = props.database?.bannerUrl; // Optional banner

    if (props.dominantColor === "user" || !props.dominantColor) {
      const imageUrl = bannerUrl || defaultImageUrl;
      if (imageUrl) {
        colorProps = await processImageColors(imageUrl);
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

    // --- Props Preparation & Formatting (Moved BEFORE dimension calculation) ---
    // Add coloring to props before sanitizing/formatting
    props = {
      ...props,
      coloring: { ...colorProps },
    };

    // Sanitize and format props first, as dimensions might depend on them
    const sanitizedProps = JSON.parse(
      JSON.stringify(props, (_, value) =>
        typeof value === "bigint" ? Number(value) : value
      )
    );
    const formattedProps = {
      ...formatValue(sanitizedProps),
      style: { display: "flex" },
    };

    // Add debug flag if needed
    if (scaling.debug) {
      formattedProps.debug = scaling.debug;
      console.log("Debug mode enabled for component rendering");
    }

    // Add i18n if needed
    if (formattedProps.locale && i18n) {
      const safeI18n = i18n; // Assume i18n is valid if passed
      safeI18n.setLocale(formattedProps.locale);
      formattedProps.i18n = safeI18n;
      formattedProps.t = (key) => safeI18n.__(`components.${component}.${key}`);
      console.log(
        `Using i18n with locale ${formattedProps.locale} for component ${component}`
      );
    } else if (formattedProps.locale) {
      console.warn(
        "Locale provided but i18n instance is missing. Skipping localization."
      );
    }

    // --- Dimension Calculation (Uses formattedProps now) ---
    const componentWidthDef = Component.dimensions?.width;
    const componentHeightDef = Component.dimensions?.height;

    // Calculate width: Call function if it exists, otherwise use value or default
    let calculatedWidth;
    if (typeof componentWidthDef === "function") {
      // Pass formattedProps to the function, as it might need database etc.
      calculatedWidth = Number(componentWidthDef(formattedProps));
    } else {
      calculatedWidth = Number(componentWidthDef);
    }

    // Calculate height: Call function if it exists, otherwise use value or default
    let calculatedHeight;
    if (typeof componentHeightDef === "function") {
      // Pass formattedProps to the function
      calculatedHeight = Number(componentHeightDef(formattedProps));
    } else {
      calculatedHeight = Number(componentHeightDef);
    }

    // Final dimensions with validation and defaults
    const dimensions = {
      width:
        !isNaN(calculatedWidth) && calculatedWidth > 0 ? calculatedWidth : 800,
      height:
        !isNaN(calculatedHeight) && calculatedHeight > 0
          ? calculatedHeight
          : 400,
    };

    // --- SVG Generation (remains the same) ---
    try {
      svg = await satori(
        React.createElement(Component, formattedProps), // Use React.createElement for safety
        {
          width: dimensions.width,
          height: dimensions.height,
          fonts,
          debug: scaling.debug,
          loadAdditionalAsset: async (code, segment) => {
            if (code === "emoji")
              return await fetchEmojiSvg(segment, scaling.emoji);
            if (code === "image") return await loadImageAsset(segment);
            return null; // Return null for unrecognized codes
          },
        }
      );
      console.log("SVG generation completed");
    } catch (satoriError) {
      console.error("Satori SVG generation failed:", satoriError);
      // Attempt fallback if it's a known recoverable error, e.g., image size
      if (satoriError.message?.includes("Image size cannot be determined")) {
        console.warn(
          "Image size error during Satori render, attempting fallback dimensions"
        );
        try {
          svg = await satori(React.createElement(Component, formattedProps), {
            width: 800, // Fallback dimensions
            height: 400,
            fonts,
            debug: scaling.debug,
            loadAdditionalAsset: async (code, segment) => {
              if (code === "emoji")
                return await fetchEmojiSvg(segment, scaling.emoji);
              if (code === "image") return await loadImageAsset(segment);
              return null;
            },
          });
        } catch (fallbackError) {
          console.error("Satori fallback render also failed:", fallbackError);
          throw fallbackError; // Re-throw the fallback error
        }
      } else {
        throw satoriError; // Re-throw original error if not recoverable
      }
    }

    // --- PNG Generation using Sharp ---
    try {
      if (!svg || typeof svg !== "string") {
        throw new Error("Invalid SVG generated by satori");
      }

      /*interface AvifOptions extends OutputOptions {
        /** quality, integer 1-100 (optional, default 50) */
      //quality?: number | undefined;
      /** use lossless compression (optional, default false) */
      //lossless?: boolean | undefined;
      /** Level of CPU effort to reduce file size, between 0 (fastest) and 9 (slowest) (optional, default 4) */
      //effort?: number | undefined;
      /** set to '4:2:0' to use chroma subsampling, requires libvips v8.11.0 (optional, default '4:4:4') */
      //chromaSubsampling?: string | undefined;
      /** Set bitdepth to 8, 10 or 12 bit (optional, default 8) */
      //bitdepth?: 8 | 10 | 12 | undefined;*/

      /* interface HeifOptions extends OutputOptions {
        /** quality, integer 1-100 (optional, default 50) */
      //quality?: number | undefined;
      /** compression format: av1, hevc (optional, default 'av1') */
      //compression?: 'av1' | 'hevc' | undefined;
      /** use lossless compression (optional, default false) */
      //lossless?: boolean | undefined;
      /** Level of CPU effort to reduce file size, between 0 (fastest) and 9 (slowest) (optional, default 4) */
      //effort?: number | undefined;
      /** set to '4:2:0' to use chroma subsampling (optional, default '4:4:4') */
      //chromaSubsampling?: string | undefined;
      /** Set bitdepth to 8, 10 or 12 bit (optional, default 8) */
      //bitdepth?: 8 | 10 | 12 | undefined;*/

      // Use sharp for PNG conversion with optimized options
      pngBuffer = await sharp(Buffer.from(svg))
        .resize(
          Math.round(dimensions.width * scaling.image),
          Math.round(dimensions.height * scaling.image)
        ) // Apply scaling
        /*.png({ //DEFAULT
          compressionLevel: 9, // Max lossless compression
          adaptiveFiltering: true, // Better compression for some images
          palette: true, // Use palette quantization (lossy, smaller size)
          quality: 85, // Lowered quality for palette generation (0-100)
          effort: 10, // Max CPU effort for optimization (1-10)
        })*/
        /*.webp({ //NOT GREAT QUALITY, 23KB
          quality: 70, // High quality
          effort: 6, // Max CPU effort for compression
          lossless: false, // Use lossy compression
          smartSubsample: true, // Improve color detail retention
          alphaQuality: 100, // Keep max alpha quality (default)
        })*/
        .avif({
          //BEST, 16KB
          quality: 65, // High quality
          chromaSubsampling: "4:2:0", // Use chroma subsampling
          effort: 2, // Max CPU effort for compression
        })
        /*.tiff({ //NOT SUPPORTE
          quality: 100, // High quality
          compression: "lzw", // Use LZW compression
        })*/

        .toBuffer();

      console.log("PNG Buffer created via sharp:", pngBuffer.length, "bytes"); // Updated log message
    } catch (sharpError) {
      console.error("Sharp PNG conversion failed:", sharpError);
      throw sharpError; // Re-throw error
    } finally {
      // No Resvg resources to free here
      svg = null; // Release SVG string memory
    }

    await cleanup(false); // Perform cleanup, maybe less aggressive GC trigger

    // --- Return Logic (remains the same) ---
    const finalBuffer = Buffer.from(pngBuffer); // Ensure it's a Buffer
    console.log(
      "Final buffer type:",
      typeof finalBuffer,
      "Is Buffer?",
      Buffer.isBuffer(finalBuffer),
      "Length:",
      finalBuffer?.length
    );

    return props.returnDominant ? [finalBuffer, props.coloring] : finalBuffer;
  } catch (error) {
    console.error("Image generation failed:", error);
    // Consider logging more context like component name and props (carefully, avoid logging sensitive data)
    console.error(
      `Component: ${
        typeof component === "string" ? component : "Inline"
      }, Props: ${JSON.stringify(
        props?.interaction?.commandName ?? props?.interaction?.customId ?? "N/A"
      )}`
    );
    // Clean up potentially large objects from memory in case of error
    pngBuffer = null;
    svg = null;
    props = null;
    component = null;
    await cleanup(true); // Force GC on error path
    throw error; // Re-throw the error to be handled upstream
  }

  // Cleanup function for temporary files (Moved to top level)
  // async function cleanupTempFiles() { ... }
}
