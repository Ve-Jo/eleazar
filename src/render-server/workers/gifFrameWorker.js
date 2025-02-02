import sharp from "sharp";
import fs from "fs/promises";
import path from "path";

// Constants
const MAX_INPUT_PIXELS = 100 * 1024 * 1024; // 100MP limit

// Configure sharp
sharp.cache(false);
sharp.concurrency(1);
sharp.simd(true);

self.onmessage = async (event) => {
  const { data, startFrame, endFrame, frameSkip, width, height, cacheDir } =
    event.data;
  console.log(`🔧 Worker processing frames ${startFrame} to ${endFrame}`);

  try {
    let frames = [];
    for (let i = startFrame; i < endFrame; i += frameSkip) {
      const framePath = path.join(cacheDir, `frame-${i}.png`);

      try {
        // Check if frame already exists
        const existingFrame = await fs.readFile(framePath);
        console.log(`   ↪️ Using cached frame ${i}`);
        frames.push({ frameIndex: i, buffer: existingFrame });
        continue;
      } catch {
        // Frame doesn't exist, process it
        const frame = await sharp(data, {
          page: i,
          limitInputPixels: MAX_INPUT_PIXELS,
        })
          .resize(width, height, {
            fit: "cover",
            position: "center",
            fastShrinkOnLoad: true,
          })
          .png({ compressionLevel: 9 })
          .toBuffer();

        // Save frame to cache
        await fs.writeFile(framePath, frame);
        frames.push({ frameIndex: i, buffer: frame });
        console.log(`   ✓ Processed and saved frame ${i}`);
      }
    }

    self.postMessage({ frames });
  } catch (error) {
    console.error(
      `❌ Worker error processing frames ${startFrame}-${endFrame}:`,
      error
    );
    self.postMessage({ error: error.message });
  } finally {
    // Cleanup
    frames = null;
    if (global.gc) global.gc();
  }
};
