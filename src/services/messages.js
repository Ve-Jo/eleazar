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
import { getAvailableModels, getModelCapabilities } from "./groqModels.js";
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
  locale = "en"
) {
  const prefs = getUserPreferences(userId);
  const components = [];

  // Model select menu
  if (availableModels?.length) {
    const menu = new StringSelectMenuBuilder()
      .setCustomId(`ai_select_model_${userId}`)
      .setPlaceholder(
        i18n.__("events.ai.buttons.menus.modelSelect.placeholder", locale)
      );
    const opts = availableModels.slice(0, 25).map((m) => ({
      label: m.name,
      value: m.id,
      default: m.id === prefs.selectedModel,
    }));
    menu.addOptions(opts);
    components.push(new ActionRowBuilder().addComponents(menu));
  }

  if (!noButtons) {
    const systemBtn = new ButtonBuilder()
      .setCustomId(`ai_toggle_context_${userId}`)
      .setLabel(
        prefs.systemPromptEnabled
          ? i18n.__("events.ai.buttons.systemPrompt.on", locale)
          : i18n.__("events.ai.buttons.systemPrompt.off", locale)
      )
      .setStyle(prefs.systemPromptEnabled ? 1 : 2);

    let actualTools = prefs.toolsEnabled;
    let toolsLabel = actualTools
      ? i18n.__("events.ai.buttons.systemPrompt.tools.on", locale)
      : i18n.__("events.ai.buttons.systemPrompt.tools.off", locale);
    let toolsStyle = prefs.toolsEnabled ? 1 : 2;
    let toolsDisabled = false;

    if (prefs.selectedModel) {
      const cap = await getModelCapabilities(prefs.selectedModel);
      if (prefs.toolsEnabled && !cap.supportsTools) {
        actualTools = false;
        toolsLabel = i18n.__(
          "events.ai.buttons.systemPrompt.tools.offModel",
          locale
        );
        toolsStyle = 2;
        toolsDisabled = true;
      }
    }
    const toolsBtn = new ButtonBuilder()
      .setCustomId(`ai_toggle_tools_${userId}`)
      .setLabel(toolsLabel)
      .setStyle(toolsStyle)
      .setDisabled(toolsDisabled);

    const current = prefs.messageHistory.length;
    const max = (CONFIG.maxContextLength || 4) * 2;
    const clearBtn = new ButtonBuilder()
      .setCustomId(`ai_clear_context_${userId}`)
      .setLabel(
        i18n.__(
          "events.ai.buttons.systemPrompt.clearContext",
          { current, max },
          locale
        )
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
  const previousMsg = lastUserComponentMessages.get(userId);
  if (previousMsg && previousMsg.editable) {
    try {
      await previousMsg.edit({ components: [] });
    } catch (error) {
      console.error(
        "Failed to remove components from previous message:",
        error
      );
    }
  }

  try {
    await processingMessage.edit({ content: chunks[0] || "...", components });
    finalMsg = processingMessage;
  } catch {
    finalMsg = await message.channel.send({
      content: chunks[0] || "...",
      components,
    });
  }

  for (let i = 1; i < chunks.length; i++) {
    await message.channel.send(chunks[i]).catch(() => {});
  }

  // Store the new message with components
  if (finalMsg && components.length) {
    lastUserComponentMessages.set(userId, finalMsg);

    const collector = finalMsg.createMessageComponentCollector({
      filter: (i) =>
        (i.isButton() || i.isStringSelectMenu()) && i.user.id === userId,
      time: 15 * 60 * 1000,
    });
    collector.on("collect", async (interaction) => {
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
      const models = await getAvailableModels(isVisionRequest);
      const newComponents = await buildInteractionComponents(
        userId,
        models,
        isVisionRequest,
        false,
        locale
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
        await processAiRequest(
          message,
          userId,
          messageContent,
          newVisionRequest,
          finalMsg,
          locale
        );
      }
    });

    collector.on("end", () => {
      // When the collector ends, check if this is still the latest message with components
      if (lastUserComponentMessages.get(userId) === finalMsg) {
        // If it is and it's still editable, remove the components
        if (finalMsg.editable) {
          finalMsg.edit({ components: [] }).catch((error) => {
            console.error(
              "Failed to remove components after collector end:",
              error
            );
          });
        }
      }
    });
  }
}
