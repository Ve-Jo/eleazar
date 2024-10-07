import fs from "fs";
import path from "path";

const fontPath = path.join(process.cwd(), "./fonts/Roboto-Medium.ttf");
const fontBuffer = fs.readFileSync(fontPath);

const fontPath2 = path.join(process.cwd(), "./fonts/Inter_28pt-SemiBold.ttf");
const fontBuffer2 = fs.readFileSync(fontPath2);

export const defaultSatoriConfig = {
  width: 600,
  height: 200,
  fonts: [
    {
      name: "Inter",
      data: fontBuffer2,
      weight: 600,
      style: "normal",
    },
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
