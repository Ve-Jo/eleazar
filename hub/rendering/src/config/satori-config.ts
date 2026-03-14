type SatoriFont = {
  name: string;
  weight?: number;
  style?: string;
  data?: ArrayBuffer | Uint8Array;
};

type SatoriConfig = {
  width: number;
  height: number;
  fonts: SatoriFont[];
  loadAdditionalAsset?: (...args: unknown[]) => unknown;
};

type CustomSatoriConfig = {
  width?: number;
  height?: number;
  loadAdditionalAsset?: (...args: unknown[]) => unknown;
};

export async function createSatoriConfig(
  customConfig: CustomSatoriConfig = {},
  fonts?: SatoriFont[]
): Promise<SatoriConfig> {
  try {
    console.log("🎨 Creating Satori configuration");

    if (!fonts) {
      throw new Error("Fonts must be provided to Satori config");
    }

    const config: SatoriConfig = {
      width: customConfig.width || 1200,
      height: customConfig.height || 1200,
      fonts,
    };

    if (customConfig.loadAdditionalAsset) {
      config.loadAdditionalAsset = customConfig.loadAdditionalAsset;
    }

    if (!config.fonts || config.fonts.length === 0) {
      throw new Error("No fonts configured for Satori");
    }

    const fontSummary = config.fonts.map((font) => ({
      name: font.name,
      weight: font.weight,
      style: font.style,
      hasData: Boolean(font.data),
    }));
    console.log("📝 Satori config created with fonts:");
    fontSummary.forEach((font) => console.log(JSON.stringify(font, null, 2)));

    return config;
  } catch (error) {
    console.error("❌ Satori configuration error:", error);
    throw error;
  }
}
