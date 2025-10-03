export async function createSatoriConfig(customConfig = {}, fonts) {
  try {
    console.log("🎨 Creating Satori configuration");

    if (!fonts) {
      throw new Error("Fonts must be provided to Satori config");
    }

    // Use provided fonts to create config
    const config = {
      width: customConfig.width || 1200,
      height: customConfig.height || 1200,
      fonts,
    };

    // Add loadAdditionalAsset if provided
    if (customConfig.loadAdditionalAsset) {
      config.loadAdditionalAsset = customConfig.loadAdditionalAsset;
    }

    // Validate config
    if (!config.fonts || config.fonts.length === 0) {
      throw new Error("No fonts configured for Satori");
    }

    // Log final config for debugging
    const fontSummary = config.fonts.map((f) => ({
      name: f.name,
      weight: f.weight,
      style: f.style,
      hasData: !!f.data,
    }));
    console.log("📝 Satori config created with fonts:");
    fontSummary.forEach((font) => console.log(JSON.stringify(font, null, 2)));

    return config;
  } catch (error) {
    console.error("❌ Satori configuration error:", error);
    throw error;
  }
}
