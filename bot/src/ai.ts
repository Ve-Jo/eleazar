import {
  initializeApiClients,
  getAvailableModels,
  getModelDetails,
  getModelCapabilities,
  getApiClientForModel,
  updateModelCooldown,
  checkModelRateLimit,
} from "./services/ai/aiService.ts";
import {
  state,
  getUserPreferences,
  updateUserPreference,
  clearUserHistory,
  addConversationToHistory,
  isModelRateLimited,
  setModelRateLimit,
  isModelWithoutTools,
  supportsReasoning,
  markModelAsNotSupportingTools,
  setPendingInteraction,
  getPendingInteraction,
  deletePendingInteraction,
  hasPendingInteraction,
} from "./services/ai/index.ts";
import {
  splitMessage,
  buildInteractionComponents,
  sendResponse,
  handleFinetuneModal,
  buildErrorComponents,
  buildProviderOptions,
  buildPaginatedModelMenu,
} from "./services/ai/messages.ts";
import { generateToolsFromCommands } from "./services/ai/tools.ts";

type ModelDetailsGetter = (client: unknown, modelId: string) => Promise<unknown>;

async function isModelAvailable(client: unknown, modelId: string): Promise<boolean> {
  try {
    const model = await (getModelDetails as ModelDetailsGetter)(client, modelId);
    return !!model;
  } catch (error) {
    console.error(`Error checking if model ${modelId} is available:`, error);
    return false;
  }
}

export {
  state,
  getUserPreferences,
  updateUserPreference,
  clearUserHistory,
  addConversationToHistory,
  initializeApiClients,
  getAvailableModels,
  getModelDetails,
  getModelCapabilities,
  getApiClientForModel,
  isModelRateLimited,
  setModelRateLimit,
  isModelWithoutTools,
  supportsReasoning,
  markModelAsNotSupportingTools,
  splitMessage,
  buildInteractionComponents,
  sendResponse,
  buildErrorComponents,
  buildProviderOptions,
  buildPaginatedModelMenu,
  generateToolsFromCommands,
  handleFinetuneModal,
  updateModelCooldown,
  checkModelRateLimit,
  isModelAvailable,
  setPendingInteraction,
  getPendingInteraction,
  deletePendingInteraction,
  hasPendingInteraction,
};
