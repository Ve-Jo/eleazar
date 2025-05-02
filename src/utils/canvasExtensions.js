import { join } from "path";
import fs from "fs";
import axios from "axios";
import { Image, Path2D } from "@napi-rs/canvas";
import { Resvg } from "@resvg/resvg-js";
import { parse } from "twemoji-parser";
import twemoji from "twemoji";

// Cache for emojis
const emojiCache = new Map();

async function loadLocalImage(imagePath, imageName) {
  return new Promise(async (resolve, reject) => {
    const cachedImagePath = join(imagePath, imageName);

    try {
      // Check if the emoji exists in cache
      if (fs.existsSync(cachedImagePath)) {
        try {
          const data = fs.readFileSync(cachedImagePath);
          const img = new Image();

          // Wait for the image to load before returning
          return new Promise((imgResolve) => {
            img.onload = () => {
              console.log(
                `Image loaded: ${imageName}, width: ${img.width}, height: ${img.height}`
              );
              imgResolve(img);
            };

            img.onerror = (err) => {
              console.error(`Failed to load image: ${imageName}`, err);
              createFallbackImage(imageName, resolve);
            };

            // Set src after attaching handlers
            img.src = data;
          })
            .then((loadedImg) => resolve(loadedImg))
            .catch((err) => {
              console.error(`Image loading promise error: ${err.message}`);
              createFallbackImage(imageName, resolve);
            });
        } catch (error) {
          console.error(`Error with emoji ${imageName}:`, error);
          createFallbackImage(imageName, resolve);
        }
      } else {
        try {
          // Try to save the emoji
          await save_emojis(imageName.replace(".png", ""));

          // Check if file was created successfully
          if (fs.existsSync(cachedImagePath)) {
            const img = new Image();
            img.src = fs.readFileSync(cachedImagePath);
            resolve(img);
          } else {
            createFallbackImage(imageName, resolve);
          }
        } catch (error) {
          console.error(`Error saving emoji ${imageName}:`, error);
          createFallbackImage(imageName, resolve);
        }
      }
    } catch (error) {
      console.error(`Unexpected error with emoji ${imageName}:`, error);
      createFallbackImage(imageName, resolve);
    }
  });
}

// Helper function to create a fallback image for missing emojis
function createFallbackImage(emojiName, resolve) {
  console.log(`Creating fallback image for emoji: ${emojiName}`);

  // Create a blank canvas to use as fallback
  const { createCanvas } = require("@napi-rs/canvas");
  const canvas = createCanvas(64, 64);
  const ctx = canvas.getContext("2d");

  // Fill with light gray background
  ctx.fillStyle = "#E0E0E0";
  ctx.fillRect(0, 0, 64, 64);

  // Add some text
  ctx.fillStyle = "#000000";
  ctx.font = "16px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Show abbreviated emoji name
  const emojiCode = emojiName.replace(".png", "");
  ctx.fillText(
    emojiCode.length > 5 ? `${emojiCode.substring(0, 5)}..` : emojiCode,
    32,
    32
  );

  // Convert to Image object
  const img = new Image();
  img.src = canvas.toBuffer("image/png");
  resolve(img);
}

async function save_emojis(emoji) {
  const imagesDirectory = join(process.cwd(), "emojis");
  console.log(`Saving emoji to directory: ${imagesDirectory}`);

  if (!fs.existsSync(imagesDirectory)) {
    fs.mkdirSync(imagesDirectory, { recursive: true });
  }

  try {
    const emojiData = parse(emoji);
    if (!emojiData || emojiData.length === 0) {
      console.warn(`No emoji data found for: ${emoji}`);
      return; // Skip if no emoji data found
    }

    for (const emojiInfo of emojiData) {
      console.log(`Processing emoji: ${emojiInfo.text}`);
      const emojiFileName = `${emojiInfo.text}.png`;
      const emojiFilePath = join(imagesDirectory, emojiFileName);

      // Check if emoji already exists
      if (fs.existsSync(emojiFilePath)) {
        console.log(`Emoji ${emojiInfo.text} already exists`);
        continue;
      }

      try {
        // Use CDN links from cdnjs (more reliable)
        console.log("EMOJI INFO");
        console.log(emojiInfo);
        const emojiCode = twemoji.convert
          .toCodePoint(emojiInfo.text)
          .replace(/-fe0f$/i, "");
        if (!emojiCode) {
          console.warn(
            `Could not convert emoji to code point: ${emojiInfo.text}`
          );
          continue;
        }

        let svgUrl = `https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/${emojiCode}.svg`;
        let response = await axios
          .get(svgUrl, {
            responseType: "text",
            timeout: 5000,
          })
          .catch(async (e) => {
            // Try without variation selector if first attempt fails
            if (emojiCode.includes("-")) {
              const baseCode = emojiCode.split("-")[0];
              svgUrl = `https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/${baseCode}.svg`;
              return await axios
                .get(svgUrl, {
                  responseType: "text",
                  timeout: 5000,
                })
                .catch((e) => {
                  console.error(`Network error fetching emoji: ${e.message}`);
                  return { data: null };
                });
            }
            console.error(`Network error fetching emoji: ${e.message}`);
            return { data: null };
          });

        if (!response || !response.data) {
          console.error(`Failed to fetch emoji ${emojiInfo.text}`);
          continue;
        }

        const svgBuffer = response.data;
        const scaledSize = 512;

        // Scale the SVG properly
        let scaledSvg = svgBuffer;
        scaledSvg = scaledSvg.replace(
          /width="([^"]+)"/,
          `width="${scaledSize}"`
        );
        scaledSvg = scaledSvg.replace(
          /height="([^"]+)"/,
          `height="${scaledSize}"`
        );

        // Add viewBox if it doesn't exist
        if (!scaledSvg.includes("viewBox")) {
          scaledSvg = scaledSvg.replace(
            "<svg",
            `<svg viewBox="0 0 ${scaledSize} ${scaledSize}"`
          );
        }

        // Use try-catch for the Resvg conversion
        try {
          const resvg = new Resvg(scaledSvg, {
            fitTo: { mode: "width", value: scaledSize },
          });
          const pngData = resvg.render();
          const pngBuffer = pngData.asPng();

          fs.writeFileSync(emojiFilePath, pngBuffer);

          // Free resources
          pngData.free?.();
          resvg.free?.();

          console.log(`Successfully saved emoji: ${emojiInfo.text}`);
        } catch (resvgError) {
          console.error(
            `Error converting SVG to PNG for emoji ${emojiInfo.text}:`,
            resvgError
          );
        }
      } catch (error) {
        console.error(`Error saving emoji ${emojiInfo.text}:`, error);
      }
    }
  } catch (error) {
    console.error("Error fetching or caching emoji images:", error);
  }
}

