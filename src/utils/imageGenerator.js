import satori from "satori";
import sharp from "sharp";
import { createSatoriConfig } from "../config/satori-config.js";
import twemoji from "@twemoji/api";
import axios from "axios";
import { Readable } from "stream";
import fs from "fs/promises";
import path from "path";

const TEMP_DIR = path.join(process.cwd(), "temp", "emoji");

sharp.cache(false);
sharp.concurrency(1);
sharp.simd(true);

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
  const cacheFilePath = path.join(TEMP_DIR, `${emojiCode}-${emojiScaling}.png`);

  try {
    // Try to read from cache first
    const cachedData = await fs.readFile(cacheFilePath);
    return `data:image/png;base64,${cachedData.toString("base64")}`;
  } catch {
    // If not in cache, fetch and save
    const svgUrl = `https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/${emojiCode}.svg`;

    try {
      const { data } = await axios.get(svgUrl, { responseType: "arraybuffer" });
      const pngBuffer = await sharp(data)
        .resize(64 * emojiScaling, 64 * emojiScaling, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toBuffer();

      // Save to temp file
      await fs.writeFile(cacheFilePath, pngBuffer);

      return `data:image/png;base64,${pngBuffer.toString("base64")}`;
    } catch (error) {
      console.error(`Failed to load emoji ${emoji}:`, error);
      return null;
    }
  }
}

// Initialize temp directory when module loads
ensureTempDir().catch(console.error);

export async function generateImage(
  Component,
  props = {},
  customConfig = {},
  scaling = { image: 2, emoji: 1 }
) {
  const satoriConfig = createSatoriConfig({
    ...customConfig,
    loadAdditionalAsset: async (code, segment) =>
      code === "emoji" ? await fetchEmojiSvg(segment, scaling.emoji) : null,
  });

  const svg = await satori(<Component {...props} />, satoriConfig);

  const svgString = Buffer.from(svg).toString("utf-8");
  const [, width, height] = svgString.match(
    /<svg[^>]+width="(\d+)"[^>]+height="(\d+)"/
  );

  const newWidth = Math.round(parseInt(width) * scaling.image);
  const newHeight = Math.round(parseInt(height) * scaling.image);

  return sharp(Buffer.from(svg), { limitInputPixels: false })
    .withMetadata({ density: 72 })
    .resize(newWidth, newHeight, {
      kernel: sharp.kernel.mitchell,
      fastShrinkOnLoad: true,
    })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer()
    .then((buffer) => {
      const readableStream = new Readable();
      readableStream.push(buffer);
      readableStream.push(null);
      return readableStream;
    });
}
