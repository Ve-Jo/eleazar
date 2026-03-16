// @ts-nocheck
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";

export async function rasterizeSvgToPng({
  svg,
  targetWidth,
  targetHeight,
  dimensions,
  useResvg,
  quality,
  effort,
  startPerf,
  endPerf,
}) {
  if (!svg || typeof svg !== "string") {
    throw new Error("Invalid SVG provided");
  }

  if (useResvg) {
    startPerf?.(`[imageGenerator] reSVG-rasterization`);
    const resvgInst = new Resvg(svg, {
      fitTo: {
        mode: "width",
        value: targetWidth,
      },
      background: "transparent",
      shapeRendering: 2,
      imageRendering: 1,
    });
    const raster = resvgInst.render();
    const pngData = raster.asPng();
    endPerf?.(`[imageGenerator] reSVG-rasterization`);
    startPerf?.(`[imageGenerator] sharp-png-encode`);
    const buffer = await sharp(pngData)
      .png({
        quality,
        compressionLevel: 9,
      })
      .toBuffer();
    endPerf?.(`[imageGenerator] sharp-png-encode`);
    return buffer;
  }

  startPerf?.(`[imageGenerator] sharp-conversion`);
  const baseSharpPipeline = sharp(Buffer.from(svg), {
    density: Math.max(72, Math.min(300, targetWidth / (dimensions.width / 72))),
  }).resize(targetWidth, targetHeight);
  const buffer = await baseSharpPipeline
    .png({
      quality,
      compressionLevel: 9,
    })
    .toBuffer();
  endPerf?.(`[imageGenerator] sharp-conversion`);
  return buffer;
}
