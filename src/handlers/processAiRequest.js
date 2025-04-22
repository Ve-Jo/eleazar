import i18n from "../utils/newI18n.js";
import CONFIG from "../config/aiConfig.js";
import {
  getUserPreferences,
  updateUserPreference,
  addConversationToHistory,
} from "../state/prefs.js";
import { isModelRateLimited, setModelRateLimit } from "../state/state.js";
import {
  getApiClientForModel,
  getModelCapabilities,
  getAvailableModels,
} from "../services/groqModels.js";
import { generateToolsFromCommands } from "../services/tools.js";
import {
  buildInteractionComponents,
  sendResponse,
} from "../services/messages.js";
import { executeToolCall } from "../services/toolExecutor.js";

// Helper function to detect if AI is trying to use a "fake" tool in text format
function detectFakeToolCalls(content) {
  // Pattern to detect attempted tool calls in several formats
  const patterns = [
    // Match format: !command argument or /command argument
    /[!\/]([a-z0-9_]+)(.*)/i,
    // Match format: @bot command argument
    /@[a-z0-9_]+\s+([a-z0-9_]+)(.*)/i,
    // Match format: command(arguments) or command({json})
    /\b([a-z0-9_]+)\(([^)]*)\)/i,
    // Match JSON-like format: {"command": "name", "arguments": {...}}
    /{[\s\n]*"command"[\s\n]*:[\s\n]*"([^"]+)"[\s\n]*,[\s\n]*"arguments"[\s\n]*:[\s\n]*([\s\S]*?)}/i,
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      const fullMatch = match[0];
      const name = match[1];
      const argString = match[2]?.trim() || "{}";

      // Try to parse arguments as JSON if they look like JSON
      let args = {};
      if (argString.startsWith("{") && argString.endsWith("}")) {
        try {
          args = JSON.parse(argString);
        } catch {
          // If parsing fails, use as string
          const paramName = name === "say" ? "text" : "prompt";
          args = { [paramName]: argString };
        }
      } else if (argString) {
        // For simple text arguments, try to intelligently assign to parameter
        const paramName = name === "say" ? "text" : "prompt";
        args = { [paramName]: argString };
      }

      return {
        fullMatch,
        name,
        args,
      };
    }
  }

  return null;
}

