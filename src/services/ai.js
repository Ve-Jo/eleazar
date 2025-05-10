import { Groq } from "groq-sdk";
import OpenAI from "openai";
import fetch from "node-fetch";
import {
  StringSelectMenuBuilder,
  ButtonBuilder,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import CONFIG from "../config/aiConfig.js";
import i18n from "../utils/newI18n.js";
import {
  state,
  getUserPreferences,
  updateUserPreference,
  clearUserHistory,
  addConversationToHistory,
  isModelWithoutTools,
  markModelAsNotSupportingTools,
} from "../state/index.js";

// =============================================================================
// MODEL MANAGEMENT
// =============================================================================

// --- Model Cache ---
let cachedModels = null; // { groq: [], openrouter: [] }
let lastFetchTime = 0;
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

// --- Helper Functions ---

// Extracts size info from model names
function extractModelSize(modelId) {
  const match = modelId.match(/([\d.]+[mMkKbB])[-\s_]/i);
  return match ? match[1].toUpperCase() : null;
}

// Standardizes model names for display
function formatModelName(model, provider) {
  return `${provider}/${model.id}`;
}

// --- Model Fetching ---

// Fetch models from Groq API
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

    // Fallback: create models from config if API call fails
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
    const preferredTextModels = new Set(
      CONFIG.openrouter.preferredModels?.text || []
    );
    const preferredVisionModels = new Set(
      CONFIG.openrouter.preferredModels?.vision || []
    );

    // Fetch all models from API
    const models = await openRouterClient.models.list();
    console.log(`Fetched ${models.data.length} models from OpenRouter API`);

    // Filter to only include models in our preferred lists
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

    // Fallback: create models from config if API call fails
    console.log("Using fallback preferred models from config");
    const fallbackModels = [];

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

// --- Model Retrieval ---

// Get available models filtered by capability
export async function getAvailableModels(client, capabilityFilter = null) {
  const allModelsData = await fetchAllModels(client);

  const availableModelsMap = new Map();
  [...allModelsData.groq, ...allModelsData.openrouter].forEach((model) => {
    const baseName = `${model.provider}/${model.id}`;
    availableModelsMap.set(baseName, model);
  });

  const isVisionRequest = capabilityFilter === "vision";
  let preferredModelNamesConfig = [];
  let resultModels = [];
  const addedModelNames = new Set();
  let uniquePreferredModelNames = [];

  if (isVisionRequest) {
    // Vision request - only use vision models from config
    preferredModelNamesConfig = [
      ...(CONFIG.groq.preferredModels?.vision || []).map((id) => `groq/${id}`),
      ...(CONFIG.openrouter.preferredModels?.vision || []).map(
        (id) => `openrouter/${id}`
      ),
    ];
    console.log("Filtering for VISION models based on config.");

    // Remove duplicates preserving order from the vision config list
    uniquePreferredModelNames = [...new Set(preferredModelNamesConfig)];

    // Add available models ONLY from the preferred vision list
    for (const modelName of uniquePreferredModelNames) {
      const model = availableModelsMap.get(modelName);
      if (model && model.capabilities.vision) {
        resultModels.push(model);
        addedModelNames.add(modelName);
      }
    }
  } else {
    // Text request - use text models from config
    preferredModelNamesConfig = [
      ...(CONFIG.groq.preferredModels?.text || []).map((id) => `groq/${id}`),
      ...(CONFIG.openrouter.preferredModels?.text || []).map(
        (id) => `openrouter/${id}`
      ),
    ];
    console.log("Prioritizing TEXT models based on config.");

    // Remove duplicates preserving order from the text config list
    uniquePreferredModelNames = [...new Set(preferredModelNamesConfig)];

    // Add available models ONLY from the preferred text list
    for (const modelName of uniquePreferredModelNames) {
      const model = availableModelsMap.get(modelName);
      if (model) {
        resultModels.push(model);
        addedModelNames.add(modelName);
      }
    }
  }

  console.log(
    `Returning ${resultModels.length} available models for ${
      isVisionRequest ? "VISION" : "TEXT"
    } request, ordered by config preference.`
  );

  return resultModels;
}

// Get details for a specific model by ID
export async function getModelDetails(client, prefixedModelId) {
  const allModels = await fetchAllModels(client);
  const allCombined = [...allModels.groq, ...allModels.openrouter];

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

    // Use the state structure for tool support
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

// Get the API client for a model
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

// Get capabilities for a specific model
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

// Update model cooldown
export function updateModelCooldown(modelId) {
  // Placeholder for rate limiting implementation
  console.log(`Cooldown update requested for ${modelId} (placeholder)`);
}

// =============================================================================
// MESSAGE HANDLING
// =============================================================================

// Track the last message with components for each user
const lastUserComponentMessages = new Map();

// Split message into smaller chunks if needed
export function splitMessage(message, maxLength = 2000) {
  if (message.length <= maxLength) return [message];
  const chunks = [];
  let currentChunk = "";
  let inCodeBlock = false;
  let codeLang = "";
  const lines = message.split("\n");

  for (const line of lines) {
    const len = line.length + 1;
    const codeMatch = line.match(/^```(\w*)/);

    if (codeMatch) {
      if (inCodeBlock) {
        inCodeBlock = false;
        if (currentChunk.length + len > maxLength) {
          chunks.push(currentChunk + "\n```");
          currentChunk = "```" + codeLang + "\n" + line;
          inCodeBlock = true;
        } else {
          currentChunk += "\n" + line;
        }
      } else {
        inCodeBlock = true;
        codeLang = codeMatch[1] || "";
        if (currentChunk.length + len > maxLength) {
          if (currentChunk) chunks.push(currentChunk);
          currentChunk = line;
        } else {
          currentChunk += (currentChunk ? "\n" : "") + line;
        }
      }
    } else if (currentChunk.length + len <= maxLength) {
      currentChunk += (currentChunk ? "\n" : "") + line;
    } else {
      if (inCodeBlock) {
        chunks.push(currentChunk + "\n```");
        currentChunk = "```" + codeLang + "\n" + line;
      } else {
        chunks.push(currentChunk);
        currentChunk = line;
      }
    }
  }

  if (currentChunk) chunks.push(currentChunk);
  if (inCodeBlock && !chunks[chunks.length - 1].trim().endsWith("```")) {
    chunks[chunks.length - 1] += "\n```";
  }

  return chunks.map((c) => c.trim()).filter(Boolean);
}

