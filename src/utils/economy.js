import { Pool } from "pg";

let pool;

const DB_MAX_RETRIES = 4;
const DB_INITIAL_DELAY = 1500;

// Define default values for all possible fields
const DEFAULT_VALUES = {
  // Guild level defaults
  counting: {
    channel_id: "0",
    message: 1,
    pinoneach: 0,
    pinnedrole: "0",
    only_numbers: false,
    lastpinnedmember: "0",
    no_same_user: false,
    no_unique_role: false,
    lastwritter: "0",
  },
  levels: {
    xp_per_message: 1,
    message_cooldown: 60,
    multiplier: 100,
  },

  // User level defaults
  balance: 0,
  bank: 0,
  total_xp: 0,
  banner_url: null,
  latest_activity: () => new Date(),
  daily: 0,
  work: 0,
  crime: 0,
  message: 0,
  total_messages: 0,
  commands_used: 0,
  total_earned: 0,
  upgrades: {
    daily: { level: 1 },
    crime: { level: 1 },
  },
};

// Cooldown configurations
const COOLDOWNS = {
  crime: {
    base: 8 * 60 * 60 * 1000, // 8 hours
    min: 2 * 60 * 60 * 1000, // 2 hours minimum
    reduction: 20 * 60 * 1000, // 20 minutes per level
  },
  daily: 24 * 60 * 60 * 1000, // 24 hours
  message: 60 * 1000, // 1 minute
};

// Shop configurations
const UPGRADES = {
  daily: {
    id: 0,
    emoji: "💰",
    basePrice: 20,
    priceMultiplier: 1.5,
    effectMultiplier: 0.15, // 15% increase per level
  },
  crime: {
    id: 1,
    emoji: "⏳",
    basePrice: 50,
    priceMultiplier: 1.2,
    effectValue: 20 * 60 * 1000, // 20 minutes reduction per level
  },
};

async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function createConnection() {
  let retries = 0;

  while (true) {
    try {
      console.log("Attempting to connect to public database...");
      console.log("Connection URL:", process.env.PG_DATABASE_URL);

      pool = new Pool({
        connectionString: process.env.PG_DATABASE_URL,
      });

      // Test the connection
      await pool.query("SELECT 1");
      console.log("Connected to public database successfully");
      return pool;
    } catch (error) {
      retries++;

      console.error("Connection error details:", {
        message: error.message,
        code: error.code,
        detail: error.detail,
      });
      if (retries > DB_MAX_RETRIES) {
        console.error(
          "Max retries reached. Failed to connect to database:",
          error
        );
        throw error;
      }

      const backoffDelay = DB_INITIAL_DELAY * Math.pow(2, retries - 1);
      console.log(
        `Database connection attempt ${retries} failed, retrying in ${
          backoffDelay / 1000
        } seconds...`
      );

      await delay(backoffDelay);
    }
  }
}

class EconomyEZ {
  static async testDatabaseConnection() {
    try {
      await createConnection();
      await this.initializeDatabase();
      await this.executeQuery("SELECT 1");
      console.log(
        "Successfully connected to the database and initialized tables"
      );
    } catch (error) {
      console.error("Failed to connect to the database:", error);
      throw error;
    }
  }

  static async executeQuery(query, params = []) {
    if (!pool) {
      await createConnection();
    }
    try {
      const result = await pool.query(query, params);
      return result.rows;
    } catch (error) {
      console.error("Error executing query:", error);
      throw error;
    }
  }

