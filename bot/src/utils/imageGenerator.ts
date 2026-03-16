import hubClient from "../api/hubClient.ts";

type PrimitiveValue = string | number | boolean | bigint | null | undefined;
type FormattableValue =
  | PrimitiveValue
  | FormattableValue[]
  | { [key: string]: FormattableValue };

type ColorOptions = {
  paletteSize?: number;
  quality?: number;
  ignoreWhite?: boolean;
  returnDominant?: boolean;
};

type ScalingOptions = {
  image?: number;
  emoji?: number;
  debug?: boolean;
};

type I18nLike = {
  getLocale?: () => string;
};

type GeneratedImageProps = Record<string, unknown>;

type LocalPaletteColor = [number, number, number];

type ColorProcessingResult =
  | LocalPaletteColor[]
  | {
      palette: LocalPaletteColor[];
      dominantColor: LocalPaletteColor;
    }
  | unknown;

const colorCache = new Map<string, ColorProcessingResult>();
const COLOR_CACHE_MAX_SIZE = 50;
const BOT_RENDER_LOGGING = parseBooleanEnv(process.env.BOT_RENDER_LOGGING, false);
const DEFAULT_DISCORD_ASSET_MAX_SIZE = parseInt(
  process.env.BOT_RENDER_ASSET_MAX_SIZE || "",
  10
) || 512;
const GAME_DISCORD_ASSET_MAX_SIZE = parseInt(
  process.env.BOT_RENDER_GAME_ASSET_MAX_SIZE || "",
  10
) || 256;
const ASSET_URL_PROP_KEYS = new Set(["avatarURL", "iconURL", "bannerURL"]);
const GAME_COMPONENTS = new Set(["2048", "Snake", "Tower", "Coinflip", "GameLauncher"]);

function parseBooleanEnv(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === null || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function clampDiscordAssetSize(urlValue: string, maxSize: number): string {
  if (!urlValue || !urlValue.startsWith("http")) return urlValue;
  try {
    const parsed = new URL(urlValue);
    const host = parsed.hostname.toLowerCase();
    const isDiscordCdn =
      host.includes("cdn.discordapp.com") || host.includes("media.discordapp.net");
    if (!isDiscordCdn) return urlValue;

    const currentSize = parseInt(parsed.searchParams.get("size") || "", 10);
    if (!Number.isNaN(currentSize) && currentSize > maxSize) {
      parsed.searchParams.set("size", String(maxSize));
      return parsed.toString();
    }
    return urlValue;
  } catch {
    return urlValue;
  }
}

function sanitizeRenderProps(value: unknown, maxAssetSize: number): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeRenderProps(entry, maxAssetSize));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (key === "_debug") continue;

    if (typeof entry === "string" && ASSET_URL_PROP_KEYS.has(key)) {
      sanitized[key] = clampDiscordAssetSize(entry, maxAssetSize);
      continue;
    }

    sanitized[key] = sanitizeRenderProps(entry, maxAssetSize);
  }
  return sanitized;
}

function manageColorCache(): void {
  while (colorCache.size > COLOR_CACHE_MAX_SIZE) {
    const oldestKey = colorCache.keys().next().value;
    if (!oldestKey) {
      return;
    }
    colorCache.delete(oldestKey);
  }
}

function formatValue(value: FormattableValue): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string") {
    if (/^\-?\d*\.?\d+$/.test(value)) {
      const num = Number(value);
      return !Number.isNaN(num) ? num : value;
    }

    if (/^\d{17,19}$/.test(value)) {
      return value;
    }

    return value;
  }

  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return value.map((entry) => formatValue(entry));
  }

  if (typeof value === "object") {
    const formatted: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      formatted[key] = formatValue(val as FormattableValue);
    }
    return formatted;
  }

  return value;
}

async function processImageColors(
  imageUrl: string,
  options: ColorOptions = {}
): Promise<ColorProcessingResult> {
  const {
    paletteSize = 5,
    quality = 10,
    ignoreWhite = true,
    returnDominant = false,
  } = options;

  const cacheKey = `${imageUrl}-${paletteSize}-${quality}-${ignoreWhite}-${returnDominant}`;

  if (colorCache.has(cacheKey)) {
    return colorCache.get(cacheKey) as ColorProcessingResult;
  }

  try {
    const result = (await hubClient.processImageColors(imageUrl)) as ColorProcessingResult;

    manageColorCache();
    colorCache.set(cacheKey, result);

    return result;
  } catch (error) {
    console.error("Hub color processing failed, falling back to local:", error);

    try {
      const { getPaletteFromURL, getColorFromURL } = await import("color-thief-bun");
      let palette: LocalPaletteColor[] | undefined;
      let dominantColor: LocalPaletteColor | undefined;

      if (returnDominant) {
        [palette, dominantColor] = (await Promise.all([
          getPaletteFromURL(imageUrl, paletteSize, quality),
          getColorFromURL(imageUrl, quality),
        ])) as [LocalPaletteColor[], LocalPaletteColor];
      } else {
        palette = (await getPaletteFromURL(
          imageUrl,
          paletteSize,
          quality
        )) as LocalPaletteColor[];
      }

      if (ignoreWhite && palette) {
        palette = palette.filter(([r, g, b]) => {
          const brightness = (r * 299 + g * 587 + b * 114) / 1000;
          return brightness < 240;
        });
      }

      const result = returnDominant
        ? { palette: palette ?? [], dominantColor: dominantColor as LocalPaletteColor }
        : (palette ?? []);

      manageColorCache();
      colorCache.set(cacheKey, result);

      return result;
    } catch (fallbackError) {
      console.error("Local color processing also failed:", fallbackError);
      throw fallbackError;
    }
  }
}

async function generateImage(
  component: string,
  props: GeneratedImageProps = {},
  scaling: ScalingOptions = { image: 1, emoji: 1, debug: false },
  i18n?: I18nLike,
  options: Record<string, unknown> = {}
): Promise<unknown> {
  try {
    if (BOT_RENDER_LOGGING) {
      console.log("Generating image via hub rendering service");
    }
    const maxAssetSize = GAME_COMPONENTS.has(component)
      ? GAME_DISCORD_ASSET_MAX_SIZE
      : DEFAULT_DISCORD_ASSET_MAX_SIZE;
    const optimizedProps = sanitizeRenderProps(props, maxAssetSize) as GeneratedImageProps;
    const effectiveScaling = {
      image: scaling.image ?? 1,
      emoji: scaling.emoji ?? 1,
    };

    const renderOptions = {
      renderMode: "command",
      ...options,
    };

    return await hubClient.generateImage(
      component,
      optimizedProps,
      effectiveScaling,
      i18n?.getLocale?.() || "en",
      renderOptions
    );
  } catch (error) {
    console.error("Hub image generation failed:", error);
    throw error;
  }
}

async function cleanup(forceGC = true): Promise<void> {
  colorCache.clear();
  if (forceGC && global.gc) {
    global.gc();
  }
}

export { formatValue, processImageColors, generateImage, cleanup };
export default generateImage;
