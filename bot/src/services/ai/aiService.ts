import hubClient, { type AiHubModel } from "../../api/hubClient.ts";
import { state } from "./index.ts";

export type ModelCapabilities = {
  vision?: boolean;
  tools?: boolean;
  maxContext?: number;
  reasoning?: boolean;
  [key: string]: unknown;
};

export type AvailableModel = {
  id: string;
  name: string;
  provider?: string;
  capabilities: ModelCapabilities;
  pricing?: Record<string, unknown>;
  isFeatured?: boolean;
  [key: string]: unknown;
};

export type ApiClientInitResult = {
  groq: boolean;
  openrouter: boolean;
  nanogpt: boolean;
};

export type RateLimitStatus = {
  isLimited: boolean;
  remainingTime: number;
};

export type ApiClientForModel = {
  client: unknown;
  provider: string;
  modelId: string;
};

type ProviderKey = "groq" | "openrouter" | "nanogpt";

type ModelCollection = Record<ProviderKey, AvailableModel[]>;

type StateModelStatus = {
  rateLimits: Record<string, number>;
  toolSupport: Map<string, boolean>;
  modelsWithoutTools: Set<string>;
  modelCapabilitiesCache?: Map<string, AvailableModel>;
};

const CACHE_DURATION = 10 * 60 * 1000;

let cachedModels: ModelCollection | null = null;
let lastFetchTime = 0;

function getStateModelStatus(): StateModelStatus {
  return state.modelStatus as StateModelStatus;
}

export async function initializeApiClients(_client: unknown): Promise<ApiClientInitResult> {
  const results = { groq: false, openrouter: false, nanogpt: false };

  console.log("🤖 AI Hub integration active - skipping direct API client initialization");

  results.groq = true;
  results.openrouter = true;
  results.nanogpt = true;

  return results;
}

function createFallbackModels(provider: string): AvailableModel[] {
  console.log(`Using fallback models for ${provider} - AI Hub integration active`);
  return [];
}

function toAvailableModel(model: AiHubModel): AvailableModel {
  return {
    id: model.id,
    name: model.name || `${model.provider || "unknown"}/${model.id}`,
    provider: model.provider || "unknown",
    capabilities: {
      vision: model.capabilities?.vision || false,
      tools: model.capabilities?.tools !== false,
      maxContext: model.capabilities?.maxContext || model.context_window || model.context_length || 8192,
      reasoning: model.capabilities?.reasoning || false,
    },
    pricing: model.pricing || {},
    isFeatured: model.isFeatured || false,
  };
}

async function fetchAllModels(_client: unknown, userId: string | null = null): Promise<ModelCollection> {
  const now = Date.now();
  if (
    cachedModels &&
    now - lastFetchTime < CACHE_DURATION &&
    cachedModels.groq.length &&
    cachedModels.openrouter.length &&
    cachedModels.nanogpt.length
  ) {
    console.log("Using cached AI models.");
    return cachedModels;
  }

  console.log("Fetching fresh AI models from AI Hub...");
  cachedModels = { groq: [], openrouter: [], nanogpt: [] };

  try {
    const hubModels = await hubClient.getAIHubModels(null, false, userId, null, "featured", "desc");
    const featuredCount = hubModels.filter((model) => model.isFeatured).length;
    console.log(
      `[fetchAllModels] Received ${hubModels.length} models (${featuredCount} featured) from hub`
    );

    hubModels.forEach((model) => {
      const providerKey = (model.provider || "unknown").toLowerCase() as ProviderKey | "unknown";
      if (providerKey === "groq" || providerKey === "openrouter" || providerKey === "nanogpt") {
        cachedModels?.[providerKey].push(toAvailableModel(model));
      }
    });

    console.log(`Fetched ${hubModels.length} models from AI Hub`);

    if (hubModels.length === 0) {
      console.warn("AI Hub returned no models, using fallback configuration");
      cachedModels.groq = createFallbackModels("groq");
      cachedModels.openrouter = createFallbackModels("openrouter");
      cachedModels.nanogpt = createFallbackModels("nanogpt");
    }
  } catch (error) {
    console.error("Error fetching models from AI Hub:", error);
    console.log("Falling back to configuration-based models");
    cachedModels.groq = createFallbackModels("groq");
    cachedModels.openrouter = createFallbackModels("openrouter");
    cachedModels.nanogpt = createFallbackModels("nanogpt");
  }

  lastFetchTime = now;

  [...cachedModels.groq, ...cachedModels.openrouter, ...cachedModels.nanogpt].forEach((model) => {
    if (model?.id) {
      const cacheKey = `${model.provider}/${model.id}`;
      getStateModelStatus().modelCapabilitiesCache?.set(cacheKey, model);
    }
  });

  console.log(
    `Total models cached: Groq (${cachedModels.groq.length}), OpenRouter (${cachedModels.openrouter.length}), NanoGPT (${cachedModels.nanogpt.length})`
  );
  return cachedModels;
}

