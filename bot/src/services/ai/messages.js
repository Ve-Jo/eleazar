import i18n from "../../utils/i18n.js";
import {
  StringSelectMenuBuilder,
  ButtonBuilder,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import CONFIG from "../../config/aiConfig.js";
import {
  state,
  getUserPreferences,
  updateUserPreference,
  clearUserHistory,
  getAvailableModels,
  getModelCapabilities,
  getModelDetails,
  supportsReasoning,
} from "../../ai.js";
import processAiRequest from "../../handlers/processAiRequest.js";

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

// Helper function to build model options with proper descriptions and features
async function buildModelOptions(models, selectedModel, locale = "en") {
  const optionPromises = models.slice(0, 25).map(async (m) => {
    // Build descriptive features based on capabilities
    const features = [];

    // Add vision capability indicator if model supports it
    if (m.capabilities && m.capabilities.vision) {
      features.push(
        `🖼️ ${await i18n.__(
          "events.ai.buttons.menus.modelSelect.visionSupport",
          locale,
        )}`,
      );
    }

    // Add reasoning capability indicator if model supports it
    if (supportsReasoning(m.id)) {
      features.push(
        `🧠 ${await i18n.__(
          "events.ai.buttons.menus.modelSelect.reasoningSupport",
          locale,
        )}`,
      );
    }

    // Create option with or without description
    return {
      label: m.name.length > 100 ? m.name.substring(0, 97) + "..." : m.name,
      description: features.length > 0 ? features.join(" • ") : undefined,
      value: m.name,
      default: m.name === selectedModel,
      // Provider emoji can be added back if needed
    };
  });

  return Promise.all(optionPromises);
}

export async function buildInteractionComponents(
  userId,
  availableModels,
  isVision = false,
  noButtons = false,
  locale = "en",
  client = null,
) {
  const prefs = getUserPreferences(userId);
  let effectiveMaxContext = (CONFIG.maxContextLength || 4) * 2; // Default
  let selectedModelDetails = null;
  let modelContextWindow = 8192; // Default context window

  if (prefs.selectedModel && client) {
    try {
      selectedModelDetails = await getModelDetails(client, prefs.selectedModel);
      if (selectedModelDetails) {
        console.log(
          `Model details for ${prefs.selectedModel}:`,
          selectedModelDetails,
        );

        // Get the actual context window from config
        modelContextWindow =
          CONFIG.modelContextWindows?.[prefs.selectedModel] ||
          selectedModelDetails.capabilities?.maxContext ||
          8192;

        // Calculate effective max context based on token limit (rough estimate: 4 chars per token)
        const maxTokens = modelContextWindow * 0.9; // 90% safety margin
        effectiveMaxContext = Math.floor(maxTokens / 4); // Convert to characters

        console.log(
          `[DEBUG] Context window for ${prefs.selectedModel}: ${modelContextWindow} tokens, effective max: ${effectiveMaxContext} chars`,
        );
      } else {
        console.log(
          `No selected model details available for ${prefs.selectedModel}, disabling tools button`,
        );
      }
    } catch (error) {
      console.warn(
        "Error getting model details for context adjustment:",
        error,
      );
      selectedModelDetails = null; // Ensure it's null on error to avoid disabling tools incorrectly
    }
  }
  const components = [];

  // For initial model selection only - show model selection menu
  if (noButtons && availableModels?.length) {
    i18n.setLocale(locale);

    // Log model capabilities for debugging
    console.log("Building model selection with the following models:");
    availableModels.slice(0, 3).forEach((m) => {
      console.log(
        `Model ${m.name}: Vision=${
          m.capabilities?.vision
        }, Reasoning=${supportsReasoning(m.id)}`,
      );
    });
    if (availableModels.length > 3) {
      console.log(`... and ${availableModels.length - 3} more models`);
    }

    const menu = new StringSelectMenuBuilder()
      .setCustomId(`ai_select_model_${userId}`)
      .setPlaceholder(
        await i18n.__("events.ai.buttons.menus.modelSelect.placeholder"),
      );

    // Use the shared function to build options
    const opts = await buildModelOptions(
      availableModels,
      prefs.selectedModel,
      locale,
    );

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
              (await i18n.__(
                "events.ai.buttons.menus.settingsSelect.placeholder",
                locale,
              )) || "Settings"
            }`
          : (await i18n.__(
              "events.ai.buttons.menus.settingsSelect.placeholder",
              locale,
            )) || "Settings",
      );

    const options = [];

    // System prompt toggle option
    options.push({
      label: await i18n.__(
        "events.ai.buttons.menus.settingsSelect.systemPrompt",
      ),
      description: prefs.systemPromptEnabled
        ? await i18n.__(
            "events.ai.buttons.menus.settingsSelect.systemPromptEnabled",
          )
        : await i18n.__(
            "events.ai.buttons.menus.settingsSelect.systemPromptDisabled",
          ),
      value: "system_prompt",
      emoji: prefs.systemPromptEnabled ? "✅" : "❌",
    });

    // Tools support toggle
    options.push({
      label: await i18n.__("events.ai.buttons.menus.settingsSelect.tools"),
      description: prefs.toolsEnabled
        ? await i18n.__("events.ai.buttons.menus.settingsSelect.toolsEnabled")
        : await i18n.__("events.ai.buttons.menus.settingsSelect.toolsDisabled"),
      value: "tools",
      emoji: prefs.toolsEnabled ? "✅" : "❌",
    });

    // Check if we're using an OpenRouter model to add web search option
    const isOpenRouterModel =
      prefs.selectedModel && prefs.selectedModel.startsWith("openrouter/");
    /*if (isOpenRouterModel) {
      // Web search toggle
      options.push({
        label:
          await i18n.__("events.ai.buttons.menus.settingsSelect.webSearch") ||
          "Web Search",
        description: prefs.aiParams.web_search
          ? await i18n.__(
              "events.ai.buttons.menus.settingsSelect.webSearchEnabled"
            ) || "Search enabled"
          : await i18n.__(
              "events.ai.buttons.menus.settingsSelect.webSearchDisabled"
            ) || "Search disabled",
        value: "web_search",
        emoji: prefs.aiParams.web_search ? "✅" : "❌",
      });
    }*/

    // Clear context option with token usage display
    const current = prefs.messageHistory.length;
    const modelContextWindow =
      CONFIG.modelContextWindows?.[prefs.selectedModel] ||
      selectedModelDetails?.capabilities?.maxContext ||
      8192;
    const estimatedTokens = prefs.messageHistory.reduce((total, msg) => {
      return total + (msg.content ? msg.content.length * 0.75 : 0); // Rough estimate: 0.75 tokens per character
    }, 0);

    options.push({
      label: await i18n.__("events.ai.buttons.systemPrompt.clearContext", {
        current,
        max: effectiveMaxContext,
      }),
      value: "clear_context",
      description: `Tokens: ${Math.round(
        estimatedTokens,
      ).toLocaleString()} / ${modelContextWindow.toLocaleString()} (${Math.round(
        (estimatedTokens / modelContextWindow) * 100,
      )}%)`,
      emoji: "🗑️",
      disabled: current === 0,
      default: false,
    });

    // Fine-tune settings option
    options.push({
      label: await i18n.__("events.ai.buttons.finetune.buttonLabel", locale),
      value: "finetune_settings",
      description:
        (await i18n.__(
          "events.ai.buttons.menus.settingsOptions.finetune",
          locale,
        )) || "Adjust AI generation parameters",
      emoji: "🎛️",
      default: false,
    });

    // Switch model option
    options.push({
      label:
        (await i18n.__(
          "events.ai.buttons.menus.settingsOptions.switchModel.label",
          locale,
        )) || "Switch Model",
      value: "switch_model",
      description:
        (await i18n.__(
          "events.ai.buttons.menus.settingsOptions.switchModel.description",
          locale,
        )) || "Change the AI model",
      emoji: "🔄",
      default: false,
    });

    settingsMenu.addOptions(options);
    components.push(new ActionRowBuilder().addComponents(settingsMenu));
  }

  return components;
}

export async function sendResponse(
  message,
  processingMessage,
  content,
  components = [],
  locale = "en",
  isStreaming = false,
) {
  i18n.setLocale(locale);

  const userId = message.author.id;
  const sanitized = content
    .replace(
      /<@[!&]?\d+>/g,
      await i18n.__("events.ai.buttons.sanitization.mention", locale),
    )
    .replace(
      /@everyone/gi,
      await i18n.__("events.ai.buttons.sanitization.everyone", locale),
    )
    .replace(
      /@here/gi,
      await i18n.__("events.ai.buttons.sanitization.here", locale),
    );

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
          (c) => c instanceof ActionRowBuilder || (c && c.type === 1),
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
          (c) => c instanceof ActionRowBuilder || (c && c.type === 1),
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
        (c) => c instanceof ActionRowBuilder || (c && c.type === 1),
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
            case "system_prompt":
              // Toggle system prompt
              updateUserPreference(
                userId,
                "systemPromptEnabled",
                !prefs.systemPromptEnabled,
              );
              break;

            case "tools":
              // Toggle tools
              updateUserPreference(userId, "toolsEnabled", !prefs.toolsEnabled);
              break;

            case "web_search":
              // Toggle web search
              const currentWebSearch = prefs.aiParams.web_search || false;
              updateUserPreference(userId, "aiParams", {
                ...prefs.aiParams,
                web_search: !currentWebSearch,
              });
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
                isVisionRequest ? "vision" : null,
              );

              const modelMenu = new StringSelectMenuBuilder()
                .setCustomId(`ai_select_model_${userId}`)
                .setPlaceholder(
                  await i18n.__(
                    "events.ai.buttons.menus.modelSelect.placeholder",
                  ),
                );

              // Use the shared function to build options
              const opts = await buildModelOptions(
                models,
                prefs.selectedModel,
                locale,
              );

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
          const selectedModel = interaction.values[0];
          updateUserPreference(userId, "selectedModel", selectedModel);

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
            `Cleared history for user ${userId} due to model switch.`,
          );

          // Process the request with the newly selected model
          await processAiRequest(
            message,
            userId,
            messageContent,
            newVisionRequest,
            finalMsg,
            locale,
          );
          return; // Return early
        }

        // Rebuild components with updated preferences
        const isVisionRequest =
          message.attachments.size > 0 &&
          message.attachments.first().contentType?.startsWith("image/");
        const models = await getAvailableModels(
          message.client,
          isVisionRequest ? "vision" : null,
        );
        const newComponents = await buildInteractionComponents(
          userId,
          models,
          isVisionRequest,
          false,
          locale,
          message.client,
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

// New function to handle fine-tune settings modal
export async function handleFinetuneModal(interaction, userId, locale = "en") {
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
  const paramOptions = await Promise.all(
    Object.entries(CONFIG.aiParameters)
      .filter(([param, config]) => {
        // If parameter has provider restriction, check if current provider is supported
        if (config.providers && Array.isArray(config.providers)) {
          return config.providers.includes(provider);
        }
        // If no provider restriction, show the parameter for all providers
        return true;
      })
      .map(async ([param, config]) => ({
        label: await i18n.__(
          `events.ai.buttons.finetune.parameters.${param}.label`,
          locale,
        ),
        value: param,
        description: `${aiParams[param] || config.default} (${config.min}-${
          config.max
        })`,
      })),
  );

  // Create selection menu
  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`ai_param_select_${userId}`)
      .setPlaceholder(
        (await i18n.__("events.ai.buttons.finetune.selectParameter", locale)) ||
          "Select parameter to adjust",
      )
      .addOptions(paramOptions),
  );

  // Show parameter selection menu
  await interaction.reply({
    content:
      (await i18n.__(
        "events.ai.buttons.finetune.selectParameterPrompt",
        locale,
      )) || "Select an AI parameter to adjust:",
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
      const placeholder = await createParameterPlaceholder(
        selectedParam,
        paramConfig,
        aiParams[selectedParam],
        locale,
      );

      // Create modal for parameter edit
      const modal = new ModalBuilder()
        .setCustomId(`ai_param_edit_${userId}_${selectedParam}`)
        .setTitle(
          await i18n.__(
            `events.ai.buttons.finetune.parameters.${selectedParam}.label`,
            locale,
          ),
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
        paramConfig,
      );

      // Update user preferences
      const updatedParams = { ...aiParams };
      updatedParams[selectedParam] = newValue;
      updateUserPreference(userId, "aiParams", updatedParams);

      // Acknowledge the parameter update
      await modalInteraction.reply({
        content: await i18n.__(
          "events.ai.buttons.finetune.parameterUpdated",
          {
            parameter: await i18n.__(
              `events.ai.buttons.finetune.parameters.${selectedParam}.label`,
              locale,
            ),
            value: newValue,
          },
          locale,
        ),
        ephemeral: true,
      });
    } catch (error) {
      console.error("Error handling parameter selection/edit:", error);
      try {
        await i
          .reply({
            content: await i18n.__("events.ai.buttons.finetune.error", locale),
            ephemeral: true,
          })
          .catch(() => {});
      } catch (replyError) {
        console.error("Error sending reply:", replyError);
      }
    }
  });

  collector.on("end", async (collected) => {
    if (collected.size === 0) {
      // Clean up if no selection was made
      message
        .edit({
          content:
            (await i18n.__(
              "events.ai.buttons.finetune.selectionTimeout",
              locale,
            )) || "Parameter selection timed out.",
          components: [],
        })
        .catch(console.error);
    }
  });
}

// Helper function to create parameter placeholder
async function createParameterPlaceholder(
  paramName,
  paramConfig,
  currentValue,
  locale,
) {
  const defaultVal = paramConfig.default;
  const description = await i18n.__(
    `events.ai.buttons.finetune.parameters.${paramName}.description`,
    locale,
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
        `Invalid value for ${paramName}: ${input}, using default: ${paramConfig.default}`,
      );
      return currentValue || paramConfig.default;
    }

    return Math.max(paramConfig.min, Math.min(paramConfig.max, parsedValue));
  } catch (e) {
    console.error(`Error parsing value for ${paramName}: ${e.message}`);
    return currentValue || paramConfig.default; // On error, keep current value or use default
  }
}

// Helper function to get the appropriate emoji for reasoning level
function getReasoningEmoji(level) {
  switch (level?.toLowerCase()) {
    case "off":
      return "❌";
    case "low":
      return "🤔";
    case "medium":
      return "🧠";
    case "high":
      return "🔬";
    default:
      return "🧠";
  }
}
