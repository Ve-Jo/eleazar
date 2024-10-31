import fs from "fs";
import path from "path";

let fontBuffers = null;

function loadFonts() {
  if (!fontBuffers) {
    const fontPath = path.join(process.cwd(), "./fonts/Roboto-Medium.ttf");
    const fontPath2 = path.join(
      process.cwd(),
      "./fonts/Inter_28pt-SemiBold.ttf"
    );

    fontBuffers = {
      Roboto: fs.readFileSync(fontPath),
      Inter: fs.readFileSync(fontPath2),
    };
  }
  return fontBuffers;
}

export const defaultSatoriConfig = {
  width: 600,
  height: 200,
  fonts: [
    {
      name: "Inter",
      weight: 600,
      style: "normal",
    },
    {
      name: "Roboto",
      weight: 400,
      style: "normal",
    },
  ],
};

export function createSatoriConfig(customConfig = {}) {
  const fonts = loadFonts();
  const configFonts = defaultSatoriConfig.fonts.map((font) => ({
    ...font,
    data: fonts[font.name],
  }));

  return {
    ...defaultSatoriConfig,
    ...customConfig,
    fonts: [...configFonts, ...(customConfig.fonts || [])],
  };
}