// Build interactive components for AI responses
export async function buildInteractionComponents(
  userId,
  availableModels,
  isVision = false,
  noButtons = false,
  locale = "en",
  client = null
) {
  const prefs = getUserPreferences(userId);
  let effectiveMaxContext = (CONFIG.maxContextLength || 4) * 2;
  let selectedModelDetails = null;

  if (prefs.selectedModel && client) {
    try {
      selectedModelDetails = await getModelDetails(client, prefs.selectedModel);
      if (selectedModelDetails) {
        console.log(
          `Model details for ${prefs.selectedModel}:`,
          selectedModelDetails
        );
        if (selectedModelDetails.provider === "openrouter") {
          effectiveMaxContext = 4 * 2; // 4 pairs for OpenRouter
        }
      } else {
        console.log(
          `No selected model details available for ${prefs.selectedModel}`
        );
      }
    } catch (error) {
      console.warn(
        "Error getting model details for context adjustment:",
        error
      );
      selectedModelDetails = null;
    }
  }

  const components = [];

  // For initial model selection only - show model selection menu
  if (noButtons && availableModels?.length) {
    i18n.setLocale(locale);

    const menu = new StringSelectMenuBuilder()
      .setCustomId(`ai_select_model_${userId}`)
      .setPlaceholder(
        i18n.__("events.ai.buttons.menus.modelSelect.placeholder")
      );

    const opts = availableModels.slice(0, 25).map((m) => ({
      label: m.name.length > 100 ? m.name.substring(0, 97) + "..." : m.name,
      value: m.name,
      default: m.name === prefs.selectedModel,
    }));

    menu.addOptions(opts);
    components.push(new ActionRowBuilder().addComponents(menu));
    return components;
  }

  // For regular chat interactions - settings menu
  if (!noButtons) {
    i18n.setLocale(locale);

    // Create settings select menu
    const settingsMenu = new StringSelectMenuBuilder()
      .setCustomId(`ai_settings_menu_${userId}`)
      .setPlaceholder(
        prefs.selectedModel
          ? `${prefs.selectedModel} - ${
              i18n.__(
                "events.ai.buttons.menus.settingsSelect.placeholder",
                locale
              ) || "Settings"
            }`
          : i18n.__(
              "events.ai.buttons.menus.settingsSelect.placeholder",
              locale
            ) || "Settings"
      );

    // Check if system prompt should be disabled for this model
    const modelIsDisabledInConfig =
      selectedModelDetails &&
      CONFIG.disableSystemPromptFor?.includes(
        `${selectedModelDetails.provider}/${selectedModelDetails.id}`
      );

    // System prompt option (combined with command guidance)
    const sysPromptEnabled =
      prefs.systemPromptEnabled && !modelIsDisabledInConfig;
    settingsMenu.addOptions({
      label: i18n.__(
        sysPromptEnabled
          ? "events.ai.buttons.systemPrompt.on"
          : "events.ai.buttons.systemPrompt.off"
      ),
      value: "toggle_context",
      description: "Toggle system instructions and command guidance",
      emoji: sysPromptEnabled ? "✅" : "❌",
      default: false,
    });

    // Clear context option
    const current = prefs.messageHistory.length;
    settingsMenu.addOptions({
      label: i18n.__("events.ai.buttons.systemPrompt.clearContext", {
        current,
        max: effectiveMaxContext,
      }),
      value: "clear_context",
      description:
        i18n.__(
          "events.ai.buttons.menus.settingsOptions.clearContext",
          locale
        ) || "Clear conversation history",
      emoji: "🗑️",
      disabled: current === 0,
      default: false,
    });

    // Fine-tune settings option
    settingsMenu.addOptions({
      label: i18n.__("events.ai.buttons.finetune.buttonLabel", locale),
      value: "finetune_settings",
      description:
        i18n.__("events.ai.buttons.menus.settingsOptions.finetune", locale) ||
        "Adjust AI generation parameters",
      emoji: "🎛️",
      default: false,
    });

    // Switch model option
    settingsMenu.addOptions({
      label:
        i18n.__(
          "events.ai.buttons.menus.settingsOptions.switchModel.label",
          locale
        ) || "Switch Model",
      value: "switch_model",
      description:
        i18n.__(
          "events.ai.buttons.menus.settingsOptions.switchModel.description",
          locale
        ) || "Change the AI model",
      emoji: "🔄",
      default: false,
    });

    components.push(new ActionRowBuilder().addComponents(settingsMenu));
  }

  return components;
}

