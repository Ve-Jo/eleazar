import express from "express";
import { generateImage, processImageColors } from "../utils/imageGenerator.js";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs/promises";
import { watch } from "fs";
import React from "react";
import { WebSocketServer } from "ws";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const COMPONENTS_DIR = path.join(__dirname, "components");
const PUBLIC_DIR = path.join(__dirname, "public");

const app = express();

// Serve static files from public directory
app.use(express.static(PUBLIC_DIR));

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
  const mockI18n = {
    // Core i18n methods
    getLocale: function () {
      return lang;
    },
    setLocale: function (locale) {
      console.log(`[PREVIEW] Setting locale to ${locale}`);
      return locale;
    },
    __: function (key, replacements = {}) {
      try {
        // Handle nested keys with dot notation (e.g., "levelUp.chat.title")
        const keyParts = key.split(".");

        // Check if Component has localization_strings
        if (Component && Component.localization_strings) {
          // For simple keys directly in localization_strings
          if (keyParts.length === 1 && Component.localization_strings[key]) {
            const translation =
              Component.localization_strings[key][lang] ||
              Component.localization_strings[key].en ||
              key;
            return applyReplacements(translation, replacements);
          }

          // For nested keys
          if (keyParts.length > 1) {
            // Try to find the key in component's localization_strings
            // First try the exact structure (e.g., levelUp.chat.title)
            const firstKey = keyParts[0];
            if (Component.localization_strings[firstKey]) {
              let currentObj = Component.localization_strings[firstKey];

              // Handle single-level nesting (most common case)
              if (keyParts.length === 2 && typeof currentObj === "object") {
                // Check if it's a direct language map
                if (currentObj[lang] || currentObj.en) {
                  return applyReplacements(
                    currentObj[lang] || currentObj.en,
                    replacements
                  );
                }

                // Check if second part exists
                const secondKey = keyParts[1];
                if (currentObj[secondKey]) {
                  const translation =
                    currentObj[secondKey][lang] ||
                    currentObj[secondKey].en ||
                    key;
                  return applyReplacements(translation, replacements);
                }
              }

              // Handle multiple levels of nesting (e.g., levelUp.chat.title)
              // This traverses deeper into the structure
              for (let i = 1; i < keyParts.length; i++) {
                if (currentObj && typeof currentObj === "object") {
                  currentObj = currentObj[keyParts[i]];
                } else {
                  break;
                }
              }

              // If we found a language map at the end
              if (currentObj && (currentObj[lang] || currentObj.en)) {
                return applyReplacements(
                  currentObj[lang] || currentObj.en,
                  replacements
                );
              }
            }
          }
        }

        // Fallback to returning the key itself
        console.log(`Translation not found for key: ${key}`);
        return applyReplacements(key, replacements);
      } catch (e) {
        console.error("Translation error:", e);
        return key;
      }
    },
    // Helper methods
    getTranslation: function (key, replacements = {}, locale = null) {
      return this.__(key, replacements, locale || lang);
    },
    getNestedValue: function (obj, path) {
      if (!obj || !path) return undefined;
      const parts = path.split(".");
      let current = obj;
      for (const part of parts) {
        if (current === undefined || current === null) return undefined;
        current = current[part];
      }
      return current;
    },
    // Mock debug/registration functions
    debugTranslations: function (key) {
      console.log(`[PREVIEW] Debug translations for key: ${key}`);
      return this;
    },
    registerLocalizations: function (category, name, localizations) {
      console.log(
        `[PREVIEW] Registering localizations for ${category}.${name}`
      );
      return this;
    },
    initialized: true,
    supportedLocales: ["en", "ru", "uk"],
    translations: {},
  };

  return mockI18n;
}

// Helper function to apply replacements to translation strings
function applyReplacements(text, replacements) {
  if (!replacements || typeof replacements !== "object" || !text) {
    return text;
  }

  let result = text;

  // Process each replacement
  for (const [key, value] of Object.entries(replacements)) {
    // Skip undefined values
    if (value === undefined) continue;

    // Convert value to string
    const stringValue = String(value);

    // Replace {{key}} pattern (double braces)
    const doublePattern = `{{${key}}}`;
    result = result.replace(new RegExp(doublePattern, "g"), stringValue);

    // Replace {key} pattern (single braces)
    const singlePattern = `{${key}}`;
    result = result.replace(new RegExp(singlePattern, "g"), stringValue);
  }

  return result;
}

