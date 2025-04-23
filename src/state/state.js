import CONFIG from "../config/aiConfig.js";

export const state = {
  userPreferences: {},
  groqModelsCache: {
    models: [],
    lastFetched: 0,
    cacheDuration: 3600 * 1000,
  },
  modelCapabilities: {},
  pendingInteractions: {},
  groqClient: null,
  modelRateLimits: {},
  modelToolSupportCache: new Map(), // Cache for tool support status
  modelsWithoutTools: new Set(), // Set of model IDs known not to support tools
};

export function isModelRateLimited(modelId) {
  if (!state.modelRateLimits[modelId]) {
    return false;
  }
  if (Date.now() > state.modelRateLimits[modelId]) {
    delete state.modelRateLimits[modelId];
    return false;
  }
  return true;
}

export function setModelRateLimit(modelId, durationMs = 60000) {
  state.modelRateLimits[modelId] = Date.now() + durationMs;
}

export function markModelAsNotSupportingTools(modelId) {
  state.modelsWithoutTools.add(modelId);
  state.modelToolSupportCache.set(modelId, false);
  console.log(`Added ${modelId} to list of models without tool support`);
}

export function isModelWithoutTools(modelId) {
  return state.modelsWithoutTools.has(modelId);
}
