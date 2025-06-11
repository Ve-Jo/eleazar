import CONFIG from "../../config/aiConfig.js";
import {
  checkModelRateLimit,
  updateModelCooldown,
  markModelAsNotSupportingTools as markModelNotSupportingTools,
  supportsReasoning as modelSupportsReasoning,
} from "./aiService.js";

/**
 * Global application state
 */
export const state = {
  // User-specific data
  userPreferences: {},
  pendingInteractions: {},

  // Model caching and capabilities
  modelCache: {
    models: [],
    lastFetched: 0,
    cacheDuration: 3600 * 1000, // 1 hour
  },

  // API clients
  clients: {},

  // Model status tracking
  modelStatus: {
    rateLimits: {}, // modelId -> timestamp when rate limit expires
    toolSupport: new Map(), // modelId -> boolean indicating tool support
    modelsWithoutTools: new Set(), // Set of model IDs known not to support tools
  },
};

/**
 * Check if a model is currently rate-limited
 * @param {string} modelId - The model identifier
 * @returns {boolean} - Whether the model is rate-limited
 */
export function isModelRateLimited(modelId) {
  // Use the new function from aiService.js
  const { isLimited } = checkModelRateLimit(modelId);
  return isLimited;
}

/**
 * Set a rate limit for a model
 * @param {string} modelId - The model identifier
 * @param {number} durationMs - Duration in milliseconds for the rate limit
 */
export function setModelRateLimit(modelId, durationMs = 60000) {
  // Use the new function from aiService.js
  updateModelCooldown(modelId, durationMs);
}

/**
 * Mark a model as not supporting tools
 * @param {string} modelId - The model identifier
 */
export function markModelAsNotSupportingTools(modelId) {
  // Use the new function from aiService.js
  markModelNotSupportingTools(modelId);
}

/**
 * Check if a model is known to not support tools
 * @param {string} modelId - The model identifier
 * @returns {boolean} - Whether the model is known not to support tools
 */
export function isModelWithoutTools(modelId) {
  // Check directly from the state
  return state.modelStatus.modelsWithoutTools.has(modelId);
}

/**
 * Check if a model supports reasoning capabilities
 * @param {string} modelId - The model identifier
 * @returns {boolean} - Whether the model supports reasoning
 */
export function supportsReasoning(modelId) {
  // Use the new function from aiService.js
  return modelSupportsReasoning(modelId);
}

/**
 * Get user preferences or create with defaults if not exists
 * @param {string} userId - The user ID
 * @returns {Object} - The user preferences object
 */
export function getUserPreferences(userId) {
  if (!state.userPreferences[userId]) {
    // Initialize with default values
    state.userPreferences[userId] = {
      selectedModel: null,
      systemPromptEnabled: true,
      toolsEnabled: true,
      reasoningEnabled: true,
      reasoningLevel: "medium", // Use a single string: 'off', 'low', 'medium', 'high'
      messageHistory: [],
      // Group all AI parameters together from config defaults
      aiParams: Object.fromEntries(
        Object.entries(CONFIG.aiParameters).map(([key, param]) => [
          key,
          param.default,
        ])
      ),
    };
  } else {
    // Make sure all parameters from config are present in existing user prefs
    // This handles cases where new parameters are added to the config
    const existingParams = state.userPreferences[userId].aiParams || {};
    state.userPreferences[userId].aiParams = {
      ...existingParams,
      ...Object.fromEntries(
        Object.entries(CONFIG.aiParameters)
          .filter(([key]) => existingParams[key] === undefined)
          .map(([key, param]) => [key, param.default])
      ),
    };

    // Add reasoning level if it doesn't exist
    if (!state.userPreferences[userId].hasOwnProperty("reasoningLevel")) {
      state.userPreferences[userId].reasoningLevel = "medium";
    }

    // Handle legacy reasoningSettings format conversion
    if (state.userPreferences[userId].hasOwnProperty("reasoningSettings")) {
      // If using old format, convert to new format and remove old
      if (!state.userPreferences[userId].hasOwnProperty("reasoningLevel")) {
        const settings = state.userPreferences[userId].reasoningSettings;
        if (!state.userPreferences[userId].reasoningEnabled) {
          state.userPreferences[userId].reasoningLevel = "off";
        } else {
          state.userPreferences[userId].reasoningLevel =
            settings?.effort || "medium";
        }
      }
      // Remove the old settings
      delete state.userPreferences[userId].reasoningSettings;
    }

    // Add reasoningEnabled if it doesn't exist (backward compatibility)
    if (!state.userPreferences[userId].hasOwnProperty("reasoningEnabled")) {
      state.userPreferences[userId].reasoningEnabled =
        state.userPreferences[userId].reasoningLevel !== "off";
    }
  }
  return state.userPreferences[userId];
}

/**
 * Update a specific user preference
 * @param {string} userId - The user ID
 * @param {string} key - The preference key to update
 * @param {any} value - The new value
 * @returns {Object} - The updated user preferences
 */
export function updateUserPreference(userId, key, value) {
  const prefs = getUserPreferences(userId);
  prefs[key] = value;
  return prefs;
}

/**
 * Clear conversation history for a user
 * @param {string} userId - The user ID
 */
export function clearUserHistory(userId) {
  getUserPreferences(userId).messageHistory = [];
  console.log(`Cleared message history for user ${userId}`);
}

/**
 * Add a conversation exchange to user history
 * @param {string} userId - The user ID
 * @param {string} userMessage - The user's message
 * @param {string} aiResponse - The AI's response
 */
export function addConversationToHistory(userId, userMessage, aiResponse) {
  const prefs = getUserPreferences(userId);

  // Add messages to history
  prefs.messageHistory.push({ role: "user", content: userMessage });
  prefs.messageHistory.push({ role: "assistant", content: aiResponse });

  // Trim history if it exceeds the maximum context length
  const maxPairs = CONFIG.maxContextLength || 4;
  if (prefs.messageHistory.length > maxPairs * 2) {
    // Determine if we have a system message to preserve
    const hasSystemMessage =
      prefs.systemPromptEnabled &&
      prefs.messageHistory.some((m) => m.role === "system");

    // Remove oldest user-assistant pair, preserving system message if present
    prefs.messageHistory.splice(hasSystemMessage ? 1 : 0, 2);
  }
}
