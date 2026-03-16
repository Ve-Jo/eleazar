// @ts-nocheck
import satori from "satori";
import React from "react";

export async function renderWithSatori({
  Component,
  formattedProps,
  dimensions,
  scaling,
  fonts,
  componentName,
  fetchEmojiSvg,
  loadImageAsset,
  startPerf,
  endPerf,
}) {
  startPerf?.(`[imageGenerator] svg-generation`);
  try {
    const svg = await satori(React.createElement(Component, formattedProps), {
      width: dimensions.width,
      height: dimensions.height,
      fonts,
      debug: scaling.debug,
      loadAdditionalAsset: async (code, segment) => {
        if (code === "emoji") {
          return await fetchEmojiSvg(segment, scaling.emoji);
        }
        if (code === "image") {
          return await loadImageAsset(segment);
        }
        return null;
      },
    });
    endPerf?.(`[imageGenerator] svg-generation`);
    return svg;
  } catch (error) {
    console.error("Satori SVG generation failed:", error);
    if (error.message?.includes("Image size cannot be determined")) {
      console.warn("Image size error, attempting fallback dimensions");
      try {
        const svg = await satori(React.createElement(Component, formattedProps), {
          width: 800,
          height: 400,
          fonts,
          debug: scaling.debug,
          loadAdditionalAsset: async (code, segment) => {
            if (code === "emoji") {
              return await fetchEmojiSvg(segment, scaling.emoji);
            }
            if (code === "image") {
              return await loadImageAsset(segment);
            }
            return null;
          },
        });
        endPerf?.(`[imageGenerator] svg-generation`);
        return svg;
      } catch (fallbackError) {
        console.error("Satori fallback render also failed:", fallbackError);
        endPerf?.(`[imageGenerator] svg-generation`);
        throw fallbackError;
      }
    }
    endPerf?.(`[imageGenerator] svg-generation`);
    throw error;
  }
}