// Send AI response to user
export async function sendResponse(
  message,
  processingMessage,
  content,
  components = [],
  locale = "en",
  isStreaming = false
) {
  i18n.setLocale(locale);

  const userId = message.author.id;
  const sanitized = content
    .replace(
      /<@[!&]?\d+>/g,
      i18n.__("events.ai.buttons.sanitization.mention", locale)
    )
    .replace(
      /@everyone/gi,
      i18n.__("events.ai.buttons.sanitization.everyone", locale)
    )
    .replace(/@here/gi, i18n.__("events.ai.buttons.sanitization.here", locale));

  const chunks = splitMessage(sanitized);
  let finalMsg;

  // Remove components from previous message if it exists
  if (
    lastUserComponentMessages.has(userId) &&
    lastUserComponentMessages.get(userId).collector
  ) {
    lastUserComponentMessages.get(userId).collector.stop();
    lastUserComponentMessages.delete(userId);
  }

  // If streaming is already completed, don't modify the message yet
  if (isStreaming) {
    // For streaming, we want to keep the message as is, but send additional chunks if needed
    finalMsg = processingMessage;
    for (let i = 1; i < chunks.length; i++) {
      await message.channel.send(chunks[i]).catch(() => {});
    }
    return finalMsg; // Return early, components will be added after streaming is done
  }

  try {
    // Ensure components are V1 Action Rows
    const v1Components = Array.isArray(components)
      ? components.filter(
          (c) => c instanceof ActionRowBuilder || (c && c.type === 1)
        )
      : [];

    await processingMessage.edit({
      content: chunks[0] || "...",
      components: v1Components,
    });
    finalMsg = processingMessage;
  } catch {
    // Ensure components are V1 Action Rows for fallback
    const v1Components = Array.isArray(components)
      ? components.filter(
          (c) => c instanceof ActionRowBuilder || (c && c.type === 1)
        )
      : [];

    finalMsg = await message.channel.send({
      content: chunks[0] || "...",
      components: v1Components,
    });
  }

  for (let i = 1; i < chunks.length; i++) {
    await message.channel.send(chunks[i]).catch(() => {});
  }

  // Also use the filtered V1 components when deciding to attach the collector
  const finalV1Components = Array.isArray(components)
    ? components.filter(
        (c) => c instanceof ActionRowBuilder || (c && c.type === 1)
      )
    : [];

  // Store the new message with components
  if (finalMsg && finalV1Components.length) {
    lastUserComponentMessages.set(userId, finalMsg);

    const collector = finalMsg.createMessageComponentCollector({
      filter: (i) =>
        (i.isButton() || i.isStringSelectMenu()) && i.user.id === userId,
      time: 15 * 60 * 1000,
    });

    collector.on("collect", async (interaction) => {
      try {
        // Handle settings menu selection
        if (
          interaction.isStringSelectMenu() &&
          interaction.customId === `ai_settings_menu_${userId}`
        ) {
          const selectedValue = interaction.values[0];
          const prefs = getUserPreferences(userId);

          switch (selectedValue) {
            case "toggle_context":
              // Toggle system prompt
              updateUserPreference(
                userId,
                "systemPromptEnabled",
                !prefs.systemPromptEnabled
              );
              break;

            case "clear_context":
              // Clear context
              clearUserHistory(userId);
              break;

            case "finetune_settings":
              // Show finetune modal
              await handleFinetuneModal(interaction, userId, locale);
              return; // Return early to prevent updating components

            case "switch_model":
              // Show model selection menu
              const isVisionRequest =
                message.attachments.size > 0 &&
                message.attachments.first().contentType?.startsWith("image/");

              const models = await getAvailableModels(
                message.client,
                isVisionRequest ? "vision" : null
              );

              const modelMenu = new StringSelectMenuBuilder()
                .setCustomId(`ai_select_model_${userId}`)
                .setPlaceholder(
                  i18n.__("events.ai.buttons.menus.modelSelect.placeholder")
                );

              const opts = models.slice(0, 25).map((m) => ({
                label:
                  m.name.length > 100
                    ? m.name.substring(0, 97) + "..."
                    : m.name,
                value: m.name,
                default: m.name === prefs.selectedModel,
              }));

              modelMenu.addOptions(opts);

              await interaction.update({
                components: [new ActionRowBuilder().addComponents(modelMenu)],
              });
              return; // Return early to prevent updating components
          }
        }
        // Handle original model select menu
        else if (
          interaction.isStringSelectMenu() &&
          interaction.customId === `ai_select_model_${userId}`
        ) {
          // Immediately defer the update to show loading state
          await interaction.deferUpdate();
          console.log(
            `Model selection: Interaction deferred for user ${userId}`
          );

          const selectedModel = interaction.values[0];
          updateUserPreference(userId, "selectedModel", selectedModel);
          console.log(
            `Model selection: Updated preference to ${selectedModel} for user ${userId}`
          );

          try {
            // Update the message to show processing state
            await finalMsg.edit({
              content:
                i18n.__(
                  "events.ai.messages.modelSelectedProcessing",
                  { model: selectedModel },
                  locale
                ) ||
                `Model changed to ${selectedModel}. Processing your request...`,
              components: [],
            });
            console.log(
              `Model selection: Updated message with processing state`
            );
          } catch (editError) {
            console.error(
              `Error updating message after model selection:`,
              editError
            );
          }

          // If user just selected a new model, retry the AI request with that model
          const messageContent = message.content
            .replace(new RegExp(`<@!?${message.client.user.id}>`, "g"), "")
            .trim();
          const newVisionRequest =
            message.attachments.size > 0 &&
            message.attachments.first().contentType?.startsWith("image/");

          // Stop the collector when selecting a new model
          collector.stop();
          // Clear history before processing with the new model
          clearUserHistory(userId);
          console.log(
            `Cleared history for user ${userId} due to model switch.`
          );

          // Process the request with the newly selected model
          const processAiRequest = (
            await import("../handlers/processAiRequest.js")
          ).default;

          try {
            await processAiRequest(
              message,
              userId,
              messageContent,
              newVisionRequest,
              finalMsg,
              locale
            );
            console.log(
              `Model selection: Completed processing with new model for user ${userId}`
            );
          } catch (processError) {
            console.error(
              `Error processing request with new model:`,
              processError
            );
            // Update message with error if processing failed
            try {
              await finalMsg.edit({
                content:
                  i18n.__(
                    "events.ai.messages.errorOccurred",
                    { error: processError.message },
                    locale
                  ) || `Error: ${processError.message}`,
                components: [],
              });
            } catch (finalEditError) {
              console.error(
                `Error updating message with error state:`,
                finalEditError
              );
            }
          }

          return; // Return early
        }

        // Rebuild components with updated preferences
        const isVisionRequest =
          message.attachments.size > 0 &&
          message.attachments.first().contentType?.startsWith("image/");
        const models = await getAvailableModels(
          message.client,
          isVisionRequest ? "vision" : null
        );
        const newComponents = await buildInteractionComponents(
          userId,
          models,
          isVisionRequest,
          false,
          locale,
          message.client
        );

        // Update original message with new components
        await interaction.update({ components: newComponents });
      } catch (error) {
        if (error.code === 10062) {
          // Unknown interaction
          console.error("Unknown interaction error:", error);
          await interaction
            .reply({
              content: "Interaction expired, please try again.",
              ephemeral: true,
            })
            .catch(() => {});
        } else {
          console.error("Error in collector:", error);
        }
      }
    });

    collector.on("end", () => {
      lastUserComponentMessages.delete(userId); // Ensure cleanup on end
    });
  }

  return finalMsg;
}