// Function to create mockData with specified language
async function createMockData(lang = "en", Component = null) {
  // Create i18n mock for this component
  const i18nMock = createI18nMock(lang, Component);

  // Mock data for Leaderboard component
  if (Component?.name === "Leaderboard") {
    const usernames = [
      "DragonSlayer",
      "StarLight",
      "NightOwl",
      "CyberNinja",
      "PixelMaster",
      "ShadowWalker",
      "MoonKnight",
      "SunChaser",
      "StormBringer",
      "FirePhoenix",
    ];

    const generateEconomyData = () => {
      const balance = parseFloat((Math.random() * 500).toFixed(2));
      const bank = parseFloat((Math.random() * 500).toFixed(2));
      return {
        balance,
        bank,
        value: balance + bank,
      };
    };

    // Generate users with properly processed colors
    const users = await Promise.all(
      Array(10)
        .fill()
        .map(async (_, index) => {
          const avatarId = index % 5; // Discord has 5 default avatars (0-4)
          const avatarURL = `https://cdn.discordapp.com/embed/avatars/${avatarId}.png`;
          const colorProps = await processImageColors(avatarURL);
          const economyData = generateEconomyData();

          return {
            id: (1000000000 + index).toString(),
            name: `${usernames[index % usernames.length]}${Math.floor(
              Math.random() * 999
            )}`,
            avatarURL,
            coloring: colorProps,
            /*bannerUrl: `https://cdn.discordapp.com/embed/avatars/${Math.floor(
              Math.random() * 5
            )}.png`,*/
            value: economyData.value,
            balance: economyData.balance,
            bank: economyData.bank,
            totalBalance: economyData.value,
            level: Math.floor(Math.random() * 100) + 1,
            xp: Math.floor(Math.random() * 100000),
            xpStats: {
              chat: Math.floor(Math.random() * 50000),
              voice: Math.floor(Math.random() * 50000),
            },
            gameRecords: {
              2048: { highScore: Math.floor(Math.random() * 8192) },
              snake: { highScore: Math.floor(Math.random() * 200) },
            },
            seasonStats: {
              rank: index + 1,
              totalXP: Math.floor(Math.random() * 100000),
            },
          };
        })
    );

    return {
      locale: lang,
      i18n: i18nMock,
      users: users.sort((a, b) => b.value - a.value),
      currentPage: 1,
      totalPages: 3,
      highlightedPosition: 2,
      category: "total",
      interaction: {
        user: {
          id: "123456789",
          username: "Test User",
          displayName: "Test User",
          avatarURL: "https://cdn.discordapp.com/embed/avatars/0.png",
        },
      },
      dominantColor: "user",
    };
  }

  // Mock data for LevelUp component
  if (Component?.name === "LevelUp") {
    return {
      locale: lang,
      i18n: i18nMock,
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
      },
      // LevelUp specific properties
      type: "chat", // chat or game
      currentXP: 75,
      requiredXP: 100,
      level: 5,
      oldLevel: 4,
      dominantColor: "user",
    };
  }

  // Mock data for CratesDisplay component
  if (Component?.name === "CratesDisplay") {
    return {
      locale: lang,
      i18n: i18nMock,
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
      },
      database: {
        balance: 1500.75,
        seasonXp: 2450,
      },
      crates: [
        {
          type: "daily",
          name: "Daily Crate",
          emoji: "🎁",
          description: "Open once every 24 hours for daily rewards",
          available: true,
          count: 0,
          cooldown: 0,
        },
        {
          type: "weekly",
          name: "Weekly Crate",
          emoji: "📦",
          description: "Contains better rewards than daily crates",
          available: false,
          count: 0,
          cooldown: 120000, // 2 minutes for testing
        },
        {
          type: "rare",
          name: "Rare Crate",
          emoji: "🧰",
          description:
            "Contains rare items and higher chances for good rewards",
          available: true,
          count: 2,
          cooldown: 0,
        },
        {
          type: "seasonal",
          name: "Seasonal Crate",
          emoji: "🎄",
          description: "Special limited-time rewards for the current season",
          available: false,
          count: 0,
          cooldown: 360000, // 6 minutes for testing
        },
      ],
      selectedCrate: 0,
      dominantColor: "user",
    };
  }

  // Mock data for CrateRewards component
  if (Component?.name === "CrateRewards") {
    return {
      locale: lang,
      i18n: i18nMock,
      interaction: {
        user: {
          id: "123456789",
          username: "Test User",
          displayName: "Test User",
          avatarURL: "https://cdn.discordapp.com/embed/avatars/0.png",
        },
      },
      crateType: "daily",
      crateEmoji: "🎁",
      crateName: "Daily Crate",
      rewards: {
        coins: 75,
        xp: 50,
        seasonXp: 50,
        discount: 10,
        cooldownReductions: {
          daily: 600000, // 10 minutes
          work: 1800000, // 30 minutes
        },
      },
      dominantColor: "user",
    };
  }

  // Mock data for Transfer component with user-to-user transfer support
  if (Component?.name === "Transfer") {
    // Create a recipient user for transfer visualization
    const recipientUser = {
      id: "987654321",
      username: "RecipientUser",
      displayName: "Recipient User",
      avatarURL: "https://cdn.discordapp.com/embed/avatars/3.png",
      balance: 750.25,
    };

    return {
      locale: lang,
      i18n: i18nMock,
      interaction: {
        user: {
          id: "123456789",
          username: "SenderUser",
          displayName: "Sender User",
          avatarURL:
            "https://cdn.discordapp.com/avatars/888384053735194644/dfc83402e6e67f14949a56a10c6a6706.png?size=2048",
        },
        guild: {
          id: "987654321",
          name: "Test Guild",
          iconURL: "https://cdn.discordapp.com/embed/avatars/0.png",
        },
      },
      database: {
        economy: {
          balance: 1000.5,
          bankBalance: 5000.75,
          bankRate: 25,
          bankStartTime: 25,
        },
      },
      amount: 250.5,
      // Add these properties to test different modes
      isDeposit: false,
      isTransfer: true, // Set to true to test transfer mode
      recipient: recipientUser, // Include recipient data
      dominantColor: "user",
    };
  }

  // Default mock data for other components
  return {
    locale: lang, // Add locale for imageGenerator
    i18n: i18nMock, // Add the i18n mock object
    interaction: {
      user: {
        id: "123456789",
        username: "Test User",
        displayName: "Test User",
        avatarURL:
          "https://cdn.discordapp.com/avatars/888384053735194644/dfc83402e6e67f14949a56a10c6a6706.png?size=2048",
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
    dominantColor: "user",
    database: {
      //bannerUrl: null,
      economy: {
        balance: 1000.5,
        bankBalance: 5000.75,
        bankRate: 25,
        bankStartTime: 25,
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
    // Add level information
    xp: 15000,
    level: 25,
    // Add game records
    gameRecords: {
      2048: { highScore: 4096 },
      snake: { highScore: 150 },
    },
    // Add season stats
    seasonStats: {
      rank: 5,
      totalXP: 25000,
    },
    // Add XP stats
    xpStats: {
      chat: 10000,
      voice: 5000,
    },
    // Add upgrades data for UpgradesDisplay component
    upgrades:
      Component?.name === "UpgradesDisplay"
        ? [
            {
              emoji: "🎁",
              title:
                lang === "ru"
                  ? "Ежедневный бонус"
                  : lang === "uk"
                  ? "Щоденний бонус"
                  : "Daily Bonus",
              description:
                lang === "ru"
                  ? "+15% к ежедневной награде"
                  : lang === "uk"
                  ? "+15% до щоденної нагороди"
                  : "+15% daily reward bonus",
              currentLevel: 1,
              nextLevel: 2,
              price: 20,
              progress: 50,
              id: 0,
              category: "economy",
            },
            {
              emoji: "⏳",
              title:
                lang === "ru"
                  ? "Преступление"
                  : lang === "uk"
                  ? "Злочин"
                  : "Crime Cooldown",
              description:
                lang === "ru"
                  ? "-20 мин. перезарядки"
                  : lang === "uk"
                  ? "-20 хв. перезарядки"
                  : "-20 min crime cooldown",
              currentLevel: 1,
              nextLevel: 2,
              price: 50,
              progress: 50,
              id: 1,
              category: "economy",
            },
            {
              emoji: "🏦",
              title:
                lang === "ru"
                  ? "Банк. процент"
                  : lang === "uk"
                  ? "Банк. відсоток"
                  : "Bank Rate",
              description:
                lang === "ru"
                  ? "+0.5% к ставке банка"
                  : lang === "uk"
                  ? "+0.5% до ставки банку"
                  : "+0.5% bank interest rate",
              currentLevel: 1,
              nextLevel: 2,
              price: 100,
              progress: 50,
              id: 2,
              category: "economy",
            },
            {
              emoji: "🏦",
              title:
                lang === "ru"
                  ? "Банк. процент"
                  : lang === "uk"
                  ? "Банк. відсоток"
                  : "Bank Rate",
              description:
                lang === "ru"
                  ? "+0.5% к ставке банка"
                  : lang === "uk"
                  ? "+0.5% до ставки банку"
                  : "+0.5% bank interest rate",
              currentLevel: 1,
              nextLevel: 2,
              price: 100,
              progress: 50,
              id: 2,
              category: "cooldown",
            },
            {
              emoji: "🏦",
              title:
                lang === "ru"
                  ? "Банк. процент"
                  : lang === "uk"
                  ? "Банк. відсоток"
                  : "Bank Rate",
              description:
                lang === "ru"
                  ? "+0.5% к ставке банка"
                  : lang === "uk"
                  ? "+0.5% до ставки банку"
                  : "+0.5% bank interest rate",
              currentLevel: 1,
              nextLevel: 2,
              price: 100,
              progress: 50,
              id: 2,
              category: "cooldown",
            },
          ]
        : undefined,
    currentUpgrade: 0,
    balance: 1000.5,
    // Coloring will be set in the image generation route based on theme
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

    // Add special controls for specific components
    let additionalControls = "";

    if (componentName === "Transfer") {
      additionalControls = `
        <div class="mode-controls">
          <span>Mode: </span>
          <button class="mode-btn" data-mode="deposit" onclick="changeMode('deposit')">Deposit</button>
          <button class="mode-btn" data-mode="withdraw" onclick="changeMode('withdraw')">Withdraw</button>
          <button class="mode-btn active" data-mode="transfer" onclick="changeMode('transfer')">Transfer</button>
        </div>
      `;
    }

    // Add type toggle for LevelUp component
    if (componentName === "LevelUp") {
      additionalControls = `
        <div class="type-controls">
          <span>Type: </span>
          <button class="type-btn active" data-type="chat" onclick="changeType('chat')">Chat</button>
          <button class="type-btn" data-type="game" onclick="changeType('game')">Game</button>
        </div>
      `;
    }

    // Create preview page
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${componentName} Preview</title>
        <script>
          // Client-side storage helper that works in all environments
          const storage = {
            get: (key, defaultValue) => {
              try {
                if (typeof localStorage !== 'undefined') {
                  const value = localStorage.getItem(key);
                  return value !== null ? value : defaultValue;
                }
              } catch (e) {
                console.warn('localStorage not available:', e);
              }
              return defaultValue;
            },
            set: (key, value) => {
              try {
                if (typeof localStorage !== 'undefined') {
                  localStorage.setItem(key, value);
                }
              } catch (e) {
                console.warn('localStorage not available:', e);
              }
            }
          };
          
          // WebSocket connection for live reload
          const ws = new WebSocket('ws://' + window.location.host);
          
          let currentLang = storage.get('previewLang', 'en');
          let debugMode = storage.get('debugMode', 'false') === 'true';
          let currentMode = storage.get('transferMode', 'transfer');
          let darkTheme = storage.get('darkTheme', 'true') === 'true';
          let currentType = storage.get('levelUpType', 'chat');
          
          function toggleDebug() {
            debugMode = !debugMode;
            storage.set('debugMode', debugMode);
            document.getElementById('debugButton').classList.toggle('active', debugMode);
            
            ws.send(JSON.stringify({
              type: 'debugChange',
              component: '${componentName}',
              debug: debugMode
            }));
          }
          
          function toggleTheme() {
            darkTheme = !darkTheme;
            storage.set('darkTheme', darkTheme);
            document.getElementById('themeButton').classList.toggle('active', darkTheme);
            document.getElementById('themeButton').textContent = darkTheme ? 'Dark Theme' : 'Light Theme';
            
            ws.send(JSON.stringify({
              type: 'themeChange',
              component: '${componentName}',
              darkTheme: darkTheme
            }));
            
            refreshImage();
          }
          
          function changeType(type) {
            if ('${componentName}' !== 'LevelUp') return;
            
            currentType = type;
            storage.set('levelUpType', type);
            document.querySelectorAll('.type-btn').forEach(btn => {
              btn.classList.toggle('active', btn.dataset.type === type);
            });
            
            // Notify server about type change
            ws.send(JSON.stringify({
              type: 'typeChange',
              component: '${componentName}',
              levelType: type
            }));
            
            refreshImage();
          }
          
          function changeMode(mode) {
            if ('${componentName}' !== 'Transfer') return;
            
            currentMode = mode;
            storage.set('transferMode', mode);
            document.querySelectorAll('.mode-btn').forEach(btn => {
              btn.classList.toggle('active', btn.dataset.mode === mode);
            });
            
            // Notify server about mode change
            ws.send(JSON.stringify({
              type: 'modeChange',
              component: '${componentName}',
              mode: mode
            }));
            
            refreshImage();
          }
          
          function refreshImage() {
            const img = document.querySelector('.preview img');
            let url = '/${componentName}/image?lang=' + currentLang;
            
            if ('${componentName}' === 'Transfer') {
              url += '&mode=' + currentMode;
            }
            
            if ('${componentName}' === 'LevelUp') {
              url += '&type=' + currentType;
            }
            
            url += '&debug=' + debugMode + '&theme=' + (darkTheme ? 'dark' : 'light') + '&t=' + Date.now();
            img.src = url;
          }
          
          ws.onopen = () => {
            // Tell server which component we're viewing
            ws.send(JSON.stringify({ 
              type: 'viewing',
              component: '${componentName}',
              lang: currentLang,
              mode: currentMode,
              debug: debugMode,
              darkTheme: darkTheme
            }));
          };
          
          ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'reload' || data.type === 'langChange' || 
                data.type === 'debugChange' || data.type === 'modeChange' ||
                data.type === 'themeChange') {
              refreshImage();
            }
          };

          function changeLang(lang) {
            currentLang = lang;
            storage.set('previewLang', lang);
            document.querySelectorAll('.lang-btn').forEach(btn => {
              btn.classList.toggle('active', btn.dataset.lang === lang);
            });
            
            // Notify server about language change
            ws.send(JSON.stringify({
              type: 'langChange',
              component: '${componentName}',
              lang: lang
            }));

            refreshImage();
          }

          // Initialize on load
          window.onload = () => {
            // Initialize language buttons
            document.querySelectorAll('.lang-btn').forEach(btn => {
              btn.classList.toggle('active', btn.dataset.lang === currentLang);
            });
            
            // Initialize debug button
            if (document.getElementById('debugButton')) {
              document.getElementById('debugButton').classList.toggle('active', debugMode);
            }
            
            // Initialize theme button
            if (document.getElementById('themeButton')) {
              document.getElementById('themeButton').classList.toggle('active', darkTheme);
              document.getElementById('themeButton').textContent = darkTheme ? 'Dark Theme' : 'Light Theme';
            }
            
            // Initialize Transfer mode buttons if applicable
            if ('${componentName}' === 'Transfer') {
              document.querySelectorAll('.mode-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.mode === currentMode);
              });
            }
            
            // Initialize LevelUp type buttons if applicable
            if ('${componentName}' === 'LevelUp') {
              document.querySelectorAll('.type-btn').forEach(btn => {
                console.log('Setting type button:', btn.dataset.type, currentType);
                btn.classList.toggle('active', btn.dataset.type === currentType);
              });
            }
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
            flex-wrap: wrap;
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
          .lang-controls, .mode-controls {
            display: flex;
            gap: 5px;
            margin-left: 10px;
            align-items: center;
          }
          .lang-btn, .mode-btn, .debug-btn {
            padding: 8px 12px;
            border: none;
            border-radius: 4px;
            background: #e0e0e0;
            cursor: pointer;
            font-weight: 500;
          }
          .lang-btn.active, .mode-btn.active, .debug-btn.active {
            background: #FFA500;
            color: white;
          }
          .mode-btn.active {
            background: #9C27B0;
          }
          .debug-btn.active {
            background: #F44336;
          }
          .theme-btn {
            padding: 8px 12px;
            border: none;
            border-radius: 4px;
            background: #e0e0e0;
            cursor: pointer;
            font-weight: 500;
          }
          .theme-btn.active {
            background: #673AB7;
            color: white;
          }
          .type-controls {
            display: flex;
            gap: 5px;
            margin-left: 10px;
            align-items: center;
          }
          .type-btn {
            padding: 8px 12px;
            border: none;
            border-radius: 4px;
            background: #e0e0e0;
            cursor: pointer;
            font-weight: 500;
          }
          .type-btn.active {
            background: #2196F3;
            color: white;
          }
          .type-btn[data-type="game"].active {
            background: #1DB935;
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
          <div class="debug-controls">
            <button id="debugButton" onclick="toggleDebug()" class="debug-btn">Debug Mode</button>
          </div>
          <div class="theme-controls">
            <button id="themeButton" onclick="toggleTheme()" class="theme-btn">Dark Theme</button>
          </div>
          ${additionalControls}
        </div>
        <div class="preview">
          <img src="/${componentName}/image?lang=en${
      componentName === "Transfer" ? "&mode=transfer" : ""
    }" onload="this.parentElement.setAttribute('style', 'width:' + this.naturalWidth + 'px; height:' + this.naturalHeight + 'px; position:relative;')" />
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
    console.error("Error details:", error);
    res.status(500).send(`Error rendering component: ${error.message}`);
  }
});

