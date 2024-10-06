import satori from "satori";
import sharp from "sharp";
import { createSatoriConfig } from "../config/satori-config.js";

export async function generateImage(Component, props = {}, customConfig = {}) {
  const satoriConfig = createSatoriConfig(customConfig);
  const svg = await satori(<Component {...props} />, satoriConfig);

  return sharp(Buffer.from(svg)).png().toBuffer();
}
