import satori from "satori";
import sharp from "sharp";
import { createSatoriConfig } from "../config/satori-config.js";
import twemoji from "@twemoji/api";
import axios from "axios";

async function fetchEmojiSvg(emoji) {
  const emojiCode = twemoji.convert.toCodePoint(emoji);
  const svgUrl = `https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/${emojiCode}.svg`;

  try {
    const response = await axios.get(svgUrl, {
      responseType: "arraybuffer",
    });
    const svgBuffer = Buffer.from(response.data);
    const base64Svg = svgBuffer.toString("base64");
    return `data:image/svg+xml;base64,${base64Svg}`;
  } catch (error) {
    console.error(`Failed to load emoji ${emoji}:`, error);
    return null;
  }
}

export async function generateImage(Component, props = {}, customConfig = {}) {
  const satoriConfig = createSatoriConfig({
    ...customConfig,
    loadAdditionalAsset: async (code, segment) => {
      if (code === "emoji") {
        return await fetchEmojiSvg(segment);
      }
      return null;
    },
  });

  try {
    const svg = await satori(<Component {...props} />, satoriConfig);
    return sharp(Buffer.from(svg)).png().toBuffer();
  } catch (error) {
    console.error("Error in satori:", error);
    throw error;
  }
}
