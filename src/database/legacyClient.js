import { PrismaClient } from "@prisma/client";
import _ from "lodash";

// Initialize a shared Prisma Client instance
let prisma;
try {
  prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    log:
      process.env.NODE_ENV === "development" ? ["query", "error"] : ["error"],
  });
} catch (error) {
  console.error("Error initializing Prisma client:", error);
  // Create a mock client for fallback
  prisma = {
    legacyGameData: {
      findUnique: async () => null,
      create: async (data) => ({ data: JSON.stringify({}) }),
      update: async () => ({}),
    },
  };
}

// Default schemas for different games
export const DEFAULT_GAME_SCHEMAS = {
  rpg_clicker2: {
    class_stats: {
      sword_level: 1,
      sword: 60,
      sword_max: 60,
      daggers: 45,
      daggers_max: 45,
      ninja_level: 1,
      shield_level: 1,
      shield: 20,
      shield_max: 20,
      magic_max: 1,
      magic_upgrade: 1,
      magic_level: 1,
      mana: 30,
      mana_max: 30,
      bow_level: 1,
      arrows: 60,
      arrows_max: 60,
      durability_level: 1,
      backpack_level: 1,
      health_max_level: 1,
      crit_percent: 8,
      health_bottle: 0,
      durability_bottle: 0,
      mana_bottle: 0,
      bomb: 0,
      ammo_box: 0,
      combo: 0,
    },
    user: {
      home: 1,
      gold: 0,
      level: 1,
      xp: 0,
      mobile: 0,
      health_max: 20,
      health_current: 20,
    },
    global_mob: {
      here: 0,
      name: null,
      health_max: 0,
      health: 0,
      aim: 0,
      armor: 0,
      damage: 0,
      regeneration: 0,
    },
    class: {
      name: null,
      aim: 0,
      regeneration: 0,
      defence: 0,
      health: 0,
      aim_level: 1,
      regeneration_level: 1,
      health_level: 1,
    },
    stones: {
      name: null,
      level: 0,
      max_bonus: 0,
      xp_bonus: 0,
      gold_bonus: 0,
      health_bonus: 0,
      regeneration_bonus: 0,
    },
    mob: {
      here: 0,
      name: null,
      level: 1,
      damage: 0.5,
      aim: 1,
      health_max: 20,
      health: 20,
      regeneration: 0,
      defence: 0,
    },
    location: {
      level: 1,
      name: "Дебри",
      wallpaper_link: null,
      inactive: 0,
      fixed_distance: 0,
      distance: 0,
      distance_to: 100,
    },
    boss: {
      here: 0,
      name: null,
      health_max: 0,
      health: 0,
      aim: 0,
      armor: 0,
      damage: 0,
      regeneration: 0,
    },
  },
};

// In-memory cache for when DB operations fail
const memoryCache = new Map();

// Helper function to safely parse JSON, returning default if error
const safeJsonParse = (jsonString, defaultValue = {}) => {
  try {
    return JSON.parse(jsonString);
  } catch (e) {
    // console.warn("Failed to parse legacy JSON data:", e);
    return defaultValue;
  }
};

/**
 * Fetches or creates the legacy game data record for a specific user and game.
 * @param {string} guildId
 * @param {string} userId
 * @param {string} gameId
 * @returns {Promise<object>} The legacy game data object (parsed JSON).
 */
async function getLegacyGameData(guildId, userId, gameId) {
  const cacheKey = `${guildId}:${userId}:${gameId}`;

  try {
    // First check memory cache
    if (memoryCache.has(cacheKey)) {
      return memoryCache.get(cacheKey);
    }

    // Try to find existing data in database
    let legacyData;
    try {
      legacyData = await prisma.legacyGameData.findUnique({
        where: {
          userId_guildId_gameId: {
            userId,
            guildId,
            gameId,
          },
        },
        select: { data: true },
      });
    } catch (dbError) {
      console.error("Error querying legacy game data:", dbError);
      legacyData = null;
    }

    // If no data found, create new record with default schema
    if (!legacyData) {
      const defaultData = DEFAULT_GAME_SCHEMAS[gameId] || {};

      try {
        legacyData = await prisma.legacyGameData.create({
          data: {
            userId,
            guildId,
            gameId,
            data: JSON.stringify(defaultData), // Use default schema for this game
          },
          select: { data: true },
        });

        console.log(
          `Created new legacy game data for ${gameId} (${guildId}/${userId})`
        );
      } catch (createError) {
        console.error("Error creating legacy game data:", createError);

        // If DB creation fails, use default data and cache it in memory
        const defaultData = DEFAULT_GAME_SCHEMAS[gameId] || {};
        memoryCache.set(cacheKey, defaultData);
        return defaultData;
      }
    }

    // Parse and return data
    const result =
      typeof legacyData?.data === "string"
        ? safeJsonParse(legacyData.data, DEFAULT_GAME_SCHEMAS[gameId] || {})
        : legacyData?.data || DEFAULT_GAME_SCHEMAS[gameId] || {};

    // Cache the result
    memoryCache.set(cacheKey, result);
    return result;
  } catch (error) {
    console.error(
      `Error getting legacy game data for ${gameId} (${guildId}/${userId}):`,
      error
    );
    // Return default schema on error
    const defaultData = DEFAULT_GAME_SCHEMAS[gameId] || {};
    memoryCache.set(cacheKey, defaultData);
    return defaultData;
  }
}

/**
 * Updates the entire JSON data for a legacy game record.
 * @param {string} guildId
 * @param {string} userId
 * @param {string} gameId
 * @param {object} data The complete data object to save.
 * @returns {Promise<boolean>} Success status.
 */
