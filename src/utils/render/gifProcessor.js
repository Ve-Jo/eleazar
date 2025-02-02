import sharp from "sharp";
import axios from "axios";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import GIFEncoder from "gifencoder";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const GIF_TEMP_DIR = path.join(process.cwd(), "temp", "gif-frames");
const CPU_CORES = process.env.CPU_ONE_CORE
  ? 1
  : Math.min(
      typeof navigator !== "undefined"
        ? navigator.hardwareConcurrency
        : process.env.CPU_CORES || 2,
      4
    );

// Configure sharp globally
sharp.cache(false);
sharp.concurrency(1);
sharp.simd(true);
// sharp.limitInputPixels(true); // Removed as it's not supported in newer versions

// Constants for GIF processing
const MAX_GIF_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FRAMES = 50;
const MAX_DIMENSION = 1200;
const QUALITY = 60;
const MAX_INPUT_PIXELS = 100 * 1024 * 1024; // 100MP limit

console.log(
  `🔧 Using ${CPU_CORES} CPU core${CPU_CORES > 1 ? "s" : ""} for processing`
);

// Ensure GIF temp directory exists
async function ensureGifTempDir() {
  try {
    await fs.access(GIF_TEMP_DIR);
  } catch {
    await fs.mkdir(GIF_TEMP_DIR, { recursive: true });
  }
}

// Clean memory helper
const cleanupMemory = () => {
  if (typeof Bun !== "undefined") {
    Bun.gc(true);
  } else if (global.gc) {
    global.gc();
  }
  sharp.cache(false);
};

export async function getGifMetadata(url) {
  try {
    const { data } = await axios.get(url, {
      responseType: "arraybuffer",
      maxContentLength: MAX_GIF_SIZE,
      timeout: 5000,
    });
    const metadata = await sharp(data, {
      limitInputPixels: MAX_INPUT_PIXELS,
    }).metadata();
    return { metadata, buffer: data };
  } catch (error) {
    console.error("Error fetching GIF metadata:", error);
    throw error;
  }
}

export async function extractGifFrames(gifData) {
  let data = null;
  let frames = [];

  try {
    console.log("\n=== Starting GIF Processing ===");

    if (Buffer.isBuffer(gifData)) {
      data = gifData;
      if (data.length > MAX_GIF_SIZE) {
        throw new Error("GIF size exceeds maximum allowed size");
      }
    } else if (typeof gifData === "string") {
      const cleanUrl = gifData.split("?")[0];
      const encodedUrl = encodeURI(cleanUrl);

      const response = await axios.get(encodedUrl, {
        responseType: "arraybuffer",
        maxContentLength: MAX_GIF_SIZE,
        timeout: 5000,
      });
      data = response.data;
    } else {
      throw new Error("Invalid GIF data provided");
    }

    const metadata = await sharp(data, { limitInputPixels: true }).metadata();

    // Validate GIF dimensions
    if (metadata.width > MAX_DIMENSION || metadata.height > MAX_DIMENSION) {
      throw new Error("GIF dimensions exceed maximum allowed size");
    }

    const frameSkip =
      metadata.pages > MAX_FRAMES ? Math.ceil(metadata.pages / MAX_FRAMES) : 1;
    const framesToProcess = Math.ceil(metadata.pages / frameSkip);
    const delays = metadata.delay || [];

    // Create unique cache directory
    const dataHash = crypto.createHash("md5").update(data).digest("hex");
    const cacheDir = path.join(GIF_TEMP_DIR, dataHash);
    await fs.mkdir(cacheDir, { recursive: true });

    // Process frames in batches
    const BATCH_SIZE = 10;
    for (let i = 0; i < framesToProcess; i += BATCH_SIZE) {
      const batchPromises = [];
      const batchEnd = Math.min(i + BATCH_SIZE, framesToProcess);

      for (let j = i; j < batchEnd; j++) {
        const frameIndex = j * frameSkip;
        batchPromises.push(
          processFrame(data, frameIndex, metadata, frameSkip, delays, cacheDir)
        );
      }

      const batchFrames = await Promise.all(batchPromises);
      frames.push(...batchFrames.filter(Boolean));

      // Clear batch data
      cleanupMemory();
    }

    // Save metadata for cache
    const cacheMetadata = {
      frameCount: frames.length,
      frameDelays: frames.map((f) => f.delay),
      width: metadata.width,
      height: metadata.height,
      frameSkip,
      timestamp: Date.now(),
    };
    await fs.writeFile(
      path.join(cacheDir, "metadata.json"),
      JSON.stringify(cacheMetadata)
    );

    return frames;
  } catch (error) {
    console.error("Error extracting GIF frames:", error);
    throw error;
  } finally {
    data = null;
    cleanupMemory();
  }
}

