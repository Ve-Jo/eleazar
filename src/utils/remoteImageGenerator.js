import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");

const WORKER_PATH = path.join(__dirname, "..", "render-server", "worker.js");
const WORKER_START_TIMEOUT = 10000;
const WORKER_IDLE_TIMEOUT = 60000; // Kill worker after 1 minute of inactivity
const MESSAGE_DELIMITER = "\n---MESSAGE_BOUNDARY---\n";
const READY_MESSAGE = '{"type":"ready"}';

// Worker pool management
const workerPool = {
  process: null,
  lastUseTime: 0,
  idleTimer: null,
};

function log(...args) {
  console.error("[Generator]", ...args);
}

function cleanup() {
  if (workerPool.process) {
    workerPool.process.kill();
    workerPool.process = null;
  }
  if (workerPool.idleTimer) {
    clearTimeout(workerPool.idleTimer);
    workerPool.idleTimer = null;
  }
}

class ChunkAssembler {
  constructor() {
    this.reset();
  }

  reset() {
    this.expectedChunks = 0;
    this.expectedSize = 0;
    this.receivedChunks = new Map();
    this.assembling = false;
  }

  handleMessage(parsed) {
    if (parsed.type === "chunks") {
      this.expectedChunks = parsed.count;
      this.expectedSize = parsed.totalSize;
      this.assembling = true;
      return null;
    }

    if (parsed.type === "chunk" && this.assembling) {
      this.receivedChunks.set(parsed.index, parsed.data);

      if (this.receivedChunks.size === this.expectedChunks) {
        // All chunks received, reconstruct the message
        const orderedChunks = Array.from({ length: this.expectedChunks })
          .map((_, i) => this.receivedChunks.get(i))
          .join("");

        if (orderedChunks.length !== this.expectedSize) {
          throw new Error(
            `Chunk assembly failed: size mismatch (expected ${this.expectedSize}, got ${orderedChunks.length})`
          );
        }

        const result = JSON.parse(orderedChunks);
        this.reset();
        return result;
      }
      return null;
    }

    return parsed;
  }

  isAssembling() {
    return this.assembling;
  }
}

async function spawnWorker() {
  cleanup();

  log("Starting new render worker process...");

  try {
    workerPool.process = spawn("bun", ["run", WORKER_PATH], {
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        ELEAZAR_PROJECT_ROOT: PROJECT_ROOT,
        NODE_ENV: process.env.NODE_ENV || "production",
      },
      cwd: PROJECT_ROOT,
    });

    // Set up error handling
    workerPool.process.on("error", (error) => {
      log("Worker process error:", error);
      cleanup();
    });

    workerPool.process.on("exit", (code, signal) => {
      log(`Worker process exited (code: ${code}, signal: ${signal})`);
      cleanup();
    });

    // Set up logging
    workerPool.process.stderr.on("data", (data) => {
      const messages = data.toString().split("\n");
      for (const message of messages) {
        if (message.trim()) console.error(message);
      }
    });

    // Wait for ready message
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error("Worker failed to start (timeout)"));
      }, WORKER_START_TIMEOUT);

      let buffer = "";
      let readyReceived = false;

      const messageHandler = (data) => {
        if (readyReceived) return;

        try {
          buffer += data.toString("utf8");

          // Look for exact ready message sequence
          if (buffer.includes(READY_MESSAGE + MESSAGE_DELIMITER)) {
            clearTimeout(timeout);
            readyReceived = true;
            resolve();
            return;
          }

          // Check for messages
          const messages = buffer.split(MESSAGE_DELIMITER);
          buffer = messages.pop() || "";

          for (const message of messages) {
            if (!message.trim()) continue;

            try {
              const parsed = JSON.parse(message);
              if (parsed.type === "ready") {
                clearTimeout(timeout);
                readyReceived = true;
                resolve();
                return;
              }
            } catch (err) {
              // Ignore JSON parse errors during startup
            }
          }
        } catch (err) {
          // Ignore general errors during startup
        }
      };

      workerPool.process.stdout.on("data", messageHandler);

      // Handle worker exit during startup
      const exitHandler = (code, signal) => {
        clearTimeout(timeout);
        if (!readyReceived) {
          reject(
            new Error(
              `Worker exited during startup (code: ${code}, signal: ${signal})`
            )
          );
        }
      };

      workerPool.process.once("exit", exitHandler);

      // Cleanup event listeners on success
      const cleanup = () => {
        workerPool.process.stdout.removeListener("data", messageHandler);
        workerPool.process.removeListener("exit", exitHandler);
      };

      // Clean up listeners whether we resolve or reject
      resolve.cleanup = cleanup;
      reject.cleanup = cleanup;
    }).finally((result) => {
      // Call cleanup function if it exists
      if (result && typeof result.cleanup === "function") {
        result.cleanup();
      }
    });

    // Update last use time
    workerPool.lastUseTime = Date.now();

    // Set up idle timer
    workerPool.idleTimer = setTimeout(() => {
      if (Date.now() - workerPool.lastUseTime >= WORKER_IDLE_TIMEOUT) {
        log("Worker idle timeout reached, cleaning up");
        cleanup();
      }
    }, WORKER_IDLE_TIMEOUT);

    return workerPool.process;
  } catch (error) {
    cleanup();
    throw error;
  }
}