async function setLegacyGameData(guildId, userId, gameId, data) {
  const cacheKey = `${guildId}:${userId}:${gameId}`;

  try {
    // Always update the memory cache first for immediate access
    memoryCache.set(cacheKey, data);

    // Check if record exists first
    let exists;
    try {
      exists = await prisma.legacyGameData.findUnique({
        where: {
          userId_guildId_gameId: { userId, guildId, gameId },
        },
        select: { id: true },
      });
    } catch (findError) {
      console.error("Error checking if legacy game data exists:", findError);
      // Return true because we've already updated the memory cache
      return true;
    }

    try {
      if (exists) {
        // Update existing record
        await prisma.legacyGameData.update({
          where: {
            userId_guildId_gameId: { userId, guildId, gameId },
          },
          data: {
            data: JSON.stringify(data), // Store as JSON string
          },
        });
      } else {
        // Create a new record
        await prisma.legacyGameData.create({
          data: {
            userId,
            guildId,
            gameId,
            data: JSON.stringify(data || DEFAULT_GAME_SCHEMAS[gameId] || {}),
          },
        });
      }
    } catch (dbError) {
      console.error("Error saving legacy game data to database:", dbError);
      // Return true because we've already updated the memory cache
      return true;
    }

    return true;
  } catch (error) {
    console.error(
      `Error setting legacy game data for ${gameId} (${guildId}/${userId}):`,
      error
    );
    return false;
  }
}

/**
 * Retrieves a specific value from the legacy game data JSON using a dot-notation key.
 * @param {string} guildId
 * @param {string} userId
 * @param {string} gameId
 * @param {string} key Dot-notation key (e.g., "user.level").
 * @param {any} defaultValue Default value if key not found.
 * @returns {Promise<any>}
 */
async function getLegacyValue(
  guildId,
  userId,
  gameId,
  key,
  defaultValue = undefined
) {
  const data = await getLegacyGameData(guildId, userId, gameId);
  return _.get(data, key, defaultValue);
}

/**
 * Sets a specific value within the legacy game data JSON using a dot-notation key.
 * Creates nested objects if they don't exist.
 * @param {string} guildId
 * @param {string} userId
 * @param {string} gameId
 * @param {string} key Dot-notation key (e.g., "user.level").
 * @param {any} value The value to set.
 * @returns {Promise<boolean>} Success status.
 */
async function setLegacyValue(guildId, userId, gameId, key, value) {
  // Get current data from cache if possible
  const cacheKey = `${guildId}:${userId}:${gameId}`;
  const cachedData = memoryCache.get(cacheKey);

  let data;
  if (cachedData) {
    // Use cached data if available
    data = cachedData;
  } else {
    // Otherwise fetch from database
    data = await getLegacyGameData(guildId, userId, gameId);
  }

  // Update the value
  _.set(data, key, value);

  // Save the updated data
  return setLegacyGameData(guildId, userId, gameId, data);
}

/**
 * Increments a numeric value within the legacy game data JSON.
 * @param {string} guildId
 * @param {string} userId
 * @param {string} gameId
 * @param {string} key Dot-notation key.
 * @param {number} amount Amount to increment by (defaults to 1).
 * @returns {Promise<boolean>} Success status.
 */
async function incLegacyValue(guildId, userId, gameId, key, amount = 1) {
  // Get current data from cache if possible
  const cacheKey = `${guildId}:${userId}:${gameId}`;
  const cachedData = memoryCache.get(cacheKey);

  let data;
  if (cachedData) {
    // Use cached data if available
    data = cachedData;
  } else {
    // Otherwise fetch from database
    data = await getLegacyGameData(guildId, userId, gameId);
  }

  // Get current value with default 0
  const currentValue = _.get(data, key, 0);

  if (typeof currentValue === "number") {
    // Set the incremented value
    _.set(data, key, currentValue + amount);

    // Save the updated data
    return setLegacyGameData(guildId, userId, gameId, data);
  } else {
    console.warn(
      `Cannot increment non-numeric value at key '${key}' for ${gameId} (${guildId}/${userId})`
    );
    return false;
  }
}

/**
 * Decrements a numeric value within the legacy game data JSON.
 * @param {string} guildId
 * @param {string} userId
 * @param {string} gameId
 * @param {string} key Dot-notation key.
 * @param {number} amount Amount to decrement by (defaults to 1).
 * @returns {Promise<boolean>} Success status.
 */
async function decLegacyValue(guildId, userId, gameId, key, amount = 1) {
  return incLegacyValue(guildId, userId, gameId, key, -amount); // Reuse inc logic
}

/**
 * Deletes a key-value pair from the legacy game data JSON using a dot-notation key.
 * @param {string} guildId
 * @param {string} userId
 * @param {string} gameId
 * @param {string} key Dot-notation key.
 * @returns {Promise<boolean>} Success status.
 */
async function deleteLegacyValue(guildId, userId, gameId, key) {
  // Get current data from cache if possible
  const cacheKey = `${guildId}:${userId}:${gameId}`;
  const cachedData = memoryCache.get(cacheKey);

  let data;
  if (cachedData) {
    // Use cached data if available
    data = cachedData;
  } else {
    // Otherwise fetch from database
    data = await getLegacyGameData(guildId, userId, gameId);
  }

  // Use lodash.unset for safe deletion, even if path doesn't exist
  _.unset(data, key);

  // Save the updated data
  return setLegacyGameData(guildId, userId, gameId, data);
}

export default {
  get: getLegacyValue,
  set: setLegacyValue,
  inc: incLegacyValue,
  dec: decLegacyValue,
  delete: deleteLegacyValue,
  _getData: getLegacyGameData, // Expose for potential direct access if needed
  _setData: setLegacyGameData, // Expose for potential direct access if needed
};
