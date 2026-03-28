import { expect, test } from "bun:test";

import {
  ACTIVITY_LAUNCHER_LOCALIZATIONS,
  buildActivityStrings,
  clearActivityLocaleCache,
} from "./activityI18n.ts";

const REQUIRED_LOCALES = ["en", "ru", "uk"] as const;

function isLocaleLeaf(input: unknown): input is Record<(typeof REQUIRED_LOCALES)[number], string> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return false;
  }

  return REQUIRED_LOCALES.every((locale) => typeof (input as Record<string, unknown>)[locale] === "string");
}

function collectLeafValidationErrors(input: unknown, pathPrefix = ""): string[] {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return [pathPrefix || "<root>"];
  }

  const entries = Object.entries(input as Record<string, unknown>);
  if (entries.length === 0) {
    return [pathPrefix || "<root>"];
  }

  if (isLocaleLeaf(input)) {
    return [];
  }

  const errors: string[] = [];
  for (const [key, value] of entries) {
    const childPath = pathPrefix ? `${pathPrefix}.${key}` : key;
    errors.push(...collectLeafValidationErrors(value, childPath));
  }

  return errors;
}

function collectUndefinedPaths(input: unknown, pathPrefix = ""): string[] {
  if (typeof input === "string") {
    return [];
  }

  if (input === undefined || input === null) {
    return [pathPrefix || "<root>"];
  }

  if (typeof input !== "object" || Array.isArray(input)) {
    return [];
  }

  const errors: string[] = [];
  for (const [key, value] of Object.entries(input)) {
    const childPath = pathPrefix ? `${pathPrefix}.${key}` : key;
    errors.push(...collectUndefinedPaths(value, childPath));
  }

  return errors;
}

test("activity localization payload uses {en,ru,uk} leaves", () => {
  const errors = collectLeafValidationErrors(ACTIVITY_LAUNCHER_LOCALIZATIONS);
  expect(errors).toEqual([]);
});

test("buildActivityStrings returns fully defined strings for all supported locales", () => {
  clearActivityLocaleCache();

  for (const locale of REQUIRED_LOCALES) {
    const strings = buildActivityStrings(locale);
    const undefinedPaths = collectUndefinedPaths(strings);
    expect(undefinedPaths).toEqual([]);
  }
});
