import express from "express";
import { generateImage } from "../utils/render/imageGenerator.js";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs/promises";
import { watch } from "fs";
import React from "react";
import { WebSocketServer } from "ws";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const COMPONENTS_DIR = path.join(__dirname, "components");

const app = express();
const wss = new WebSocketServer({ noServer: true });

// Track active WebSocket connections and their settings
const clients = new Map();

// Watch for component file changes
async function watchComponents() {
  console.log(`Watching for changes in: ${COMPONENTS_DIR}`);

  try {
    // Verify directory exists and is accessible
    await fs.access(COMPONENTS_DIR);

    // Use absolute path for more reliable watching
    const absolutePath = path.resolve(COMPONENTS_DIR);
    console.log(`Using absolute path: ${absolutePath}`);

    const watcher = watch(absolutePath, { recursive: true });

    watcher.on("change", async (eventType, filename) => {
      console.log(`File change detected: ${filename}`);
      if (filename && filename.endsWith(".jsx")) {
        // Handle both absolute and relative paths
        const baseName = path.basename(filename);
        const componentName = baseName.replace(".jsx", "");

        console.log(`Component ${componentName} changed, notifying clients...`);

        let clientsNotified = 0;
        // Notify all clients viewing this component
        for (const [ws, data] of clients.entries()) {
          if (data.component === componentName) {
            console.log(`Notifying client watching ${componentName}`);
            try {
              ws.send(
                JSON.stringify({
                  type: "reload",
                  timestamp: Date.now(),
                })
              );
              clientsNotified++;
            } catch (error) {
              console.error(`Error notifying client: ${error.message}`);
              // Remove dead connections
              clients.delete(ws);
            }
          }
        }
        console.log(
          `Notified ${clientsNotified} clients about ${componentName} update`
        );
      }
    });

    watcher.on("error", (error) => {
      console.error("Watcher error:", error);
    });

    return watcher;
  } catch (error) {
    console.error("Failed to set up file watcher:", error);
    throw error;
  }
}

let componentWatcher;
try {
  componentWatcher = await watchComponents();
  console.log("File watcher initialized successfully");
} catch (error) {
  console.error("Failed to initialize file watcher:", error);
  process.exit(1);
}

// Cleanup watcher on process exit
process.on("SIGINT", () => {
  componentWatcher.close();
  process.exit(0);
});

// Create i18n mock with translations
function createI18nMock(lang, Component) {
  return {
    getLocale: () => lang,
    __: (key) => {
      try {
        // Simple keys (no dots)
        if (
          Component.localization_strings &&
          Component.localization_strings[key]
        ) {
          return (
            Component.localization_strings[key][lang] ||
            Component.localization_strings[key].en ||
            key
          );
        }

        // Complex keys (with dots)
        const [category, stringKey] = key.split(".");
        if (
          Component.localization_strings &&
          Component.localization_strings[stringKey]
        ) {
          return (
            Component.localization_strings[stringKey][lang] ||
            Component.localization_strings[stringKey].en ||
            key
          );
        }

        return key;
      } catch (e) {
        console.error("Translation error:", e);
        return key;
      }
    },
  };
}

// Function to create mockData with specified language
function createMockData(lang = "en", Component = null) {
  return {
    locale: lang, // Add locale for imageGenerator
    interaction: {
      user: {
        id: "123456789",
        username: "Test User",
        displayName: "Test User",
        avatarURL: "https://cdn.discordapp.com/embed/avatars/0.png",
      },
      guild: {
        id: "987654321",
        name: "Test Guild",
        iconURL: "https://cdn.discordapp.com/embed/avatars/0.png",
      },
      bot: {
        shards: Array(4)
          .fill()
          .map((_, i) => ({
            id: i + 1,
            guilds: Math.floor(Math.random() * 100) + 1,
            ping: Array(6)
              .fill()
              .map(() => Math.floor(Math.random() * 150) + 1),
          })),
      },
    },
    database: {
      bannerUrl: null,
      economy: {
        balance: 1000.5,
        bankBalance: 5000.75,
        bankRate: 5,
        bankStartTime: Date.now() - 3600000,
      },
      avatar_url: "https://cdn.discordapp.com/embed/avatars/0.png",
      bot_stats: {
        guilds_stats: Array(100)
          .fill()
          .map(() => Math.floor(Math.random() * 100) + 1),
        database_pings: Array(10)
          .fill()
          .map(() => Math.floor(Math.random() * 100) + 1),
        render_pings: Array(10)
          .fill()
          .map(() => Math.floor(Math.random() * 100) + 1),
        music_pings: Array(10)
          .fill()
          .map(() => Math.floor(Math.random() * 100) + 1),
      },
    },
    i18n: createI18nMock(lang, Component),
    currentSong: {
      title: "Example Song",
      artist: "Example Artist",
      duration: 271000,
      thumbnail: "https://cdn.discordapp.com/embed/avatars/0.png",
    },
    nextSongs: Array(3)
      .fill()
      .map((_, i) => ({
        title: `Next Song ${i + 1}`,
        artist: `Artist ${i + 1}`,
        duration: 240000,
        thumbnail: "https://cdn.discordapp.com/embed/avatars/0.png",
        user: {
          avatarURL: "https://cdn.discordapp.com/embed/avatars/0.png",
        },
      })),
    currentTime: 65000,
    duration: 271000,
    amount: 100,
    nextDaily: 3600000,
    emoji: "🎁",
    victim: {
      user: {
        id: "111111111",
        username: "Victim User",
        avatarURL: "https://cdn.discordapp.com/embed/avatars/1.png",
      },
      balance: 500,
    },
    robber: {
      user: {
        id: "222222222",
        username: "Robber User",
        avatarURL: "https://cdn.discordapp.com/embed/avatars/2.png",
      },
      balance: 1000,
    },
    success: true,
  };
}

