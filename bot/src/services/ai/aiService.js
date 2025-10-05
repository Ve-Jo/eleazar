import { Groq } from "groq-sdk";
import OpenAI from "openai";
import fetch from "node-fetch";
import CONFIG from "../../config/aiConfig.js";
import { state } from "./index.js";

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

  // Initialize Groq client if configured
  if (CONFIG.groq.apiKey) {
    const clientPath = CONFIG.groq.clientPath;
    if (!client[clientPath]) {
      try {
        client[clientPath] = new Groq({
          apiKey: CONFIG.groq.apiKey,
        });
        console.log("✅ Successfully initialized Groq client");
        results.groq = true;
      } catch (error) {
        console.error("❌ Failed to initialize Groq client:", error.message);
      }
    } else {
      console.log(`✅ Groq client already exists at client.${clientPath}`);
      results.groq = true;
    }
  }

  // Initialize OpenRouter client if configured
  if (CONFIG.openrouter.apiKey) {
    const clientPath = CONFIG.openrouter.clientPath;
    if (!client[clientPath]) {
      try {
        client[clientPath] = new OpenAI({
          apiKey: CONFIG.openrouter.apiKey,
          baseURL: CONFIG.openrouter.baseURL,
        });
        console.log("✅ Successfully initialized OpenRouter client");
        results.openrouter = true;
      } catch (error) {
        console.error(
          "❌ Failed to initialize OpenRouter client:",
          error.message
        );
      }
    } else {
      console.log(
        `✅ OpenRouter client already exists at client.${clientPath}`
      );
      results.openrouter = true;
    }
  }

  // Initialize NanoGPT client if configured
  if (CONFIG.nanogpt.apiKey) {
    const clientPath = CONFIG.nanogpt.clientPath;
    if (!client[clientPath]) {
      try {
        client[clientPath] = new OpenAI({
          apiKey: CONFIG.nanogpt.apiKey,
          baseURL: CONFIG.nanogpt.baseURL,
        });
        console.log("✅ Successfully initialized NanoGPT client");
        results.nanogpt = true;
      } catch (error) {
        console.error("❌ Failed to initialize NanoGPT client:", error.message);
      }
    } else {
      console.log(`✅ NanoGPT client already exists at client.${clientPath}`);
      results.nanogpt = true;
    }
  }

  return results;
}

// --- Model Fetching ---

/**
 * Fetch models from Groq API
 * @param {Object} groqClient - Initialized Groq client
 * @returns {Array} Array of available models
 */
async function fetchGroqModelsFromApi(groqClient) {
  if (!groqClient) {
    console.warn(
      "Attempted to fetch Groq models without an initialized client."
    );
    return [];
  }

  try {
    const preferredTextModels = new Set(
      CONFIG.groq.preferredModels?.text || []
    );
    const preferredVisionModels = new Set(
      CONFIG.groq.preferredModels?.vision || []
    );

    // Fetch all models from API
    const models = await groqClient.models.list();
    console.log(`Fetched ${models.data.length} models from Groq API`);

    // Filter to only include models in our preferred lists
    const filteredModels = models.data
      .filter((m) => m.active)
      .filter(
        (m) => preferredTextModels.has(m.id) || preferredVisionModels.has(m.id)
      )
      .map((model) => ({
        id: model.id,
        name: formatModelName(model, "groq"),
        provider: "groq",
        capabilities: {
          vision: preferredVisionModels.has(model.id),
          tools: true,
          maxContext: model.context_window || 8192,
        },
      }));

    console.log(`Filtered to ${filteredModels.length} preferred Groq models`);
    return filteredModels;
  } catch (error) {
    console.error("Error fetching Groq models:", error.message);

    // Fallback to config if API call fails
    return createFallbackModels("groq");
  }
}

/**
 * Fetch models from OpenRouter API
 * @param {Object} openRouterClient - Initialized OpenRouter client
 * @returns {Array} Array of available models
 */