// Handle fine-tune settings modal
async function handleFinetuneModal(interaction, userId, locale = "en") {
  const prefs = getUserPreferences(userId);
  const { aiParams } = prefs;

  // Set locale for i18n
  i18n.setLocale(locale);

  // Determine provider from selected model
  let provider = "generic";
  if (prefs.selectedModel) {
    const parts = prefs.selectedModel.split("/");
    if (parts.length >= 2) {
      provider = parts[0]; // First part is the provider
    }
  }

  console.log(`Handling fine-tune modal for provider: ${provider}`);

  // Format values for display - filter parameters based on provider
  const paramOptions = Object.entries(CONFIG.aiParameters)
    .filter(([param, config]) => {
      // If parameter has provider restriction, check if current provider is supported
      if (config.providers && Array.isArray(config.providers)) {
        return config.providers.includes(provider);
      }
      // If no provider restriction, show the parameter for all providers
      return true;
    })
    .map(([param, config]) => ({
      label: i18n.__(
        `events.ai.buttons.finetune.parameters.${param}.label`,
        locale
      ),
      value: param,
      description: `${aiParams[param] || config.default} (${config.min}-${
        config.max
      })`,
    }));

  // Create selection menu
  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`ai_param_select_${userId}`)
      .setPlaceholder(
        i18n.__("events.ai.buttons.finetune.selectParameter", locale) ||
          "Select parameter to adjust"
      )
      .addOptions(paramOptions)
  );

  // Show parameter selection menu
  await interaction.reply({
    content:
      i18n.__("events.ai.buttons.finetune.selectParameterPrompt", locale) ||
      "Select an AI parameter to adjust:",
    components: [row],
    ephemeral: true,
  });

  // Collect parameter selection
  const message = await interaction.fetchReply();
  const collector = message.createMessageComponentCollector({
    filter: (i) =>
      i.customId === `ai_param_select_${userId}` && i.user.id === userId,
    time: 60000, // 1 minute
    max: 1,
  });

  collector.on("collect", async (i) => {
    try {
      const selectedParam = i.values[0];
      const paramConfig = CONFIG.aiParameters[selectedParam];

      // Create placeholder for modal input
      const placeholder = createParameterPlaceholder(
        selectedParam,
        paramConfig,
        aiParams[selectedParam],
        locale
      );

      // Create modal for parameter edit
      const modal = new ModalBuilder()
        .setCustomId(`ai_param_edit_${userId}_${selectedParam}`)
        .setTitle(
          i18n.__(
            `events.ai.buttons.finetune.parameters.${selectedParam}.label`,
            locale
          )
        );

      // Create text input for selected parameter
      const paramInput = new TextInputBuilder()
        .setCustomId("value")
        .setLabel(`${paramConfig.min}-${paramConfig.max}`)
        .setPlaceholder(placeholder)
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false);

      // Add input to modal
      modal.addComponents(new ActionRowBuilder().addComponents(paramInput));

      // Show modal for parameter edit
      await i.showModal(modal);

      // Wait for modal submission
      const modalInteraction = await i.awaitModalSubmit({
        filter: (mi) =>
          mi.customId === `ai_param_edit_${userId}_${selectedParam}`,
        time: 120000, // 2 minutes
      });

      // Process the parameter value
      const inputValue = modalInteraction.fields.getTextInputValue("value");
      const newValue = validateParameterValue(
        inputValue,
        selectedParam,
        aiParams[selectedParam] || paramConfig.default,
        paramConfig
      );

      // Update user preferences
      const updatedParams = { ...aiParams };
      updatedParams[selectedParam] = newValue;
      updateUserPreference(userId, "aiParams", updatedParams);

      // Acknowledge the parameter update
      await modalInteraction.reply({
        content: i18n.__(
          "events.ai.buttons.finetune.parameterUpdated",
          {
            parameter: i18n.__(
              `events.ai.buttons.finetune.parameters.${selectedParam}.label`,
              locale
            ),
            value: newValue,
          },
          locale
        ),
        ephemeral: true,
      });
    } catch (error) {
      console.error("Error handling parameter selection/edit:", error);
      try {
        await i
          .reply({
            content: i18n.__("events.ai.buttons.finetune.error", locale),
            ephemeral: true,
          })
          .catch(() => {});
      } catch (replyError) {
        console.error("Error sending reply:", replyError);
      }
    }
  });

  collector.on("end", (collected) => {
    if (collected.size === 0) {
      // Clean up if no selection was made
      message
        .edit({
          content:
            i18n.__("events.ai.buttons.finetune.selectionTimeout", locale) ||
            "Parameter selection timed out.",
          components: [],
        })
        .catch(console.error);
    }
  });
}

