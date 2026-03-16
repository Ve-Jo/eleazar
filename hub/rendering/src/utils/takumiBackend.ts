// @ts-nocheck
import React from "react";
import { ImageResponse } from "@takumi-rs/image-response";

export async function renderWithTakumi({
  Component,
  formattedProps,
  dimensions,
  scaling,
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
        width: dimensions.width,
        height: dimensions.height,
        format: "webp",
        quality,
        emoji: "twemoji",
        devicePixelRatio: scaling.image,
        drawDebugBorder: scaling.debug,
        fonts,
        jsx: {
          defaultStyles: false,
        },
        fetch: async (src) => {
          let buffer = Buffer.alloc(0);
          const resolvedSrc =
            typeof src === "string"
              ? src
              : typeof src?.href === "string"
              ? src.href
              : typeof src?.toString === "function"
              ? src.toString()
              : "";
          if (resolvedSrc) {
            if (resolvedSrc.startsWith("data:")) {
              buffer = dataUriToBuffer(resolvedSrc) ?? Buffer.alloc(0);
            } else {
              const resolvedDataUri = await loadImageAsset(resolvedSrc);
              buffer = dataUriToBuffer(resolvedDataUri) ?? Buffer.alloc(0);
            }
          }
          return {
            arrayBuffer: async () => bufferToArrayBuffer(buffer),
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
