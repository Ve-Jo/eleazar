import React from "react";

/**
 * Utility to process flag emojis (regional indicator symbols) in React elements.
 * 
 * Takumi's emoji: "twemoji" option doesn't handle regional indicator symbols correctly.
 * This utility pre-processes React elements to replace flag emojis with <img> elements
 * pointing to twemoji SVG URLs.
 * 
 * Regional indicators: U+1F1E6 (🇦) to U+1F1FF (🇿)
 * Each letter maps to: 1F1E6 + (letter position in alphabet)
 * Example: US = U (1F1FA) + S (1F1F8) -> https://...twemoji/1f1fa-1f1f8.svg
 */

const TWEMOJI_SVG_BASE = "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg";

/**
 * Check if a codepoint is a regional indicator symbol
 */
function isRegionalIndicator(cp: number | undefined): boolean {
  if (cp === undefined) return false;
  return cp >= 0x1f1e6 && cp <= 0x1f1ff;
}

/**
 * Convert regional indicator codepoint to letter (A-Z)
 */
function regionalIndicatorToLetter(cp: number): string {
  return String.fromCharCode(cp - 0x1f1e6 + 65);
}

/**
 * Convert country code to twemoji SVG URL
 */
export function countryCodeToFlagUrl(countryCode: string): string {
  const code = countryCode.toUpperCase();
  const cp1 = (0x1f1e6 + code.charCodeAt(0) - 65).toString(16);
  const cp2 = (0x1f1e6 + code.charCodeAt(1) - 65).toString(16);
  return `${TWEMOJI_SVG_BASE}/${cp1}-${cp2}.svg`;
}

/**
 * Split text into parts: regular text and flag emojis
 */
function splitTextByFlags(text: string): Array<{ type: "text"; value: string } | { type: "flag"; code: string }> {
  const parts: Array<{ type: "text"; value: string } | { type: "flag"; code: string }> = [];
  let i = 0;
  let currentText = "";

  while (i < text.length) {
    const cp = text.codePointAt(i);

    // Check if this is a regional indicator (potential flag start)
    if (cp && isRegionalIndicator(cp)) {
      // Get the next character's codepoint (skip surrogate pair)
      const charSize = cp > 0xffff ? 2 : 1;
      const nextCp = text.codePointAt(i + charSize);

      if (nextCp && isRegionalIndicator(nextCp)) {
        // Found a flag! Push current text and the flag
        if (currentText) {
          parts.push({ type: "text", value: currentText });
          currentText = "";
        }
        const letter1 = regionalIndicatorToLetter(cp);
        const letter2 = regionalIndicatorToLetter(nextCp);
        parts.push({ type: "flag", code: letter1 + letter2 });
        const nextCharSize = nextCp > 0xffff ? 2 : 1;
        i += charSize + nextCharSize;
        continue;
      }
    }
    currentText += text[i];
    i++;
  }

  if (currentText) {
    parts.push({ type: "text", value: currentText });
  }

  return parts;
}

/**
 * Convert text containing flag emojis to React elements
 */
function textToReactWithFlags(
  text: string,
  imgSize: number = 16
): React.ReactNode {
  const parts = splitTextByFlags(text);

  // If no flags found, return original text
  if (parts.length === 1 && parts[0]?.type === "text") {
    return text;
  }

  // Create React elements for each part
  const elements = parts.map((part, idx) => {
    if (part.type === "text") {
      return React.createElement("span", { key: idx }, part.value);
    } else {
      const url = countryCodeToFlagUrl(part.code);
      return React.createElement("img", {
        key: idx,
        src: url,
        width: imgSize,
        height: imgSize,
        style: { display: "inline-block", verticalAlign: "middle" },
        alt: part.code,
      });
    }
  });

  return React.createElement(
    "span",
    { style: { display: "inline-flex", alignItems: "center", gap: "2px" } },
    elements
  );
}

/**
 * Recursively traverse and transform React elements to replace flag emojis
 */
export function processFlagEmojis(
  node: React.ReactNode,
  imgSize: number = 16
): React.ReactNode {
  // Handle null/undefined/boolean
  if (node == null || typeof node === "boolean") {
    return node;
  }

  // Handle strings - check for flags
  if (typeof node === "string") {
    return textToReactWithFlags(node, imgSize);
  }

  // Handle numbers
  if (typeof node === "number") {
    return node;
  }

  // Handle arrays
  if (Array.isArray(node)) {
    return node.map((child) => processFlagEmojis(child, imgSize));
  }

  // Handle React elements
  if (React.isValidElement(node)) {
    // Skip img elements to avoid processing their alt text
    if (node.type === "img") {
      return node;
    }

    const props = node.props as Record<string, unknown> | undefined;
    const children = props?.children;

    if (children !== undefined && props) {
      // Process children - the result is always a valid ReactNode
      // Cast through unknown since children comes from untyped props
      const processedChildren = processFlagEmojis(children as unknown as React.ReactNode, imgSize);
      // Only clone if we have something to render
      if (processedChildren !== null && processedChildren !== undefined) {
        // Type assertion needed: React.cloneElement's type signature is overly strict
        // It accepts ReactNode at runtime but TS doesn't recognize {} as valid
        return React.cloneElement(
          node,
          props,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          processedChildren as any
        );
      }
    }

    return node;
  }

  return node;
}
