import puppeteer from "puppeteer";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Store active sessions
const activeSessions = new Map();
const SESSION_TIMEOUT = 30000; // 30 seconds idle timeout

// Get or create a Puppeteer session
const getSession = async (sessionId, initializationScript) => {
  if (activeSessions.has(sessionId)) {
    const session = activeSessions.get(sessionId);
    clearTimeout(session.timeoutId); // Clear existing timeout
    // Reset timeout
    session.timeoutId = setTimeout(
      () => closeSession(sessionId),
      SESSION_TIMEOUT
    );
    console.log(`Reusing existing Puppeteer session: ${sessionId}`);
    return session;
  }

  console.log(`Creating new Puppeteer session: ${sessionId}`);
  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-gpu", // Disable GPU acceleration entirely
      "--disable-accelerated-2d-canvas", // Disable accelerated 2D canvas
      // WebGL is needed for Three.js, even software rendering
      "--disable-web-security",
      "--enable-logging=stderr",
    ],
    env: {
      ...process.env,
      PUPPETEER_DEBUG: "true", // Enable Puppeteer debug logging
    },
  });

  const page = await browser.newPage();

  // Enable console log capturing for debugging
  page.on("console", (msg) =>
    console.log(`Browser console [${sessionId}]:`, msg.text())
  );
  page.on("error", (err) =>
    console.error(`Browser error [${sessionId}]:`, err)
  );
  page.on("pageerror", (err) =>
    console.error(`Page error [${sessionId}]:`, err)
  );

  // Basic HTML structure - remove forced body background
  await page.setContent(
    `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Puppeteer Session</title>
        <style>
          body { 
            margin: 0; 
            overflow: hidden; 
            /* background-color: #2B2D31; */ /* REMOVED - Let it be transparent */
          }
          canvas { 
            display: block; 
            width: 100%; 
            height: 100%; 
          }
          #debug-info {
            position: absolute;
            top: 10px;
            left: 10px;
            color: white;
            font-family: monospace;
            z-index: 100;
            background: rgba(0,0,0,0.7);
            padding: 5px;
            border-radius: 3px;
            font-size: 10px;
          }
        </style>
        <!-- Load THREE.js directly with a script tag -->
        <script src="https://cdn.jsdelivr.net/npm/three@0.148.0/build/three.min.js"></script>
    </head>
    <body>
        <div id="render-container"></div>
        <div id="debug-info">Loading...</div>
        <script>
            // Verify THREE is loaded in global scope
            if (typeof THREE !== 'undefined') {
                console.log('THREE loaded directly via script tag');
                window.threeLoaded = true;
                
                // Check WebGL availability
                const canvas = document.createElement('canvas');
                const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
                const debugInfo = document.getElementById('debug-info');
                
                if (!gl) {
                  console.error('WebGL not supported');
                  debugInfo.textContent = 'WebGL not supported';
                  window.webglAvailable = false;
                } else {
                  console.log('WebGL is supported');
                  const renderer = gl.getParameter(gl.RENDERER);
                  const vendor = gl.getParameter(gl.VENDOR);
                  const version = gl.getParameter(gl.VERSION);
                  
                  const debugText = 'WebGL: ' + version + '\\nRenderer: ' + renderer + '\\nVendor: ' + vendor;
                  debugInfo.textContent = debugText;
                  console.log(debugText);
                  window.webglAvailable = true;
                }
            } else {
                console.error('Failed to load THREE');
                window.threeLoaded = false;
                document.getElementById('debug-info').textContent = 'THREE.js load error';
            }
        </script>
    </body>
    </html>
  `,
    { waitUntil: ["load", "networkidle0"] }
  );

  // Wait for THREE to confirm loading
  try {
    await page.waitForFunction("window.threeLoaded === true", {
      timeout: 15000,
    });
    console.log("THREE confirmed loaded in page.");

    // Also check if WebGL is available
    const webglStatus = await page.evaluate(() => window.webglAvailable);
    if (!webglStatus) {
      console.warn(
        "WebGL not available in Puppeteer session - rendering may fail"
      );
    }
  } catch (e) {
    console.error("Timeout or error waiting for THREE to load in page.");
    await browser.close(); // Clean up if THREE fails to load
    throw new Error("Failed to initialize THREE.js in Puppeteer page.");
  }

  // Inject the component-specific rendering functions script
  if (initializationScript) {
    try {
      await page.addScriptTag({ content: initializationScript });
      console.log("Component-specific render functions injected.");
    } catch (e) {
      console.error("Failed to inject initialization script:", e);
      await browser.close();
      throw new Error("Failed to inject component script into Puppeteer page.");
    }
  } else {
    console.warn("No initialization script provided for Puppeteer session.");
  }

  const session = {
    browser,
    page,
    timeoutId: setTimeout(() => closeSession(sessionId), SESSION_TIMEOUT),
  };
  activeSessions.set(sessionId, session);

  return session;
};

// Render or update the scene in an existing session page
const renderUpdate = async (sessionId, options) => {
  // Extract forceInit, separate from evaluateOptions
  const { initializationScript, forceInit, ...evaluateOptions } = options;

  const session = await getSession(sessionId, initializationScript);
  if (!session) throw new Error(`Session not found for ID: ${sessionId}`);

  const { page } = session;
  const { width, height } = evaluateOptions;

  await page.setViewport({ width, height, deviceScaleFactor: 1 });

  try {
    // Determine if initialization is needed
    const needsInit =
      forceInit ||
      (await page.evaluate(
        // Add forceInit check here
        () =>
          typeof window.object === "undefined" ||
          !document.getElementById("render-container")?.hasChildNodes()
      ));

    if (needsInit) {
      console.log(
        `Calling initializeScene (forceInit: ${!!forceInit}) for session: ${sessionId}`
      );
      await page.evaluate(
        (opts) => window.initializeScene(opts),
        evaluateOptions
      );
    } else {
      console.log(`Calling updateRotation for session: ${sessionId}`);
      await page.evaluate(
        (opts) => window.updateRotation(opts),
        evaluateOptions
      );
    }

    // Allow a bit more time for rendering after update/init
    await new Promise((resolve) => setTimeout(resolve, 200)); // Reduced to 200ms

    const screenshot = await page.screenshot({
      type: "png",
      omitBackground: true, // Omit background for transparency
      optimizeForSpeed: true, // Added flag for potential speedup
    });
    return `data:image/png;base64,${screenshot.toString("base64")}`;
  } catch (error) {
    console.error(`Error during renderUpdate for session ${sessionId}:`, error);
    // Attempt to close the potentially broken session
    await closeSession(sessionId);
    throw error; // Re-throw error to be handled by the command
  }
};

// Close a specific session
const closeSession = async (sessionId) => {
  if (activeSessions.has(sessionId)) {
    console.log(`Closing Puppeteer session: ${sessionId}`);
    const session = activeSessions.get(sessionId);
    clearTimeout(session.timeoutId); // Clear timeout just in case
    try {
      await session.browser.close();
    } catch (closeError) {
      console.error(
        `Error closing browser for session ${sessionId}:`,
        closeError
      );
    }
    activeSessions.delete(sessionId);
  } else {
    console.log(`Attempted to close non-existent session: ${sessionId}`);
  }
};

// Graceful shutdown cleanup
process.on("exit", async () => {
  console.log("Closing all active Puppeteer sessions on exit...");
  for (const sessionId of activeSessions.keys()) {
    await closeSession(sessionId);
  }
});

export { getSession, renderUpdate, closeSession };
