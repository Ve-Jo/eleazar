// @ts-nocheck
import React from "react";
import { ImageResponse } from "@takumi-rs/image-response";

const EMPTY_BUFFER = Buffer.alloc(0);
const takumiAssetBufferCache = new Map();
const TAKUMI_ASSET_BUFFER_CACHE_MAX_SIZE =
  parseInt(process.env.TAKUMI_ASSET_BUFFER_CACHE_MAX_SIZE, 10) || 256;
const TAKUMI_ASSET_BUFFER_TTL_MS =
  parseInt(process.env.TAKUMI_ASSET_BUFFER_TTL_MS, 10) || 10 * 60 * 1000;
const TAKUMI_PERSISTENT_IMAGES_MAX_SIZE =
  parseInt(process.env.TAKUMI_PERSISTENT_IMAGES_MAX_SIZE, 10) || 128;

function getCachedTakumiAssetBuffer(key) {
  const entry = takumiAssetBufferCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > TAKUMI_ASSET_BUFFER_TTL_MS) {
    takumiAssetBufferCache.delete(key);
    return null;
  }
  return entry;
}

function setCachedTakumiAssetBuffer(key, asset) {
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

function resolveSourceKey(src) {
  return typeof src === "string"
    ? src
    : typeof src?.href === "string"
    ? src.href
    : typeof src?.toString === "function"
    ? src.toString()
    : "";
}

async function resolveSourceAsset(
  src,
  loadImageAsset,
  dataUriToBuffer,
  bufferToArrayBuffer
) {
  if (!src) {
    return {
      buffer: EMPTY_BUFFER,
      arrayBuffer: await bufferToArrayBuffer(EMPTY_BUFFER),
    };
  }

  const cached = getCachedTakumiAssetBuffer(src);
  if (cached) return cached;

  let buffer = EMPTY_BUFFER;
  if (src.startsWith("data:")) {
    buffer = dataUriToBuffer(src) ?? EMPTY_BUFFER;
  } else {
    const resolvedDataUri = await loadImageAsset(src);
    buffer = dataUriToBuffer(resolvedDataUri) ?? EMPTY_BUFFER;
  }

  if (buffer.length > 0) {
    const arrayBuffer = await bufferToArrayBuffer(buffer);
    const asset = { buffer, arrayBuffer };
    setCachedTakumiAssetBuffer(src, asset);
    return asset;
  }
  return { buffer: EMPTY_BUFFER, arrayBuffer: await bufferToArrayBuffer(EMPTY_BUFFER) };
}

export async function renderWithTakumi({
  Component,
  formattedProps,
  dimensions,
  scaling,
  targetWidth,
  targetHeight,
  fonts,
  quality,
  loadImageAsset,
  dataUriToBuffer,
  bufferToArrayBuffer,
  startPerf,
  endPerf,
}) {
  startPerf?.(`[imageGenerator] takumi-generation`);
  try {
    const response = new ImageResponse(
      React.createElement(Component, formattedProps),
      {
        width: dimensions.width * scaling.image,
        height: dimensions.height * scaling.image,
        format: "webp",
        quality,
        emoji: "twemoji",
        devicePixelRatio: scaling.image,
        drawDebugBorder: scaling.debug,
        fonts,
        dithering: "floyd-steinberg",
        persistentImages: getPersistentImagesSnapshot(),
        jsx: {
          defaultStyles: false,
        },
        fetch: async (src) => {
          const resolvedSrc = resolveSourceKey(src);
          const asset = await resolveSourceAsset(
            resolvedSrc,
            loadImageAsset,
            dataUriToBuffer,
            bufferToArrayBuffer
          );
          return {
            arrayBuffer: async () => asset.arrayBuffer,
          };
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
