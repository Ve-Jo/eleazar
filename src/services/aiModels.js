import { Groq } from "groq-sdk";
import OpenAI from "openai";
import fetch from "node-fetch";
import CONFIG from "../config/aiConfig.js";
import { state, isModelWithoutTools } from "../state/state.js";

// --- Model Cache ---
let cachedModels = null; // { groq: [], openrouter: [] }
let lastFetchTime = 0;
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

// --- Helper Functions ---

// Extracts size info - Keep as is for now, might need adjustment for OpenRouter models if format differs
function extractModelSize(modelId) {
  const match = modelId.match(/([\d.]+[mMkKbB])[-\s_]/i); // Adjusted regex slightly
  return match ? match[1].toUpperCase() : null;
}

// Standardizes model names for display - prefix with provider
function formatModelName(model, provider) {
  // Removed size extraction and suffix addition
  // const size = extractModelSize(model.id);
  // const sizeStr = size ? ` (${size})` : "";
  // return `${provider}/${model.id}${sizeStr}`;
  return `${provider}/${model.id}`; // Return only provider/id
}

// --- API Fetching Functions ---

// Fetch models from Groq API
async function fetchGroqModelsFromApi(groqClient) {
  if (!groqClient) {
    console.warn(
      "Attempted to fetch Groq models without an initialized client."
    );
    return [];
  }

  try {
    // Get preferred models from config
    const preferredTextModels = new Set(
      CONFIG.groq.preferredModels?.text || []
    );
    const preferredVisionModels = new Set(
      CONFIG.groq.preferredModels?.vision || []
    );

    // Fetch all models from API
    const models = await groqClient.models.list();
    console.log(`Fetched ${models.data.length} models from Groq API`);

    // Filter to only include models that are in our preferred lists
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
          // Use our explicit categorization rather than inferring
          vision: preferredVisionModels.has(model.id),
          tools: true, // Assume all models support tools
          maxContext: model.context_window || 8192,
        },
      }));

    console.log(`Filtered to ${filteredModels.length} preferred Groq models`);
    return filteredModels;
  } catch (error) {
    console.error("Error fetching Groq models:", error.message);

    // Fallback: create models directly from config if API call fails
    console.log("Using fallback preferred models from config");
    const fallbackModels = [];

    // Add text models
    CONFIG.groq.preferredModels?.text?.forEach((id) => {
      fallbackModels.push({
        id,
        name: `groq/${id}`,
        provider: "groq",
        capabilities: {
          vision: false,
          tools: true,
          maxContext: 8192,
        },
      });
    });

    // Add vision models
    CONFIG.groq.preferredModels?.vision?.forEach((id) => {
      fallbackModels.push({
        id,
        name: `groq/${id}`,
        provider: "groq",
        capabilities: {
          vision: true,
          tools: true,
          maxContext: 8192,
        },
      });
    });

    return fallbackModels;
  }
}

// Fetch models from OpenRouter API
async function fetchOpenRouterModelsFromApi(openRouterClient) {
  if (!openRouterClient) {
    console.warn(
      "Attempted to fetch OpenRouter models without an initialized client."
    );
    return [];
  }

  try {
    // Get preferred models from config
    const preferredTextModels = new Set(
      CONFIG.openrouter.preferredModels?.text || []
    );
    const preferredVisionModels = new Set(
      CONFIG.openrouter.preferredModels?.vision || []
    );

    // Fetch all models from API
    const models = await openRouterClient.models.list();
    console.log(`Fetched ${models.data.length} models from OpenRouter API`);

    // Filter to only include models that are in our preferred lists
    const filteredModels = models.data
      .filter((m) => m.id && m.id.trim() !== "")
      .filter(
        (m) => preferredTextModels.has(m.id) || preferredVisionModels.has(m.id)
      )
      .map((model) => ({
        id: model.id,
        name: formatModelName(model, "openrouter"),
        provider: "openrouter",
        capabilities: {
          // Use our explicit categorization rather than inferring
          vision: preferredVisionModels.has(model.id),
          tools: true,
          maxContext: model.context_length || 8192,
        },
      }));

    console.log(
      `Filtered to ${filteredModels.length} preferred OpenRouter models`
    );
    return filteredModels;
  } catch (error) {
    console.error("Error fetching OpenRouter models:", error.message);

    // Fallback: create models directly from config if API call fails
    console.log("Using fallback preferred models from config");
    const fallbackModels = [];

    // Add text models
    CONFIG.openrouter.preferredModels?.text?.forEach((id) => {
      fallbackModels.push({
        id,
        name: `openrouter/${id}`,
        provider: "openrouter",
        capabilities: {
          vision: false,
          tools: true,
          maxContext: 8192,
        },
      });
    });

    // Add vision models
    CONFIG.openrouter.preferredModels?.vision?.forEach((id) => {
      fallbackModels.push({
        id,
        name: `openrouter/${id}`,
        provider: "openrouter",
        capabilities: {
          vision: true,
          tools: true,
          maxContext: 8192,
        },
      });
    });

    return fallbackModels;
  }
}

// --- Combined Model Fetching and Management ---

