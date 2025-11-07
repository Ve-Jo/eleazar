import { Groq } from "groq-sdk";
import OpenAI from "openai";
import fetch from "node-fetch";
import { state } from "./index.js";
import hubClient from "../../api/hubClient.js";

// --- Model Cache ---
let cachedModels = null; // { groq: [], openrouter: [] }
let lastFetchTime = 0;
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

// --- Helper Functions ---

// Standardizes model names for display
function formatModelName(model, provider) {
  return `${provider}/${model.id}`;
}

// --- API Client Management ---

/**
 * Initialize API clients for model providers
 * @param {Object} client - Discord client object
 * @returns {Object} Object containing initialization status for each provider
 */
export async function initializeApiClients(client) {
  const results = { groq: false, openrouter: false, nanogpt: false };

  // Since we're using AI Hub, we don't need to initialize direct API clients
  // The hub will handle all API communications
  console.log(
    "🤖 AI Hub integration active - skipping direct API client initialization"
  );

  // Mark all providers as available since hub will handle them
  results.groq = true;
  results.openrouter = true;
  results.nanogpt = true;

  return results;
}

// --- Model Fetching ---

/**
 * Fetch models from Groq API
 * @param {Object} groqClient - Initialized Groq client
 * @returns {Array} Array of available models
 */
async function fetchGroqModelsFromApi(groqClient) {
  // Since we're using AI Hub, we don't fetch models directly from APIs
  console.log(
    "🤖 AI Hub integration active - skipping direct Groq API model fetch"
  );
  return [];
}

/**
 * Fetch models from OpenRouter API
 * @param {Object} openRouterClient - Initialized OpenRouter client
 * @returns {Array} Array of available models
 */
async function fetchOpenRouterModelsFromApi(openRouterClient) {
  // Since we're using AI Hub, we don't fetch models directly from APIs
  console.log(
    "🤖 AI Hub integration active - skipping direct OpenRouter API model fetch"
  );
  return [];
}

/**
 * Fetch models from NanoGPT API
 * @param {Object} nanoGptClient - Initialized NanoGPT client
 * @returns {Array} Array of available models
 */
async function fetchNanoGPTModelsFromApi(nanoGptClient) {
  // Since we're using AI Hub, we don't fetch models directly from APIs
  console.log(
    "🤖 AI Hub integration active - skipping direct NanoGPT API model fetch"
  );
  return [];
}

/**
 * Create fallback models from config when API calls fail
 * @param {string} provider - Provider name ('groq', 'openrouter', or 'nanogpt')
 * @returns {Array} Array of fallback models
 */
function createFallbackModels(provider) {
  console.log(
    `Using fallback models for ${provider} - AI Hub integration active`
  );
  // Return empty array since we're using AI Hub for all model management
  return [];
}

/**
 * Fetches models from AI Hub service
 * @param {Object} client - Discord client object
 * @param {string} userId - User ID for personalized model fetching
 * @returns {Object} Object containing all available models by provider
 */
async function fetchAllModels(client, userId = null) {
  const now = Date.now();
  if (
    cachedModels &&
    now - lastFetchTime < CACHE_DURATION &&
    cachedModels.groq?.length &&
    cachedModels.openrouter?.length &&
    cachedModels.nanogpt?.length
  ) {
    console.log("Using cached AI models.");
    return cachedModels;
  }

  console.log("Fetching fresh AI models from AI Hub...");
  cachedModels = { groq: [], openrouter: [], nanogpt: [] }; // Reset cache

  try {
    // Fetch models from AI Hub with user context for personalized models
    // Request featured models to be sorted first
    const hubModels = await hubClient.getAIHubModels(
      null,
      false,
      userId,
      null,
      "featured",
      "desc"
    );

    // Log summary of featured models for debugging
    const featuredCount = hubModels.filter((m) => m.isFeatured).length;
    console.log(
      `[fetchAllModels] Received ${hubModels.length} models (${featuredCount} featured) from hub`
    );

    // Group models by provider
    hubModels.forEach((model) => {
      const provider = model.provider || "unknown";
      const providerKey = provider.toLowerCase();

      if (cachedModels[providerKey]) {
        cachedModels[providerKey].push({
          id: model.id,
          name: model.name || `${provider}/${model.id}`,
          provider: provider,
          capabilities: {
            vision: model.capabilities?.vision || false,
            tools: model.capabilities?.tools !== false, // Default to true
            maxContext:
              model.capabilities?.maxContext ||
              model.context_window ||
              model.context_length ||
              8192,
            reasoning: model.capabilities?.reasoning || false,
          },
          pricing: model.pricing || {},
          isFeatured: model.isFeatured || false, // Preserve featured status from hub
        });
      }
    });

    console.log(`Fetched ${hubModels.length} models from AI Hub`);

    // Fallback to config models if hub fetch fails or returns empty
    if (hubModels.length === 0) {
      console.warn("AI Hub returned no models, using fallback configuration");
      cachedModels.groq = createFallbackModels("groq");
      cachedModels.openrouter = createFallbackModels("openrouter");
      cachedModels.nanogpt = createFallbackModels("nanogpt");
    }
  } catch (error) {
    console.error("Error fetching models from AI Hub:", error);
    console.log("Falling back to configuration-based models");

    // Use fallback models from config
    cachedModels.groq = createFallbackModels("groq");
    cachedModels.openrouter = createFallbackModels("openrouter");
    cachedModels.nanogpt = createFallbackModels("nanogpt");
  }

  lastFetchTime = now;

  // Store model capabilities in the cache for future reference
  [
    ...cachedModels.groq,
    ...cachedModels.openrouter,
    ...cachedModels.nanogpt,
  ].forEach((model) => {
    if (model && model.id) {
      const cacheKey = `${model.provider}/${model.id}`;
      state.modelStatus.modelCapabilitiesCache.set(cacheKey, model);
    }
  });

  console.log(
    `Total models cached: Groq (${cachedModels.groq.length}), OpenRouter (${cachedModels.openrouter.length}), NanoGPT (${cachedModels.nanogpt.length})`
  );
  return cachedModels;
}