// Split response into chunks if needed
function splitMessage(message, maxLength = 2000) {
  const chunks = [];
  let currentChunk = "";
  let inCodeBlock = false;
  let codeBlockLanguage = "";

  const lines = message.split("\n");
  for (const line of lines) {
    const codeBlockMatch = line.match(/^```(\w+)?/);
    if (codeBlockMatch) {
      if (inCodeBlock) {
        inCodeBlock = false;
        currentChunk += line + "\n";
        chunks.push(currentChunk.trim());
        currentChunk = "";
        continue;
      } else {
        inCodeBlock = true;
        codeBlockLanguage = codeBlockMatch[1] || "";
      }
    }

    if (currentChunk.length + line.length + 1 > maxLength) {
      if (inCodeBlock) {
        chunks.push(currentChunk.trim() + "\n```");
        currentChunk = "```" + codeBlockLanguage + "\n" + line;
      } else {
        chunks.push(currentChunk.trim());
        currentChunk = line;
      }
    } else {
      currentChunk += (currentChunk ? "\n" : "") + line;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  if (inCodeBlock && !chunks[chunks.length - 1].endsWith("```")) {
    chunks[chunks.length - 1] += "\n```";
  }

  return chunks;
}

export default async function processAiRequest(
  message,
  userId,
  messageContent,
  isVisionRequest,
  processingMessage = null,
  effectiveLocale = "en"
) {
  console.log(`Starting processAiRequest for user ${userId}`);

  const client = message.client;
  const channel = message.channel;
  const author = message.author;

  if (!author) {
    console.error("Could not determine author for AI request.");
    if (channel)
      await channel
        .send("Error: Could not identify user for request.")
        .catch(() => {});
    return;
  }

  const prefs = getUserPreferences(userId);
  if (!prefs.selectedModel) {
    console.error(
      `processAiRequest called for user ${userId} without a selected model.`
    );
    if (channel)
      await channel
        .send("Error: No AI model selected. Please select a model first.")
        .catch(() => {});
    return;
  }

  console.log(`Using model ${prefs.selectedModel} for user ${userId}`);

  // Provider and capabilities check
  let provider;
  let capabilities;
  try {
    const apiClientInfo = await getApiClientForModel(prefs.selectedModel);
    provider = apiClientInfo.provider;
    capabilities = await getModelCapabilities(prefs.selectedModel);
    console.log(`Model capabilities for ${prefs.selectedModel}:`, capabilities);
  } catch (error) {
    console.error(
      `Failed to get provider or capabilities for ${prefs.selectedModel}:`,
      error
    );
    const errMsg = `😥 Error checking model details: ${error.message}`;
    if (processingMessage) {
      await sendResponse(message, processingMessage, errMsg, []);
    } else if (channel) {
      await channel.send(errMsg).catch(() => {});
    }
    return;
  }

  // Vision mismatch: prompt user to select a vision-capable model and retry
  if (isVisionRequest && !capabilities.vision) {
    const errMsg = `Model \`${prefs.selectedModel}\` does not support image input. Please select a model with 'Vision' capability for this request.`;
    console.log(
      `Vision request blocked for non-vision model ${prefs.selectedModel}.`
    );
    const visionModels = await getAvailableModels(true);
    const comps = await buildInteractionComponents(
      userId,
      visionModels,
      true,
      false,
      effectiveLocale
    );
    // Send prompt with vision model selector
    channel.sendTyping();
    const promptMsg = await channel.send({
      content: errMsg,
      components: comps,
    });
    // Collector for vision model selection
    const collector = promptMsg.createMessageComponentCollector({
      filter: (i) => i.user.id === userId && i.isStringSelectMenu(),
      time: 5 * 60 * 1000,
    });
    collector.on("collect", async (interaction) => {
      if (!interaction.isStringSelectMenu()) return;
      const selectedModelId = interaction.values[0];
      // Update user preference to the new vision model
      updateUserPreference(userId, "selectedModel", selectedModelId);
      await interaction.deferUpdate();
      // Show processing state
      await promptMsg.edit({
        content: i18n.__(
          "events.ai.messages.modelSelectedProcessing",
          { model: selectedModelId },
          effectiveLocale
        ),
        components: [],
      });
      // Retry the AI request with the selected vision model
      await processAiRequest(
        message,
        userId,
        messageContent,
        true,
        promptMsg,
        effectiveLocale
      );
    });
    return;
  }

  // Rate limit check
  if (isModelRateLimited(prefs.selectedModel)) {
    const retryTime = state.modelRateLimits[prefs.selectedModel];
    const minutesLeft = Math.ceil((retryTime - Date.now()) / 60000);
    const errMsg = `Model \`${prefs.selectedModel}\` is currently rate-limited. Please try again in about ${minutesLeft} minute(s) or select a different model.`;
    console.log(`Prevented call to rate-limited model ${prefs.selectedModel}.`);
    if (processingMessage) {
      await sendResponse(message, processingMessage, errMsg, []);
    } else {
      await channel.send(errMsg).catch(() => {});
    }
    return;
  }

  // Send or edit processing message
  let procMsg = processingMessage;
  if (!procMsg) {
    channel.sendTyping();
    procMsg = await channel.send(
      i18n.__("events.ai.messages.processing", { model: prefs.selectedModel })
    );
  } else {
    await procMsg
      .edit({
        content: i18n.__("events.ai.messages.processing", {
          model: prefs.selectedModel,
        }),
        components: [],
      })
      .catch(() => {});
  }

  try {
    // Build conversation context
    let apiMessages = [...prefs.messageHistory];
    if (prefs.systemPromptEnabled && CONFIG.initialSystemContext) {
      apiMessages = apiMessages.filter((m) => m.role !== "system");
      apiMessages.unshift({
        role: "system",
        content: CONFIG.initialSystemContext,
      });
    } else {
      apiMessages = apiMessages.filter((m) => m.role !== "system");
    }
    const userMsg = { role: "user", content: null };
    if (isVisionRequest && message.attachments.size > 0) {
      const attachment = message.attachments.first();
      if (attachment.contentType.startsWith("image/")) {
        userMsg.content = [
          { type: "text", text: messageContent },
          { type: "image_url", image_url: { url: attachment.url } },
        ];
      } else {
        userMsg.content = `${messageContent}\n(Attached file: ${attachment.name})`;
      }
    } else {
      userMsg.content = messageContent;
    }
    apiMessages.push(userMsg);

    // Generate tools
    const baseTools = generateToolsFromCommands(
      client,
      prefs.toolsEnabled && !isVisionRequest
    );

    // Call API
    const { client: apiClient } = await getApiClientForModel(
      prefs.selectedModel
    );
    const payload = {
      model: prefs.selectedModel,
      messages: apiMessages,
      tools: baseTools,
      tool_choice: baseTools.length ? "auto" : undefined,
    };
    const responseData = await apiClient.chat.completions.create(payload);

    // Process response
    const aiMsg = responseData.choices[0].message;
    let finalText = aiMsg.content?.trim() || "";
    const toolCalls = aiMsg.tool_calls || [];

    if (!finalText && !toolCalls.length)
      finalText = i18n.__("events.ai.messages.noTextResponse", effectiveLocale);

    // Process tool calls if there are any and tools are enabled
    if (toolCalls.length && prefs.toolsEnabled) {
      console.log(`AI requested ${toolCalls.length} tool calls.`);

      // Process tool calls
      for (const toolCall of toolCalls) {
        console.log(`Executing tool: ${toolCall.function.name}`);

        const { success, response, commandReplied, visualResponse } =
          await executeToolCall(toolCall, message, effectiveLocale);

        console.log(
          `Tool ${toolCall.function.name} execution ${
            success ? "succeeded" : "failed"
          }. Command replied directly: ${commandReplied}, Visual response: ${visualResponse}`
        );

        // If the command replied with visual content (embeds/attachments),
        // don't add additional text about it to avoid confusion
        if (visualResponse) {
          continue;
        }

        // Add tool result to the response if it didn't already reply with visual content
        if (!commandReplied) {
          // Format the tool result as a block
          const toolName = toolCall.function.name;
          const prefix = success
            ? i18n.__(
                "events.ai.buttons.toolResult.successPrefix",
                { command: toolName },
                effectiveLocale
              )
            : i18n.__(
                "events.ai.buttons.toolResult.errorPrefix",
                { command: toolName },
                effectiveLocale
              );

          finalText += `\n\n${prefix}\n${response || ""}`;
        }
      }
    } else if (toolCalls.length && !prefs.toolsEnabled) {
      finalText += `\n\n${i18n.__(
        "events.ai.messages.toolsDisabledNote",
        effectiveLocale
      )}`;
    } else if (!toolCalls.length) {
      // Check if the AI tried to use a "fake" tool in text format
      const fakeToolCall = detectFakeToolCalls(finalText);
      if (fakeToolCall && prefs.toolsEnabled) {
        console.log(
          `Detected fake tool call in AI response: ${fakeToolCall.name}`
        );

        // Create a proper tool call from the fake one
        const properToolCall = {
          function: {
            name: fakeToolCall.name,
            arguments: JSON.stringify(fakeToolCall.args),
          },
        };

        // Execute the real tool
        const { success, response, commandReplied, visualResponse } =
          await executeToolCall(properToolCall, message, effectiveLocale);

        console.log(
          `Converted fake tool ${fakeToolCall.name} execution ${
            success ? "succeeded" : "failed"
          }. Command replied directly: ${commandReplied}, Visual response: ${visualResponse}`
        );

        // Replace the fake tool text with the real response
        // First remove the fake tool call syntax completely
        let cleanedResponse = finalText.replace(fakeToolCall.fullMatch, "");

        // If the command showed visual content, don't add text response
        if (visualResponse) {
          finalText = cleanedResponse.trim();
        } else if (!commandReplied) {
          // Format the tool result as a block
          const toolName = fakeToolCall.name;
          const prefix = success
            ? i18n.__(
                "events.ai.buttons.toolResult.successPrefix",
                { command: toolName },
                effectiveLocale
              )
            : i18n.__(
                "events.ai.buttons.toolResult.errorPrefix",
                { command: toolName },
                effectiveLocale
              );

          // Add the real tool response
          finalText =
            cleanedResponse.trim() +
            (cleanedResponse.trim() ? "\n\n" : "") +
            `${prefix}\n${response || ""}`;
        } else {
          finalText = cleanedResponse.trim();
        }
      }
    }

    // Send final response
    addConversationToHistory(userId, messageContent, finalText);
    const models = await getAvailableModels(isVisionRequest);
    const comps = await buildInteractionComponents(
      userId,
      models,
      isVisionRequest,
      false,
      effectiveLocale
    );
    await sendResponse(message, procMsg, finalText, comps, effectiveLocale);
  } catch (error) {
    console.error(`Error in processAiRequest:`, error);
    const errMsg = i18n.__(
      "events.ai.messages.errorOccurred",
      { error: error.message },
      effectiveLocale
    );
    await sendResponse(message, procMsg, errMsg, [], effectiveLocale);
  }
}
