import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");

const MAX_RETRIES = 4;
const INITIAL_DELAY = 1500;

async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

      // Spawn worker process
      const workerPath = path.join(
        __dirname,
        "..",
        "render-server",
        "worker.js"
      );
      console.log("Worker path:", workerPath);

      const workerProcess = spawn("bun", ["run", workerPath], {
        stdio: ["pipe", "pipe", "pipe"],
        env: {
          ...process.env,
          ELEAZAR_PROJECT_ROOT: PROJECT_ROOT,
          NODE_PATH: path.join(PROJECT_ROOT, "node_modules"),
        },
        cwd: PROJECT_ROOT,
      });

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

          const messageHandler = (data) => {
            try {
              console.log("Received data from worker");
              messageBuffer += data.toString("utf8");
              if (!messageBuffer.includes("\n")) {
                console.log("Partial message received, waiting for more...");
                return;
              }

              console.log("Processing complete message");
              const message = JSON.parse(messageBuffer.trim());
              messageBuffer = "";

              if (message.type === "error") {
                console.error("Worker reported error:", message.error);
                reject(new Error(message.error));
              } else if (message.type === "result") {
                console.log("Received result message, decoding image...");
                const buffer = Buffer.from(message.data, "base64");
                console.log(`Decoded image buffer (${buffer.length} bytes)`);
                resolve({
                  buffer,
                  contentType: message.contentType,
                });
              } else {
                console.log("Received unknown message type:", message.type);
              }
            } catch (err) {
              console.error("Error processing worker message:", err);
              // Continue collecting data if parse fails
              if (messageBuffer.length > 1024 * 1024) {
                reject(new Error("Message buffer overflow"));
              }
            }
          };

          const errorHandler = (error) => {
            console.error("Worker process error:", error);
            reject(new Error("Worker process error: " + error.message));
          };

          workerProcess.stdout.on("data", messageHandler);
          workerProcess.stderr.on("data", (data) => {
            console.log("Worker log:", data.toString("utf8").trim());
          });
          workerProcess.on("error", errorHandler);

          // Send request
          console.log("Sending generation request to worker...");
          const requestData = Buffer.from(
            JSON.stringify({
              type: "generate",
              componentName,
              props: sanitizedProps,
              config,
              scaling,
            }) + "\n",
            "utf8"
          );
          workerProcess.stdin.write(requestData);
          console.log("Request sent to worker");

          // Cleanup on process exit
          workerProcess.once("exit", (code, signal) => {
            console.log(
              `Worker process exited (code: ${code}, signal: ${signal})`
            );
            if (code !== 0) {
              reject(new Error(`Worker exited with code ${code} (${signal})`));
            }
          });
        });

        return result;
      } finally {
        // Always clean up the worker process
        workerProcess.kill();
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
