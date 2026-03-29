import { createHmac, timingSafeEqual } from "node:crypto";

export function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter(Boolean);
}

export function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "bigint") {
    return Number(value);
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
}

export function toSafeInteger(value: unknown, fallback = 0): number {
  const numeric = toNumber(value, fallback);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  if (numeric < 0) {
    return 0;
  }

  return Math.floor(numeric);
}

export function toBigIntTimestamp(value: unknown): bigint {
  if (typeof value === "bigint") {
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return BigInt(Math.floor(value));
  }

  if (typeof value === "string" && value.trim()) {
    try {
      return BigInt(value);
    } catch {
      return BigInt(Date.now());
    }
  }

  return BigInt(Date.now());
}

export function buildSignedContext(
  secret: string,
  userId: string,
  guildIdsCsv: string,
  timestamp: string,
  returnTo: string
): string {
  return createHmac("sha256", secret)
    .update(`${userId}:${guildIdsCsv}:${timestamp}:${returnTo}`)
    .digest("hex");
}

export function verifySignedContext(
  expectedSignature: string,
  receivedSignature: string
): boolean {
  const expected = Buffer.from(expectedSignature, "hex");
  const received = Buffer.from(receivedSignature, "hex");

  if (expected.length === 0 || expected.length !== received.length) {
    return false;
  }

  return timingSafeEqual(expected, received);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
