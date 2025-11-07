import i18n from "../../utils/i18n.js";
import processAiRequest from "../../handlers/processAiRequest.js";
import {
  StringSelectMenuBuilder,
  ButtonBuilder,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
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
  const optionPromises = models.map(async (m) => {
    // Build descriptive features based on capabilities
    const features = [];

    // Add featured model indicator
    if (m.isFeatured) {
      features.push("⭐ Featured");
    }

    // Add vision capability indicator if model supports it
    if (m.capabilities && m.capabilities.vision) {
      features.push(
        `🖼️ ${await i18n.__(
          "events.ai.buttons.menus.modelSelect.visionSupport",
          locale
        )}`
      );
    }

    // Add reasoning capability indicator if model supports it
    if (supportsReasoning(m.id)) {
      features.push(
        `🧠 ${await i18n.__(
          "events.ai.buttons.menus.modelSelect.reasoningSupport",
          locale
        )}`
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

// Build provider selection options from available models
export async function buildProviderOptions(availableModels, locale = "en") {
  const providers = ["nanogpt", "groq", "openrouter"];
  const counts = { nanogpt: 0, groq: 0, openrouter: 0 };

  for (const m of availableModels) {
    const key = (m.provider || "").toLowerCase();
    if (counts[key] !== undefined) counts[key] += 1;
  }

  const opts = [];
  for (const p of providers) {
    if (counts[p] > 0) {
      const label =
        p === "nanogpt" ? "NanoGPT" : p === "groq" ? "Groq" : "OpenRouter";
      opts.push({
        label,
        value: `__provider_${p}__`,
        description: `${counts[p]} models`,
      });
    }
  }
  return opts.length
    ? opts
    : providers.map((p) => ({
        label:
          p === "nanogpt" ? "NanoGPT" : p === "groq" ? "Groq" : "OpenRouter",
        value: `__provider_${p}__`,
        description: "0 models",
      }));
}

// Build a paginated model menu for a specific provider
export async function buildPaginatedModelMenu(
  userId,
  models,
  provider,
  page,
  selectedModel,
  locale = "en"
) {
  const pageSize = 22; // Leave room for controls
  let providerModels = models.filter(
    (m) => (m.provider || "").toLowerCase() === provider
  );

  // Sort models: featured models first, then by name
  providerModels.sort((a, b) => {
    // Featured models get priority
    if (a.isFeatured && !b.isFeatured) return -1;
    if (!a.isFeatured && b.isFeatured) return 1;

    // Then sort by name alphabetically
    return (a.name || a.id).localeCompare(b.name || b.id);
  });

  const totalPages = Math.max(1, Math.ceil(providerModels.length / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const start = (currentPage - 1) * pageSize;
  const pageModels = providerModels.slice(start, start + pageSize);

  const menu = new StringSelectMenuBuilder()
    .setCustomId(`ai_select_model_${userId}`)
    .setPlaceholder(
      (await i18n.__(
        "events.ai.buttons.menus.modelSelect.placeholder",
        locale
      )) || "Select an AI model"
    );

  const modelOptions = await buildModelOptions(
    pageModels,
    selectedModel,
    locale
  );

  // Add pagination controls
  const controls = [];
  if (currentPage > 1) {
    controls.push({
      label:
        (await i18n.__(
          "events.ai.buttons.menus.modelSelect.pagePrev",
          locale
        )) || "Previous Page",
      value: `__page_prev__:${provider}:${currentPage}`,
      emoji: "⬅️",
    });
  }
  if (currentPage < totalPages) {
    controls.push({
      label:
        (await i18n.__(
          "events.ai.buttons.menus.modelSelect.pageNext",
          locale
        )) || "Next Page",
      value: `__page_next__:${provider}:${currentPage}`,
      emoji: "➡️",
    });
  }
  controls.push({
    label:
      (await i18n.__(
        "events.ai.buttons.menus.modelSelect.backProviders",
        locale
      )) || "Back to Providers",
    value: `__back_providers__`,
    emoji: "🔙",
  });

  // Limit to max 25 options
  const finalOptions = [...modelOptions, ...controls].slice(0, 25);
  menu.addOptions(finalOptions);
  return new ActionRowBuilder().addComponents(menu);
}

export async function buildInteractionComponents(
  userId,
  availableModels,
  isVision = false,
  noButtons = false,
  locale = "en",
  client = null
) {
  // Prewarm translation cache for AI-related keys to avoid bursty per-key requests
  try {
    await i18n.getTranslationGroup("events.ai", locale);
  } catch (_) {}
  const prefs = getUserPreferences(userId);
  let effectiveMaxContext = 8; // Default 8 messages (4 * 2)
  let selectedModelDetails = null;
  let modelContextWindow = 8192; // Default context window

  if (prefs.selectedModel && client) {
    try {
      selectedModelDetails = await getModelDetails(client, prefs.selectedModel);
      if (selectedModelDetails) {
        console.log(
          `Model details for ${prefs.selectedModel}:`,
          selectedModelDetails
        );

        // Get the actual context window from config
        modelContextWindow =
          selectedModelDetails.capabilities?.maxContext || 8192;

        // Calculate effective max context based on token limit (rough estimate: 4 chars per token)
        const maxTokens = modelContextWindow * 0.9; // 90% safety margin
        effectiveMaxContext = Math.floor(maxTokens / 4); // Convert to characters

        console.log(
          `[DEBUG] Context window for ${prefs.selectedModel}: ${modelContextWindow} tokens, effective max: ${effectiveMaxContext} chars`
        );
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

  // For initial selection - show provider selection first
  if (noButtons && availableModels?.length) {
    i18n.setLocale(locale);

    // Log model capabilities for debugging
    console.log("Building model selection with the following models:");
    availableModels.slice(0, 3).forEach((m) => {
      console.log(
        `Model ${m.name}: Vision=${
          m.capabilities?.vision
        }, Reasoning=${supportsReasoning(m.id)}`
      );
    });
    if (availableModels.length > 3) {
      console.log(`... and ${availableModels.length - 3} more models`);
    }

    const providerMenu = new StringSelectMenuBuilder()
      .setCustomId(`ai_select_provider_${userId}`)
      .setPlaceholder(
        (await i18n.__(
          "events.ai.buttons.menus.modelSelect.providerPlaceholder",
          locale
        )) || "Select a provider"
      );

    const providerOpts = await buildProviderOptions(availableModels, locale);
    providerMenu.addOptions(providerOpts);
    components.push(new ActionRowBuilder().addComponents(providerMenu));
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
                locale
              )) || "Settings"
            }`
          : (await i18n.__(
              "events.ai.buttons.menus.settingsSelect.placeholder",
              locale
            )) || "Settings"
      );

    const options = [];

    // System prompt toggle option
    options.push({
      label: await i18n.__(
        "events.ai.buttons.menus.settingsSelect.systemPrompt"
      ),
      description: prefs.systemPromptEnabled
        ? await i18n.__(
            "events.ai.buttons.menus.settingsSelect.systemPromptEnabled"
          )
        : await i18n.__(
            "events.ai.buttons.menus.settingsSelect.systemPromptDisabled"
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
      selectedModelDetails?.capabilities?.maxContext || 8192;
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
        estimatedTokens
      ).toLocaleString()} / ${modelContextWindow.toLocaleString()} (${Math.round(
        (estimatedTokens / modelContextWindow) * 100
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
          locale
        )) || "Adjust AI generation parameters",
      emoji: "🎛️",
      default: false,
    });

    // Switch model option
    options.push({
      label:
        (await i18n.__(
          "events.ai.buttons.menus.settingsOptions.switchModel.label",
          locale
        )) || "Switch Model",
      value: "switch_model",
      description:
        (await i18n.__(
          "events.ai.buttons.menus.settingsOptions.switchModel.description",
          locale
        )) || "Change the AI model",
      emoji: "🔄",
      default: false,
    });

    settingsMenu.addOptions(options);
    components.push(new ActionRowBuilder().addComponents(settingsMenu));
  }

  return components;
}

/**
 * Build components specifically for error messages to allow users to fix issues manually
 */
export async function buildErrorComponents(
  userId,
  availableModels,
  isVision = false,
  locale = "en",
  client = null
) {
  // Prewarm translation cache for AI-related keys to avoid bursty per-key requests
  try {
    await i18n.getTranslationGroup("events.ai", locale);
  } catch (_) {}
  const prefs = getUserPreferences(userId);
  const components = [];

  i18n.setLocale(locale);

  // Create error action menu with retry and settings options
  const errorMenu = new StringSelectMenuBuilder()
    .setCustomId(`ai_error_menu_${userId}`)
    .setPlaceholder(
      (await i18n.__("events.ai.errorMenu.placeholder", locale)) ||
        "Fix this error..."
    );

  const options = [];

  // Retry option
  options.push({
    label: (await i18n.__("events.ai.errorMenu.retry", locale)) || "Retry",
    description:
      (await i18n.__("events.ai.errorMenu.retryDescription", locale)) ||
      "Try the request again",
    value: "retry",
    emoji: "🔄",
  });

  // Switch model option
  options.push({
    label:
      (await i18n.__("events.ai.errorMenu.switchModel", locale)) ||
      "Switch Model",
    description:
      (await i18n.__("events.ai.errorMenu.switchModelDescription", locale)) ||
      "Try a different AI model",
    value: "switch_model",
    emoji: "🤖",
  });

  // Settings access option
  options.push({
    label:
      (await i18n.__("events.ai.errorMenu.settings", locale)) || "Settings",
    description:
      (await i18n.__("events.ai.errorMenu.settingsDescription", locale)) ||
      "Configure AI settings",
    value: "settings",
    emoji: "⚙️",
  });

  // Clear context option (in case of context-related errors)
  const current = prefs.messageHistory.length;
  options.push({
    label:
      (await i18n.__("events.ai.errorMenu.clearContext", locale)) ||
      "Clear Context",
    description:
      (await i18n.__("events.ai.errorMenu.clearContextDescription", locale)) ||
      "Reset conversation memory",
    value: "clear_context",
    emoji: "🗑️",
    disabled: current === 0,
  });

  errorMenu.addOptions(options);
  components.push(new ActionRowBuilder().addComponents(errorMenu));

  return components;
}

export async function sendResponse(
  message,
  processingMessage,
  content,
  components = [],
  locale = "en",
  isStreaming = false
) {
  i18n.setLocale(locale);

  // Prewarm translation cache for sanitization and UI strings used in responses
  try {
    await i18n.getTranslationGroup("events.ai", locale);
  } catch (_) {}

  const userId = message.author.id;
  const sanitized = content
    .replace(
      /<@[!&]?\d+>/g,
      await i18n.__("events.ai.buttons.sanitization.mention", locale)
    )
    .replace(
      /@everyone/gi,
      await i18n.__("events.ai.buttons.sanitization.everyone", locale)
    )
    .replace(
      /@here/gi,
      await i18n.__("events.ai.buttons.sanitization.here", locale)
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
        // Handle error menu selection
        if (
          interaction.isStringSelectMenu() &&
          interaction.customId === `ai_error_menu_${userId}`
        ) {
          const selectedValue = interaction.values[0];
          const prefs = getUserPreferences(userId);

          console.log(
            `Error menu selection for user ${userId}: ${selectedValue}`
          );

          switch (selectedValue) {
            case "retry":
              // Retry the AI request
              await interaction.deferUpdate();
              const messageContent = message.content
                .replace(new RegExp(`<@!?${message.client.user.id}>`, "g"), "")
                .trim();
              const newVisionRequest =
                message.attachments.size > 0 &&
                message.attachments.first().contentType?.startsWith("image/");

              // Stop the current collector
              collector.stop();

              // Process the request again
              await processAiRequest(
                message,
                userId,
                messageContent,
                newVisionRequest,
                finalMsg,
                locale
              );
              return; // Return early

            case "switch_model":
              // Show provider selection menu first (error context)
              const isVisionRequest =
                message.attachments.size > 0 &&
                message.attachments.first().contentType?.startsWith("image/");

              const models = await getAvailableModels(
                message.client,
                isVisionRequest ? "vision" : null
              );

              const providerMenu = new StringSelectMenuBuilder()
                .setCustomId(`ai_select_provider_${userId}`)
                .setPlaceholder(
                  (await i18n.__(
                    "events.ai.buttons.menus.modelSelect.providerPlaceholder",
                    locale
                  )) || "Select a provider"
                );

              const providerOpts = await buildProviderOptions(models, locale);
              providerMenu.addOptions(providerOpts);

              await interaction.update({
                components: [
                  new ActionRowBuilder().addComponents(providerMenu),
                ],
              });
              return; // Return early to prevent updating components

            case "settings":
              // Switch to regular settings menu
              const regularModels = await getAvailableModels(
                message.client,
                isVisionRequest ? "vision" : null
              );
              const newComponents = await buildInteractionComponents(
                userId,
                regularModels,
                isVisionRequest,
                false,
                locale,
                message.client
              );

              await interaction.update({ components: newComponents });
              return; // Return early

            case "clear_context":
              // Clear context memory
              clearUserHistory(userId);
              await interaction.reply({
                content: await i18n.__(
                  "events.ai.buttons.systemPrompt.contextCleared",
                  locale
                ),
                ephemeral: true,
              });
              break;
          }
        }
        // Handle settings menu selection
        else if (
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
                !prefs.systemPromptEnabled
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
              // Show provider selection menu first
              const isVisionRequest =
                message.attachments.size > 0 &&
                message.attachments.first().contentType?.startsWith("image/");

              const models = await getAvailableModels(
                message.client,
                isVisionRequest ? "vision" : null
              );

              const providerMenu = new StringSelectMenuBuilder()
                .setCustomId(`ai_select_provider_${userId}`)
                .setPlaceholder(
                  (await i18n.__(
                    "events.ai.buttons.menus.modelSelect.providerPlaceholder",
                    locale
                  )) || "Select a provider"
                );

              const providerOpts = await buildProviderOptions(models, locale);
              providerMenu.addOptions(providerOpts);

              await interaction.update({
                components: [
                  new ActionRowBuilder().addComponents(providerMenu),
                ],
              });
              return; // Return early to prevent updating components
          }
        }
        // Handle provider selection menu
        else if (
          interaction.isStringSelectMenu() &&
          interaction.customId === `ai_select_provider_${userId}`
        ) {
          const providerToken = interaction.values[0];
          const provider = providerToken
            .replace("__provider_", "")
            .replace("__", "")
            .toLowerCase();

          const isVisionRequest =
            message.attachments.size > 0 &&
            message.attachments.first().contentType?.startsWith("image/");
          const models = await getAvailableModels(
            message.client,
            isVisionRequest ? "vision" : null
          );

          const row = await buildPaginatedModelMenu(
            userId,
            models,
            provider,
            1,
            getUserPreferences(userId).selectedModel,
            locale
          );

          await interaction.update({ components: [row] });
          return;
        }
        // Handle original model select menu
        else if (
          interaction.isStringSelectMenu() &&
          interaction.customId === `ai_select_model_${userId}`
        ) {
          const selectedValue = interaction.values[0];

          // Handle pagination and navigation
          if (
            selectedValue.startsWith("__page_next__") ||
            selectedValue.startsWith("__page_prev__")
          ) {
            const parts = selectedValue.split(":");
            const directive = parts[0];
            const provider = parts[1];
            const cur = parseInt(parts[2] || "1", 10);
            const nextPage = directive.includes("next")
              ? cur + 1
              : Math.max(1, cur - 1);

            const isVisionRequest =
              message.attachments.size > 0 &&
              message.attachments.first().contentType?.startsWith("image/");
            const models = await getAvailableModels(
              message.client,
              isVisionRequest ? "vision" : null
            );

            const row = await buildPaginatedModelMenu(
              userId,
              models,
              provider,
              nextPage,
              getUserPreferences(userId).selectedModel,
              locale
            );

            await interaction.update({ components: [row] });
            return;
          }

          if (selectedValue === "__back_providers__") {
            const isVisionRequest =
              message.attachments.size > 0 &&
              message.attachments.first().contentType?.startsWith("image/");
            const models = await getAvailableModels(
              message.client,
              isVisionRequest ? "vision" : null
            );
            const providerMenu = new StringSelectMenuBuilder()
              .setCustomId(`ai_select_provider_${userId}`)
              .setPlaceholder(
                (await i18n.__(
                  "events.ai.buttons.menus.modelSelect.providerPlaceholder",
                  locale
                )) || "Select a provider"
              );
            const providerOpts = await buildProviderOptions(models, locale);
            providerMenu.addOptions(providerOpts);
            await interaction.update({
              components: [new ActionRowBuilder().addComponents(providerMenu)],
            });
            return;
          }

          const selectedModel = selectedValue;
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
            `Cleared history for user ${userId} due to model switch.`
          );

          // Process the request with the newly selected model
          await processAiRequest(
            message,
            userId,
            messageContent,
            newVisionRequest,
            finalMsg,
            locale
          );
          return; // Return early
        }

        // Rebuild components with updated preferences
        const isVisionRequest =
          message.attachments.size > 0 &&
          message.attachments.first().contentType?.startsWith("image/");
        const models = getAvailableModels(
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
  // Default AI parameters for hub integration
  const defaultParams = {
    temperature: { label: "Temperature", description: "Controls randomness" },
    top_p: { label: "Top P", description: "Nucleus sampling parameter" },
    max_tokens: {
      label: "Max Tokens",
      description: "Maximum tokens to generate",
    },
  };

  const paramOptions = await Promise.all(
    Object.entries(defaultParams)
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
          locale
        ),
        value: param,
        description: `${aiParams[param] || config.default} (${config.min}-${
          config.max
        })`,
      }))
  );

  // Create selection menu
  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`ai_param_select_${userId}`)
      .setPlaceholder(
        (await i18n.__("events.ai.buttons.finetune.selectParameter", locale)) ||
          "Select parameter to adjust"
      )
      .addOptions(paramOptions)
  );

  // Show parameter selection menu
  await interaction.reply({
    content:
      (await i18n.__(
        "events.ai.buttons.finetune.selectParameterPrompt",
        locale
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
      const paramConfig = defaultParams[selectedParam];

      // Create placeholder for modal input
      const placeholder = await createParameterPlaceholder(
        selectedParam,
        paramConfig,
        aiParams[selectedParam],
        locale
      );

      // Create modal for parameter edit
      const modal = new ModalBuilder()
        .setCustomId(`ai_param_edit_${userId}_${selectedParam}`)
        .setTitle(
          await i18n.__(
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
        content: await i18n.__(
          "events.ai.buttons.finetune.parameterUpdated",
          {
            parameter: await i18n.__(
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
              locale
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
  locale
) {
  const defaultVal = paramConfig.default;
  const description = await i18n.__(
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