export default function extendCanvas(ctx) {
  ctx.drawTextWithinWidth = function (text, x, y, maxWidth, spacing) {
    let ready = [];
    let words = text.split(" ");
    for (let i = 0; i < words.length; i++) {
      if (this.measureText(words.slice(0, i).join("")).width >= maxWidth) {
        ready.push(words.slice(0, i));
        words = words.slice(i);
        i = 0;
      }
    }
    ready.push(words);
    for (let i = 0; i < ready.length; i++) {
      this.fillText(ready[i].join(" "), x, y + i * spacing);
    }
  };

  ctx.drawRoundedRectangle = function (
    x,
    y,
    width,
    height,
    cornerRadius,
    color,
    backgroundImage
  ) {
    this.beginPath();
    this.moveTo(x + cornerRadius, y);
    this.lineTo(x + width - cornerRadius, y);
    this.arcTo(x + width, y, x + width, y + cornerRadius, cornerRadius);
    this.lineTo(x + width, y + height - cornerRadius);
    this.arcTo(
      x + width,
      y + height,
      x + width - cornerRadius,
      y + height,
      cornerRadius
    );
    this.lineTo(x + cornerRadius, y + height);
    this.arcTo(x, y + height, x, y + height - cornerRadius, cornerRadius);
    this.lineTo(x, y + cornerRadius);
    this.arcTo(x, y, x + cornerRadius, y, cornerRadius);
    this.closePath();

    this.save();
    this.clip();

    if (backgroundImage) {
      const imageAspectRatio = backgroundImage.width / backgroundImage.height;
      let scaledWidth = width;
      let scaledHeight = width / imageAspectRatio;
      if (scaledHeight < height) {
        scaledHeight = height;
        scaledWidth = height * imageAspectRatio;
      }
      const imageX = x + (width - scaledWidth) / 2;
      const imageY = y + (height - scaledHeight) / 2;
      this.drawImage(
        backgroundImage,
        imageX,
        imageY,
        scaledWidth,
        scaledHeight
      );
    } else if (color) {
      this.fillStyle = color;
      this.fill();
    } else {
      this.stroke();
    }

    // Restore the canvas state to remove the clipping path
    this.restore();
  };

  ctx.drawRoundAvatar = function (
    avatarImage,
    avatarX,
    avatarY,
    avatarSize,
    roundness,
    shadows
  ) {
    this.save();

    if (shadows) {
      this.shadowColor = "rgba(0, 0, 0, 0.8)";
      this.shadowBlur = 125;
      this.shadowOffsetX = 0;
      this.shadowOffsetY = 0;
    }

    const clipPath = new Path2D();
    const cornerRadius = avatarSize * roundness;
    clipPath.moveTo(avatarX + cornerRadius, avatarY);
    clipPath.arcTo(
      avatarX + avatarSize,
      avatarY,
      avatarX + avatarSize,
      avatarY + avatarSize,
      cornerRadius
    );
    clipPath.arcTo(
      avatarX + avatarSize,
      avatarY + avatarSize,
      avatarX,
      avatarY + avatarSize,
      cornerRadius
    );
    clipPath.arcTo(
      avatarX,
      avatarY + avatarSize,
      avatarX,
      avatarY,
      cornerRadius
    );
    clipPath.arcTo(
      avatarX,
      avatarY,
      avatarX + avatarSize,
      avatarY,
      cornerRadius
    );
    this.clip(clipPath);
    this.drawImage(avatarImage, avatarX, avatarY, avatarSize, avatarSize);

    if (shadows) {
      this.shadowColor = "transparent";
      this.shadowBlur = 0;
      this.shadowOffsetX = 0;
      this.shadowOffsetY = 0;
    }

    this.restore();
  };

  ctx.drawEmoji = async function (emoji, x, y, wx, wy) {
    try {
      console.log("GETTING THE PATH OF EMOJI");
      console.log(join(process.cwd(), "emojis"), `${emoji}.png`);
      const emojiImg = await loadLocalImage(
        join(process.cwd(), "emojis"),
        `${emoji}.png`
      );
      console.log("Image width:", emojiImg.width, "height:", emojiImg.height);

      if (!emojiImg || !emojiImg.width || !emojiImg.height) {
        throw new Error("Invalid image object returned from loadLocalImage");
      }

      this.drawImage(emojiImg, x, y, wx, wy);
    } catch (error) {
      console.error(`Error drawing emoji ${emoji}:`, error);
      // Draw a fallback
      this.fillStyle = "#FF0000";
      this.fillRect(x, y, wx, wy);
    }
  };

  return ctx;
}
