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
  mining2: {
    player: {
      username: null,
      id: null,
      status: "playing",
      x: 0,
      y: 0,
      health: 100,
      health_max: 100,
      health_regen_speed: 0.01,
      blocks_broken: 0,
      attack_damage: 5,
      pickaxe: "stone",
      pickaxe_damage: 1,
      pickaxe_durability: 50,
      pickaxe_durability_max: 50,
      level: 1,
      xp: 0,
      xp_needed: 100,
      coins: 0,
      place_cooldown: 0,
      place_cooldown_max: 10,
      active_item: 1,
      inventory: [],
      travelling: false,
      travelling_progress: 0,
      travelling_to: 0,
      shop_cooldown: 0,
      shop_cooldown_max: 5,
      area_unlocked: 1,
      cooldown: 0,
      cooldown_max: 0.5,
      stats: {
        coins_spent: 0,
        blocks_placed: 0,
        blocks_broken: 0,
        mobs_killed: 0,
        deaths: 0,
        total_travelling_distance: 0,
        playtime: 0,
      },
      upgrades: {
        health: 1,
        damage: 1,
        pickaxe_durability: 1,
        cooldown: 1,
        shop_cooldown: 1,
        place_cooldown: 1,
        inventory_slots: 1,
      },
    },
    visible_area: {
      area: 1,
      x: 0,
      y: 0,
      width: 11,
      height: 11,
    },
    money: 0,
    inventory: { size: 0 },
    tools_inventory: { size: 0 },
    shopping: {
      status: 0,
      page: 0,
    },
    tools: {
      sword: {
        durability: 50,
        durability_max: 50,
        damage: 5,
      },
      vision: {
        number: 11,
      },
      backpack: {
        size: 10,
      },
      tools_backpack: {
        size: 5,
      },
    },
    selected_block: {},
    custom_block: {},
    custom_textures: [],
    blocks: [],
    mobs: [],
    destroyed: [],
    placed: {},
    destroying: {
      mob: 0,
      x: 0,
      y: 0,
      points: 0,
      points_max: 0,
    },
    modificators: {
      mobs_health: 1,
    },
    other: {
      latest_message_id: 0,
      latest_starting: 0,
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

// Add this helper function for safe JSON serialization
function safeParse(obj) {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  const seen = new WeakSet();

  function replacer(key, value) {
    if (key === "") return value; // Initial call

    if (value === null || typeof value !== "object") {
      return value;
    }

    if (seen.has(value)) {
      return "[Circular Reference]";
    }

    seen.add(value);
    return value;
  }

  // Use the replacer function to handle circular structures
  return JSON.parse(JSON.stringify(obj, replacer));
}

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
        // Try to upsert instead of just creating - this prevents unique constraint errors
        legacyData = await prisma.legacyGameData.upsert({
          where: {
            userId_guildId_gameId: {
              userId,
              guildId,
              gameId,
            },
          },
          update: {
            data: JSON.stringify(defaultData), // Update with default if it exists
          },
          create: {
            userId,
            guildId,
            gameId,
            data: JSON.stringify(defaultData), // Use default schema for this game
          },
          select: { data: true },
        });

        console.log(
          `Created/updated legacy game data for ${gameId} (${guildId}/${userId})`
        );
      } catch (upsertError) {
        console.error("Error upserting legacy game data:", upsertError);

        // If operation fails, try one more approach
        try {
          // Maybe the record was created in between our check and create attempt
          // Try to get it again
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

          if (!legacyData) {
            // If still not found, use default data and cache it in memory
            const defaultData = DEFAULT_GAME_SCHEMAS[gameId] || {};
            memoryCache.set(cacheKey, defaultData);
            return defaultData;
          }
        } catch (retryError) {
          console.error(
            "Error retrying to fetch legacy game data:",
            retryError
          );
          // If DB operations completely fail, use default data and cache it in memory
          const defaultData = DEFAULT_GAME_SCHEMAS[gameId] || {};
          memoryCache.set(cacheKey, defaultData);
          return defaultData;
        }
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
    // Use the safe serializer to handle circular references
    const safeData = safeParse(data);

    await prisma.legacyGameData.upsert({
      where: {
        userId_guildId_gameId: { userId, guildId, gameId },
      },
      update: {
        data: JSON.stringify(safeData || DEFAULT_GAME_SCHEMAS[gameId] || {}),
      },
      create: {
        userId,
        guildId,
        gameId,
        data: JSON.stringify(safeData || DEFAULT_GAME_SCHEMAS[gameId] || {}),
      },
    });
    return true;
  } catch (error) {
    console.error("Error upserting legacy game data to database:", error);
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
  console.log(
    `Setting ${gameId} value at path: ${key} = ${JSON.stringify(value)}`
  );

  // Get current data from cache if possible
  const cacheKey = `${guildId}:${userId}:${gameId}`;

  // Always get the full data to ensure we work with latest
  let data = await getLegacyGameData(guildId, userId, gameId);

  // Update the value
  _.set(data, key, value);

  // Update memory cache immediately
  memoryCache.set(cacheKey, data);

  // Save the updated data
  try {
    // Use the safe serializer to handle circular references
    const safeData = safeParse(data);

    const updated = await prisma.legacyGameData.upsert({
      where: {
        userId_guildId_gameId: { userId, guildId, gameId },
      },
      update: {
        data: JSON.stringify(safeData || DEFAULT_GAME_SCHEMAS[gameId] || {}),
      },
      create: {
        userId,
        guildId,
        gameId,
        data: JSON.stringify(safeData || DEFAULT_GAME_SCHEMAS[gameId] || {}),
      },
    });

    console.log(`Database updated for ${gameId}, path: ${key}`);
    return true;
  } catch (error) {
    console.error(`Error setting ${gameId} value at ${key}:`, error);
    // Still return true because memory cache was updated
    return true;
  }
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