// --- Model Retrieval and Management ---

/**
 * Get available models filtered by capability
 * @param {Object} client - Discord client object
 * @param {string|null} capabilityFilter - Capability to filter by ('vision' or null for text)
 * @returns {Array} Array of available models matching the filter
 */
export async function getAvailableModels(
  client,
  capabilityFilter = null,
  userId = null
) {
  const allModelsData = await fetchAllModels(client, userId);

  // Create a map of all models for quick lookup
  const availableModelsMap = new Map();
  [
    ...allModelsData.groq,
    ...allModelsData.openrouter,
    ...allModelsData.nanogpt,
  ].forEach((model) => {
    const baseName = `${model.provider}/${model.id}`;
    availableModelsMap.set(baseName, model);
  });

  const isVisionRequest = capabilityFilter === "vision";
  let resultModels = [];

  // Since AI Hub handles subscription filtering, return all available models
  // and filter by capability if requested
  for (const model of availableModelsMap.values()) {
    if (isVisionRequest) {
      // For vision requests, only include models with vision capability
      if (model && model.capabilities.vision) {
        resultModels.push(model);
      }
    } else {
      // For text requests, include all models (hub already filtered by subscription)
      if (model) {
        resultModels.push(model);
      }
    }
  }

  // Sort models: featured models first, then by name
  resultModels.sort((a, b) => {
    // Featured models get priority
    if (a.isFeatured && !b.isFeatured) return -1;
    if (!a.isFeatured && b.isFeatured) return 1;

    // Then sort by name alphabetically
    return (a.name || a.id).localeCompare(b.name || b.id);
  });

  // Debug logging for featured models
  const featuredCount = resultModels.filter((m) => m.isFeatured).length;
  console.log(
    `[getAvailableModels] Total models: ${resultModels.length}, Featured models: ${featuredCount}`
  );
  if (featuredCount > 0) {
    console.log(
      `[getAvailableModels] Featured models:`,
      resultModels.filter((m) => m.isFeatured).map((m) => m.name)
    );
  }

  console.log(
    `Returning ${resultModels.length} available models for ${
      isVisionRequest ? "VISION" : "TEXT"
    } request`
  );
  return resultModels;
}

/**
 * Get details for a specific model by ID
 * @param {Object} client - Discord client object
 * @param {string} prefixedModelId - Full model ID with provider prefix
 * @returns {Object|null} Model details or null if not found
 */
export async function getModelDetails(client, prefixedModelId) {
  const allModels = await fetchAllModels(client);
  const allCombined = [
    ...allModels.groq,
    ...allModels.openrouter,
    ...allModels.nanogpt,
  ];

  // Find model by its prefixed name
  let model = allCombined.find((m) => m.name === prefixedModelId);

  if (!model) {
    console.warn(`Model details not found for prefixed ID: ${prefixedModelId}`);
    // Fallback: try splitting and matching provider/id
    const parts = prefixedModelId.split("/");
    if (parts.length === 2) {
      const [provider, id] = parts;
      model = allCombined.find((m) => m.provider === provider && m.id === id);
    }
  }

  if (model) {
    // Check the global cache for tool support
    const cacheKey = `${model.provider}/${model.id}`;

    // Update capabilities from cache if available
    if (state.modelStatus.toolSupport.has(cacheKey)) {
      model.capabilities.tools = state.modelStatus.toolSupport.get(cacheKey);
      console.log(
        `Updated tool support for ${prefixedModelId} from cache: ${model.capabilities.tools}`
      );
    }
    // Check against known list of models without tools
    else if (state.modelStatus.modelsWithoutTools.has(model.id)) {
      model.capabilities.tools = false;
      state.modelStatus.toolSupport.set(cacheKey, false);
      console.log(
        `Marked ${prefixedModelId} as not supporting tools based on dynamic list`
      );
    }
  }

  return model;
}