// Fetches models from all configured providers and caches them
async function fetchAllModels(client) {
  const now = Date.now();
  if (
    cachedModels &&
    now - lastFetchTime < CACHE_DURATION &&
    cachedModels.groq?.length &&
    cachedModels.openrouter?.length
  ) {
    console.log("Using cached AI models.");
    return cachedModels;
  }

  console.log("Fetching fresh AI models...");
  cachedModels = { groq: [], openrouter: [] }; // Reset cache

  const groqClient = client[CONFIG.groq.clientPath];
  const openRouterClient = client[CONFIG.openrouter.clientPath];

  const fetchPromises = [];
  if (groqClient) {
    fetchPromises.push(
      fetchGroqModelsFromApi(groqClient).then((models) => {
        cachedModels.groq = models;
      })
    );
  } else {
    console.warn("Groq client not available, cannot fetch Groq models.");
  }

  if (openRouterClient) {
    fetchPromises.push(
      fetchOpenRouterModelsFromApi(openRouterClient).then((models) => {
        cachedModels.openrouter = models;
      })
    );
  } else {
    console.warn(
      "OpenRouter client not available, cannot fetch OpenRouter models."
    );
  }

  await Promise.all(fetchPromises);

  lastFetchTime = now;
  console.log(
    `Total models cached: Groq (${cachedModels.groq.length}), OpenRouter (${cachedModels.openrouter.length})`
  );
  return cachedModels;
}

// Get available models, strictly filtering based on capability request
async function getAvailableModels(client, capabilityFilter = null) {
  // Restore fetching models and creating the Map
  const allModelsData = await fetchAllModels(client);

  const availableModelsMap = new Map();
  [...allModelsData.groq, ...allModelsData.openrouter].forEach((model) => {
    // Use the base name (provider/id) as the key for consistency
    const baseName = `${model.provider}/${model.id}`;
    availableModelsMap.set(baseName, model); // Use baseName as key
  });

  // --- TEMPORARY DEBUG LOG --- //
  console.log(
    "Models available in map:",
    Array.from(availableModelsMap.keys())
  );
  // --- END DEBUG LOG --- //

  const isVisionRequest = capabilityFilter === "vision";

  let preferredModelNamesConfig = [];

  let resultModels = [];
  const addedModelNames = new Set();

  let uniquePreferredModelNames = [];

  if (isVisionRequest) {
    // --- VISION REQUEST --- //
    // Only use vision models from config
    preferredModelNamesConfig = [
      ...(CONFIG.groq.preferredModels?.vision || []).map((id) => `groq/${id}`),
      ...(CONFIG.openrouter.preferredModels?.vision || []).map(
        (id) => `openrouter/${id}`
      ),
    ];
    console.log("Filtering for VISION models based on config.");

    // Remove duplicates while preserving order from the vision config list
    uniquePreferredModelNames = [...new Set(preferredModelNamesConfig)];

    // Add available models ONLY from the preferred vision list
    for (const modelName of uniquePreferredModelNames) {
      const model = availableModelsMap.get(modelName);
      if (model && model.capabilities.vision) {
        // Ensure it supports vision
        resultModels.push(model);
        addedModelNames.add(modelName); // Keep track in case needed later, but primarily for loop logic
      }
    }
  } else {
    // --- TEXT REQUEST --- //
    // Use text models from config as the preferred list
    preferredModelNamesConfig = [
      ...(CONFIG.groq.preferredModels?.text || []).map((id) => `groq/${id}`),
      ...(CONFIG.openrouter.preferredModels?.text || []).map(
        (id) => `openrouter/${id}`
      ),
    ];
    console.log("Prioritizing TEXT models based on config.");

    // Remove duplicates while preserving order from the text config list
    uniquePreferredModelNames = [...new Set(preferredModelNamesConfig)];

    // Add available models ONLY from the preferred text list
    for (const modelName of uniquePreferredModelNames) {
      const model = availableModelsMap.get(modelName);
      if (model) {
        // Add if available from the text list, regardless of vision capability
        resultModels.push(model);
        addedModelNames.add(modelName); // Keep track
      }
    }
  }

  // --- TEMPORARY DEBUG LOG --- //
  console.log(
    "Final models being returned (sorted?):",
    resultModels.map((m) => m.name)
  );
  // --- END DEBUG LOG --- //

  console.log(
    `Returning ${resultModels.length} available models for ${
      isVisionRequest ? "VISION" : "TEXT"
    } request, ordered by config preference.`
  );

  return resultModels;
}

// Get details for a specific model by its prefixed ID (e.g., "groq/llama3-8b-8192")
async function getModelDetails(client, prefixedModelId) {
  const allModels = await fetchAllModels(client);
  const allCombined = [...allModels.groq, ...allModels.openrouter];

  // Find model by its prefixed name (which we store in the 'name' field)
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

    // Use the new state structure
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

// --- Client and Capability Retrieval ---

// Get the appropriate API client instance based on the prefixed model ID
async function getApiClientForModel(client, prefixedModelId) {
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
    client: client[clientPath], // The actual API client (Groq SDK or OpenAI SDK instance)
    provider: provider, // The provider name ('groq' or 'openrouter')
    modelId: modelDetails.id, // The original, non-prefixed model ID for API calls
  };
}

// Get capabilities for a specific model using its prefixed ID
async function getModelCapabilities(client, prefixedModelId) {
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

// --- Rate Limiting and Cooldown (Placeholder) ---
// These might need provider-specific logic if rate limits differ significantly

function updateModelCooldown(modelId) {
  // Placeholder - Implement if needed, potentially provider-aware
  console.log(`Cooldown update requested for ${modelId} (placeholder)`);
}

// Export the public functions
export {
  fetchGroqModelsFromApi, // Keep if needed individually, maybe internal?
  fetchOpenRouterModelsFromApi, // Keep if needed individually, maybe internal?
  fetchAllModels,
  getAvailableModels,
  getModelDetails, // Exported for potential direct use
  getApiClientForModel,
  getModelCapabilities,
  updateModelCooldown,
  extractModelSize, // Keep exported if used elsewhere
};