export async function getAvailableModels(
  client: unknown,
  capabilityFilter: string | null = null,
  userId: string | null = null
): Promise<AvailableModel[]> {
  const allModelsData = await fetchAllModels(client, userId);
  const availableModelsMap = new Map<string, AvailableModel>();

  [...allModelsData.groq, ...allModelsData.openrouter, ...allModelsData.nanogpt].forEach((model) => {
    const baseName = `${model.provider}/${model.id}`;
    availableModelsMap.set(baseName, model);
  });

  const isVisionRequest = capabilityFilter === "vision";
  const resultModels: AvailableModel[] = [];

  for (const model of availableModelsMap.values()) {
    if (isVisionRequest) {
      if (model?.capabilities.vision) {
        resultModels.push(model);
      }
    } else if (model) {
      resultModels.push(model);
    }
  }

  resultModels.sort((a, b) => {
    if (a.isFeatured && !b.isFeatured) return -1;
    if (!a.isFeatured && b.isFeatured) return 1;
    return (a.name || a.id).localeCompare(b.name || b.id);
  });

  const featuredCount = resultModels.filter((model) => model.isFeatured).length;
  console.log(`[getAvailableModels] Total models: ${resultModels.length}, Featured models: ${featuredCount}`);
  if (featuredCount > 0) {
    console.log(
      `[getAvailableModels] Featured models:`,
      resultModels.filter((model) => model.isFeatured).map((model) => model.name)
    );
  }

  console.log(
    `Returning ${resultModels.length} available models for ${isVisionRequest ? "VISION" : "TEXT"} request`
  );
  return resultModels;
}

export async function getModelDetails(
  client: unknown,
  prefixedModelId: string
): Promise<AvailableModel | null> {
  const allModels = await fetchAllModels(client);
  const allCombined = [...allModels.groq, ...allModels.openrouter, ...allModels.nanogpt];

  let model = allCombined.find((entry) => entry.name === prefixedModelId) || null;

  if (!model) {
    console.warn(`Model details not found for prefixed ID: ${prefixedModelId}`);
    const parts = prefixedModelId.split("/");
    if (parts.length === 2) {
      const [provider, id] = parts;
      model = allCombined.find((entry) => entry.provider === provider && entry.id === id) || null;
    }
  }

  if (model) {
    const cacheKey = `${model.provider}/${model.id}`;
    const modelStatus = getStateModelStatus();
    if (modelStatus.toolSupport.has(cacheKey)) {
      model.capabilities.tools = modelStatus.toolSupport.get(cacheKey);
      console.log(`Updated tool support for ${prefixedModelId} from cache: ${model.capabilities.tools}`);
    } else if (modelStatus.modelsWithoutTools.has(model.id)) {
      model.capabilities.tools = false;
      modelStatus.toolSupport.set(cacheKey, false);
      console.log(`Marked ${prefixedModelId} as not supporting tools based on dynamic list`);
    }
  }

  return model;
}

export async function getApiClientForModel(
  client: unknown,
  prefixedModelId: string
): Promise<ApiClientForModel> {
  const modelDetails = await getModelDetails(client, prefixedModelId);
  if (!modelDetails) {
    throw new Error(`Could not find details or client for model: ${prefixedModelId}`);
  }

  return {
    client: null,
    provider: modelDetails.provider || "unknown",
    modelId: modelDetails.id,
  };
}

export async function getModelCapabilities(
  client: unknown,
  prefixedModelId: string
): Promise<ModelCapabilities> {
  const modelDetails = await getModelDetails(client, prefixedModelId);
  if (!modelDetails) {
    console.error(`Could not determine capabilities for unknown model: ${prefixedModelId}`);
    return { vision: false, tools: false, maxContext: 8192 };
  }
  return modelDetails.capabilities;
}

export function updateModelCooldown(modelId: string, durationMs = 60000): void {
  getStateModelStatus().rateLimits[modelId] = Date.now() + durationMs;
  console.log(`Set cooldown for ${modelId} for ${durationMs}ms`);
}

export function checkModelRateLimit(modelId: string): RateLimitStatus {
  const modelStatus = getStateModelStatus();
  const expireTime = modelStatus.rateLimits[modelId];
  if (!expireTime) {
    return { isLimited: false, remainingTime: 0 };
  }

  const now = Date.now();
  if (now > expireTime) {
    delete modelStatus.rateLimits[modelId];
    return { isLimited: false, remainingTime: 0 };
  }

  return {
    isLimited: true,
    remainingTime: Math.ceil((expireTime - now) / 1000 / 60),
  };
}

export function markModelAsNotSupportingTools(modelId: string): void {
  const parts = modelId.split("/");
  const baseId = parts.length > 1 ? (parts[1] || modelId) : modelId;
  const modelStatus = getStateModelStatus();

  modelStatus.modelsWithoutTools.add(baseId);
  modelStatus.toolSupport.set(modelId, false);
  console.log(`Added ${modelId} to list of models without tool support`);
}

export function supportsReasoning(modelId: string): boolean {
  if (!modelId) return false;

  const parts = modelId.split("/");
  let provider: string | undefined;
  let baseModelId: string;

  if (parts.length === 3) {
    provider = parts[0];
    baseModelId = `${parts[1]}/${parts[2]}`;
  } else if (parts.length === 2) {
    provider = parts[0];
    baseModelId = parts[1] || modelId;
  } else {
    baseModelId = modelId;
  }

  const modelDetails = getStateModelStatus().modelCapabilitiesCache?.get(modelId);
  if (modelDetails?.capabilities?.reasoning) {
    return true;
  }

  if (provider === "openrouter" || provider === "nanogpt") {
    const reasoningKeywords = ["reason", "ration", "logic", "think"];
    return reasoningKeywords.some((keyword) => baseModelId.toLowerCase().includes(keyword));
  }

  return false;
}
