import i18n from "../utils/newI18n.js";
import {
  StringSelectMenuBuilder,
  ButtonBuilder,
  ActionRowBuilder,
} from "discord.js";
import CONFIG from "../config/aiConfig.js";
import {
  getUserPreferences,
  updateUserPreference,
  clearUserHistory,
} from "../state/prefs.js";
import { state } from "../state/state.js";
import {
  getAvailableModels,
  getModelCapabilities,
  getModelDetails,
} from "./aiModels.js";
import processAiRequest from "../handlers/processAiRequest.js";

// Track the last message with components for each user
const lastUserComponentMessages = new Map();

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

export async function buildInteractionComponents(
  userId,
  availableModels,
  isVision = false,
  noButtons = false,
  locale = "en",
  client = null
) {
  const prefs = getUserPreferences(userId);
  let effectiveMaxContext = (CONFIG.maxContextLength || 4) * 2; // Default
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
          `No selected model details available for ${prefs.selectedModel}, disabling tools button`
        );
      }
    } catch (error) {
      console.warn(
        "Error getting model details for context adjustment:",
        error
      );
      selectedModelDetails = null; // Ensure it's null on error to avoid disabling tools incorrectly
    }
  }
  const components = [];

  // Model select menu
  if (availableModels?.length) {
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
  }

  if (!noButtons) {
    let sysPromptLabel = prefs.systemPromptEnabled
      ? i18n.__("events.ai.buttons.systemPrompt.on")
      : i18n.__("events.ai.buttons.systemPrompt.off");
    let sysPromptStyle = prefs.systemPromptEnabled ? 1 : 2;
    let sysPromptDisabled = false;

    // Check if system prompt is explicitly disabled for this model in config
    const modelIsDisabledInConfig =
      selectedModelDetails &&
      CONFIG.disableSystemPromptFor?.includes(
        `${selectedModelDetails.provider}/${selectedModelDetails.id}`
      );

    if (modelIsDisabledInConfig) {
      console.log(
        `System prompt explicitly disabled for ${prefs.selectedModel} via config. Disabling button.`
      );
      sysPromptLabel = i18n.__("events.ai.buttons.systemPrompt.off");
      sysPromptStyle = 2; // Secondary style (OFF)
      sysPromptDisabled = true;
    }

    const systemBtn = new ButtonBuilder()
      .setCustomId(`ai_toggle_context_${userId}`)
      .setLabel(sysPromptLabel)
      .setStyle(sysPromptStyle)
      .setDisabled(sysPromptDisabled);

    let toolsLabel =
      i18n.__("events.ai.buttons.systemPrompt.tools.on") || "Tools: ON";
    let toolsStyle = prefs.toolsEnabled ? 1 : 2; // 1 for primary, 2 for secondary
    let toolsDisabled = false;
    let modelSupportsTools = true; // Track if the model supports tools

    // First check user preference for label and style
    if (!prefs.toolsEnabled) {
      toolsLabel =
        i18n.__("events.ai.buttons.systemPrompt.tools.off") || "Tools: OFF";
      toolsStyle = 2; // Secondary style when off
    }

    // Then check if model details are available
    if (!selectedModelDetails) {
      modelSupportsTools = false;
      toolsDisabled = true;
      console.log(
        `No model details available for ${prefs.selectedModel}, disabling tools`
      );
      toolsLabel =
        i18n.__("events.ai.buttons.systemPrompt.tools.offModel", locale) ||
        "Tools: OFF (Model)";
    }
    // Check the model's capabilities and cache
    else {
      // Check the global cache first (most up-to-date)
      const cacheKey = `${selectedModelDetails.provider}/${selectedModelDetails.id}`;
      if (state.modelToolSupportCache.has(cacheKey)) {
        modelSupportsTools = state.modelToolSupportCache.get(cacheKey);
        if (!modelSupportsTools) {
          toolsDisabled = true;
          console.log(
            `Tools not supported for ${prefs.selectedModel} (from cache), disabling button`
          );
          toolsLabel =
            i18n.__("events.ai.buttons.systemPrompt.tools.offModel", locale) ||
            "Tools: OFF (Model)";
        } else {
          console.log(
            `Tools supported for ${prefs.selectedModel} (from cache), button ${
              prefs.toolsEnabled ? "ON" : "OFF"
            } based on user preference`
          );
        }
      }
      // Fall back to capabilities if not in cache
      else if (!selectedModelDetails.capabilities?.tools) {
        modelSupportsTools = false;
        toolsDisabled = true;
        console.log(
          `Tools not supported in capabilities for ${prefs.selectedModel}, disabling`
        );
        toolsLabel =
          i18n.__("events.ai.buttons.systemPrompt.tools.offModel", locale) ||
          "Tools: OFF (Model)";
      }
    }

    console.log(
      `Final tools button state - Disabled: ${toolsDisabled}, Model Supports: ${modelSupportsTools}, User Preference: ${
        prefs.toolsEnabled
      }, Label: ${toolsLabel || "unknown"}`
    );

    // Make sure we have a valid string for the button label
    if (!toolsLabel || typeof toolsLabel !== "string") {
      toolsLabel =
        prefs.toolsEnabled && modelSupportsTools ? "Tools: ON" : "Tools: OFF";
      console.log(`Using fallback tools label: ${toolsLabel}`);
    }

    const toolsBtn = new ButtonBuilder()
      .setCustomId(`ai_toggle_tools_${userId}`)
      .setLabel(toolsLabel)
      .setStyle(toolsStyle)
      .setDisabled(toolsDisabled);

    const current = prefs.messageHistory.length;
    const clearBtn = new ButtonBuilder()
      .setCustomId(`ai_clear_context_${userId}`)
      .setLabel(
        i18n.__("events.ai.buttons.systemPrompt.clearContext", {
          current,
          max: effectiveMaxContext,
        })
      )
      .setStyle(4)
      .setDisabled(current === 0);

    components.push(
      new ActionRowBuilder().addComponents([systemBtn, toolsBtn, clearBtn])
    );
  }

  return components;
}

