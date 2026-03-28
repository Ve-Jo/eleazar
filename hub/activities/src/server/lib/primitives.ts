import type { ActivitySupportedLocale } from "../../../../shared/src/contracts/hub.ts";

export function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function clamp(min: number, value: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function normalizeGameId(gameId: string): string {
  return String(gameId || "").trim().toLowerCase();
}

export function getDiscordOAuthErrorMessage(payload: any): string {
  if (!payload || typeof payload !== "object") {
    return "Discord OAuth token exchange failed.";
  }

  const error = typeof payload.error === "string" ? payload.error : "oauth_error";
  const description =
    typeof payload.error_description === "string" ? payload.error_description : "";

  return description ? `${error}: ${description}` : error;
}

export function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function asArray(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry) => entry && typeof entry === "object") as Array<
    Record<string, unknown>
  >;
}

export function toBoolean(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    return value.trim().toLowerCase() === "true";
  }
  if (typeof value === "number") {
    return value > 0;
  }
  return false;
}

export function roundMoney(value: number): number {
  return Number(value.toFixed(5));
}

export function formatCompactNumber(value: number, locale: ActivitySupportedLocale): string {
  return value.toLocaleString(locale === "uk" ? "uk-UA" : locale === "ru" ? "ru-RU" : "en-US", {
    maximumFractionDigits: value >= 100 ? 0 : 2,
    minimumFractionDigits: 0,
  });
}

export function formatDurationCompact(
  valueMs: number,
  locale: ActivitySupportedLocale,
  unitLabels?: { day: string; hour: string; minute: string }
): string {
  const totalSeconds = Math.max(0, Math.floor(valueMs / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const labels = unitLabels
    ? { d: unitLabels.day, h: unitLabels.hour, m: unitLabels.minute }
    : locale === "ru"
    ? { d: "д", h: "ч", m: "м" }
    : locale === "uk"
    ? { d: "д", h: "г", m: "хв" }
    : { d: "d", h: "h", m: "m" };

  if (days > 0) {
    return `${days}${labels.d} ${hours}${labels.h}`;
  }
  if (hours > 0) {
    return `${hours}${labels.h} ${minutes}${labels.m}`;
  }
  return `${Math.max(1, minutes)}${labels.m}`;
}

export function interpolateTemplate(
  template: string,
  variables: Record<string, string | number>
): string {
  return Object.entries(variables).reduce(
    (result, [key, value]) =>
      result.replaceAll(`{{${key}}}`, String(value)).replaceAll(`{{ ${key} }}`, String(value)),
    template
  );
}

export function getAvatarUrl(userId?: string, avatarHash?: string | null): string {
  if (!userId || !avatarHash) {
    return "https://cdn.discordapp.com/embed/avatars/0.png";
  }

  return `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.png?size=128`;
}

export function getUpgradeLevel(upgrades: any[], type: string): number {
  const upgrade = upgrades.find(
    (item) => String(item?.type || "").toLowerCase() === String(type).toLowerCase()
  );
  return Math.max(1, toNumber(upgrade?.level, 1));
}
