import {
  checkModelRateLimit,
  updateModelCooldown,
  markModelAsNotSupportingTools as markModelNotSupportingTools,
  supportsReasoning as modelSupportsReasoning,
} from "./aiService.ts";

type MessageHistoryEntry = {
  role: string;
  content: string;
};

type AIParams = {
  temperature: number;
  top_p: number;
  max_tokens: number;
  web_search: boolean;
  [key: string]: string | number | boolean;
};

type UserPreferenceRecord = {
  selectedModel: string | null;
  systemPromptEnabled: boolean;
  toolsEnabled: boolean;
  reasoningEnabled: boolean;
  reasoningLevel: string;
  messageHistory: MessageHistoryEntry[];
  aiParams: AIParams;
  reasoningSettings?: { effort?: string };
  [key: string]: unknown;
};

type ModelCacheState = {
  models: unknown[];
  lastFetched: number;
  cacheDuration: number;
};

type ModelStatusState = {
  rateLimits: Record<string, number>;
  toolSupport: Map<string, boolean>;
  modelsWithoutTools: Set<string>;
  modelCapabilitiesCache: Map<string, unknown>;
};

type AIState = {
  userPreferences: Record<string, UserPreferenceRecord>;
  pendingInteractions: Record<string, unknown>;
  modelCache: ModelCacheState;
  clients: Record<string, unknown>;
  modelStatus: ModelStatusState;
};

const defaultAiParamConfig = {
  temperature: { default: 0.7, min: 0, max: 2, step: 0.1 },
  top_p: { default: 0.9, min: 0, max: 1, step: 0.1 },
  max_tokens: { default: 2048, min: 1, max: 8192, step: 1 },
  web_search: { default: false },
};

function buildDefaultAiParams(): AIParams {
  return Object.fromEntries(
    Object.entries(defaultAiParamConfig).map(([key, param]) => [key, param.default])
  ) as AIParams;
}

const state: AIState = {
  userPreferences: {},
  pendingInteractions: {},
  modelCache: {
    models: [],
    lastFetched: 0,
    cacheDuration: 3600 * 1000,
  },
  clients: {},
  modelStatus: {
    rateLimits: {},
    toolSupport: new Map<string, boolean>(),
    modelsWithoutTools: new Set<string>(),
    modelCapabilitiesCache: new Map<string, unknown>(),
  },
};

function isModelRateLimited(modelId: string): boolean {
  const { isLimited } = checkModelRateLimit(modelId) as { isLimited: boolean };
  return isLimited;
}

function setModelRateLimit(modelId: string, durationMs = 60000): void {
  updateModelCooldown(modelId, durationMs);
}

function markModelAsNotSupportingTools(modelId: string): void {
  markModelNotSupportingTools(modelId);
}

function isModelWithoutTools(modelId: string): boolean {
  return state.modelStatus.modelsWithoutTools.has(modelId);
}

function supportsReasoning(modelId: string): boolean {
  return modelSupportsReasoning(modelId);
}

function getUserPreferences(userId: string): UserPreferenceRecord {
  if (!state.userPreferences[userId]) {
    state.userPreferences[userId] = {
      selectedModel: null,
      systemPromptEnabled: true,
      toolsEnabled: true,
      reasoningEnabled: true,
      reasoningLevel: "medium",
      messageHistory: [],
      aiParams: buildDefaultAiParams(),
    };
  } else {
    const existingParams = state.userPreferences[userId].aiParams || {};
    state.userPreferences[userId].aiParams = {
      ...existingParams,
      ...Object.fromEntries(
        Object.entries(defaultAiParamConfig)
          .filter(([key]) => existingParams[key] === undefined)
          .map(([key, param]) => [key, param.default])
      ),
    } as AIParams;

    if (state.userPreferences[userId].aiParams.web_search === undefined) {
      state.userPreferences[userId].aiParams.web_search = false;
    }

    if (!Object.prototype.hasOwnProperty.call(state.userPreferences[userId], "reasoningLevel")) {
      state.userPreferences[userId].reasoningLevel = "medium";
    }

    if (Object.prototype.hasOwnProperty.call(state.userPreferences[userId], "reasoningSettings")) {
      if (!Object.prototype.hasOwnProperty.call(state.userPreferences[userId], "reasoningLevel")) {
        const settings = state.userPreferences[userId].reasoningSettings;
        if (!state.userPreferences[userId].reasoningEnabled) {
          state.userPreferences[userId].reasoningLevel = "off";
        } else {
          state.userPreferences[userId].reasoningLevel = settings?.effort || "medium";
        }
      }
      delete state.userPreferences[userId].reasoningSettings;
    }

    if (!Object.prototype.hasOwnProperty.call(state.userPreferences[userId], "reasoningEnabled")) {
      state.userPreferences[userId].reasoningEnabled =
        state.userPreferences[userId].reasoningLevel !== "off";
    }
  }

  return state.userPreferences[userId];
}

function updateUserPreference(userId: string, key: string, value: unknown): UserPreferenceRecord {
  const prefs = getUserPreferences(userId);
  prefs[key] = value;
  return prefs;
}

function clearUserHistory(userId: string): void {
  getUserPreferences(userId).messageHistory = [];
  console.log(`Cleared message history for user ${userId}`);
}

function addConversationToHistory(
  userId: string,
  userMessage: string,
  aiResponse: string
): void {
  const prefs = getUserPreferences(userId);

  prefs.messageHistory.push({ role: "user", content: userMessage });
  prefs.messageHistory.push({ role: "assistant", content: aiResponse });

  const currentTokens = prefs.messageHistory.reduce((total, msg) => {
    return total + (msg.content ? msg.content.length * 0.75 : 0);
  }, 0);

  const modelContextWindow = 8192;
  const maxTokens = modelContextWindow * 0.9;
  if (currentTokens > maxTokens) {
    const hasSystemMessage =
      prefs.systemPromptEnabled && prefs.messageHistory.some((message) => message.role === "system");

    prefs.messageHistory.splice(hasSystemMessage ? 1 : 0, 2);

    console.log(
      `[DEBUG] Trimmed context for user ${userId}: ${currentTokens} tokens > ${maxTokens} max tokens`
    );
  }
}

export {
  state,
  isModelRateLimited,
  setModelRateLimit,
  markModelAsNotSupportingTools,
  isModelWithoutTools,
  supportsReasoning,
  getUserPreferences,
  updateUserPreference,
  clearUserHistory,
  addConversationToHistory,
};