async function fetchOpenRouterModelsFromApi(openRouterClient) {
  if (!openRouterClient) {
    console.warn(
      "Attempted to fetch OpenRouter models without an initialized client."
    );
    return [];
  }

  try {
    const preferredTextModels = new Set(
      CONFIG.openrouter.preferredModels?.text || []
    );
    const preferredVisionModels = new Set(
      CONFIG.openrouter.preferredModels?.vision || []
    );
    const preferredModelsSet = new Set([
      ...preferredTextModels,
      ...preferredVisionModels,
    ]);

    // Fetch all models from API
    const models = await openRouterClient.models.list();
    console.log(`Fetched ${models.data.length} models from OpenRouter API`);

    // Process all models with intelligent capability detection
    const processedModels = models.data
      .filter((m) => m.id && m.id.trim() !== "")
      .map((model) => {
        // Check if the model is in our preferred list or if it meets pricing criteria
        const isPreferred = preferredModelsSet.has(model.id);

        // Vision capability detection
        // First check our manual configuration, then look at model metadata
        const hasVision =
          preferredVisionModels.has(model.id) ||
          (model.capabilities && model.capabilities.includes("vision")) ||
          model.id.toLowerCase().includes("vision") ||
          model.id.toLowerCase().includes("vl");

        // Reasoning capability detection
        // First check our manual configuration, then infer from model metadata
        const hasReasoning =
          CONFIG.reasoningCapableModels.includes(model.id) ||
          (model.capabilities && model.capabilities.includes("reasoning")) ||
          model.id.toLowerCase().includes("reason");

        // Context window detection
        const contextWindow = model.context_length || 8192;

        return {
          id: model.id,
          name: formatModelName(model, "openrouter"),
          provider: "openrouter",
          capabilities: {
            vision: hasVision,
            tools: true,
            maxContext: contextWindow,
            reasoning: hasReasoning,
          },
          pricing: {
            prompt: model.pricing?.prompt,
            completion: model.pricing?.completion,
          },
          isPreferred: isPreferred,
        };
      });

    // Filter to include preferred models and other affordable models
    const filteredModels = processedModels.filter((model) => {
      // Always include preferred models
      if (model.isPreferred) {
        return true;
      }

      // Include other models based on pricing if they're comparable to our preferred models
      // This allows newly released models to be included
      const averagePreferredPromptPrice =
        processedModels
          .filter((m) => m.isPreferred && m.pricing?.prompt)
          .reduce((sum, m) => sum + m.pricing.prompt, 0) /
          processedModels.filter((m) => m.isPreferred && m.pricing?.prompt)
            .length || Infinity;

      const averagePreferredCompletionPrice =
        processedModels
          .filter((m) => m.isPreferred && m.pricing?.completion)
          .reduce((sum, m) => sum + m.pricing.completion, 0) /
          processedModels.filter((m) => m.isPreferred && m.pricing?.completion)
            .length || Infinity;

      // Include if the model pricing is comparable or lower than our preferred models
      const isPricingAcceptable =
        (!model.pricing?.prompt ||
          model.pricing.prompt <= averagePreferredPromptPrice * 1.5) &&
        (!model.pricing?.completion ||
          model.pricing.completion <= averagePreferredCompletionPrice * 1.5);

      return isPricingAcceptable;
    });

    console.log(
      `Filtered to ${filteredModels.length} OpenRouter models (${processedModels.length} total available)`
    );
    return filteredModels;
  } catch (error) {
    console.error("Error fetching OpenRouter models:", error.message);

    // Fallback to config if API call fails
    return createFallbackModels("openrouter");
  }
}

/**
 * Fetch models from NanoGPT API
 * @param {Object} nanoGptClient - Initialized NanoGPT client
 * @returns {Array} Array of available models
 */
async function fetchNanoGPTModelsFromApi(nanoGptClient) {
  if (!nanoGptClient) {
    console.warn(
      "Attempted to fetch NanoGPT models without an initialized client."
    );
    return [];
  }

  try {
    const preferredTextModels = new Set(
      CONFIG.nanogpt.preferredModels?.text || []
    );
    const preferredVisionModels = new Set(
      CONFIG.nanogpt.preferredModels?.vision || []
    );

    // NanoGPT API может не иметь стандартного endpoint для получения моделей
    // Используем модели из конфигурации как fallback
    console.log("Fetching NanoGPT models from configuration");

    const models = [];

    // Добавляем текстовые модели
    CONFIG.nanogpt.preferredModels?.text?.forEach((id) => {
      models.push({
        id,
        name: `nanogpt/${id}`,
        provider: "nanogpt",
        capabilities: {
          vision: false,
          tools: true,
          maxContext: 8192,
        },
      });
    });

    // Добавляем vision модели
    CONFIG.nanogpt.preferredModels?.vision?.forEach((id) => {
      models.push({
        id,
        name: `nanogpt/${id}`,
        provider: "nanogpt",
        capabilities: {
          vision: true,
          tools: true,
          maxContext: 8192,
        },
      });
    });

    console.log(`Found ${models.length} NanoGPT models from configuration`);
    return models;
  } catch (error) {
    console.error("Error fetching NanoGPT models:", error.message);

    // Fallback to config if API call fails
    return createFallbackModels("nanogpt");
  }
}

/**
 * Create fallback models from config when API calls fail
 * @param {string} provider - Provider name ('groq', 'openrouter', or 'nanogpt')
 * @returns {Array} Array of fallback models
 */
