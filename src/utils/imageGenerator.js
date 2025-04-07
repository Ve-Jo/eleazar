import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import React from "react";
import twemoji from "@twemoji/api";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";
import fetch from "node-fetch";
import { getPaletteFromURL, getColorFromURL } from "color-thief-bun";
import i18n from "./newI18n.js";

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
const colorCache = new Map();
const COLOR_CACHE_MAX_SIZE = 30;

// Fonts configuration
let fonts = null;

// Initialize sharp (still needed for GIF processing)
sharp.cache(false);
sharp.concurrency(1);

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
  colorCache.clear();
  sharp.cache(false);
  if (forceGC && global.gc) {
    global.gc();
  }
}

// Helper function to manage color cache size
function manageColorCache() {
  if (colorCache.size > COLOR_CACHE_MAX_SIZE) {
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

function processColors(dominantColor, options = {}) {
  const { gradientAngle = Math.floor(Math.random() * 360) } = options;

  const isRGBColor = (color) => color?.startsWith("rgb");
  if (!isRGBColor(dominantColor)) {
    console.warn("Invalid color format, expected RGB string:", dominantColor);
    return getDefaultColors();
  }

  const rgbMatch = dominantColor.match(/\d+/g);
  if (!rgbMatch || rgbMatch.length < 3) {
    console.warn(
      "Could not extract RGB values from color string:",
      dominantColor
    );
    return getDefaultColors();
  }

  const [r, g, b] = rgbMatch.slice(0, 3).map(Number);
  if (!validateRGB(r, g, b)) {
    console.error("Invalid RGB values after parsing:", { r, g, b });
    return getDefaultColors();
  }

  const luminance = getLuminance(r, g, b);
  const isDarkText = luminance > 0.5;

  return {
    textColor: isDarkText ? "#000000" : "#FFFFFF",
    secondaryTextColor: isDarkText
      ? "rgba(0, 0, 0, 0.8)"
      : "rgba(255, 255, 255, 0.8)",
    tertiaryTextColor: isDarkText
      ? "rgba(0, 0, 0, 0.4)"
      : "rgba(255, 255, 255, 0.4)",
    isDarkText,
    backgroundGradient: `linear-gradient(${gradientAngle}deg, ${dominantColor}, ${dominantColor})`,
    overlayBackground: isDarkText
      ? "rgba(0, 0, 0, 0.1)"
      : "rgba(255, 255, 255, 0.2)",
  };
}

export async function processImageColors(imageUrl) {
  try {
    console.log("Processing image colors for URL:", imageUrl); // Debug log

    // Fetch and preprocess the image with blur
    const response = await fetch(imageUrl);
    if (!response.ok) {
      console.error(`Failed to fetch image: ${response.status}`);
      return getDefaultColors();
    }

    const imageBuffer = Buffer.from(await response.arrayBuffer());
    console.log("Image fetched, size:", imageBuffer.length); // Debug log

    const blurredBuffer = await sharp(imageBuffer)
      .resize(50, 50, { fit: "inside" })
      .blur(20)
      .toBuffer();
    console.log("Image processed with sharp"); // Debug log

    // Get dominant color from the blurred image
    const dominantColor = await getColorFromURL(
      Buffer.from(blurredBuffer).buffer
    );
    console.log("Extracted dominant color:", dominantColor); // Debug log

    if (!dominantColor || dominantColor.length !== 3) {
      console.error("No color extracted from image:", imageUrl);
      return getDefaultColors();
    }

    const [r, g, b] = dominantColor;
    if (!validateRGB(r, g, b)) {
      console.error("Invalid RGB color values:", dominantColor);
      return getDefaultColors();
    }

    const primaryColor = {
      rgb: [r, g, b],
      hsl: rgbToHsl(r, g, b),
      luminance: getLuminance(r, g, b),
      rgbStr: `rgb(${r}, ${g}, ${b})`,
    };

    const secondaryHSL = [...primaryColor.hsl];
    secondaryHSL[1] = Math.max(0.1, primaryColor.hsl[1] * 0.9);
    secondaryHSL[2] = Math.max(
      0.15,
      Math.min(
        0.85,
        primaryColor.hsl[2] * (primaryColor.hsl[2] > 0.5 ? 0.9 : 1.1)
      )
    );

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

    const secondaryColor = {
      rgb: [
        Math.round(hueToRgb(p, q, h + 1 / 3) * 255),
        Math.round(hueToRgb(p, q, h) * 255),
        Math.round(hueToRgb(p, q, h - 1 / 3) * 255),
      ],
      hsl: secondaryHSL,
      rgbStr: `rgb(${Math.round(hueToRgb(p, q, h + 1 / 3) * 255)}, ${Math.round(
        hueToRgb(p, q, h) * 255
      )}, ${Math.round(hueToRgb(p, q, h - 1 / 3) * 255)})`,
    };

    const gradientAngle = 145;
    const isDarkText = primaryColor.luminance > 0.5;

    return {
      textColor: isDarkText ? "#000000" : "#FFFFFF",
      secondaryTextColor: isDarkText
        ? "rgba(0, 0, 0, 0.8)"
        : "rgba(255, 255, 255, 0.8)",
      tertiaryTextColor: isDarkText
        ? "rgba(0, 0, 0, 0.4)"
        : "rgba(255, 255, 255, 0.4)",
      isDarkText,
      backgroundGradient: `linear-gradient(${gradientAngle}deg, ${primaryColor.rgbStr}, ${secondaryColor.rgbStr})`,
      overlayBackground: isDarkText
        ? "rgba(0, 0, 0, 0.1)"
        : "rgba(255, 255, 255, 0.2)",
      embedColor: rgbToDiscordColor(...primaryColor.rgb),
    };
  } catch (error) {
    console.error("Failed to process image colors:", error);
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

// Enhanced image generation with proper resource management
export async function generateImage(
  component,
  props = {},
  scaling = { image: 2, emoji: 1, debug: false }
) {
  let resvg = null;
  let renderedImage = null;
  let pngBuffer = null;

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

    console.log("Using scaling settings:", scaling); // Debug log

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
        const module = await import(`file://${componentPath}`);
        Component = module.default;
      } catch (error) {
        console.error(`Failed to import component ${component}:`, error);
        throw new Error(`Component ${component} not found`);
      }
    } else {
      Component = component;
    }

    // Process colors and ensure proper structure
    let colorProps;
    if (props.dominantColor === "user" || !props.dominantColor) {
      const imageUrl =
        props.database?.bannerUrl || props.interaction.user.avatarURL;
      colorProps = await processImageColors(imageUrl);
    } else if (props.dominantColor) {
      colorProps = processColors(props.dominantColor, {
        hueRotation: props.hueRotation,
        gradientAngle: props.gradientAngle,
      });
    }

    // Ensure we always have valid color properties
    if (!colorProps) {
      colorProps = getDefaultColors();
    }

    // Register component localization strings if the component has them
    if (Component.localization_strings) {
      console.log(
        `[generateImage] Registering ${component} localization strings with i18n`
      );

      // Use the new i18n.registerLocalizations function
      i18n.registerLocalizations(
        "components",
        component,
        Component.localization_strings,
        false
      );
    }

    // Create a new props object with properly structured coloring
    props = {
      ...props,
      coloring: {
        ...colorProps,
        // Ensure all style properties are strings or numbers
        backgroundGradient:
          typeof colorProps.backgroundGradient === "string"
            ? colorProps.backgroundGradient
            : "linear-gradient(145deg, rgb(33, 150, 243), rgb(33, 150, 243))",
      },
    };

    // Ensure dimensions are properly structured
    const dimensions = {
      width: Number(Component.dimensions?.width || 800),
      height: Number(Component.dimensions?.height || 400),
    };

    // Sanitize and format props
    const sanitizedProps = {
      ...JSON.parse(
        JSON.stringify(props, (_, value) =>
          typeof value === "bigint" ? Number(value) : value
        )
      ),
      style: { display: "flex" }, // Ensure root element has flex display
    };

    const formattedProps = formatValue(sanitizedProps);
    console.log("Formatted props:", formattedProps);

    // Add debug flag to formatted props if it exists in scaling
    if (scaling.debug) {
      formattedProps.debug = scaling.debug;
      console.log("Debug mode enabled for component rendering");
    }

    // Create a translator for the component
    if (formattedProps.locale) {
      const locale = formattedProps.locale;

      // Use the existing enhanced i18n instance if provided
      if (props.i18n && typeof props.i18n.__ === "function") {
        console.log("Using provided enhanced i18n translator");
        formattedProps.i18n = props.i18n;
      }
      // Otherwise create a new context-specific i18n for the component
      else {
        console.log("Creating new context i18n translator for component");

        // Create context-specific i18n for the component
        formattedProps.i18n = i18n.createContextI18n(
          "components",
          component,
          locale
        );
        console.log(
          `Created context i18n translator for component: ${component} with locale: ${locale}`
        );
      }
    }

    // Helper function to load image assets
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
            `Unsupported image type: ${
              contentType || "unknown"
            } for URL: ${url}`
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

    // Ensure dimensions are always provided
    let svg;
    try {
      svg = await satori(<Component {...formattedProps} />, {
        width: dimensions.width,
        height: dimensions.height,
        fonts,
        debug: scaling.debug,
        loadAdditionalAsset: async (code, segment) => {
          if (code === "emoji") {
            return await fetchEmojiSvg(segment, scaling.emoji);
          }
          if (code === "image") {
            const imageData = await loadImageAsset(segment);
            if (!imageData) return null;
            return imageData;
          }
          return null;
        },
      });
      console.log("SVG generation completed");
    } catch (error) {
      if (error.message?.includes("Image size cannot be determined")) {
        console.warn("Image size error, using default dimensions");
        svg = await satori(<Component {...formattedProps} />, {
          width: 800,
          height: 400,
          fonts,
          debug: scaling.debug,
          loadAdditionalAsset: async (code, segment) => {
            if (code === "emoji") {
              return await fetchEmojiSvg(segment, scaling.emoji);
            }
            if (code === "image") {
              const imageData = await loadImageAsset(segment);
              if (!imageData) return null;
              return imageData;
            }
            return null;
          },
        });
      } else {
        throw error;
      }
    }

    try {
      if (!svg || typeof svg !== "string") {
        throw new Error("Invalid SVG generated by satori");
      }

      resvg = new Resvg(svg, {
        fitTo: {
          mode: "width",
          value: dimensions.width * scaling.image,
        },
      });
      renderedImage = resvg.render();
      console.log("Image rendered successfully");
      pngBuffer = renderedImage.asPng();

      // Validate and ensure proper buffer handling
      if (!Buffer.isBuffer(pngBuffer)) {
        console.error("PNG Buffer is not a valid buffer:", typeof pngBuffer);
        throw new Error("Invalid PNG buffer generated");
      }

      console.log("PNG Buffer created:", pngBuffer.length, "bytes");

      // Ensure compatibility with discord.js
      pngBuffer = Buffer.from(pngBuffer);
    } finally {
      // Ensure resources are freed
      if (renderedImage) renderedImage.free?.();
      if (resvg) resvg.free?.();
    }

    // Banner is now handled by the component itself

    await cleanup();

    // Log buffer information for debugging
    console.log("Original buffer type:", typeof pngBuffer);
    console.log("Is Buffer?", Buffer.isBuffer(pngBuffer));
    console.log("Buffer length:", pngBuffer?.length);

    // Ensure proper Buffer conversion
    const finalBuffer = Buffer.isBuffer(pngBuffer)
      ? pngBuffer
      : Buffer.from(pngBuffer);

    // Verify final buffer
    console.log("Final buffer type:", typeof finalBuffer);
    console.log("Final is Buffer?", Buffer.isBuffer(finalBuffer));
    console.log("Final buffer length:", finalBuffer.length);

    // Return buffer directly
    return props.returnDominant ? [finalBuffer, props.coloring] : finalBuffer;
  } catch (error) {
    console.error("Image generation failed:", error);
    throw error;
  }

  // Cleanup function for temporary files
  async function cleanupTempFiles() {
    try {
      const files = await fs.readdir(TEMP_DIR);
      const now = Date.now();

      for (const file of files) {
        const filePath = join(TEMP_DIR, file);
        const stats = await fs.stat(filePath);

        // Delete files older than 1 hour
        if (now - stats.mtimeMs > 3600000) {
          await fs.unlink(filePath);
        }
      }
    } catch (error) {
      console.error("Failed to cleanup temporary files:", error);
    }
  }
}