/**
 * Get the API client for a model
 * @param {Object} client - Discord client object
 * @param {string} prefixedModelId - Full model ID with provider prefix
 * @returns {Object} Object containing client, provider, and modelId
 */
export async function getApiClientForModel(client, prefixedModelId) {
  const modelDetails = await getModelDetails(client, prefixedModelId);
  if (!modelDetails) {
    throw new Error(
      `Could not find details or client for model: ${prefixedModelId}`
    );
  }

  const provider = modelDetails.provider;

  // Since we're using AI Hub, we don't need direct API clients
  // The hub will handle the API communication
  return {
    client: null, // Hub will handle this
    provider: provider,
    modelId: modelDetails.id,
  };
}

/**
 * Get capabilities for a specific model
 * @param {Object} client - Discord client object
 * @param {string} prefixedModelId - Full model ID with provider prefix
 * @returns {Object} Capabilities object with vision, tools, and maxContext properties
 */
export async function getModelCapabilities(client, prefixedModelId) {
  const modelDetails = await getModelDetails(client, prefixedModelId);
  if (!modelDetails) {
    console.error(
      `Could not determine capabilities for unknown model: ${prefixedModelId}`
    );
    // Return default/conservative capabilities
    return { vision: false, tools: false, maxContext: 8192 }; // This is appropriate as a last resort fallback
  }
  return modelDetails.capabilities;
}

/**
 * Update model cooldown/rate limit status
 * @param {string} modelId - Model ID to update
 * @param {number} durationMs - Duration in milliseconds for the rate limit
 */
export function updateModelCooldown(modelId, durationMs = 60000) {
  state.modelStatus.rateLimits[modelId] = Date.now() + durationMs;
  console.log(`Set cooldown for ${modelId} for ${durationMs}ms`);
}

/**
 * Check if a model is currently rate-limited
 * @param {string} modelId - The model ID to check
 * @returns {Object} Object with isLimited and remainingTime properties
 */
export function checkModelRateLimit(modelId) {
  const expireTime = state.modelStatus.rateLimits[modelId];
  if (!expireTime) {
    return { isLimited: false, remainingTime: 0 };
  }

  const now = Date.now();
  if (now > expireTime) {
    // Expired rate limit, clean up
    delete state.modelStatus.rateLimits[modelId];
    return { isLimited: false, remainingTime: 0 };
  }

  return {
    isLimited: true,
    remainingTime: Math.ceil((expireTime - now) / 1000 / 60), // in minutes
  };
}

/**
 * Mark a model as not supporting tools
 * @param {string} modelId - Full model ID with provider prefix
 */
export function markModelAsNotSupportingTools(modelId) {
  // Extract base ID if prefixed
  const parts = modelId.split("/");
  const baseId = parts.length > 1 ? parts[1] : modelId;

  state.modelStatus.modelsWithoutTools.add(baseId);
  state.modelStatus.toolSupport.set(modelId, false);
  console.log(`Added ${modelId} to list of models without tool support`);
}

/**
 * Check if a model supports reasoning capabilities
 * @param {string} modelId - The model ID to check
 * @returns {boolean} Whether the model supports reasoning
 */
export function supportsReasoning(modelId) {
  if (!modelId) return false;

  // Parse the model ID to handle different formats
  const parts = modelId.split("/");
  let provider, baseModelId;

  if (parts.length === 3) {
    // Format: provider/company/model
    provider = parts[0];
    baseModelId = `${parts[1]}/${parts[2]}`;
  } else if (parts.length === 2) {
    // Format: provider/model
    provider = parts[0];
    baseModelId = parts[1];
  } else {
    // Just model name
    baseModelId = modelId;
  }

  // Check model capabilities from cache
  const modelDetails = state.modelStatus.modelCapabilitiesCache?.get(modelId);
  if (modelDetails?.capabilities?.reasoning) {
    return true;
  }

  // For OpenRouter models, check if the model name contains reasoning keywords
  if (provider === "openrouter") {
    const reasoningKeywords = ["reason", "ration", "logic", "think"];
    return reasoningKeywords.some((keyword) =>
      baseModelId.toLowerCase().includes(keyword)
    );
  }

  // For NanoGPT models, check if the model name contains reasoning keywords
  if (provider === "nanogpt") {
    const reasoningKeywords = ["reason", "ration", "logic", "think"];
    return reasoningKeywords.some((keyword) =>
      baseModelId.toLowerCase().includes(keyword)
    );
  }

  return false;
}
