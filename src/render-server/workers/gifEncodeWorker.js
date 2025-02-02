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
  const { frames, width, height, startIndex, endIndex, options, cacheDir } =
    event.data;
  console.log(
    `🎨 Encoder worker processing frames ${startIndex} to ${endIndex}`
  );

  try {
    const processedFrames = [];
    const encodedFramesDir = path.join(cacheDir, "encoded");
    await fs.mkdir(encodedFramesDir, { recursive: true });

    // Prepare overlay exactly as in createGifDirect
    let overlayBuffer = null;
    if (options.overlayBuffer) {
      overlayBuffer = await sharp(options.overlayBuffer, {
        limitInputPixels: MAX_INPUT_PIXELS,
      })
        .resize(width, height, {
          fit: "contain",
          position: "center",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
          fastShrinkOnLoad: true,
        })
        .png({ compressionLevel: 9 })
        .toBuffer();
      console.log("✅ Worker prepared overlay buffer");
    }

    const validFrames = frames.filter((frame) => frame && frame.buffer);
    console.log(
      `🧹 Worker found ${validFrames.length} valid frames to process`
    );

    for (let i = 0; i < validFrames.length; i++) {
      const frame = validFrames[i];
      try {
        if (!frame || !frame.buffer) {
          console.warn(`⚠️ Skipping invalid frame at position ${i}`);
          continue;
        }

        // Process frame exactly as in createGifDirect
        let processedFrame = await sharp(frame.buffer, {
          limitInputPixels: MAX_INPUT_PIXELS,
        })
          .resize(width, height, {
            fit: "cover",
            position: "center",
            fastShrinkOnLoad: true,
          })
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });

        // Convert back to regular image buffer
        let finalFrame = sharp(processedFrame.data, {
          raw: {
            width,
            height,
            channels: 4,
          },
          limitInputPixels: MAX_INPUT_PIXELS,
        });

        // If overlay exists, composite it
        if (overlayBuffer) {
          finalFrame = finalFrame.composite([
            {
              input: overlayBuffer,
              blend: "over",
              opacity: options.overlayAlpha || 0.85,
            },
          ]);
        }

        // Get final buffer
        const frameBuffer = await finalFrame
          .png({ compressionLevel: 9 })
          .toBuffer();

        // Save to cache
        const encodedFramePath = path.join(
          encodedFramesDir,
          `encoded-${startIndex + i}.png`
        );
        await fs.writeFile(encodedFramePath, frameBuffer);

        processedFrames.push({
          buffer: frameBuffer,
          delay: frame.delay || 40,
        });

        console.log(`   ✓ Encoded frame ${i + 1}`);

        // Clear processed frame data
        processedFrame = null;
        finalFrame = null;
        if (global.gc) global.gc();
      } catch (error) {
        console.error(`❌ Error encoding frame ${i + 1}:`, error);
      }
    }

    // Clear overlay buffer
    overlayBuffer = null;
    if (global.gc) global.gc();

    self.postMessage({
      frames: processedFrames,
      startIndex,
      endIndex,
    });
  } catch (error) {
    console.error(
      `❌ Worker error encoding frames ${startIndex}-${endIndex}:`,
      error
    );
    self.postMessage({ error: error.message });
  }
};