export async function sendResponse(
  message,
  processingMessage,
  content,
  components = [],
  locale = "en"
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
        const [_, action, subaction, id] = interaction.customId.split("_");
        // Only handle interactions for this user
        if (id !== userId) return;
        // Handle button interactions
        if (interaction.isButton()) {
          if (action === "toggle" && subaction === "context") {
            const prefs = getUserPreferences(userId);
            updateUserPreference(
              userId,
              "systemPromptEnabled",
              !prefs.systemPromptEnabled
            );
          } else if (action === "toggle" && subaction === "tools") {
            const prefs = getUserPreferences(userId);
            updateUserPreference(userId, "toolsEnabled", !prefs.toolsEnabled);
          } else if (action === "clear" && subaction === "context") {
            clearUserHistory(userId);
          }
        } else if (interaction.isStringSelectMenu()) {
          // Handle model select menu
          if (action === "select" && subaction === "model") {
            const selectedModel = interaction.values[0];
            updateUserPreference(userId, "selectedModel", selectedModel);
          }
        }
        // Rebuild components to reflect updated preferences
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
        // If the user just selected a new model, retry the AI request with that model
        if (
          interaction.isStringSelectMenu() &&
          action === "select" &&
          subaction === "model"
        ) {
          const messageContent = message.content
            .replace(new RegExp(`<@!?${message.client.user.id}>`, "g"), "")
            .trim();
          const newVisionRequest =
            message.attachments.size > 0 &&
            message.attachments.first().contentType?.startsWith("image/");
          // Stop the collector only when selecting a new model, as we'll process a new AI request
          collector.stop();
          // Clear history before processing with the new model
          clearUserHistory(userId);
          console.log(
            `Cleared history for user ${userId} due to model switch.`
          );
          await processAiRequest(
            message,
            userId,
            messageContent,
            newVisionRequest,
            finalMsg,
            locale
          );
        }
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
}
