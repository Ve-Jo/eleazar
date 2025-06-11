/**
 * Unified AI API
 *
 * This file provides a single import point for all AI-related functionality.
 * Instead of importing from multiple files, just import from here.
 */

// Import from services
import {
  // Client management
  initializeApiClients,

  // Model retrieval
  getAvailableModels,
  getModelDetails,
  getModelCapabilities,
  getApiClientForModel,

  // Rate limiting
  updateModelCooldown,
  checkModelRateLimit,

  // Capabilities
  markModelAsNotSupportingTools as _markModelNoTools,
  supportsReasoning as _modelSupportsReasoning,
} from "./services/ai/aiService.js";

// Import from state
import {
  // State access
  state,

  // User preferences
  getUserPreferences,
  updateUserPreference,
  clearUserHistory,
  addConversationToHistory,

  // Model status checks
  isModelRateLimited,
  setModelRateLimit,
  isModelWithoutTools,
  supportsReasoning,
  markModelAsNotSupportingTools,
} from "./services/ai/index.js";

// Import from services/messages.js
import {
  // Message handling
  splitMessage,
  buildInteractionComponents,
  sendResponse,
  handleFinetuneModal,
} from "./services/ai/messages.js";

// Import from services/tools.js
import {
  // Tool handling
  generateToolsFromCommands,
} from "./services/ai/tools.js";

// Re-export everything with clear categories
export {
  // ----- STATE -----
  // Global state object
  state,

  // ----- USER PREFERENCES -----
  // User settings and history
  getUserPreferences,
  updateUserPreference,
  clearUserHistory,
  addConversationToHistory,

  // ----- MODEL MANAGEMENT -----
  // Client initialization
  initializeApiClients,

  // Model retrieval and information
  getAvailableModels,
  getModelDetails,
  getModelCapabilities,
  getApiClientForModel,

  // ----- MODEL STATUS -----
  // Rate limiting
  isModelRateLimited,
  setModelRateLimit,

  // Capability checks
  isModelWithoutTools,
  supportsReasoning,
  markModelAsNotSupportingTools,

  // ----- MESSAGE HANDLING -----
  splitMessage,
  buildInteractionComponents,
  sendResponse,

  // ----- TOOL HANDLING -----
  generateToolsFromCommands,
  handleFinetuneModal,
};

// Simple helper function for checking if a model is valid and available
export async function isModelAvailable(client, modelId) {
  try {
    const model = await getModelDetails(client, modelId);
    return !!model;
  } catch (error) {
    console.error(`Error checking if model ${modelId} is available:`, error);
    return false;
  }
}
