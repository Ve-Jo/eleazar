import satori from "satori";
import sharp from "sharp";
import { createSatoriConfig } from "../config/satori-config.js";
import twemoji from "@twemoji/api";
import axios from "axios";
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

async function fetchEmojiSvg(emoji, emojiScaling, client) {
  process.emit("memoryLabel", `Emoji Processing Start: ${emoji}`, client);
  const emojiCode = twemoji.convert.toCodePoint(emoji);
  const cacheFilePath = path.join(TEMP_DIR, `${emojiCode}-${emojiScaling}.png`);

  try {
    let cachedData = await fs.readFile(cacheFilePath);
    const base64 = cachedData.toString("base64");
    cachedData = null;
    process.emit("memoryLabel", `Emoji Cache Hit: ${emoji}`, client);
    return `data:image/png;base64,${base64}`;
  } catch {
    process.emit("memoryLabel", `Emoji Fetching: ${emoji}`, client);
    const svgUrl = `https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/${emojiCode}.svg`;

    try {
      let { data } = await axios.get(svgUrl, { responseType: "arraybuffer" });
      const scaledSize = Math.round(64 * emojiScaling);

      if (isNaN(scaledSize) || scaledSize <= 0) {
        throw new Error(`Invalid scaled size: ${scaledSize}`);
      }

      let pngBuffer = await sharp(data)
        .resize(scaledSize, scaledSize, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
          fastShrinkOnLoad: true,
        })
        .png({ compressionLevel: 6, effort: 1, palette: true })
        .toBuffer();

      data = null;

      await fs.writeFile(cacheFilePath, pngBuffer);
      const base64 = pngBuffer.toString("base64");
      pngBuffer = null;

      process.emit(
        "memoryLabel",
        `Emoji Processing Complete: ${emoji}`,
        client
      );
      return `data:image/png;base64,${base64}`;
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
  scaling = { image: 2, emoji: 1 },
  client
) {
  process.emit("memoryLabel", "Image Generation Start", client);

  let satoriConfig = null;
  let svg = null;
  let svgBuffer = null;

  try {
    satoriConfig = createSatoriConfig({
      ...customConfig,
      loadAdditionalAsset: async (code, segment) =>
        code === "emoji"
          ? await fetchEmojiSvg(segment, scaling.emoji, client)
          : null,
    });

    // Break down the Satori operation
    process.emit("memoryLabel", "Before Satori", client);
    svg = await satori(<Component {...props} />, satoriConfig);
  } finally {
    // Immediate cleanup
    Component = null;
    props = null;
    customConfig = null;
    satoriConfig = null;
    if (global.gc) global.gc();
  }

  try {
    process.emit("memoryLabel", "SVG Buffer Creation", client);
    svgBuffer = Buffer.from(svg);
    svg = null;

    const dimensions = svgBuffer
      .toString("utf-8")
      .match(/<svg[^>]+width="(\d+)"[^>]+height="(\d+)"/);
    const newWidth = Math.round(parseInt(dimensions[1]) * scaling.image);
    const newHeight = Math.round(parseInt(dimensions[2]) * scaling.image);

    if (global.gc) global.gc();
    process.emit("memoryLabel", "Sharp Processing Start", client);

    return await new Promise((resolve, reject) => {
      let sharpInstance = null;
      try {
        sharpInstance = sharp(svgBuffer, {
          limitInputPixels: true,
          sequentialRead: true,
          pages: 1,
          memory: 256,
        })
          .withMetadata({ density: 72 })
          .resize(newWidth, newHeight, {
            kernel: sharp.kernel.mitchell,
            fastShrinkOnLoad: true,
            limitInputPixels: true,
          })
          .png({
            compressionLevel: 6,
            adaptiveFiltering: false,
            effort: 3,
            palette: true,
          });

        svgBuffer = null;

        sharpInstance.toBuffer({ resolveWithObject: false }, (err, buffer) => {
          if (err) {
            sharpInstance = null;
            reject(err);
            return;
          }

          sharpInstance = null;

          process.emit("memoryLabel", "Processing Complete", client);
          resolve(buffer);
          process.emit("memoryLabel", "", client);
        });
      } catch (error) {
        sharpInstance = null;
        reject(error);
      }
    });
  } finally {
    svg = null;
    svgBuffer = null;
  }
}
