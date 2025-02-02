import { generateImage } from "../utils/render/imageGenerator.js";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";
import { createElement } from "react";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");

const COMPONENTS_DIR = path.join(__dirname, "components");
const MAX_REQUEST_SIZE = 10 * 1024 * 1024; // 10MB max request size
const MESSAGE_DELIMITER = "\n---MESSAGE_BOUNDARY---\n";
const CHUNK_SIZE = 512 * 1024; // 512KB chunks
const MIN_IDLE_TIMEOUT = 8000; // 10 seconds minimum idle timeout
const MAX_IDLE_TIMEOUT = 25000; // 25 seconds maximum idle timeout
const HIGH_LOAD_THRESHOLD = 5; // Number of requests that indicates high load

// Global state
let isReady = false;
let requestCount = 0;
let idleTimeout = null;
let buffer = "";
let currentRequestSize = 0;

// Cache for initialized resources
const resourceCache = {
  components: new Map(),
};

// Redirect all console.* to stderr
const originalConsole = { ...console };
for (const method of Object.keys(console)) {
  console[method] = (...args) => {
    process.stderr.write(`${args.join(" ")}\n`);
  };
}

function log(...args) {
  process.stderr.write(`[Worker] ${args.join(" ")}\n`);
}

// Helper function to safely send messages through stdout only
function sendMessage(message, isLargePayload = false) {
  try {
    // For message objects, send through stdout with delimiter
    const serialized = JSON.stringify(message);

    if (isLargePayload) {
      // For large payloads, send in chunks
      const chunks = Math.ceil(serialized.length / CHUNK_SIZE);
      const chunkInfoMessage = {
        type: "chunks",
        count: chunks,
        totalSize: serialized.length,
      };

      process.stdout.write(
        Buffer.from(
          JSON.stringify(chunkInfoMessage) + MESSAGE_DELIMITER,
          "utf8"
        )
      );

      // Send chunks
      for (let i = 0; i < chunks; i++) {
        const chunk = serialized.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        const chunkMessage = {
          type: "chunk",
          index: i,
          total: chunks,
          data: chunk,
        };
        process.stdout.write(
          Buffer.from(JSON.stringify(chunkMessage) + MESSAGE_DELIMITER, "utf8")
        );
      }
    } else {
      // For small messages, send directly
      process.stdout.write(Buffer.from(serialized + MESSAGE_DELIMITER, "utf8"));
    }
  } catch (error) {
    log("Error serializing message:", error);
    sendError(error);
  }
}

function sendError(error) {
  try {
    sendMessage({
      type: "error",
      error: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  } catch (err) {
    log("Failed to send error message:", err);
    process.exit(1);
  }
}

// Parse numeric values in an object
function parseNumericValues(obj) {
  if (!obj || typeof obj !== "object") return obj;

  const result = Array.isArray(obj) ? [] : {};

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "object" && value !== null) {
      // Recursively parse nested objects/arrays
      result[key] = parseNumericValues(value);
    } else if (typeof value === "string") {
      // Try to convert string to number if it looks like one
      if (/^-?\d+(\.\d+)?$/.test(value)) {
        const num = Number(value);
        if (!isNaN(num)) {
          result[key] = num;
          continue;
        }
      }
      result[key] = value;
    } else {
      result[key] = value;
    }
  }

  return result;
}

// Request validation
function validateRequest(request) {
  if (!request || typeof request !== "object") {
    throw new Error("Invalid request format");
  }

  if (request.type !== "generate") {
    throw new Error("Invalid request type");
  }

  if (typeof request.componentName !== "string") {
    throw new Error("Component name must be a string");
  }

  if (!request.props || typeof request.props !== "object") {
    throw new Error("Props must be an object");
  }

  if (!isReady) {
    throw new Error("Worker not ready");
  }
}

