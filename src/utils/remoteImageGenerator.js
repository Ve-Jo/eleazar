import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { setTimeout as sleep } from "timers/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");

const MAX_RETRIES = 4;
const INITIAL_DELAY = 1500;
const WORKER_PATH = path.join(__dirname, "..", "render-server", "worker.js");
const WORKER_START_TIMEOUT = 10000;
const WORKER_IDLE_TIMEOUT = 30000;

// Worker process management
let workerProcess = null;
let lastUsed = Date.now();

async function getWorker() {
  if (workerProcess && Date.now() - lastUsed < WORKER_IDLE_TIMEOUT) {
    return workerProcess;
  }

  if (workerProcess) {
    workerProcess.kill();
  }

  console.log("🚀 Starting new render worker process...");
  workerProcess = spawn("bun", ["run", WORKER_PATH], {
    stdio: ["pipe", "pipe", "pipe"],
    env: {
      ...process.env,
      ELEAZAR_PROJECT_ROOT: PROJECT_ROOT,
      NODE_PATH: path.join(PROJECT_ROOT, "node_modules"),
    },
    cwd: PROJECT_ROOT,
  });

  // Wait for worker to be ready
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Worker failed to start (timeout)"));
    }, WORKER_START_TIMEOUT);

    const readyHandler = (data) => {
      const messages = data.toString("utf8").split("\n");
      for (const msg of messages) {
        if (!msg.trim()) continue;
        try {
          const message = JSON.parse(msg);
          if (message.type === "ready") {
            clearTimeout(timeout);
            resolve();
            return;
          }
        } catch (err) {
          console.log("Ignoring startup message:", msg);
        }
      }
    };

    workerProcess.stdout.on("data", readyHandler);
    workerProcess.stderr.on("data", (data) => {
      console.log("Worker startup log:", data.toString("utf8").trim());
    });

    workerProcess.once("exit", (code, signal) => {
      reject(new Error(`Worker exited during startup (code: ${code}, signal: ${signal})`));
    });
  });

  return workerProcess;
}

/**
 * Generates an image using a React component in a separate process
 */
export async function generateRemoteImage(
  componentName,
  props,
  config,
  scaling
) {
  let retries = 0;
  let worker = null;
  let retries = 0;

  // Validate banner URL if present
  if (props.database?.banner_url) {
    try {
      const response = await fetch(props.database.banner_url, {
        method: "HEAD",
      });
      if (!response.headers.get("content-type")?.startsWith("image/")) {
        console.error(
          "Invalid banner content type:",
          response.headers.get("content-type")
        );
        props.database.banner_url = null;
      }
    } catch (error) {
      console.error("Error validating banner URL:", error);
      props.database.banner_url = null;
    }
  }

  while (true) {
    try {
      console.log("🚀 Starting render process...");

      // Prepare sanitized props
      const locale = props.locale || "en";
      const sanitizedProps = JSON.parse(
        JSON.stringify({ ...props, locale }, (key, value) => {
          if (typeof value === "bigint") return value.toString();
          if (
            typeof value === "string" &&
            !isNaN(value) &&
            value.trim() !== ""
          ) {
            return Number(value);
          }
          if (key === "banner_url" && !value) return undefined;
          return value;
        })
      );

      // Get or create worker process
      worker = await getWorker();
      lastUsed = Date.now();

      try {
        // Wait for process to be ready
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Worker failed to start (timeout)"));
          }, 10000);

          let isResolved = false;

          const readyHandler = (data) => {
            try {
              // Split by newlines to handle multiple messages
              const messages = data.toString("utf8").split("\n");

              for (const msg of messages) {
                if (!msg.trim()) continue;

                try {
                  const message = JSON.parse(msg);
                  if (message.type === "ready") {
                    if (!isResolved) {
                      console.log("✅ Received ready message from worker");
                      clearTimeout(timeout);
                      isResolved = true;
                      resolve();
                    }
                    return;
                  }
                } catch (err) {
                  // Ignore non-JSON messages (like Bun's startup logs)
                  console.log("Ignoring startup message:", msg);
                }
              }
            } catch (err) {
              console.error("Error in ready handler:", err);
              // Don't reject here, might be partial data
            }
          };

          // Listen for both stdout and stderr during startup
          workerProcess.stdout.on("data", readyHandler);
          workerProcess.stderr.on("data", (data) => {
            console.log("Worker startup log:", data.toString("utf8").trim());
          });

          // Remove listeners once ready
          const cleanup = () => {
            workerProcess.stdout.removeListener("data", readyHandler);
          };

          // Clean up listeners on resolve/reject
          workerProcess.once("exit", (code, signal) => {
            if (!isResolved) {
              cleanup();
              reject(
                new Error(
                  `Worker exited during startup (code: ${code}, signal: ${signal})`
                )
              );
            }
          });

          // Also clean up if we resolve successfully
          resolve = (() => {
            const originalResolve = resolve;
            return () => {
              cleanup();
              originalResolve();
            };
          })();
        });

        // Send the generation request
        const result = await new Promise((resolve, reject) => {
          let messageBuffer = "";
          let isResolved = false;

          const messageHandler = (data) => {
            try {
              messageBuffer += data.toString("utf8");
              if (!messageBuffer.includes("\n")) return;

              const message = JSON.parse(messageBuffer.trim());
              messageBuffer = "";

              if (message.type === "error") {
                console.error("Worker error:", message.error);
                reject(new Error(message.error));
              } else if (message.type === "result") {
                const buffer = Buffer.from(message.data, "base64");
                resolve({
                  buffer,
                  contentType: message.contentType,
                });
                isResolved = true;
              }
            } catch (err) {
              console.error("Error processing message:", err);
              if (messageBuffer.length > 1024 * 1024) {
                reject(new Error("Message buffer overflow"));
              }
            }
          };

          const errorHandler = (error) => {
            if (!isResolved) {
              reject(new Error("Worker process error: " + error.message));
            }
          };

          worker.stdout.on("data", messageHandler);
          worker.stderr.on("data", (data) => {
            console.log("Worker log:", data.toString("utf8").trim());
          });
          worker.on("error", errorHandler);

          // Send request
          const requestData = JSON.stringify({
            type: "generate",
            componentName,
            props: sanitizedProps,
            config,
            scaling,
          }) + "\n";
          worker.stdin.write(requestData);

          // Cleanup
          const cleanup = () => {
            worker.stdout.removeListener("data", messageHandler);
            worker.stderr.removeListener("data", messageHandler);
            worker.removeListener("error", errorHandler);
          };

          worker.once("exit", (code, signal) => {
            cleanup();
            if (!isResolved) {
              reject(new Error(`Worker exited with code ${code} (${signal})`));
            }
          });

          resolve = (() => {
            const originalResolve = resolve;
            return (value) => {
              cleanup();
              originalResolve(value);
            };
          })();
        });

        return result;
      } finally {
        // Keep worker alive for reuse
        lastUsed = Date.now();
      }
    } catch (error) {
      retries++;
      console.error("Generation error:", error.message);

      if (retries > MAX_RETRIES) {
        console.error("Max retries reached:", error);
        throw error;
      }

      const backoffDelay =
        retries === 1 ? 2000 : INITIAL_DELAY * Math.pow(2, retries - 1);
      console.log(`Retrying in ${backoffDelay / 1000} seconds...`);
      await delay(backoffDelay);
    }
  }
}
