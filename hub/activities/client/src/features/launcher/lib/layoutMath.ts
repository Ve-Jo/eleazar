export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function interpolateRange(min: number, max: number, progress: number): number {
  return min + (max - min) * progress;
}

export function parseNumericCssValue(rawValue: string): number {
  const numericValue = Number.parseFloat(rawValue);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

export function formatDebugPx(value: number): string {
  return `${Math.round(value)}px`;
}
