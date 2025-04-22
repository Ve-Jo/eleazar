import { Groq } from "groq-sdk";
import CONFIG from "../config/aiConfig.js";
import { state } from "../state/state.js";

// Build and cache Groq models from CONFIG
export async function fetchGroqModels() {
  if (state.groqModelsCache.models.length > 0) {
    return state.groqModelsCache.models;
  }
  const allowedText = new Set(CONFIG.groq.models.text || []);
  const allowedVision = new Set(CONFIG.groq.models.vision || []);
  const allModels = new Set([...allowedText, ...allowedVision]);
  const processed = [];
  for (const id of allModels) {
    processed.push({
      id,
      name: id,
      provider: "groq",
      capabilities: {
        text: true,
        vision: allowedVision.has(id),
        supportsTools: true,
      },
      get size() {
        return extractModelSize(id, id);
      },
    });
  }
  state.groqModelsCache.models = processed;
  state.groqModelsCache.lastFetched = Date.now();
  return processed;
}

// Extract numeric size from model id/name
export function extractModelSize(id, name) {
  const match = `${id} ${name}`.match(/(\d+)b\b/i);
  return match ? Number(match[1]) : 0;
}

// Return list of models, filtering by vision capability if requested
export async function getAvailableModels(isVision = false) {
  await fetchGroqModels();
  return state.groqModelsCache.models.filter((m) =>
    isVision ? m.capabilities.vision : true
  );
}

// Pick a default model for a given type (text or vision)
export function getAvailableModel(type) {
  return CONFIG.groq.models[type][0];
}

// Set a cooldown in state for a specific model
export function updateModelCooldown(modelType, modelName, retryAfter) {
  state.modelRateLimits = state.modelRateLimits || {};
  state.modelRateLimits[modelName] = Date.now() + retryAfter * 1000;
}

// Check if a model supports tools and vision
export async function getModelCapabilities(modelId) {
  const capabilities = { text: true, vision: false, supportsTools: false };
  const isVision = CONFIG.groq.models.vision.includes(modelId);
  capabilities.vision = isVision;
  capabilities.supportsTools = true;
  return capabilities;
}

// Create or retrieve an API client for a given model
export async function getApiClientForModel(modelId) {
  let provider = "groq";
  let clientInstance;
  // Ensure groq client exists
  if (!state.groqClient) {
    state.groqClient = new Groq({ apiKey: CONFIG.groq.apiKey });
  }
  clientInstance = state.groqClient;
  return { provider, client: clientInstance, apiKey: CONFIG.groq.apiKey };
}
