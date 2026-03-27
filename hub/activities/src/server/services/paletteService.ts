import type { ActivityPalette } from "../../../../shared/src/contracts/hub.ts";

import { PALETTE_CACHE_TTL_MS, RENDERING_SERVICE_URL } from "../config.ts";
import { parseJsonResponse } from "../lib/http.ts";
import { asObject } from "../lib/primitives.ts";

const paletteCache = new Map<string, { expiresAt: number; palette: ActivityPalette }>();

export const DEFAULT_ACTIVITY_PALETTE: ActivityPalette = {
  textColor: "#f8fbff",
  secondaryTextColor: "rgba(248,251,255,0.78)",
  tertiaryTextColor: "rgba(248,251,255,0.56)",
  overlayBackground: "rgba(255,255,255,0.08)",
  backgroundGradient: "linear-gradient(145deg, #0f4a68 0%, #173e78 45%, #2f215f 100%)",
  accentColor: "#ffb648",
  dominantColor: "rgb(70, 143, 201)",
  isDarkText: false,
};

export async function fetchRenderingPalette(imageUrl?: string | null): Promise<ActivityPalette> {
  if (!imageUrl) {
    return DEFAULT_ACTIVITY_PALETTE;
  }

  const cached = paletteCache.get(imageUrl);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.palette;
  }

  try {
    const response = await fetch(`${RENDERING_SERVICE_URL}/colors`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ imageUrl }),
    });

    const parsed = await parseJsonResponse(response);
    const candidate = asObject(parsed.data);
    const palette: ActivityPalette = {
      textColor:
        typeof candidate.textColor === "string"
          ? candidate.textColor
          : DEFAULT_ACTIVITY_PALETTE.textColor,
      secondaryTextColor:
        typeof candidate.secondaryTextColor === "string"
          ? candidate.secondaryTextColor
          : DEFAULT_ACTIVITY_PALETTE.secondaryTextColor,
      tertiaryTextColor:
        typeof candidate.tertiaryTextColor === "string"
          ? candidate.tertiaryTextColor
          : DEFAULT_ACTIVITY_PALETTE.tertiaryTextColor,
      overlayBackground:
        typeof candidate.overlayBackground === "string"
          ? candidate.overlayBackground
          : DEFAULT_ACTIVITY_PALETTE.overlayBackground,
      backgroundGradient:
        typeof candidate.backgroundGradient === "string"
          ? candidate.backgroundGradient
          : DEFAULT_ACTIVITY_PALETTE.backgroundGradient,
      accentColor:
        typeof candidate.accentColor === "string"
          ? candidate.accentColor
          : DEFAULT_ACTIVITY_PALETTE.accentColor,
      dominantColor:
        typeof candidate.dominantColor === "string"
          ? candidate.dominantColor
          : DEFAULT_ACTIVITY_PALETTE.dominantColor,
      isDarkText:
        typeof candidate.isDarkText === "boolean"
          ? candidate.isDarkText
          : DEFAULT_ACTIVITY_PALETTE.isDarkText,
    };

    paletteCache.set(imageUrl, {
      palette,
      expiresAt: Date.now() + PALETTE_CACHE_TTL_MS,
    });

    return palette;
  } catch (error) {
    console.warn("[activities] failed to fetch palette from rendering service", error);
    return DEFAULT_ACTIVITY_PALETTE;
  }
}
