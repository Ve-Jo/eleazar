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
