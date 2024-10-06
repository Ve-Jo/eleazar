import fs from "fs";
import path from "path";

const fontPath = path.join(process.cwd(), "Roboto-Medium.ttf");
const fontBuffer = fs.readFileSync(fontPath);

export const defaultSatoriConfig = {
  width: 600,
  height: 200,
  fonts: [
    {
      name: "Roboto",
      data: fontBuffer,
      weight: 400,
      style: "normal",
    },
  ],
};

export function createSatoriConfig(customConfig = {}) {
  return {
    ...defaultSatoriConfig,
    ...customConfig,
    fonts: [
      ...(defaultSatoriConfig.fonts || []),
      ...(customConfig.fonts || []),
    ],
  };
}