  static async initializeDatabase() {
    try {
      await this.executeQuery(`
        CREATE TABLE IF NOT EXISTS key_value_store (
          key TEXT PRIMARY KEY,
          value JSONB NOT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create an index for faster prefix searches
      await this.executeQuery(`
        CREATE INDEX IF NOT EXISTS key_prefix_idx ON key_value_store USING btree(key text_pattern_ops)
      `);

      console.log("Database initialized successfully");
    } catch (error) {
      console.error("Error initializing database:", error);
      throw error;
    }
  }

  static getDefaultValue(field) {
    const value = DEFAULT_VALUES[field];
    return typeof value === "function" ? value() : value;
  }

  static isDefaultValue(field, value) {
    const defaultValue = this.getDefaultValue(field);

    // Handle nested objects (like counting or levels)
    if (typeof value === "object" && value !== null) {
      if (typeof defaultValue !== "object") return false;

      // Check if all properties in the object match their default values
      return Object.entries(value).every(([key, val]) => {
        const defVal = defaultValue[key];
        if (typeof val === "object" && val !== null) {
          return this.isDefaultValue(key, val);
        }
        return val === defVal;
      });
    }

    return (
      value === defaultValue ||
      (value === null && defaultValue === null) ||
      (typeof value === "number" && value === 0 && defaultValue === 0)
    );
  }

  static cleanupDefaultValues(data) {
    if (!data || typeof data !== "object") return data;

    const cleaned = { ...data };

    // Handle guild-level properties
    if (cleaned.counting && this.isDefaultValue("counting", cleaned.counting)) {
      delete cleaned.counting;
    }
    if (cleaned.levels && this.isDefaultValue("levels", cleaned.levels)) {
      delete cleaned.levels;
    }

    // Handle user data
    for (const [key, value] of Object.entries(cleaned)) {
      if (key !== "counting" && key !== "levels") {
        if (typeof value === "object" && value !== null) {
          const cleanedNested = this.cleanupDefaultValues(value);
          if (Object.keys(cleanedNested).length === 0) {
            delete cleaned[key];
          } else {
            cleaned[key] = cleanedNested;
          }
        } else if (this.isDefaultValue(key, value)) {
          delete cleaned[key];
        }
      }
    }

    return cleaned;
  }

  static applyDefaultValues(data, path = "") {
    if (!data || typeof data !== "object") return data;

    const result = { ...data };
    const parts = path.split(".");

    // If this is a guild path (only one part)
    if (parts.length === 1) {
      // Apply guild-level defaults
      if (!result.counting) {
        result.counting = this.getDefaultValue("counting");
      } else {
        // Ensure all counting properties have defaults
        result.counting = {
          ...this.getDefaultValue("counting"),
          ...result.counting,
        };
      }

      if (!result.levels) {
        result.levels = this.getDefaultValue("levels");
      } else {
        // Ensure all level properties have defaults
        result.levels = {
          ...this.getDefaultValue("levels"),
          ...result.levels,
        };
      }
      return result;
    }

    // If this is a user path (guildId.userId)
    if (parts.length === 2) {
      for (const [key, defaultValue] of Object.entries(DEFAULT_VALUES)) {
        if (key !== "counting" && key !== "levels") {
          if (result[key] === undefined) {
            result[key] = this.getDefaultValue(key);
          } else if (
            typeof defaultValue === "object" &&
            defaultValue !== null
          ) {
            // Handle nested user properties (like upgrades)
            result[key] = {
              ...this.getDefaultValue(key),
              ...result[key],
            };
          }
        }
      }
    }

    return result;
  }

  static async get(path) {
    if (!path) throw new Error("Path is required");

    const parts = path.split(".");
    const guildId = parts[0];

    try {
      const result = await this.executeQuery(
        `SELECT value FROM key_value_store WHERE key = $1`,
        [guildId]
      );

      // If no data exists in database
      if (!result[0]) {
        // Return appropriate default structure based on path
        return this.applyDefaultValues({}, path);
      }

      let data = result[0].value;

      // If requesting guild data
      if (parts.length === 1) {
        return this.applyDefaultValues(data, path);
      }

      // If requesting user data
      if (parts.length === 2) {
        data = data[parts[1]] || {};
        return this.applyDefaultValues(data, path);
      }

      // If requesting a specific field
      for (let i = 1; i < parts.length; i++) {
        if (!data || !data[parts[i]]) {
          if (i === parts.length - 1) {
            return this.getDefaultValue(parts[i]);
          }
          return null;
        }
        data = data[parts[i]];
      }
      return data;
    } catch (error) {
      console.error("Error getting data:", error);
      throw error;
    }
  }

  static async set(path, value) {
    if (!path) throw new Error("Path is required");

    const parts = path.split(".");
    const guildId = parts[0];

    try {
      let existingData = (await this.get(guildId)) || {};

      // If setting guild-level data directly
      if (parts.length === 1) {
        existingData = { ...existingData, ...value };
      } else {
        // Navigate to the correct nested location
        let current = existingData;
        for (let i = 1; i < parts.length - 1; i++) {
          current[parts[i]] = current[parts[i]] || {};
          current = current[parts[i]];
        }

        // Set the value
        if (parts.length > 1) {
          const lastKey = parts[parts.length - 1];
          current[parts[parts.length - 1]] = value;
        }
      }

      // Clean up and save
      const cleanedData = this.cleanupDefaultValues(existingData);

      // If all values are default, remove the record entirely
      if (Object.keys(cleanedData).length === 0) {
        await this.executeQuery(`DELETE FROM key_value_store WHERE key = $1`, [
          guildId,
        ]);
      } else {
        await this.executeQuery(
          `INSERT INTO key_value_store (key, value, updated_at)
           VALUES ($1, $2, CURRENT_TIMESTAMP)
           ON CONFLICT (key)
           DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP`,
          [guildId, cleanedData]
        );
      }

      return true;
    } catch (error) {
      console.error("Error setting data:", error);
      throw error;
    }
  }

  static async remove(path) {
    if (!path) throw new Error("Path is required");

    const parts = path.split(".");
    const guildId = parts[0];

    try {
      if (parts.length === 1) {
        // Remove entire guild data
        await this.executeQuery(`DELETE FROM key_value_store WHERE key = $1`, [
          guildId,
        ]);
        return true;
      }

      // Get existing data
      let existingData = await this.get(guildId);
      if (!existingData) return false;

      // Navigate to the parent of the target
      let current = existingData;
      for (let i = 1; i < parts.length - 1; i++) {
        if (!current[parts[i]]) return false;
        current = current[parts[i]];
      }

      // Remove the target key
      const lastKey = parts[parts.length - 1];
      if (current[lastKey] !== undefined) {
        delete current[lastKey];
        // Clean up and save the data
        const cleanedData = this.cleanupDefaultValues(existingData);
        if (Object.keys(cleanedData).length === 0) {
          await this.executeQuery(
            `DELETE FROM key_value_store WHERE key = $1`,
            [guildId]
          );
        } else {
          await this.set(guildId, cleanedData);
        }
        return true;
      }

      return false;
    } catch (error) {
      console.error("Error removing data:", error);
      throw error;
    }
  }

  static async math(path, operator, number) {
    if (!path) throw new Error("Path is required");
    if (typeof number !== "number") throw new Error("Number must be a number");

    try {
      const parts = path.split(".");
      const field = parts[parts.length - 1];

      // Get the default value for this field
      const defaultValue = this.getDefaultValue(field);
      if (typeof defaultValue !== "number") {
        throw new Error(`Field ${field} does not support math operations`);
      }

      // Get the current value, using default if not set
      const currentValue = await this.get(path);
      const numericValue =
        typeof currentValue === "number" ? currentValue : defaultValue;

      let newValue;
      switch (operator) {
        case "+":
          newValue = numericValue + number;
          break;
        case "-":
          newValue = numericValue - number;
          break;
        case "*":
          newValue = numericValue * number;
          break;
        case "/":
          if (number === 0) throw new Error("Division by zero");
          newValue = numericValue / number;
          break;
        default:
          throw new Error(`Unsupported operator: ${operator}`);
      }

      // Only save if the new value is different from the default
      if (newValue !== defaultValue) {
        await this.set(path, newValue);
      } else {
        // If the new value equals the default, remove it from storage
        await this.remove(path);
      }

      return newValue;
    } catch (error) {
      console.error("Error performing math operation:", error);
      throw error;
    }
  }

  static async listGuilds() {
    try {
      const result = await this.executeQuery(
        `SELECT key FROM key_value_store ORDER BY key`
      );
      return result.map((row) => row.key);
    } catch (error) {
      console.error("Error listing guilds:", error);
      throw error;
    }
  }

  static async search(prefix) {
    try {
      const result = await this.executeQuery(
        `SELECT key, value FROM key_value_store WHERE key LIKE $1 || '%'`,
        [prefix]
      );
      return result.map((row) => ({
        key: row.key,
        value: this.applyDefaultValues(row.value),
      }));
    } catch (error) {
      console.error("Error searching data:", error);
      throw error;
    }
  }

  // Cooldown Methods
  static async getCooldownTime(guildId, userId, type) {
    try {
      const userData = await this.get(`${guildId}.${userId}`);
      const currentTime = Date.now();

      if (type === "crime") {
        const crimeLevel = userData.upgrades.crime.level;
        const cooldownReduction = COOLDOWNS.crime.reduction * (crimeLevel - 1);
        const cooldownTime = Math.max(
          COOLDOWNS.crime.base - cooldownReduction,
          COOLDOWNS.crime.min
        );
        const timeLeft = userData.crime + cooldownTime - currentTime;
        return timeLeft > 0 ? timeLeft : 0;
      }

      if (type === "daily") {
        const timeLeft = userData.daily + COOLDOWNS.daily - currentTime;
        return timeLeft > 0 ? timeLeft : 0;
      }

      return 0;
    } catch (error) {
      console.error(`Error in getCooldownTime: ${error.message}`);
      return 0;
    }
  }

  static async isCooldownActive(guildId, userId, type) {
    const timeLeft = await this.getCooldownTime(guildId, userId, type);
    return timeLeft > 0;
  }

  // Shop Methods
  static getUpgradeInfo(type, level) {
    const upgrade = UPGRADES[type];
    if (!upgrade) return null;

    const price = Math.round(
      upgrade.basePrice * Math.pow(upgrade.priceMultiplier, level - 1)
    );
    let effect;

    if (type === "daily") {
      effect = (level - 1) * upgrade.effectMultiplier * 100; // Convert to percentage
    } else if (type === "crime") {
      effect = (level - 1) * (upgrade.effectValue / (60 * 1000)); // Convert to minutes
    }

    return {
      id: upgrade.id,
      emoji: upgrade.emoji,
      price,
      effect,
      level,
    };
  }

  static async getUpgrades(guildId, userId) {
    const userData = await this.get(`${guildId}.${userId}`);
    const upgrades = {};

    for (const [type, config] of Object.entries(UPGRADES)) {
      const level = userData.upgrades[type].level;
      upgrades[type] = this.getUpgradeInfo(type, level);
    }

    return upgrades;
  }

  static async purchaseUpgrade(guildId, userId, type) {
    const userData = await this.get(`${guildId}.${userId}`);
    const currentLevel = userData.upgrades[type].level;
    const upgradeInfo = this.getUpgradeInfo(type, currentLevel);

    if (userData.balance < upgradeInfo.price) {
      return { success: false, reason: "insufficient_funds" };
    }

    // Update balance and upgrade level
    await this.math(`${guildId}.${userId}.balance`, "-", upgradeInfo.price);
    await this.set(
      `${guildId}.${userId}.upgrades.${type}.level`,
      currentLevel + 1
    );

    return {
      success: true,
      newLevel: currentLevel + 1,
      cost: upgradeInfo.price,
    };
  }

  // Level Methods
  static calculateLevel(
    totalXp,
    multiplier = DEFAULT_VALUES.levels.multiplier
  ) {
    let level = 1;
    let xpForNextLevel = multiplier;
    let remainingXp = totalXp;
    let totalXpForCurrentLevel = 0;

    while (remainingXp >= xpForNextLevel) {
      remainingXp -= xpForNextLevel;
      totalXpForCurrentLevel += xpForNextLevel;
      level++;
      xpForNextLevel = level * multiplier;
    }

    return {
      level,
      currentXP: remainingXp,
      requiredXP: xpForNextLevel,
      totalXP: totalXp,
    };
  }

  static async addXP(guildId, userId, amount) {
    const [userData, guildData] = await Promise.all([
      this.get(`${guildId}.${userId}`),
      this.get(guildId),
    ]);

    const oldTotal = userData.total_xp;
    const newTotal = await this.math(
      `${guildId}.${userId}.total_xp`,
      "+",
      amount
    );

    const multiplier = guildData.levels.multiplier;
    const oldLevel = this.calculateLevel(oldTotal, multiplier).level;
    const newLevel = this.calculateLevel(newTotal, multiplier).level;

    return {
      oldLevel,
      newLevel,
      leveledUp: newLevel > oldLevel,
      total: newTotal,
    };
  }

  static async getGuildLevels(guildId) {
    const guildData = await this.get(guildId);
    return guildData.levels;
  }

  static async setGuildLevels(guildId, settings) {
    const guildData = await this.get(guildId);
    const updates = {
      ...guildData,
      levels: {
        ...guildData.levels,
        ...settings,
      },
    };
    await this.set(guildId, updates);
    return updates.levels;
  }
}

async function initializeDatabase() {
  await createConnection();
  await EconomyEZ.initializeDatabase();
  console.log("Database system initialized successfully");
}

export default EconomyEZ;
export {
  createConnection,
  initializeDatabase,
  COOLDOWNS,
  UPGRADES,
  DEFAULT_VALUES,
};