async function processFrame(
  data,
  frameIndex,
  metadata,
  frameSkip,
  delays,
  cacheDir
) {
  try {
    const framePath = path.join(cacheDir, `frame-${frameIndex}.png`);

    // Try to load from cache first
    try {
      const cachedFrame = await fs.readFile(framePath);
      return {
        buffer: cachedFrame,
        delay: calculateDelay(frameIndex, frameSkip, delays),
        width: metadata.width,
        height: metadata.height,
      };
    } catch {
      // Process frame if not in cache
      const frame = await sharp(data, {
        page: frameIndex,
        limitInputPixels: true,
        sequentialRead: true,
      })
        .resize(metadata.width, metadata.height, {
          fit: "cover",
          position: "center",
          fastShrinkOnLoad: true,
        })
        .png({ compressionLevel: 9 })
        .toBuffer();

      await fs.writeFile(framePath, frame);

      return {
        buffer: frame,
        delay: calculateDelay(frameIndex, frameSkip, delays),
        width: metadata.width,
        height: metadata.height,
      };
    }
  } catch (error) {
    console.error(`Error processing frame ${frameIndex}:`, error);
    return null;
  }
}

function calculateDelay(frameIndex, frameSkip, delays) {
  let totalDelay = 0;
  for (let i = 0; i < frameSkip; i++) {
    const delayIndex = frameIndex + i;
    if (delayIndex < delays.length) {
      totalDelay += delays[delayIndex] || 40;
    }
  }
  return totalDelay;
}

export async function createGif(frames, width, height, options = {}) {
  console.log("\n=== Starting GIF Encoding ===");

  try {
    const encoder = new GIFEncoder(width, height);
    encoder.start();
    encoder.setRepeat(0);
    encoder.setQuality(QUALITY);
    encoder.setDispose(2);

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d", { alpha: true });

    // Process overlay if provided
    let overlayBuffer = null;
    if (options.overlayBuffer) {
      overlayBuffer = await sharp(options.overlayBuffer, {
        limitInputPixels: true,
      })
        .resize(width, height, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png({ compressionLevel: 9 })
        .toBuffer();
    }

    // Process frames in batches
    const BATCH_SIZE = 10;
    for (let i = 0; i < frames.length; i += BATCH_SIZE) {
      const batchEnd = Math.min(i + BATCH_SIZE, frames.length);

      for (let j = i; j < batchEnd; j++) {
        const frame = frames[j];
        if (!frame?.buffer) continue;

        try {
          // Process frame
          let processedFrame = sharp(frame.buffer, {
            limitInputPixels: true,
          }).resize(width, height, {
            fit: "cover",
            position: "center",
            fastShrinkOnLoad: true,
          });

          // Composite with overlay if present
          if (overlayBuffer) {
            processedFrame = processedFrame.composite([
              {
                input: overlayBuffer,
                blend: "over",
                opacity: options.overlayAlpha || 0.85,
              },
            ]);
          }

          // Get raw pixels
          const { data } = await processedFrame
            .raw()
            .toBuffer({ resolveWithObject: true });

          // Add to GIF
          ctx.clearRect(0, 0, width, height);
          const imageData = ctx.createImageData(width, height);
          imageData.data.set(new Uint8Array(data.buffer));
          ctx.putImageData(imageData, 0, 0);

          encoder.setDelay(frame.delay);
          encoder.addFrame(ctx);

          // Clear frame data
          processedFrame = null;
        } catch (error) {
          console.error(`Error processing frame ${j}:`, error);
        }
      }

      // Clear batch data
      cleanupMemory();
    }

    encoder.finish();
    const finalBuffer = encoder.out.getData();

    // Cleanup
    overlayBuffer = null;
    encoder.out.data = null;
    encoder.out = null;
    cleanupMemory();

    return finalBuffer;
  } catch (error) {
    console.error("Error creating GIF:", error);
    throw error;
  }
}

// Initialize temp directory
ensureGifTempDir().catch(console.error);
