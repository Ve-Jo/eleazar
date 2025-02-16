import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp"; // Keep for GIF processing for now
import { createCanvas, loadImage } from "@napi-rs/canvas";
import GIFEncoder from "gifencoder";
import React from "react";
import twemoji from "@twemoji/api";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";
import fetch from "node-fetch";

// Configure Bun's garbage collector if available
if (typeof Bun !== "undefined" && Bun.gc) {
  // Lower GC threshold for more frequent collection
  Bun.gc(true);
}

const __dirname = dirname(fileURLToPath(import.meta.url));

const TEMP_DIR = join(__dirname, "..", "temp");
const MAX_BANNER_SIZE = 5 * 1024 * 1024; // 5MB limit
const BANNER_TIMEOUT = 5000; // 5 seconds

// Cache instance for emojis
const emojiCache = new Map();

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
  sharp.cache(false);
  if (forceGC && global.gc) {
    global.gc();
  }
}

// Enhanced emoji handling with proper resource cleanup
export async function fetchEmojiSvg(emoji, emojiScaling = 1) {
  const emojiCode = twemoji.convert.toCodePoint(emoji);
  const cacheKey = `${emojiCode}-${emojiScaling}`;

  if (emojiCache.has(cacheKey)) {
    return emojiCache.get(cacheKey);
  }

  try {
    const svgUrl = `https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/${emojiCode}.svg`;
    const response = await fetch(svgUrl);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const svgData = await response.text();
    const scaledSize = Math.round(64 * emojiScaling);
    const scaledSvg = svgData.replace(
      /width="[^"]+" height="[^"]+"/,
      `width="${scaledSize}" height="${scaledSize}"`
    );

    let resvg = null;
    let pngData = null;
    let base64 = null;

    try {
      resvg = new Resvg(scaledSvg);
      pngData = resvg.render();
      const pngBuffer = pngData.asPng();
      base64 = `data:image/png;base64,${pngBuffer.toString("base64")}`;
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

// Optimized GIF processing with proper resource cleanup
export async function processGifFrames(
  buffer,
  width,
  height,
  overlayBuffer,
  overlayAlpha = 0.85
) {
  const metadata = await sharp(buffer).metadata();
  const encoder = new GIFEncoder(width, height);
  encoder.start();
  encoder.setRepeat(0);
  encoder.setQuality(10);
  encoder.setDispose(2);

  // Reuse canvas
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  try {
    for (let i = 0; i < metadata.pages; i++) {
      // Get, process, and composite frame
      const frameBuffer = await sharp(buffer, { page: i })
        .resize(width, height, { fit: "cover" })
        .png()
        .toBuffer();
      let processed = sharp(frameBuffer);
      if (overlayBuffer) {
        processed = processed.composite([
          {
            input: overlayBuffer,
            blend: "over",
            opacity: overlayAlpha,
          },
        ]);
      }
      const processedFrameBuffer = await processed.toBuffer();
      const image = await loadImage(processedFrameBuffer);

      // Render to canvas and add GIF frame
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(image, 0, 0);
      encoder.setDelay(metadata.delay[i] || 40);
      encoder.addFrame(ctx);
    }
  } finally {
    // Make sure to finish even if error occurs
    encoder.finish();
  }
  return encoder.out.getData();
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

// Enhanced image generation with proper resource management
export async function generateImage(
  component,
  props = {},
  scaling = { image: 2, emoji: 1 }
) {
  let resvg = null;
  let renderedImage = null;
  let pngBuffer = null;

  try {
    await ensureTempDir();
    if (!fonts) await loadFonts();

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

    const width = Component.dimensions?.width || 800;
    const height = Component.dimensions?.height || 400;
    const sanitizedProps = JSON.parse(
      JSON.stringify(props, (_, value) =>
        typeof value === "bigint" ? Number(value) : value
      )
    );
    const formattedProps = formatValue(sanitizedProps);
    console.log(formattedProps);

    if (Component.localization_strings && formattedProps.locale) {
      formattedProps.i18n = {
        __: (key) => {
          try {
            if (Component.localization_strings[key]) {
              return (
                Component.localization_strings[key][formattedProps.locale] ||
                Component.localization_strings[key].en ||
                key
              );
            }
            const [category, stringKey] = key.split(".");
            if (Component.localization_strings[stringKey]) {
              return (
                Component.localization_strings[stringKey][
                  formattedProps.locale
                ] ||
                Component.localization_strings[stringKey].en ||
                key
              );
            }
            return key;
          } catch (e) {
            console.error("Translation error:", e);
            return key;
          }
        },
        getLocale: () => formattedProps.locale,
      };
    }

    const svg = await satori(<Component {...formattedProps} />, {
      width,
      height,
      fonts,
      loadAdditionalAsset: async (code, segment) =>
        code === "emoji" ? await fetchEmojiSvg(segment, scaling.emoji) : null,
    });

    try {
      resvg = new Resvg(svg, {
        fitTo: {
          mode: "width",
          value: width * scaling.image,
        },
      });
      renderedImage = resvg.render();
      pngBuffer = renderedImage.asPng();
    } finally {
      // Ensure resources are freed
      if (renderedImage) renderedImage.free?.();
      if (resvg) resvg.free?.();
    }

    if (props.database?.bannerUrl) {
      try {
        const response = await fetch(props.database.bannerUrl, {
          size: MAX_BANNER_SIZE,
          timeout: BANNER_TIMEOUT,
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const bannerBuffer = Buffer.from(await response.arrayBuffer());
        const metadata = await sharp(bannerBuffer).metadata();
        const isGif = metadata.format === "gif" && metadata.pages > 1;

        if (isGif) {
          return await processGifFrames(
            bannerBuffer,
            width * scaling.image,
            height * scaling.image,
            pngBuffer
          );
        } else {
          return await sharp(bannerBuffer)
            .resize(width * scaling.image, height * scaling.image, {
              fit: "cover",
            })
            .composite([{ input: pngBuffer, blend: "over" }])
            .png()
            .toBuffer();
        }
      } catch (error) {
        console.error("Banner processing failed:", error);
        return pngBuffer;
      }
    }
    await cleanup();
    return pngBuffer;
  } catch (error) {
    console.error("Image generation failed:", error);
    throw error;
  }
}
