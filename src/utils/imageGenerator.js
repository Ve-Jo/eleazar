import satori from "satori";
import sharp from "sharp";
import { createSatoriConfig } from "../config/satori-config.js";
import twemoji from "@twemoji/api";
import axios from "axios";

async function fetchEmojiSvg(emoji, emojiScaling) {
  const emojiCode = twemoji.convert.toCodePoint(emoji);
  console.log(emojiCode);
  const svgUrl = `https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/${emojiCode}.svg`;

  try {
    const response = await axios.get(svgUrl, {
      responseType: "arraybuffer",
    });

    const pngBuffer = await sharp(response.data)
      .resize(256 * emojiScaling, 256 * emojiScaling, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();

    const base64Png = pngBuffer.toString("base64");
    return `data:image/png;base64,${base64Png}`;
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

  try {
    const svg = await satori(<Component {...props} />, satoriConfig);

    const svgString = Buffer.from(svg).toString("utf-8");
    const [, width, height] = svgString.match(
      /<svg[^>]+width="(\d+)"[^>]+height="(\d+)"/
    );

    const newWidth = Math.round(parseInt(width) * scaling.image);
    const newHeight = Math.round(parseInt(height) * scaling.image);

    return sharp(Buffer.from(svg))
      .resize(newWidth, newHeight, { kernel: sharp.kernel.mitchell })
      .png()
      .toBuffer();
  } catch (error) {
    console.error("Error in satori:", error);
    throw error;
  }
}