// Serve component image separately
app.get("/:componentName/image", async (req, res) => {
  try {
    const { componentName } = req.params;
    const lang = req.query.lang || "en";
    const mode = req.query.mode || "transfer"; // Get mode from query params
    const type = req.query.type || "chat"; // Get type from query params for LevelUp
    const debug = req.query.debug === "true"; // Parse debug parameter
    const theme = req.query.theme || "dark"; // Get theme from query params
    const isDarkTheme = theme === "dark";
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

    console.log(
      `Rendering ${componentName} with locale: ${lang}, mode: ${mode}, type: ${type}, debug: ${debug}, theme: ${theme}`
    );

    // Generate image with mock props
    const mockData = await createMockData(lang, Component);

    // Apply mode settings for Transfer component
    if (componentName === "Transfer" && mockData) {
      if (mode === "deposit") {
        mockData.isDeposit = true;
        mockData.isTransfer = false;
      } else if (mode === "withdraw") {
        mockData.isDeposit = false;
        mockData.isTransfer = false;
      } else if (mode === "transfer") {
        mockData.isDeposit = false;
        mockData.isTransfer = true;
      }
    }

    // Apply type settings for LevelUp component
    if (componentName === "LevelUp" && mockData) {
      mockData.type = type;
    }

    // Add debug flag to mockData
    mockData.debug = debug;

    // Apply theme settings
    if (componentName === "UpgradesDisplay" && mockData) {
      // Set coloring based on theme
      mockData.coloring = isDarkTheme
        ? {
            textColor: debug ? "#FF0000" : "#FFFFFF",
            secondaryTextColor: "rgba(255, 255, 255, 0.8)",
            tertiaryTextColor: "rgba(255, 255, 255, 0.6)",
            overlayBackground: "rgba(0, 0, 0, 0.25)",
            backgroundGradient:
              "linear-gradient(135deg, #2196f3 0%, #1976d2 100%)",
            isDarkText: false,
          }
        : {
            textColor: debug ? "#FF0000" : "#000000",
            secondaryTextColor: "rgba(0, 0, 0, 0.8)",
            tertiaryTextColor: "rgba(0, 0, 0, 0.6)",
            overlayBackground: "rgba(255, 255, 255, 0.5)",
            backgroundGradient:
              "linear-gradient(135deg, #f9f3e0 0%, #e6d7b0 100%)",
            isDarkText: true,
          };
    }

    // Validate the i18n object
    if (!mockData.i18n || typeof mockData.i18n.__ !== "function") {
      console.error("Invalid i18n object in mockData:", mockData.i18n);
      mockData.i18n = createI18nMock(lang, Component);
    }

    // Ensure there's an initialized flag
    if (mockData.i18n) {
      mockData.i18n.initialized = true;
    }

    let buffer;
    try {
      buffer = await generateImage(
        Component,
        mockData,
        {
          image: 2,
          emoji: 2,
          debug: debug, // Pass debug flag to image generator
        },
        mockData.i18n
      );

      if (!buffer || !Buffer.isBuffer(buffer)) {
        throw new Error("Generated image is invalid");
      }
    } catch (renderError) {
      console.error("Error generating image:", renderError);

      // Create an error image with the error message
      const errorMessage = renderError.message || "Unknown error";
      const errorStack = renderError.stack || "";

      try {
        // Send a fallback error image
        const { createCanvas } = await import("canvas");
        const canvas = createCanvas(800, 400);
        const ctx = canvas.getContext("2d");

        // Fill background
        ctx.fillStyle = "#FF0000";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Add error message
        ctx.fillStyle = "#FFFFFF";
        ctx.font = "24px Arial";
        ctx.fillText(`Error rendering component: ${componentName}`, 20, 40);
        ctx.fillText(`Message: ${errorMessage.substring(0, 80)}`, 20, 80);

        // Add small stack trace
        ctx.font = "12px Arial";
        const stackLines = errorStack.split("\n");
        for (let i = 0; i < Math.min(stackLines.length, 8); i++) {
          ctx.fillText(stackLines[i].substring(0, 100), 20, 120 + i * 20);
        }

        res.setHeader("Content-Type", "image/png");
        const errorBuffer = canvas.toBuffer();
        res.send(errorBuffer);
        return;
      } catch (canvasError) {
        console.error("Error creating error image:", canvasError);
        res.status(500).send(`Error rendering component: ${errorMessage}`);
        return;
      }
    }

    // Determine content type
    const isGif =
      buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46;
    const contentType = isGif ? "image/gif" : "image/png";

    res.setHeader("Content-Type", contentType);
    res.send(buffer);
  } catch (error) {
    console.error("Error details:", error);
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
  clients.set(ws, {
    component: null,
    lang: "en",
    mode: "transfer",
    debug: false,
    darkTheme: true,
    levelType: "chat",
  });

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);
      console.log("Received message:", data);

      if (
        data.type === "viewing" ||
        data.type === "langChange" ||
        data.type === "modeChange" ||
        data.type === "debugChange" ||
        data.type === "themeChange" ||
        data.type === "typeChange"
      ) {
        // Update which component, language, and mode this client is viewing
        const clientData = clients.get(ws);
        const oldComponent = clientData.component;
        clientData.component = data.component;

        if (data.lang) {
          clientData.lang = data.lang;
        }

        if (data.mode) {
          clientData.mode = data.mode;
        }

        if (data.levelType) {
          clientData.levelType = data.levelType;
        }

        if (data.type === "debugChange") {
          clientData.debug = data.debug;
          console.log(`Debug mode changed to: ${data.debug}`);
          ws.send(JSON.stringify({ type: "debugChange" }));
        }

        if (data.type === "themeChange") {
          clientData.darkTheme = data.darkTheme;
          console.log(`Theme changed to: ${data.darkTheme ? "dark" : "light"}`);
          ws.send(JSON.stringify({ type: "themeChange" }));
        }

        console.log(
          `Client updated: component=${data.component}, lang=${
            clientData.lang
          }, mode=${clientData.mode}, levelType=${
            clientData.levelType
          }, debug=${clientData.debug}, theme=${
            clientData.darkTheme ? "dark" : "light"
          }`
        );

        if (data.type === "viewing" && oldComponent !== data.component) {
          console.log(`Client now viewing: ${data.component}`);
        }

        // For language or mode changes, notify the client to refresh
        if (data.type === "langChange") {
          console.log(`Language changed to: ${data.lang}`);
          ws.send(JSON.stringify({ type: "langChange" }));
        }

        if (data.type === "modeChange") {
          console.log(`Mode changed to: ${data.mode}`);
          ws.send(JSON.stringify({ type: "modeChange" }));
        }

        if (data.type === "typeChange") {
          console.log(`Type changed to: ${data.levelType}`);
          ws.send(JSON.stringify({ type: "typeChange" }));
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
