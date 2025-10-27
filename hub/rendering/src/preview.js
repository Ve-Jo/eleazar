import express from "express";
import { generateImage, processImageColors } from "./utils/imageGenerator.js";
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

    // Helper function to resolve import path to component name
    const resolveImportToComponent = (importPath, currentComponentDir) => {
      // Handle relative imports
      if (importPath.startsWith("./") || importPath.startsWith("../")) {
        const currentDir = currentComponentDir || COMPONENTS_DIR;
        const resolvedPath = path.resolve(currentDir, importPath);

        // Check if it's a JSX file in our components directory
        if (
          resolvedPath.startsWith(absolutePath) &&
          resolvedPath.endsWith(".jsx")
        ) {
          // Return relative path from components directory, not just basename
          const relativePath = path.relative(COMPONENTS_DIR, resolvedPath);
          return relativePath.replace(".jsx", "");
        }

        // Try adding .jsx extension if not present
        if (!resolvedPath.endsWith(".jsx")) {
          const jsxPath = resolvedPath + ".jsx";
          if (jsxPath.startsWith(absolutePath)) {
            const relativePath = path.relative(COMPONENTS_DIR, jsxPath);
            return relativePath.replace(".jsx", "");
          }
        }
      }

      return null;
    };

    // Helper function to get all dependencies for a component
    const getComponentDependencies = async (componentName) => {
      const dependencies = new Set([componentName]);

      try {
        // Handle components in subdirectories (e.g., "unified/UserCard")
        let componentPath;
        if (componentName.includes("/")) {
          componentPath = path.join(COMPONENTS_DIR, `${componentName}.jsx`);
        } else {
          componentPath = path.join(COMPONENTS_DIR, `${componentName}.jsx`);
        }

        const currentComponentDir = path.dirname(componentPath);
        const content = await fs.readFile(componentPath, "utf-8");

        // Find all import statements
        const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
        let match;

        while ((match = importRegex.exec(content)) !== null) {
          const importPath = match[1];
          const depComponentName = resolveImportToComponent(
            importPath,
            currentComponentDir
          );

          if (depComponentName) {
            dependencies.add(depComponentName);

            // Recursively get dependencies of this dependency
            const subDeps = await getComponentDependencies(depComponentName);
            subDeps.forEach((dep) => dependencies.add(dep));
          }
        }
      } catch (error) {
        console.error(
          `Error getting dependencies for ${componentName}:`,
          error
        );
      }

      return dependencies;
    };

    watcher.on("change", async (eventType, filename) => {
      console.log(`File change detected: ${filename}`);
      if (filename && filename.endsWith(".jsx")) {
        // Handle both absolute and relative paths
        let changedComponentName;

        if (filename.includes("/")) {
          // Handle relative paths like "unified/UserCard.jsx"
          const relativePath = filename.replace(/^.*components[/\\]/, "");
          changedComponentName = relativePath.replace(".jsx", "");
        } else {
          // Handle simple filenames
          const baseName = path.basename(filename);
          changedComponentName = baseName.replace(".jsx", "");
        }

        console.log(
          `Component ${changedComponentName} changed, checking dependencies...`
        );

        // Get all components that depend on this changed component
        const allComponents = await getAvailableComponents();
        const affectedComponents = new Set([changedComponentName]);

        for (const componentName of allComponents) {
          if (componentName === changedComponentName) continue;

          const dependencies = await getComponentDependencies(componentName);
          if (dependencies.has(changedComponentName)) {
            affectedComponents.add(componentName);
            console.log(
              `Component ${componentName} depends on ${changedComponentName}`
            );
          }
        }

        console.log(
          `Affected components: ${Array.from(affectedComponents).join(", ")}`
        );

        let clientsNotified = 0;
        // Notify all clients viewing affected components
        for (const [ws, data] of clients.entries()) {
          if (affectedComponents.has(data.component)) {
            console.log(`Notifying client watching ${data.component}`);
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
          `Notified ${clientsNotified} clients about updates to ${Array.from(
            affectedComponents
          ).join(", ")}`
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
      const distributed = parseFloat((Math.random() * 300).toFixed(2));
      return {
        balance,
        bank,
        distributed,
        value: balance + bank + distributed,
        totalBalance: balance + bank + distributed,
        totalBankBalance: bank + distributed,
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
            distributed: economyData.distributed,
            totalBalance: economyData.totalBalance,
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

    // Mock guild vault data
    const mockGuildVault = {
      id: "vault123",
      guildId: "987654321",
      balance: 125.75, // Accumulated vault balance
      totalFees: 250.5, // Total fees collected
      lastDistribution: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      createdAt: new Date(Date.now() - 86400000 * 7).toISOString(), // 7 days ago
      updatedAt: new Date().toISOString(),
    };

    // Calculate mock fee amount (5% of transaction)
    const transactionAmount = 250.5;
    const mockFeeAmount = transactionAmount * 0.05; // 5% fee

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
          bankDistributed: 1250.25,
          bankRate: 25,
          bankStartTime: 25,
        },
      },
      amount: transactionAmount,
      // Add these properties to test different modes
      isDeposit: false,
      isTransfer: true, // Set to true to test transfer mode
      recipient: recipientUser, // Include recipient data
      guildVault: mockGuildVault, // Include guild vault data
      feeAmount: mockFeeAmount, // Include calculated fee amount
      dominantColor: "user",
    };
  }

  // Mock data for Balance component with distributed funds support
  if (Component?.name === "Balance") {
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
        economy: {
          balance: 1000.5,
          bankBalance: 5000.75,
          bankDistributed: 1250.25,
          bankRate: 25,
          bankStartTime: Date.now() - 86400000, // 1 day ago in milliseconds
        },
        individualBankBalance: 6251.0,
        combinedBankBalance: 7500.75,
        guildVault: {
          id: "vault123",
          guildId: "1282078106202669148",
          balance: 125.75, // Current vault balance
          totalFees: 250.5, // Total fees collected
          lastDistribution: new Date(Date.now() - 86400000).toISOString(),
          createdAt: new Date(Date.now() - 86400000 * 7).toISOString(), // 7 days ago
          updatedAt: new Date().toISOString(),
        },
        vaultEarnings: 125.25, // ← Добавлено поле для отображения распределенных средств
        vaultDistributions: [
          {
            id: "cmh7qsan5000d96vjmmptwe7c",
            guildId: "1282078106202669148",
            userId: "831217341454090272",
            amount: "25.50",
            distributionDate: new Date(Date.now() - 3600000).toISOString(),
            source: "automatic",
            triggeredBy: "287275956744355841",
          },
          {
            id: "cmh6vqbgt000b96m1lsxxafcz",
            guildId: "1282078106202669148",
            userId: "831217341454090272",
            amount: "18.75",
            distributionDate: new Date(Date.now() - 7200000).toISOString(),
            source: "automatic",
            triggeredBy: "287275956744355841",
          },
          {
            id: "cmh6vqbgt000c96m1lsxxafcy",
            guildId: "1282078106202669148",
            userId: "831217341454090272",
            amount: "12.00",
            distributionDate: new Date(Date.now() - 10800000).toISOString(),
            source: "automatic",
            triggeredBy: "287275956744355841",
          },
        ], // ← Последние 3 операции распределения с реальной структурой данных
      },
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
        bankDistributed: 1250.25,
        bankRate: 25,
        bankStartTime: Date.now() - 86400000, // 1 day ago in milliseconds
      },
      // Add marriage status data for testing dynamic height
      marriageStatus: {
        status: "MARRIED",
        createdAt: new Date(Date.now() - 86400000 * 30).toISOString(), // 30 days ago
      },
      partnerUsername: "Partner User",
      partnerAvatarUrl: "https://cdn.discordapp.com/embed/avatars/3.png",
      combinedBankBalance: 7500.75,
      individualBankBalance: 6251.0,
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
    guildVault: {
      totalFunds: 2500.0,
      lastDistribution: new Date(Date.now() - 86400000).toISOString(), // вчера
      participants: 25,
      distributionAmount: 500.0,
      balance: 125.75, // Accumulated vault balance
      totalFees: 250.5, // Total fees collected
    },
    feeAmount: 12.53, // 5% fee for testing
    vaultEarnings: 125.25, // ← Добавлено поле для отображения распределенных средств
    vaultDistributions: [
      {
        id: "cmh7qsan5000d96vjmmptwe7c",
        guildId: "1282078106202669148",
        userId: "831217341454090272",
        amount: "25.50",
        distributionDate: new Date(Date.now() - 3600000).toISOString(),
        source: "automatic",
        triggeredBy: "287275956744355841",
      },
      {
        id: "cmh6vqbgt000b96m1lsxxafcz",
        guildId: "1282078106202669148",
        userId: "831217341454090272",
        amount: "18.75",
        distributionDate: new Date(Date.now() - 7200000).toISOString(),
        source: "automatic",
        triggeredBy: "287275956744355841",
      },
      {
        id: "cmh6vqbgt000c96m1lsxxafcy",
        guildId: "1282078106202669148",
        userId: "831217341454090272",
        amount: "12.00",
        distributionDate: new Date(Date.now() - 10800000).toISOString(),
        source: "automatic",
        triggeredBy: "287275956744355841",
      },
    ], // ← Последние 3 операции распределения с реальной структурой данных
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

    // --- Import component with aggressive cache clearing ---
    let ReactComponent = null;
    try {
      // Clear require cache for the component
      delete require.cache[componentPath];

      // Clear all related module caches to prevent stale dependencies
      const moduleKeys = Object.keys(require.cache);
      for (const key of moduleKeys) {
        if (key.includes("components") && key.endsWith(".jsx")) {
          delete require.cache[key];
        }
      }

      // Use a more aggressive cache-busting approach with unique identifier
      const uniqueId = Date.now() + Math.random();
      const imported = await import(
        `file://${componentPath}?t=${uniqueId}&cache=${uniqueId}`
      );
      ReactComponent = imported.default;

      // Force garbage collection if available (optional)
      if (global.gc) {
        global.gc();
      }
    } catch (importError) {
      console.error(`Could not import ${componentName}:`, importError);
    }
    // --- End Component Import ---
    // Generate initial mock data for client fallback
    const lang = "en";
    const initialMockData = await createMockData(lang, ReactComponent);
    const fallbackMockDataString = JSON.stringify(initialMockData, null, 2);

    // Add specific controls for Transfer and LevelUp (keep existing logic)
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
    if (componentName === "LevelUp") {
      additionalControls = `
        <div class="type-controls">
          <span>Type: </span>
          <button class="type-btn active" data-type="chat" onclick="changeType('chat')">Chat</button>
          <button class="type-btn" data-type="game" onclick="changeType('game')">Game</button>
        </div>
      `;
    }

    // Create preview page HTML
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${componentName} Preview</title>
        <script>
          const ws = new WebSocket('ws://' + window.location.host);

          let currentLang = localStorage.getItem('previewLang') || 'en';
          let debugMode = localStorage.getItem('debugMode') === 'true';
          let darkTheme = localStorage.getItem('darkTheme') !== 'false';
          let currentMode = localStorage.getItem('transferMode') || 'transfer';
          let currentType = localStorage.getItem('levelUpType') || 'chat';
          let isMarried = localStorage.getItem('isMarried') !== 'false';

          // Get mock data from localStorage or use initial data from server
          let mockDataJson = localStorage.getItem('mockDataJson');
          if (mockDataJson === null) {
              mockDataJson = fallbackMockDataString;
          }

          function toggleDebug() {
            debugMode = !debugMode;
            localStorage.setItem('debugMode', debugMode);
            document.getElementById('debugButton').classList.toggle('active', debugMode);
            refreshImage();
          }

          function toggleTheme() {
            darkTheme = !darkTheme;
            localStorage.setItem('darkTheme', darkTheme);
            document.getElementById('themeButton').classList.toggle('active', darkTheme);
            document.getElementById('themeButton').textContent = darkTheme ? 'Dark Theme' : 'Light Theme';
            refreshImage();
          }

          function changeLang(lang) {
            currentLang = lang;
            localStorage.setItem('previewLang', lang);
            document.querySelectorAll('.lang-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.lang === lang));
            refreshImage();
          }

          function changeMode(mode) {
            if ('${componentName}' !== 'Transfer') return;
            currentMode = mode;
            localStorage.setItem('transferMode', mode);
            document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.mode === mode));
            refreshImage();
          }

          function changeType(type) {
            if ('${componentName}' !== 'LevelUp') return;
            currentType = type;
            localStorage.setItem('levelUpType', type);
            document.querySelectorAll('.type-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.type === type));
            refreshImage();
          }

          function changeMarried(married) {
            if ('${componentName}' !== 'Balance') return;
            isMarried = married;
            localStorage.setItem('isMarried', married);
            document.querySelectorAll('.marriage-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.married === String(married)));
            refreshImage();
          }

          function updateMockData() {
            const editor = document.getElementById('mockDataEditor');
            if (!editor) return;

            try {
              // Validate JSON first
              JSON.parse(editor.value);
              // Update the mockDataJson variable with the editor content
              mockDataJson = editor.value;
              localStorage.setItem('mockDataJson', mockDataJson);
              console.log('Mock data updated, refreshing image with:', mockDataJson);
              refreshImage();
            } catch (error) {
              console.error('Invalid JSON:', error);
              // Keep the invalid JSON but don't refresh
            }
          }

          function refreshImage(forceInit = false) {
            const img = document.querySelector('.preview img');
            if (!img) return;
            let url = '/${componentName}/image?lang=' + currentLang;
            url += '&debug=' + debugMode + '&theme=' + (darkTheme ? 'dark' : 'light');
            if ('${componentName}' === 'Transfer') { url += '&mode=' + currentMode; }
            if ('${componentName}' === 'LevelUp') { url += '&type=' + currentType; }
            if ('${componentName}' === 'Balance') {
              // Update mock data to include/exclude marriage status
              try {
                const mockData = JSON.parse(mockDataJson);
                
                // Ensure the new distributed funds data is preserved
                if (!mockData.database.economy) {
                  mockData.database.economy = {};
                }
                if (!mockData.database.economy.bankDistributed) {
                  mockData.database.economy.bankDistributed = 1250.25;
                }
                if (!mockData.database.individualBankBalance) {
                  mockData.database.individualBankBalance = 6251.0;
                }
                if (!mockData.database.guildVault) {
                  mockData.database.guildVault = {
                    totalFunds: 2500.0,
                    lastDistribution: new Date(Date.now() - 86400000).toISOString(),
                    participants: 25,
                    distributionAmount: 500.0
                  };
                }
                if (!mockData.database.vaultEarnings) {
                  mockData.database.vaultEarnings = 125.25;
                }
                if (!mockData.database.vaultDistributions) {
                  mockData.database.vaultDistributions = [
                    {
                      id: "cmh7qsan5000d96vjmmptwe7c",
                      guildId: "1282078106202669148",
                      userId: "831217341454090272",
                      amount: "25.50",
                      distributionDate: new Date(Date.now() - 3600000).toISOString(),
                      source: "automatic",
                      triggeredBy: "287275956744355841"
                    },
                    {
                      id: "cmh6vqbgt000b96m1lsxxafcz",
                      guildId: "1282078106202669148",
                      userId: "831217341454090272",
                      amount: "18.75",
                      distributionDate: new Date(Date.now() - 7200000).toISOString(),
                      source: "automatic",
                      triggeredBy: "287275956744355841"
                    },
                    {
                      id: "cmh6vqbgt000c96m1lsxxafcy",
                      guildId: "1282078106202669148",
                      userId: "831217341454090272",
                      amount: "12.00",
                      distributionDate: new Date(Date.now() - 10800000).toISOString(),
                      source: "automatic",
                      triggeredBy: "287275956744355841"
                    }
                  ];
                }
                
                if (isMarried) {
                  mockData.database.marriageStatus = {
                    status: "MARRIED",
                    createdAt: new Date(Date.now() - 86400000 * 30).toISOString()
                  };
                  mockData.database.partnerUsername = "Partner User";
                  mockData.database.partnerAvatarUrl = "https://cdn.discordapp.com/embed/avatars/3.png";
                  // Preserve combined bank balance for married users
                  if (!mockData.database.combinedBankBalance) {
                    mockData.database.combinedBankBalance = 7500.75;
                  }
                } else {
                  delete mockData.database.marriageStatus;
                  delete mockData.database.partnerUsername;
                  delete mockData.database.partnerAvatarUrl;
                  // Don't delete combinedBankBalance - let it be managed by the component
                }
                mockDataJson = JSON.stringify(mockData, null, 2);
                const editor = document.getElementById('mockDataEditor');
                if (editor) editor.value = mockDataJson;
              } catch (e) {
                console.error('Error updating marriage status in mock data:', e);
              }
            }
            url += '&mockData=' + encodeURIComponent(mockDataJson);
            if (forceInit) {
                url += '&forceInit=true';
            }
            url += '&t=' + Date.now();

            // Clear any previous error display
            const errorContainer = document.getElementById('errorContainer');
            if (errorContainer) {
              errorContainer.style.display = 'none';
            }

            // Use fetch to handle errors properly
            fetch(url)
              .then(response => {
                if (!response.ok) {
                  return response.json().then(errorData => {
                    throw errorData;
                  });
                }
                return response.blob();
              })
              .then(blob => {
                const objectUrl = URL.createObjectURL(blob);
                img.src = objectUrl;
                img.onload = () => URL.revokeObjectURL(objectUrl);
              })
              .catch(errorData => {
                console.error('Image generation error:', errorData);
                displayError(errorData);
              });
          }

          function displayError(errorData) {
            const errorContainer = document.getElementById('errorContainer');
            const errorDetails = document.getElementById('errorDetails');
            const formattedPropsDisplay = document.getElementById('formattedPropsDisplay');

            if (!errorContainer || !errorDetails || !formattedPropsDisplay) return;

            // Display error message
            errorDetails.innerHTML =
              '<h3>🚨 Error Details</h3>' +
              '<div class="error-message">' +
                '<strong>Message:</strong> ' + (errorData.message || 'Unknown error') + '<br>' +
                '<strong>Error:</strong> ' + (errorData.error || 'Unknown error type') + '<br>' +
                (errorData.stack ? '<strong>Stack:</strong><pre>' + errorData.stack + '</pre>' : '') +
              '</div>';

            // Display formatted props if available
            if (errorData.formattedProps) {
              formattedPropsDisplay.innerHTML =
                '<h3>📋 Formatted Props</h3>' +
                '<div class="props-content">' +
                  '<pre>' + JSON.stringify(errorData.formattedProps, null, 2) + '</pre>' +
                '</div>';
            } else {
              formattedPropsDisplay.innerHTML =
                '<h3>📋 Formatted Props</h3>' +
                '<div class="props-content">' +
                  '<em>No formatted props available</em>' +
                '</div>';
            }

            errorContainer.style.display = 'flex';
          }

          function resetMockData() {
            fetch('/${componentName}/mockData?lang=' + currentLang +
                  '&debug=' + debugMode + '&theme=' + (darkTheme ? 'dark' : 'light') +
                  ('${componentName}' === 'Transfer' ? '&mode=' + currentMode : '') +
                  ('${componentName}' === 'LevelUp' ? '&type=' + currentType : ''))
              .then(response => response.text())
              .then(data => {
                // Update mock data editor with the fresh data
                const editor = document.getElementById('mockDataEditor');
                if (editor && data) {
                  mockDataJson = data;
                  localStorage.setItem('mockDataJson', data);
                  editor.value = data;
                  refreshImage();
                }
              })
              .catch(error => console.error('Error resetting mock data:', error));
          }

          ws.onopen = () => { console.log('WS Open'); };
          ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'reload') {
                  console.log('Reload triggered by server');
                  refreshImage();
                }
            } catch(e) { console.error('WS message error', e); }
           };

          window.onload = () => {
            // Init standard controls
            document.querySelectorAll('.lang-btn').forEach(btn => { btn.classList.toggle('active', btn.dataset.lang === currentLang); });
            if (document.getElementById('debugButton')) { document.getElementById('debugButton').classList.toggle('active', debugMode); }
            if (document.getElementById('themeButton')) { document.getElementById('themeButton').classList.toggle('active', darkTheme); document.getElementById('themeButton').textContent = darkTheme ? 'Dark Theme' : 'Light Theme'; }
            if ('${componentName}' === 'Transfer') { document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.mode === currentMode)); }
            if ('${componentName}' === 'LevelUp') { document.querySelectorAll('.type-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.type === currentType)); }
            if ('${componentName}' === 'Balance') { document.querySelectorAll('.marriage-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.married === String(isMarried))); }

            // Init JSON editor
            const editor = document.getElementById('mockDataEditor');
            if (editor) {
              editor.value = mockDataJson;
            }
          };

        </script>
        <style>
          body {
            font-family: -apple-system, system-ui, sans-serif;
            max-width: 1000px;
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
          .marriage-controls {
            display: flex;
            gap: 5px;
            margin-left: 10px;
            align-items: center;
          }
          .marriage-btn {
            padding: 8px 12px;
            border: none;
            border-radius: 4px;
            background: #e0e0e0;
            cursor: pointer;
            font-weight: 500;
          }
          .marriage-btn.active {
            background: #E91E63;
            color: white;
          }
          .marriage-controls {
            display: flex;
            gap: 5px;
            margin-left: 10px;
            align-items: center;
          }
          .marriage-btn {
            padding: 8px 12px;
            border: none;
            border-radius: 4px;
            background: #e0e0e0;
            cursor: pointer;
            font-weight: 500;
          }
          .marriage-btn.active {
            background: #E91E63;
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
          .json-editor {
            width: 100%;
            margin: 20px 0;
            display: flex;
            flex-direction: column;
            gap: 10px;
          }
          .json-editor textarea {
            width: 100%;
            height: 200px;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            padding: 10px;
            border: 1px solid #ccc;
            border-radius: 4px;
            resize: vertical;
          }
          .json-editor button {
            align-self: flex-start;
            padding: 8px 16px;
            background: #2196f3;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
          }
          /* Error Display Styles */
          .error-container {
            display: none;
            width: 100%;
            margin: 20px 0;
            gap: 20px;
            flex-direction: row;
          }
          .error-panel {
            flex: 1;
            background: white;
            border: 2px solid #ff0000;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            min-width: 300px;
          }
          .props-panel {
            flex: 2;
            background: white;
            border: 2px solid #2196f3;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            min-width: 500px;
          }
          .error-message {
            background: #fff5f5;
            border: 1px solid #feb2b2;
            border-radius: 4px;
            padding: 15px;
            margin: 10px 0;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            line-height: 1.4;
          }
          .props-content {
            background: #f7fafc;
            border: 1px solid #cbd5e0;
            border-radius: 4px;
            padding: 15px;
            margin: 10px 0;
            max-height: 600px;
            overflow-y: auto;
            overflow-x: auto;
          }
          .props-content pre {
            margin: 0;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            line-height: 1.4;
            white-space: pre;
            word-break: normal;
            min-width: 100%;
          }
          .error-container h3 {
            margin: 0 0 15px 0;
            color: #333;
            font-size: 16px;
          }
          .error-container h3:first-child {
            color: #ff0000;
          }
          .error-container h3:last-child {
            color: #2196f3;
          }
        </style>
      </head>
      <body>
        <h1>${componentName} Preview</h1>
        <div class="controls">
           <!-- Standard Controls -->
           <a href="/" class="back">← Back</a> <button onclick="refreshImage()">Reload Img</button>
           <div class="lang-controls">
             <button class="lang-btn" data-lang="en" onclick="changeLang('en')">English</button>
             <button class="lang-btn" data-lang="ru" onclick="changeLang('ru')">Russian</button>
             <button class="lang-btn" data-lang="uk" onclick="changeLang('uk')">Ukrainian</button>
           </div>
           <button id="debugButton" onclick="toggleDebug()">Debug</button>
           <button id="themeButton" onclick="toggleTheme()">Theme</button>
           ${additionalControls}
        </div>
        <div class="preview"> <img src="#" alt="Loading preview..."> <div class="dimensions"></div> </div>

        <!-- Error Display Container -->
        <div id="errorContainer" class="error-container" style="display: none;">
          <div class="error-panel">
            <div id="errorDetails"></div>
          </div>
        </div>

        <div class="json-editor">
          <h3>Mock Data Editor</h3>
          <textarea id="mockDataEditor" placeholder="Enter JSON mock data here..."></textarea>
          <button onclick="updateMockData()">Update Mock Data</button>
          <button onclick="resetMockData()">Reset Mock Data</button>
        </div>
        <script>
          // Trigger initial load after setting up listeners
          if (document.readyState === 'complete') { refreshImage(); } else { window.addEventListener('load', refreshImage); }
        </script>
      </body>
      </html>
    `;

    res.send(html);
  } catch (error) {
    console.error("Error rendering component preview page:", error);
    res.status(500).send(`Error rendering component preview: ${error.message}`);
  }
});

// Serve component image separately
app.get("/:componentName/image", async (req, res) => {
  try {
    const { componentName } = req.params;
    // --- Log Received Query Parameters ---
    console.log("Received query parameters:", req.query);
    const forceInit = req.query.forceInit === "true";
    console.log(`Parsed forceInit flag: ${forceInit}`); // Log parsed value
    // --- End Logging ---
    const lang = req.query.lang || "en";
    const mode = req.query.mode || "transfer";
    const type = req.query.type || "chat";
    const debug = req.query.debug === "true";
    const theme = req.query.theme || "dark";
    const isDarkTheme = theme === "dark";
    const componentPath = path.join(COMPONENTS_DIR, `${componentName}.jsx`);

    // --- Import Component with aggressive cache clearing ---
    // Clear require cache for the component
    delete require.cache[componentPath];

    // Clear all related module caches to prevent stale dependencies
    const moduleKeys = Object.keys(require.cache);
    for (const key of moduleKeys) {
      if (key.includes("components") && key.endsWith(".jsx")) {
        delete require.cache[key];
      }
    }

    // Also clear ES module cache by using dynamic import with timestamp
    const imported = await import(`file://${componentPath}?t=${Date.now()}`);
    const Component = imported.default;
    if (!Component) throw new Error(`Component not found in ${componentPath}`);

    // --- Parse Mock Data from Query ---
    let customMockData = {};
    if (req.query.mockData) {
      try {
        customMockData = JSON.parse(req.query.mockData);
        console.log("Parsed custom mock data:", customMockData);
      } catch (error) {
        console.error("Error parsing mockData parameter:", error);
      }
    }

    console.log(
      `Rendering ${componentName} with locale: ${lang}, mode: ${mode}, type: ${type}, debug: ${debug}, theme: ${theme}`
    );

    // Use custom mock data if provided, otherwise generate default
    let mockData;
    if (req.query.mockData && customMockData) {
      console.log("Using custom mock data as base");
      mockData = customMockData;
      // Ensure locale and debug are set for custom data
      if (mockData) {
        mockData.locale = lang;
        mockData.debug = debug;
      }

      // Apply mode/type/theme settings to custom mock data
      if (componentName === "Transfer" && mockData) {
        mockData.isDeposit = mode === "deposit";
        mockData.isTransfer = mode === "transfer";

        // Update fee amount based on transaction amount and mode
        const transactionAmount = mockData.amount || 100;
        if (mode === "deposit" || mode === "withdraw") {
          mockData.feeAmount = transactionAmount * 0.05; // 5% fee
        } else {
          mockData.feeAmount = 0; // No fee for transfers
        }

        // Update guild vault balance based on mode
        if (!mockData.guildVault) {
          mockData.guildVault = {
            balance: 125.75,
            totalFees: 250.5,
            lastDistribution: new Date(Date.now() - 3600000).toISOString(),
          };
        }

        // Adjust vault balance based on operation
        if (mode === "deposit" || mode === "withdraw") {
          mockData.guildVault.balance += mockData.feeAmount;
          mockData.guildVault.totalFees += mockData.feeAmount;
        }
      }
      if (componentName === "LevelUp" && mockData) {
        mockData.type = type;
      }
      if (componentName === "UpgradesDisplay" && mockData) {
        // Apply theme settings for specific components if needed
        mockData.coloring = isDarkTheme
          ? {
              /* dark theme colors */
            }
          : {
              /* light theme colors */
            };
      }

      // Ensure i18n is properly set for custom data
      if (!mockData.i18n || typeof mockData.i18n.__ !== "function") {
        mockData.i18n = createI18nMock(lang, Component);
      }
      if (mockData.i18n) mockData.i18n.initialized = true;
    } else {
      console.log("Using generated mock data as base");
      mockData = await createMockData(lang, Component);

      // Apply mode/type/theme/debug settings to mockData
      if (componentName === "Transfer" && mockData) {
        mockData.isDeposit = mode === "deposit";
        mockData.isTransfer = mode === "transfer";

        // Update fee amount based on transaction amount and mode
        const transactionAmount = mockData.amount || 100;
        if (mode === "deposit" || mode === "withdraw") {
          mockData.feeAmount = transactionAmount * 0.05; // 5% fee
        } else {
          mockData.feeAmount = 0; // No fee for transfers
        }

        // Update guild vault balance based on mode
        if (!mockData.guildVault) {
          mockData.guildVault = {
            balance: 125.75,
            totalFees: 250.5,
            lastDistribution: new Date(Date.now() - 3600000).toISOString(),
          };
        }

        // Adjust vault balance based on operation
        if (mode === "deposit" || mode === "withdraw") {
          mockData.guildVault.balance += mockData.feeAmount;
          mockData.guildVault.totalFees += mockData.feeAmount;
        }
      }
      if (componentName === "LevelUp" && mockData) {
        mockData.type = type;
      }
      mockData.debug = debug;
      if (componentName === "UpgradesDisplay" && mockData) {
        // Apply theme settings for specific components if needed
        mockData.coloring = isDarkTheme
          ? {
              /* dark theme colors */
            }
          : {
              /* light theme colors */
            };
      }
    }

    // Log the mock data that will be passed to generateImage
    console.log(
      "Mock data to be used in generateImage:",
      JSON.stringify(mockData, null, 2)
    );

    // --- 3D Rendering Check ---
    let threeDImageData = null;
    if (Component.requires3D) {
      console.log(`Using fixed session ID for ${componentName}: ${sessionId}`);

      const threeScriptPath = componentPath.replace(".jsx", ".three.js");
      let getScriptContent = null;
      try {
        // Clear cache for 3D script as well
        delete require.cache[threeScriptPath];

        // Use aggressive cache busting for 3D scripts too
        const uniqueId = Date.now() + Math.random();
        const scriptModule = await import(
          `file://${threeScriptPath}?t=${uniqueId}&cache=${uniqueId}`
        );
        getScriptContent = scriptModule.default;
        if (typeof getScriptContent !== "function")
          throw new Error(".three.js must export default func");
      } catch (scriptError) {
        throw new Error(`Could not load 3D script: ${scriptError.message}`);
      }

      // Prepare options for Puppeteer, using controlValues
      const userAvatarUrl = mockData.interaction?.user?.avatarURL;
      let modelColor = null,
        backgroundColorHex = "#2B2D31",
        ambientLightIntensity = 0.5,
        directionalLightIntensity = 0.8;
      if (userAvatarUrl) {
        try {
          const colorData = await processImageColors(userAvatarUrl);
          if (colorData.embedColor && colorData.embedColor.startsWith("#")) {
            const hex = colorData.embedColor.slice(1);
            const r = parseInt(hex.slice(0, 2), 16);
            const g = parseInt(hex.slice(2, 4), 16);
            const b = parseInt(hex.slice(4, 6), 16);
            modelColor = (r << 16) + (g << 8) + b;
            backgroundColorHex = colorData.embedColor;
            if (colorData.isDarkText) {
              // Light background
              ambientLightIntensity = 0.8;
              directionalLightIntensity = 0.6;
            } else {
              // Dark background
              ambientLightIntensity = 0.4;
              directionalLightIntensity = 1.0;
            }
          }
        } catch (colorError) {
          console.warn(`Preview: Error processing avatar colors:`, colorError);
        }
      }

      const renderOptions = {
        // Use values from controls or defaults
        modelType: controlValues.modelType || "cube",
        rotationX: controlValues.rotationX ?? 0.5, // Use ?? for 0 value
        rotationY: controlValues.rotationY ?? 0.5,
        width: Component.dimensions?.width || 600,
        height: Component.dimensions?.height || 400,
        modelColor: modelColor,
        backgroundColor: backgroundColorHex,
        ambientLightIntensity: ambientLightIntensity,
        directionalLightIntensity: directionalLightIntensity,
        // Pass *all* control values to the script, it might use them
        ...controlValues,
        forceInit: forceInit,
      };
      // Generate the script using the *current* renderOptions
      renderOptions.initializationScript = getScriptContent(renderOptions);

      console.log(
        "Calling Puppeteer renderUpdate with options:",
        renderOptions
      );
      threeDImageData = await renderUpdate(sessionId, renderOptions);
      console.log("Puppeteer rendering complete for preview.");
      mockData.imageData = threeDImageData;
    }
    // --- End 3D Rendering Check ---

    // Validate i18n
    if (!mockData.i18n || typeof mockData.i18n.__ !== "function")
      mockData.i18n = createI18nMock(lang, Component);
    if (mockData.i18n) mockData.i18n.initialized = true;

    // Generate final image via external rendering service
    let buffer;
    let formattedProps = null;
    try {
      buffer = await generateImage(
        Component,
        mockData,
        { image: 2, emoji: 2, debug: debug },
        mockData.i18n,
        { disableThrottle: true }
      );
      if (!buffer || !Buffer.isBuffer(buffer))
        throw new Error("Generated image invalid");
    } catch (renderError) {
      console.error(
        "Error fetching rendered image from render service:",
        renderError
      );

      // Extract formattedProps from enhanced error object
      if (renderError.formattedProps) {
        formattedProps = renderError.formattedProps;
      }

      // Send enhanced error response with formattedProps
      res.status(500).json({
        error: "Render service failed",
        message:
          renderError.message || renderError.error?.message || "Unknown error",
        formattedProps: formattedProps,
        stack: renderError.stack || renderError.error?.stack,
      });
      return;
    }

    // Send response
    const isGif =
      buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46;
    res.setHeader("Content-Type", isGif ? "image/gif" : "image/avif");
    res.send(buffer);
  } catch (error) {
    console.error("Error in /image route:", error);
    // No explicit session closing needed here - timeout handles it
    res.status(500).send(`Error rendering component image: ${error.message}`);
  }
});

// Add endpoint to get the mock data used for rendering
app.get("/:componentName/mockData", async (req, res) => {
  try {
    const { componentName } = req.params;
    const lang = req.query.lang || "en";
    const mode = req.query.mode || "transfer";
    const type = req.query.type || "chat";
    const debug = req.query.debug === "true";
    const theme = req.query.theme || "dark";
    const isDarkTheme = theme === "dark";
    const componentPath = path.join(COMPONENTS_DIR, `${componentName}.jsx`);

    // Import component
    delete require.cache[componentPath];
    const imported = await import(`file://${componentPath}?t=${Date.now()}`);
    const Component = imported.default;
    if (!Component) throw new Error(`Component not found in ${componentPath}`);

    // Parse Mock Data from Query
    let customMockData = {};
    if (req.query.mockData) {
      try {
        customMockData = JSON.parse(req.query.mockData);
        console.log("Parsed custom mock data:", customMockData);
      } catch (error) {
        console.error("Error parsing mockData parameter:", error);
      }
    }

    // Use custom mock data if provided, otherwise generate default
    let mockData;
    if (Object.keys(customMockData).length > 0) {
      console.log("Using custom mock data as base");
      mockData = customMockData;
    } else {
      console.log("Using generated mock data as base");
      mockData = await createMockData(lang, Component);
    }

    // Apply mode/type/theme/debug settings to mockData
    if (componentName === "Transfer" && mockData) {
      mockData.isDeposit = mode === "deposit";
      mockData.isTransfer = mode === "transfer";
    }
    if (componentName === "LevelUp" && mockData) {
      mockData.type = type;
    }
    mockData.debug = debug;

    // Return the mock data as JSON
    res.setHeader("Content-Type", "application/json");
    res.send(JSON.stringify(mockData, null, 2));
  } catch (error) {
    console.error("Error in /mockData route:", error);
    res.status(500).send(`Error retrieving mock data: ${error.message}`);
  }
});

// Add endpoint to get component configuration
app.get("/components/config", async (req, res) => {
  try {
    const components = await getAvailableComponents();
    const configs = {};

    for (const componentName of components) {
      const componentPath = path.join(COMPONENTS_DIR, `${componentName}.jsx`);

      try {
        delete require.cache[componentPath];
        const imported = await import(
          `file://${componentPath}?t=${Date.now()}`
        );
        const Component = imported.default;

        if (Component && Component.previewControls) {
          configs[componentName] = {
            name: componentName,
            previewControls: Component.previewControls,
          };
        }
      } catch (error) {
        console.error(`Error loading component ${componentName}:`, error);
        // Skip this component but continue with others
      }
    }

    res.json({
      components: configs,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error in /components/config route:", error);
    res.status(500).json({
      error: `Error getting component configurations: ${error.message}`,
    });
  }
});

// Add endpoint to get specific component configuration
app.get("/components/:componentName/config", async (req, res) => {
  try {
    const { componentName } = req.params;
    const componentPath = path.join(COMPONENTS_DIR, `${componentName}.jsx`);

    try {
      await fs.access(componentPath);
    } catch {
      return res
        .status(404)
        .json({ error: `Component ${componentName} not found` });
    }

    let Component = null;
    try {
      delete require.cache[componentPath];
      const imported = await import(`file://${componentPath}?t=${Date.now()}`);
      Component = imported.default;
    } catch (importError) {
      return res
        .status(500)
        .json({ error: `Error importing component: ${importError.message}` });
    }

    if (!Component) {
      return res
        .status(500)
        .json({ error: `Component not found in ${componentPath}` });
    }

    const config = {
      name: componentName,
      previewControls: Component.previewControls || [],
    };

    res.json(config);
  } catch (error) {
    console.error("Error in /components/:componentName/config route:", error);
    res
      .status(500)
      .json({ error: `Error getting component config: ${error.message}` });
  }
});

// Add health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "preview",
    timestamp: new Date().toISOString(),
  });
});

// Start server if run directly
if (import.meta.main) {
  const PORT = process.env.PREVIEW_PORT || 3008;
  const server = app.listen(PORT, () => {
    console.log(`🔧 Component preview server running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`🖼️  Preview: http://localhost:${PORT}`);
  });

  // Handle WebSocket upgrades
  server.on("upgrade", (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  });
}

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
