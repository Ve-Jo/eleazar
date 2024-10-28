import satori from "satori";
import sharp from "sharp";
import { createSatoriConfig } from "../config/satori-config.js";
import twemoji from "@twemoji/api";
import axios from "axios";
import { Readable } from "stream";

// const emojiCache = new Map();

sharp.cache(false);
sharp.concurrency(1);
sharp.simd(true);

async function fetchEmojiSvg(emoji, emojiScaling) {
  const emojiCode = twemoji.convert.toCodePoint(emoji);

  // const cacheKey = `${emojiCode}-${emojiScaling}`;
  // if (emojiCache.has(cacheKey)) {
  //   return emojiCache.get(cacheKey);
  // }

  const svgUrl = `https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/${emojiCode}.svg`;

  try {
    const response = await axios.get(svgUrl, {
      responseType: "stream",
    });

    const sharpInstance = sharp();
    const resizeStream = sharpInstance
      .resize(256 * emojiScaling, 256 * emojiScaling, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png();

    const chunks = [];
    for await (const chunk of response.data.pipe(resizeStream)) {
      chunks.push(chunk);
    }

    const pngBuffer = Buffer.concat(chunks);
    sharpInstance.destroy();

    const base64Png = pngBuffer.toString("base64");
    const result = `data:image/png;base64,${base64Png}`;

    // emojiCache.set(cacheKey, result);

    // if (emojiCache.size > 100) {
    //   const firstKey = emojiCache.keys().next().value;
    //   emojiCache.delete(firstKey);
    // }

    return result;
  } catch (error) {
    console.error(`Failed to load emoji ${emoji}:`, error);
    return null;
  }
}

export async function generateImage(
  Component,
  props = {},
  customConfig = {},
  scaling = { image: 2, emoji: 1 }
) {
  const satoriConfig = createSatoriConfig({
    ...customConfig,
    loadAdditionalAsset: async (code, segment) => {
      if (code === "emoji") {
        return await fetchEmojiSvg(segment, scaling.emoji);
      }
      return null;
    },
  });

  const svg = await satori(<Component {...props} />, satoriConfig);

  const svgString = Buffer.from(svg).toString("utf-8");
  const [, width, height] = svgString.match(
    /<svg[^>]+width="(\d+)"[^>]+height="(\d+)"/
  );

  const newWidth = Math.round(parseInt(width) * scaling.image);
  const newHeight = Math.round(parseInt(height) * scaling.image);

  const sharpInstance = sharp(Buffer.from(svg), {
    limitInputPixels: false,
  }).withMetadata({
    density: 72,
  });

  const outputStream = sharpInstance
    .resize(newWidth, newHeight, {
      kernel: sharp.kernel.mitchell,
      fastShrinkOnLoad: true,
    })
    .png({ compressionLevel: 9, adaptiveFiltering: true });

  return new Promise((resolve, reject) => {
    const chunks = [];
    outputStream.on("data", (chunk) => chunks.push(chunk));
    outputStream.on("end", () => {
      const buffer = Buffer.concat(chunks);
      const readableStream = new Readable();
      readableStream.push(buffer);
      readableStream.push(null);
      sharpInstance.destroy();
      resolve(readableStream);
    });
    outputStream.on("error", (err) => {
      sharpInstance.destroy();
      reject(err);
    });
    outputStream.on("close", () => {
      if (chunks.length === 0) {
        reject(new Error("ERR_STREAM_PREMATURE_CLOSE"));
      }
    });
  });
}
