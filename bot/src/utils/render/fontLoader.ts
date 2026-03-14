import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type FontMapEntry = {
  name: string;
  weight: number;
  css: string;
};

type FontBuffers = Record<string, ArrayBuffer>;

let fontBuffers: FontBuffers | null = null;

// Map font filenames to their configurations
const fontWeightMap: Record<string, FontMapEntry> = {
  "Inter_28pt-Regular.ttf": { name: "Inter", weight: 400, css: "Inter400" },
  "Inter_28pt-Medium.ttf": { name: "Inter", weight: 500, css: "Inter500" },
  "Inter_28pt-SemiBold.ttf": { name: "Inter600", weight: 600, css: "Inter600" },
  "Inter_28pt-Bold.ttf": { name: "Inter", weight: 700, css: "Inter700" },
  "Inter_28pt-ExtraBold.ttf": { name: "Inter", weight: 800, css: "Inter800" },
  "Roboto-Medium.ttf": { name: "Roboto", weight: 500, css: "Roboto" },
};

type FontConfigTemplate = {
  name: string;
  weight: number;
  style: "normal";
  data: ArrayBuffer | null;
};

type FontConfig = {
  name: string;
  data: ArrayBuffer;
  weight: number;
  style: "normal";
};

export let defaultFontConfig: FontConfigTemplate[] = Object.entries(fontWeightMap).map(
  ([filename, font]) => ({
    name: font.name,
    weight: font.weight,
    style: "normal",
    data: null,
  }),
);

export async function loadFonts() {
  try {
    console.log("🎯 Server-side font loading started");

    if (!fontBuffers) {
      const fontPaths: Record<string, string> = {};

      // Create paths for all configured fonts
      Object.entries(fontWeightMap).forEach(([filename, config]) => {
        const key = `${config.name}${config.weight}`;
        fontPaths[key] = path.join(
          __dirname,
          "..",
          "..",
          "render-server",
          "public",
          "fonts",
          filename,
        );
      });

      console.log(
        "📂 Attempting to load fonts from paths:",
        JSON.stringify(fontPaths, null, 2),
      );

      try {
        const loadedBuffers = await Promise.all(
          Object.entries(fontPaths).map(async ([key, fontPath]) => {
            try {
              const buffer = await fs.readFile(fontPath);
              console.log(`✅ Loaded font: ${key} (${buffer.length / 1024}KB)`);
              return [
                key,
                buffer.buffer.slice(
                  buffer.byteOffset,
                  buffer.byteOffset + buffer.byteLength,
                ),
              ];
            } catch (error) {
              console.error(
                `❌ Failed to load font ${key} from ${fontPath}:`,
                error,
              );
              throw error;
            }
          }),
        );

        fontBuffers = Object.fromEntries(loadedBuffers);
        console.log("✅ All font buffers loaded successfully");
      } catch (error) {
        const err = error as NodeJS.ErrnoException;
        console.error("❌ Error reading font files:", error);
        console.error("🔍 Detailed error:", {
          code: err.code,
          path: err.path,
          message: err.message,
        });
        throw error;
      }
    } else {
      console.log("📦 Using cached font buffers");
    }

    return fontBuffers;
  } catch (error) {
    console.error("💥 Fatal font loading error:", error);
    throw error;
  }
}

export async function createFontConfig(customConfig = {}) {
  console.log("🔧 Creating font configuration");
  try {
    const fonts = await loadFonts();
    if (!fonts) {
      throw new Error("Font buffers failed to initialize");
    }
    console.log("📝 Font names available:", Object.keys(fonts));

    const configFonts: FontConfig[] = defaultFontConfig.map((font) => {
      const fontKey = `${font.name}${font.weight}`;
      const fontConfig = Object.values(fontWeightMap).find(
        (config) => config.name === font.name && config.weight === font.weight,
      );
      const fontData = fonts[fontKey];
      console.log(
        `⚙️ Configuring font: ${fontKey}`,
        JSON.stringify(
          {
            weight: font.weight,
            style: font.style,
            hasData: !!fontData,
          },
          null,
          2,
        ),
      );

      if (!fontData) {
        throw new Error(`Font data not found for ${fontKey}`);
      }
      if (!fontConfig) {
        throw new Error(`Font config not found for ${fontKey}`);
      }

      return {
        name: fontConfig.css || fontKey,
        data: fontData,
        weight: font.weight,
        style: font.style,
      };
    });

    console.log("✨ Font configuration complete");
    return configFonts;
  } catch (error) {
    console.error("❌ Font configuration failed:", error);
    throw error;
  }
}