// Helper to get all component names
async function getAvailableComponents() {
  const files = await fs.readdir(COMPONENTS_DIR);
  return files
    .filter((f) => f.endsWith(".jsx"))
    .map((f) => f.replace(".jsx", ""));
}

// Create index page that lists all components with links
app.get("/", async (req, res) => {
  const components = await getAvailableComponents();

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Component Preview</title>
      <style>
        body { 
          font-family: -apple-system, system-ui, sans-serif;
          max-width: 800px;
          margin: 40px auto;
          padding: 0 20px;
          line-height: 1.6;
        }
        h1 { color: #333; }
        .components {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 20px;
          margin-top: 30px;
        }
        .component-link {
          display: block;
          padding: 15px 20px;
          background: #f5f5f5;
          border-radius: 8px;
          color: #2196f3;
          text-decoration: none;
          font-weight: 500;
          transition: all 0.2s;
        }
        .component-link:hover {
          background: #e5e5e5;
          transform: translateY(-2px);
        }
      </style>
    </head>
    <body>
      <h1>Available Components</h1>
      <div class="components">
        ${components
          .map(
            (name) => `
          <a href="/${name}" class="component-link">${name}</a>
        `
          )
          .join("")}
      </div>
    </body>
    </html>
  `;

  res.send(html);
});

// Handle component preview requests
app.get("/:componentName", async (req, res) => {
  try {
    const { componentName } = req.params;
    const componentPath = path.join(COMPONENTS_DIR, `${componentName}.jsx`);

    try {
      await fs.access(componentPath);
    } catch {
      return res.status(404).send(`Component ${componentName} not found`);
    }

    // Create preview page
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${componentName} Preview</title>
        <script>
          // WebSocket connection for live reload
          const ws = new WebSocket('ws://' + window.location.host);
          
          let currentLang = localStorage.getItem('previewLang') || 'en';
          
          ws.onopen = () => {
            // Tell server which component we're viewing
            ws.send(JSON.stringify({ 
              type: 'viewing',
              component: '${componentName}',
              lang: currentLang
            }));
          };
          
          ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'reload' || data.type === 'langChange') {
              // Reload image without full page refresh
              const img = document.querySelector('.preview img');
              const newUrl = '/${componentName}/image?lang=' + currentLang + '&t=' + Date.now();
              img.src = newUrl;
            }
          };

          function changeLang(lang) {
            currentLang = lang;
            localStorage.setItem('previewLang', lang);
            document.querySelectorAll('.lang-btn').forEach(btn => {
              btn.classList.toggle('active', btn.dataset.lang === lang);
            });
            
            // Notify server about language change
            ws.send(JSON.stringify({
              type: 'langChange',
              component: '${componentName}',
              lang: lang
            }));

            const img = document.querySelector('.preview img');
            const newUrl = '/${componentName}/image?lang=' + lang + '&t=' + Date.now();
            img.src = newUrl;
          }

          // Initialize on load
          window.onload = () => {
            document.querySelectorAll('.lang-btn').forEach(btn => {
              btn.classList.toggle('active', btn.dataset.lang === currentLang);
            });
          };
        </script>
        <style>
          body { 
            font-family: -apple-system, system-ui, sans-serif;
            max-width: 800px;
            margin: 40px auto;
            padding: 0 20px;
            display: flex;
            flex-direction: column;
            align-items: center;
            background: #f5f5f5;
          }
          h1 { color: #333; }
          .preview {
            margin: 20px 0;
            padding: 2px;
            background: white;
            border: 2px solid #ff0000;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          }
          .preview img {
            display: block;
            max-width: 100%;
            height: auto;
          }
          .controls {
            margin: 20px 0;
            display: flex;
            gap: 10px;
            align-items: center;
          }
          .back {
            padding: 10px 20px;
            background: #2196f3;
            color: white;
            text-decoration: none;
            border-radius: 4px;
          }
          .reload {
            padding: 10px 20px;
            background: #4CAF50;
            color: white;
            text-decoration: none;
            border-radius: 4px;
          }
          .lang-controls {
            display: flex;
            gap: 5px;
            margin-left: 20px;
          }
          .lang-btn {
            padding: 10px 15px;
            border: none;
            border-radius: 4px;
            background: #e0e0e0;
            cursor: pointer;
            font-weight: 500;
          }
          .lang-btn.active {
            background: #FFA500;
            color: white;
          }
          .dimensions {
            position: absolute;
            top: 0;
            right: 0;
            background: rgba(255, 0, 0, 0.1);
            color: #ff0000;
            padding: 4px 8px;
            border-radius: 0 0 0 4px;
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <h1>${componentName} Preview</h1>
        <div class="controls">
          <a href="/" class="back">← Back to List</a>
          <a href="#" class="reload" onclick="location.reload(); return false">↻ Reload</a>
          <div class="lang-controls">
            <button class="lang-btn" data-lang="en" onclick="changeLang('en')">English</button>
            <button class="lang-btn" data-lang="ru" onclick="changeLang('ru')">Russian</button>
            <button class="lang-btn" data-lang="uk" onclick="changeLang('uk')">Ukrainian</button>
          </div>
        </div>
        <div class="preview">
          <img src="/${componentName}/image?lang=en" onload="this.parentElement.setAttribute('style', 'width:' + this.naturalWidth + 'px; height:' + this.naturalHeight + 'px; position:relative;')" />
          <div class="dimensions"></div>
        </div>
        <script>
          // Add dimensions display
          const img = document.querySelector('.preview img');
          img.onload = function() {
            const dimensions = document.querySelector('.dimensions');
            dimensions.textContent = this.naturalWidth + ' × ' + this.naturalHeight;
            this.parentElement.setAttribute('style', 'width:' + this.naturalWidth + 'px; height:' + this.naturalHeight + 'px; position:relative;');
          };
        </script>
      </body>
      </html>
    `;

    res.send(html);
  } catch (error) {
    res.status(500).send(`Error rendering component: ${error.message}`);
  }
});