async function handleRequest(request) {
  try {
    validateRequest(request);

    const { componentName, props, config, scaling } = request;
    log("Processing component:", componentName);

    // Parse numeric values in props
    const parsedProps = parseNumericValues(props);

    // Find component in render-server components directory
    const componentPath = path.join(COMPONENTS_DIR, `${componentName}.jsx`);

    try {
      await fs.access(componentPath);
    } catch {
      throw new Error(`Component not found: ${componentName}`);
    }

    // Check cache or load component
    let Component;
    if (resourceCache.components.has(componentName)) {
      Component = resourceCache.components.get(componentName);
      log(`Using cached component: ${componentName}`);
    } else {
      const imported = await import(`file://${componentPath}?t=${Date.now()}`);
      Component = imported.default;
      if (!Component) {
        throw new Error(`Component ${componentName} has no default export`);
      }
      resourceCache.components.set(componentName, Component);
      log(`Cached new component: ${componentName}`);
    }

    // Generate image with parsed props
    let rawBuffer = await generateImage(
      Component,
      parsedProps,
      config || {},
      scaling || { image: 2, emoji: 1 }
    );

    if (!rawBuffer || !Buffer.isBuffer(rawBuffer)) {
      throw new Error("Generated image is invalid");
    }

    // Detect image type
    const isGif =
      rawBuffer[0] === 0x47 && rawBuffer[1] === 0x49 && rawBuffer[2] === 0x46;

    // Ensure proper base64 encoding
    const base64Data = rawBuffer.toString("base64");
    rawBuffer = null; // Clear buffer reference

    // Prepare result with properly encoded data
    const result = {
      type: "result",
      contentType: isGif ? "image/gif" : "image/png",
      data: base64Data,
    };

    // Force Bun garbage collection
    if (typeof Bun !== "undefined") {
      Bun.gc(true);
    }

    // Send large result in chunks
    sendMessage(result, true);
  } catch (error) {
    log("Error processing request:", error);
    throw error;
  }
}

// Handle process cleanup and termination
function cleanup() {
  if (idleTimeout) {
    clearTimeout(idleTimeout);
  }
  buffer = "";
  currentRequestSize = 0;
  process.exit(0);
}

// Calculate current idle timeout based on total request count
function calculateIdleTimeout() {
  if (requestCount >= HIGH_LOAD_THRESHOLD) {
    return MAX_IDLE_TIMEOUT;
  }

  // Linear scaling between min and max timeout based on request count
  const scale = Math.min(requestCount / HIGH_LOAD_THRESHOLD, 1);
  return MIN_IDLE_TIMEOUT + (MAX_IDLE_TIMEOUT - MIN_IDLE_TIMEOUT) * scale;
}

// Update idle timer
function updateIdleTimer() {
  if (idleTimeout) {
    clearTimeout(idleTimeout);
  }
  const timeout = calculateIdleTimeout();
  idleTimeout = setTimeout(() => {
    log(`No requests for ${timeout / 1000} seconds, shutting down worker`);
    cleanup();
  }, timeout);
}

// Start the worker
(async function main() {
  try {
    log("Starting worker...");
    updateIdleTimer();

    // Handle input with size limit
    process.stdin.setEncoding("utf8");

    // Ensure stderr is flushed before sending ready message
    await new Promise((resolve) => process.stderr.write("", resolve));

    // Send ready message
    sendMessage({ type: "ready" });
    isReady = true;

    process.stdin.on("data", async (chunk) => {
      try {
        currentRequestSize += chunk.length;
        if (currentRequestSize > MAX_REQUEST_SIZE) {
          throw new Error("Request too large");
        }

        buffer += chunk;

        const messages = buffer.split(MESSAGE_DELIMITER);
        buffer = messages.pop() || ""; // Keep the last incomplete message
        currentRequestSize = buffer.length;

        for (const message of messages) {
          if (!message.trim()) continue;

          try {
            const request = JSON.parse(message);
            requestCount++;
            updateIdleTimer();
            await handleRequest(request);
          } catch (error) {
            sendError(error);
          }
        }
      } catch (error) {
        sendError(error);
        buffer = "";
        currentRequestSize = 0;
      }
    });

    // Handle process termination
    process.on("SIGTERM", cleanup);
    process.on("SIGINT", cleanup);
  } catch (error) {
    log("Fatal error:", error);
    process.exit(1);
  }
})();