function createFallbackModels(provider) {
  console.log(`Using fallback preferred models from config for ${provider}`);
  const fallbackModels = [];

  // Add text models
  CONFIG[provider]?.preferredModels?.text?.forEach((id) => {
    fallbackModels.push({
      id,
      name: `${provider}/${id}`,
      provider,
      capabilities: {
        vision: false,
        tools: true,
        maxContext: 8192,
      },
    });
  });

  // Add vision models
  CONFIG[provider]?.preferredModels?.vision?.forEach((id) => {
    fallbackModels.push({
      id,
      name: `${provider}/${id}`,
      provider,
      capabilities: {
        vision: true,
        tools: true,
        maxContext: 8192,
      },
    });
  });

  return fallbackModels;
}

/**
 * Fetches models from all configured providers and caches them
 * @param {Object} client - Discord client object
 * @returns {Object} Object containing all available models by provider
 */
async function fetchAllModels(client) {
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

  console.log("Fetching fresh AI models...");
  cachedModels = { groq: [], openrouter: [], nanogpt: [] }; // Reset cache

  const groqClient = client[CONFIG.groq.clientPath];
  const openRouterClient = client[CONFIG.openrouter.clientPath];
  const nanoGptClient = client[CONFIG.nanogpt.clientPath];

  const fetchPromises = [];
  if (groqClient) {
    fetchPromises.push(
      fetchGroqModelsFromApi(groqClient).then((models) => {
        cachedModels.groq = models;
      })
    );
  } else {
    console.warn("Groq client not available, using fallback models.");
    cachedModels.groq = createFallbackModels("groq");
  }

  if (openRouterClient) {
    fetchPromises.push(
      fetchOpenRouterModelsFromApi(openRouterClient).then((models) => {
        cachedModels.openrouter = models;
      })
    );
  } else {
    console.warn("OpenRouter client not available, using fallback models.");
    cachedModels.openrouter = createFallbackModels("openrouter");
  }

  if (nanoGptClient) {
    fetchPromises.push(
      fetchNanoGPTModelsFromApi(nanoGptClient).then((models) => {
        cachedModels.nanogpt = models;
      })
    );
  } else {
    console.warn("NanoGPT client not available, using fallback models.");
    cachedModels.nanogpt = createFallbackModels("nanogpt");
  }

  await Promise.all(fetchPromises);

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
export async function getAvailableModels(client, capabilityFilter = null) {
  const allModelsData = await fetchAllModels(client);

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
  let preferredModelNamesConfig = [];
  let resultModels = [];

  // Determine which model list to use based on the capability filter
  if (isVisionRequest) {
    // Vision request - only use vision models from config
    preferredModelNamesConfig = [
      ...(CONFIG.groq.preferredModels?.vision || []).map((id) => `groq/${id}`),
      ...(CONFIG.openrouter.preferredModels?.vision || []).map(
        (id) => `openrouter/${id}`
      ),
      ...(CONFIG.nanogpt.preferredModels?.vision || []).map(
        (id) => `nanogpt/${id}`
      ),
    ];
    console.log("Filtering for VISION models based on config.");

    // Remove duplicates preserving order
    const uniquePreferredModelNames = [...new Set(preferredModelNamesConfig)];

    // Add models that support vision
    for (const modelName of uniquePreferredModelNames) {
      const model = availableModelsMap.get(modelName);
      if (model && model.capabilities.vision) {
        resultModels.push(model);
      }
    }
  } else {
    // Text request - use text models from config
    preferredModelNamesConfig = [
      ...(CONFIG.groq.preferredModels?.text || []).map((id) => `groq/${id}`),
      ...(CONFIG.openrouter.preferredModels?.text || []).map(
        (id) => `openrouter/${id}`
      ),
      ...(CONFIG.nanogpt.preferredModels?.text || []).map(
        (id) => `nanogpt/${id}`
      ),
    ];
    console.log("Prioritizing TEXT models based on config.");

    // Remove duplicates preserving order
    const uniquePreferredModelNames = [...new Set(preferredModelNamesConfig)];

    // Add models from the preferred text list
    for (const modelName of uniquePreferredModelNames) {
      const model = availableModelsMap.get(modelName);
      if (model) {
        resultModels.push(model);
      }
    }
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
  const clientPath = CONFIG[provider]?.clientPath;

  if (!clientPath || !client[clientPath]) {
    throw new Error(
      `API client for provider '${provider}' not found or not initialized.`
    );
  }

  return {
    client: client[clientPath],
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
    return { vision: false, tools: false, maxContext: 8192 };
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

  // First check the static configuration
  const isInConfig = CONFIG.reasoningCapableModels.some(
    (m) => m === baseModelId || m === modelId
  );

  if (isInConfig) {
    return true;
  }

  // Check the model capabilities cache for reasoning support
  // Try both formats: full ID and base ID
  const fullCacheKey = modelId;
  const modelDetails =
    state.modelStatus.modelCapabilitiesCache?.get(fullCacheKey);

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