// Serve component image separately
app.get("/:componentName/image", async (req, res) => {
  try {
    const { componentName } = req.params;
    const lang = req.query.lang || "en";
    const componentPath = path.join(COMPONENTS_DIR, `${componentName}.jsx`);

    // Import and render component with cache busting
    delete require.cache[componentPath]; // Clear module cache
    const imported = await import(
      `file://${componentPath}?t=${Date.now()}`
    ).catch((error) => {
      console.error(`Failed to import component: ${error.message}`);
      throw error;
    });
    const Component = imported.default;

    if (!Component) {
      throw new Error(`Component not found in ${componentPath}`);
    }

    console.log(`Rendering ${componentName} with locale: ${lang}`);
    // Generate image with mock props
    const buffer = await generateImage(
      Component,
      createMockData(lang, Component),
      {},
      { image: 1, emoji: 1 }
    );

    if (!buffer || !Buffer.isBuffer(buffer)) {
      throw new Error("Generated image is invalid");
    }

    // Determine content type
    const isGif =
      buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46;
    const contentType = isGif ? "image/gif" : "image/png";

    res.setHeader("Content-Type", contentType);
    res.send(buffer);
  } catch (error) {
    res.status(500).send(`Error rendering component: ${error.message}`);
  }
});

// Export both app and WebSocket setup
export default {
  app,
  handleUpgrade: (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  },
};

// Handle WebSocket connections
wss.on("connection", (ws) => {
  console.log("New WebSocket connection established");

  // Initialize client data with defaults
  clients.set(ws, { component: null, lang: "en" });

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);
      console.log("Received message:", data);

      if (data.type === "viewing" || data.type === "langChange") {
        // Update which component and language this client is viewing
        const clientData = clients.get(ws);
        const oldComponent = clientData.component;
        clientData.component = data.component;
        clientData.lang = data.lang || "en";

        console.log(
          `Client updated: component=${data.component}, lang=${data.lang}`
        );

        if (data.type === "viewing" && oldComponent !== data.component) {
          console.log(`Client now viewing: ${data.component}`);
        }

        // For language changes, notify the client to refresh
        if (data.type === "langChange") {
          console.log(`Language changed to: ${data.lang}`);
          ws.send(JSON.stringify({ type: "langChange" }));
        }
      }
    } catch (e) {
      console.error("WebSocket message error:", e);
    }
  });

  // Handle client disconnection
  ws.on("close", () => {
    const clientData = clients.get(ws);
    console.log(
      `Client disconnected, was viewing: ${clientData?.component || "none"}`
    );
    clients.delete(ws);
  });

  // Keep connection alive
  const pingInterval = setInterval(() => {
    if (ws.readyState === ws.OPEN) {
      ws.ping();
    }
  }, 30000);

  ws.on("close", () => clearInterval(pingInterval));
});