export async function generateRemoteImage(
  componentName,
  props,
  config,
  scaling
) {
  log("Starting render process...");

  // Spawn worker if needed
  if (!workerPool.process) {
    workerPool.process = await spawnWorker();
  }

  // Sanitize props - handle BigInt values
  const sanitizedProps = JSON.parse(
    JSON.stringify(props, (key, value) => {
      if (typeof value === "bigint") {
        return value.toString();
      }
      return value;
    })
  );

  // Process request
  return await new Promise((resolve, reject) => {
    let buffer = "";
    const chunkAssembler = new ChunkAssembler();

    const messageHandler = (data) => {
      try {
        buffer += data.toString("utf8");

        const messages = buffer.split(MESSAGE_DELIMITER);
        buffer = messages.pop() || ""; // Keep the last incomplete message

        for (const message of messages) {
          if (!message.trim()) continue;

          try {
            const parsed = JSON.parse(message);

            // Handle chunked messages
            const result = chunkAssembler.handleMessage(parsed);
            if (result === null) {
              // Still assembling chunks
              continue;
            }

            if (result.type === "error") {
              reject(new Error(result.error));
            } else if (result.type === "result") {
              resolve({
                buffer: Buffer.from(result.data, "base64"),
                contentType: result.contentType,
              });
            }
          } catch (err) {
            if (!chunkAssembler.isAssembling()) {
              // Only report parse errors if we're not assembling chunks
              reject(
                new Error(`Failed to parse worker response: ${err.message}`)
              );
            }
          }
        }
      } catch (err) {
        reject(new Error(`Error processing response: ${err.message}`));
      }
    };

    const errorHandler = (error) => {
      reject(new Error(`Worker error: ${error.message}`));
    };

    const exitHandler = (code, signal) => {
      if (chunkAssembler.isAssembling()) {
        reject(
          new Error(
            `Worker exited during chunk assembly (code: ${code}, signal: ${signal})`
          )
        );
      } else {
        reject(
          new Error(
            `Worker exited unexpectedly (code: ${code}, signal: ${signal})`
          )
        );
      }
    };

    workerPool.process.stdout.on("data", messageHandler);
    workerPool.process.once("error", errorHandler);
    workerPool.process.once("exit", exitHandler);

    // Send request
    const request = {
      type: "generate",
      componentName,
      props: sanitizedProps,
      config,
      scaling,
    };

    const data = Buffer.from(
      JSON.stringify(request) + MESSAGE_DELIMITER,
      "utf8"
    );
    workerPool.process.stdin.write(data);

    // Update last use time
    workerPool.lastUseTime = Date.now();

    // Cleanup function for promise
    return () => {
      workerPool.process.stdout.removeListener("data", messageHandler);
      workerPool.process.removeListener("error", errorHandler);
      workerPool.process.removeListener("exit", exitHandler);
    };
  });
}

// Cleanup on process exit
process.on("exit", cleanup);
process.on("SIGINT", () => {
  cleanup();
  process.exit(0);
});
process.on("SIGTERM", () => {
  cleanup();
  process.exit(0);
});