// Helper function to create parameter placeholder
function createParameterPlaceholder(
  paramName,
  paramConfig,
  currentValue,
  locale
) {
  const defaultVal = paramConfig.default;
  const description = i18n.__(
    `events.ai.buttons.finetune.parameters.${paramName}.description`,
    locale
  );

  // Create display for values
  const valuesText = `(Default: ${defaultVal})${
    defaultVal !== currentValue ? ` (Current: ${currentValue})` : ""
  }`;

  // Discord has a 100 character limit for placeholders
  const MAX_LENGTH = 100;

  if (description.length + valuesText.length + 1 <= MAX_LENGTH) {
    return `${description} ${valuesText}`;
  } else if (valuesText.length + 20 <= MAX_LENGTH) {
    const availableSpace = MAX_LENGTH - valuesText.length - 4;
    return `${description.substring(0, availableSpace)}... ${valuesText}`;
  } else {
    return valuesText;
  }
}

// Helper function to validate and parse parameter value
function validateParameterValue(input, paramName, currentValue, paramConfig) {
  // If empty input, keep current value
  if (!input || input.trim() === "") return currentValue || paramConfig.default;

  // Parse based on parameter type
  const parser =
    paramName === "top_k" || paramName === "max_completion_tokens"
      ? parseInt
      : parseFloat;

  try {
    // Parse and validate against min/max
    const parsedValue = parser(input);

    // Check if the value is valid
    if (isNaN(parsedValue)) {
      console.warn(
        `Invalid value for ${paramName}: ${input}, using default: ${paramConfig.default}`
      );
      return currentValue || paramConfig.default;
    }

    return Math.max(paramConfig.min, Math.min(paramConfig.max, parsedValue));
  } catch (e) {
    console.error(`Error parsing value for ${paramName}: ${e.message}`);
    return currentValue || paramConfig.default; // On error, keep current value or use default
  }
}
