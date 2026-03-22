import React from "react";
import { ImageResponse } from "@takumi-rs/image-response";
import type { Font } from "@takumi-rs/core";
import { processFlagEmojis } from "./flagEmojiProcessor.ts";

type SatoriFont = {
  name: string;
  weight?: number;
  style?: string;
  data?: ArrayBuffer | Uint8Array;
};

const EMPTY_BUFFER = Buffer.alloc(0);
const takumiAssetBufferCache = new Map();
const TAKUMI_ASSET_BUFFER_CACHE_MAX_SIZE =
  parseInt(process.env.TAKUMI_ASSET_BUFFER_CACHE_MAX_SIZE || "256", 10);
const TAKUMI_ASSET_BUFFER_TTL_MS =
  parseInt(process.env.TAKUMI_ASSET_BUFFER_TTL_MS || "600000", 10);
const TAKUMI_PERSISTENT_IMAGES_MAX_SIZE =
  parseInt(process.env.TAKUMI_PERSISTENT_IMAGES_MAX_SIZE || "128", 10);

function getCachedTakumiAssetBuffer(key: string) {
  const entry = takumiAssetBufferCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > TAKUMI_ASSET_BUFFER_TTL_MS) {
    takumiAssetBufferCache.delete(key);
    return null;
  }
  return entry;
}

function setCachedTakumiAssetBuffer(key: string, asset: { buffer: Buffer; arrayBuffer: ArrayBuffer }) {
  if (
    !key ||
    !asset ||
    !Buffer.isBuffer(asset.buffer) ||
    !(asset.arrayBuffer instanceof ArrayBuffer)
  )
    return;
  takumiAssetBufferCache.set(key, {
    buffer: asset.buffer,
    arrayBuffer: asset.arrayBuffer,
    timestamp: Date.now(),
  });
  const maxSize = Math.max(
    TAKUMI_ASSET_BUFFER_CACHE_MAX_SIZE,
    TAKUMI_PERSISTENT_IMAGES_MAX_SIZE
  );
  if (takumiAssetBufferCache.size > maxSize) {
    const firstKey = takumiAssetBufferCache.keys().next().value;
    if (firstKey) takumiAssetBufferCache.delete(firstKey);
  }
}

function getPersistentImagesSnapshot() {
  const now = Date.now();
  const persistentImages = [];
  for (const [src, entry] of takumiAssetBufferCache.entries()) {
    if (now - entry.timestamp > TAKUMI_ASSET_BUFFER_TTL_MS) {
      takumiAssetBufferCache.delete(src);
      continue;
    }
    persistentImages.push({
      src,
      data: entry.arrayBuffer,
    });
    if (persistentImages.length >= TAKUMI_PERSISTENT_IMAGES_MAX_SIZE) break;
  }
  return persistentImages;
}

function resolveSourceKey(src: string | URL | { href?: string; toString?: () => string }): string {
  return typeof src === "string"
    ? src
    : typeof src?.href === "string"
    ? src.href
    : typeof src?.toString === "function"
    ? src.toString()
    : "";
}

async function resolveSourceAsset(
  src: string,
  loadImageAsset: (path: string) => Promise<string>,
  dataUriToBuffer: (dataUri: string) => Buffer | null,
  bufferToArrayBuffer: (buffer: Buffer) => Promise<ArrayBuffer>
) {
  if (!src) {
    return {
      buffer: EMPTY_BUFFER,
      arrayBuffer: await bufferToArrayBuffer(EMPTY_BUFFER),
    };
  }

  const cached = getCachedTakumiAssetBuffer(src);
  if (cached) return cached;

  let buffer: Buffer = EMPTY_BUFFER;
  if (src.startsWith("data:")) {
    buffer = dataUriToBuffer(src) ?? EMPTY_BUFFER;
  } else {
    const resolvedDataUri = await loadImageAsset(src);
    buffer = dataUriToBuffer(resolvedDataUri) ?? EMPTY_BUFFER;
  }

  if (buffer.length > 0) {
    const arrayBuffer = await bufferToArrayBuffer(buffer) as ArrayBuffer;
    const asset = { buffer, arrayBuffer };
    setCachedTakumiAssetBuffer(src, asset);
    return asset;
  }
  return { buffer: EMPTY_BUFFER, arrayBuffer: await bufferToArrayBuffer(EMPTY_BUFFER) as ArrayBuffer };
}

function transformSatoriToTakumiFonts(satoriFonts: SatoriFont[]): Font[] {
  return satoriFonts
    .filter(font => font.name && font.data)
    .map(font => {
      let data: ArrayBuffer;
      if (font.data instanceof ArrayBuffer) {
        data = font.data;
      } else if (font.data instanceof Uint8Array) {
        data = font.data.buffer as ArrayBuffer;
      } else {
        throw new Error(`Font ${font.name} has unsupported data type`);
      }
      
      return {
        name: font.name,
        data,
        weight: font.weight,
        style: font.style
      };
    });
}

export async function renderWithTakumi({
  Component,
  formattedProps,
  dimensions,
  scaling,
  targetWidth,
  targetHeight,
  fonts: satoriFonts,
  quality,
  loadImageAsset,
  dataUriToBuffer,
  bufferToArrayBuffer,
  startPerf,
  endPerf,
}: {
  Component: React.ComponentType<any>;
  formattedProps: Record<string, any>;
  dimensions: { width: number; height: number };
  scaling: { image: number; debug?: boolean };
  targetWidth?: number;
  targetHeight?: number;
  fonts: SatoriFont[];
  quality?: number;
  loadImageAsset: (src: string) => Promise<string>;
  dataUriToBuffer: (dataUri: string) => Buffer | null;
  bufferToArrayBuffer: (buffer: Buffer) => Promise<ArrayBuffer>;
  startPerf?: (label: string) => void;
  endPerf?: (label: string) => void;
}) {
  startPerf?.(`[imageGenerator] takumi-generation`);
  try {
    // Transform SatoriFont format to Takumi Font format
    const takumiFonts = transformSatoriToTakumiFonts(satoriFonts);
    
    // Create the React element and process flag emojis
    const element = React.createElement(Component, formattedProps);
    const processedElement = processFlagEmojis(element, 16 * scaling.image);
    
    const response = new ImageResponse(
      processedElement,
      {
        width: dimensions.width * scaling.image,
        height: dimensions.height * scaling.image,
        format: "png",
        quality,
        emoji: "twemoji",
        devicePixelRatio: scaling.image,
        drawDebugBorder: scaling.debug,
        fonts: takumiFonts,
        dithering: "floyd-steinberg",
        persistentImages: getPersistentImagesSnapshot(),
        jsx: {
          defaultStyles: false,
        },
      }
    );
    const buffer = Buffer.from(await response.arrayBuffer());
    endPerf?.(`[imageGenerator] takumi-generation`);
    return buffer;
  } catch (error) {
    console.error("Takumi render failed, falling back to Satori:", error);
    endPerf?.(`[imageGenerator] takumi-generation`);
    return null;
  }
}
