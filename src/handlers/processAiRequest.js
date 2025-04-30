import i18n from "../utils/newI18n.js";
import CONFIG from "../config/aiConfig.js";
import {
  getUserPreferences,
  updateUserPreference,
  addConversationToHistory,
} from "../state/prefs.js";
import {
  isModelRateLimited,
  setModelRateLimit,
  state,
  markModelAsNotSupportingTools,
} from "../state/state.js";
import {
  getApiClientForModel,
  getModelCapabilities,
  getAvailableModels,
  updateModelCooldown,
} from "../services/aiModels.js";
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

// Function to remove content between <think> tags
function removeThinkTags(content) {
  if (!content) return content;

  // Remove <think>...</think> tags (case insensitive and across multiple lines)
  let cleanedContent = content.replace(/<think>[\s\S]*?<\/think>/gi, "");

  // Also try with space between < and think in case of formatting variations
  cleanedContent = cleanedContent.replace(/< think>[\s\S]*?<\/ think>/gi, "");

  // Remove any leading/trailing whitespace that may be left after tag removal
  return cleanedContent.trim();
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
  let apiClientInfo;

  try {
    apiClientInfo = await getApiClientForModel(client, prefs.selectedModel);
    const { modelId, provider } = apiClientInfo;
    capabilities = await getModelCapabilities(client, prefs.selectedModel);
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
    const visionModels = await getAvailableModels(client, "vision");
    const comps = await buildInteractionComponents(
      userId,
      visionModels,
      true,
      false,
      effectiveLocale,
      client
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

    // Apply provider-specific context limitations
    if (apiClientInfo.provider === "openrouter") {
      const maxOpenRouterMessagePairs = 4; // Updated to 4 pairs as per user request
      if (apiMessages.length > maxOpenRouterMessagePairs * 2) {
        console.log(
          `Trimming OpenRouter context from ${apiMessages.length} to ${
            maxOpenRouterMessagePairs * 2
          } messages`
        );
        const systemMessage = apiMessages.find((m) => m.role === "system");
        const nonSystemMessages = apiMessages.filter(
          (m) => m.role !== "system"
        );
        apiMessages = nonSystemMessages.slice(-maxOpenRouterMessagePairs * 2);
        if (systemMessage) {
          apiMessages.unshift(systemMessage);
        }
      }
    } else {
      // Groq and other providers use the default context length from CONFIG
      const maxContextPairs = CONFIG.maxContextLength || 4;
      if (apiMessages.length > maxContextPairs * 2) {
        console.log(
          `Trimming context from ${apiMessages.length} to ${
            maxContextPairs * 2
          } messages (standard)`
        );
        // Similar trimming logic but with the standard limit
        const systemMessage = apiMessages.find((m) => m.role === "system");
        const nonSystemMessages = apiMessages.filter(
          (m) => m.role !== "system"
        );
        apiMessages = nonSystemMessages.slice(-maxContextPairs * 2);
        if (systemMessage) {
          apiMessages.unshift(systemMessage);
        }
      }
    }

    // Handle system prompt
    const shouldDisableSysPromptForModel =
      CONFIG.disableSystemPromptFor?.includes(prefs.selectedModel);

    if (
      prefs.systemPromptEnabled &&
      CONFIG.initialSystemContext &&
      !shouldDisableSysPromptForModel // Check the new config list
    ) {
      // Ensure only one system message exists
      apiMessages = apiMessages.filter((m) => m.role !== "system");
      apiMessages.unshift({
        role: "system",
        content: CONFIG.initialSystemContext,
      });
      console.log(`Prepending system prompt for model: ${prefs.selectedModel}`);
    } else {
      // Remove any existing system message if disabled by pref, config, or missing context
      apiMessages = apiMessages.filter((m) => m.role !== "system");
      if (shouldDisableSysPromptForModel) {
        console.log(
          `System prompt disabled for model ${prefs.selectedModel} via config.`
        );
      }
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
    console.log(
      `Tools enabled in preferences for user ${userId}:`,
      prefs.toolsEnabled
    );
    let shouldUseTools =
      prefs.toolsEnabled && !isVisionRequest && capabilities.tools;
    const modelToolSupportKey = `${apiClientInfo.provider}/${apiClientInfo.modelId}`;
    const baseTools = shouldUseTools
      ? generateToolsFromCommands(client, prefs.toolsEnabled)
      : [];
    if (capabilities.tools && !shouldUseTools) {
      console.warn(
        `Tools are supported by the model but disabled for user ${userId}. Consider enabling them.`
      );
    }

    // Check if this model is known to not support tools from previous requests
    if (
      shouldUseTools &&
      state.modelToolSupportCache.has(modelToolSupportKey) &&
      !state.modelToolSupportCache.get(modelToolSupportKey)
    ) {
      console.log(
        `Model ${prefs.selectedModel} is known to not support tools, disabling tools for this request`
      );
      shouldUseTools = false;
    }

    // Call API with retry logic for tool support
    const { client: apiClient, modelId, provider } = apiClientInfo;

    async function makeApiRequest(withTools = true) {
      const effectiveShouldUseTools =
        capabilities.tools &&
        prefs.toolsEnabled &&
        withTools &&
        baseTools.length;
      const payload = {
        model: modelId,
        messages: apiMessages,
        tools: effectiveShouldUseTools ? baseTools : undefined,
        tool_choice: effectiveShouldUseTools ? "auto" : undefined,
      };
      console.log(
        `Final tools decision: Using tools? ${effectiveShouldUseTools}`
      );
      console.log(
        `Making ${provider} API request ${
          effectiveShouldUseTools ? "with" : "without"
        } tools`
      );
      const response = await apiClient.chat.completions.create(payload);
      // Mark in the response whether tools were disabled
      response._toolsDisabled = !effectiveShouldUseTools;
      return response;
    }

    let responseData;
    try {
      // Try first with tools if they should be used
      if (shouldUseTools && baseTools.length) {
        try {
          responseData = await makeApiRequest(true);
          // If successful, update cache to indicate tools are supported
          state.modelToolSupportCache.set(modelToolSupportKey, true);
        } catch (toolError) {
          // Check if this is a "no tool support" error from OpenRouter
          if (
            provider === "openrouter" &&
            ((toolError.status === 404 &&
              toolError.error?.message?.includes(
                "No endpoints found that support tool use"
              )) ||
              (toolError.error?.message?.includes("tool") &&
                toolError.error?.message?.includes("support")))
          ) {
            console.log(
              `Model ${prefs.selectedModel} doesn't support tools, retrying without tools`
            );
            // Use the helper function instead of directly setting cache
            markModelAsNotSupportingTools(modelToolSupportKey);
            // Retry without tools
            responseData = await makeApiRequest(false);
          } else {
            // Not a tool support error, rethrow
            throw toolError;
          }
        }
      } else {
        // Tools not requested or not available, make standard request
        responseData = await makeApiRequest(false);
      }
    } catch (error) {
      console.error(`API request error:`, error);
      throw error; // Rethrow to be caught by outer catch
    }

    // After the try-catch block for responseData, add code to update cache for fallback cases
    if (shouldUseTools && baseTools.length && responseData._toolsDisabled) {
      // If we initially tried with tools but ended up using a request without tools
      console.warn(
        `Model ${prefs.selectedModel} failed with tools but succeeded without. Marking as not supporting tools.`
      );
      // Use the helper function instead of directly setting cache
      markModelAsNotSupportingTools(modelToolSupportKey);
    }

    // Process response
    if (
      !responseData ||
      !responseData.choices ||
      responseData.choices.length === 0
    ) {
      console.error("Invalid API response format:", responseData);
      throw new Error(
        "Invalid response from AI provider. The model may be experiencing issues."
      );
    }

    const aiMsg = responseData.choices[0].message;
    let finalText = aiMsg.content?.trim() || "";
    const toolCalls = aiMsg.tool_calls || [];

    // Remove any <think> tags from the response
    finalText = removeThinkTags(finalText);

    if (!finalText && !toolCalls.length)
      finalText = i18n.__("events.ai.messages.noTextResponse", effectiveLocale);

    // Process tool calls if there are any and tools are enabled
    let anyToolUsedV2 = false; // Declare flag before the loop
    if (toolCalls.length && prefs.toolsEnabled) {
      console.log(`AI requested ${toolCalls.length} tool calls.`);

      // Process tool calls
      for (const toolCall of toolCalls) {
        console.log(`Executing tool: ${toolCall.function.name}`);

        const { success, response, commandReplied, visualResponse, isV2Reply } =
          await executeToolCall(toolCall, message, effectiveLocale);

        console.log(
          `Tool ${toolCall.function.name} execution ${
            success ? "succeeded" : "failed"
          }. ` +
            `Replied: ${commandReplied}, Visual: ${visualResponse}, V2: ${isV2Reply}`
        );

        // Track if any tool used V2 components
        if (isV2Reply) {
          anyToolUsedV2 = true; // Set the flag if this tool used V2
        }

        // If the command replied with visual content OR V2 components,
        // don't add additional text about it to the main response message
        // to avoid confusion or overwriting V2 components.
        if (visualResponse || isV2Reply) {
          // If there *is* separate text from the AI after the tool ran, send it as a follow-up
          // This prevents overwriting V2 components with a V1 edit
          if (finalText) {
            await message.channel.send(finalText).catch(console.error);
            finalText = ""; // Clear the text so sendResponse doesn't send it again
          }
          // Skip adding the tool result text block below
          continue;
        }

        // Add tool result to the response if it didn't already reply with visual/V2 content
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

          finalText += `\n\n${prefix}\n${removeThinkTags(response) || ""}`;
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
            `${prefix}\n${removeThinkTags(response) || ""}`;
        } else {
          finalText = cleanedResponse.trim();
        }
      }
    }

    // Send final response
    addConversationToHistory(userId, messageContent, finalText);
    const models = await getAvailableModels(
      client,
      isVisionRequest ? "vision" : null
    );
    const comps = await buildInteractionComponents(
      userId,
      models,
      isVisionRequest,
      false,
      effectiveLocale,
      client
    );

    // If any tool used V2, we should not send the V1 components.
    // We already sent any necessary follow-up text from the AI.
    // The message state is already V2 from the tool.
    if (anyToolUsedV2) {
      console.log(
        "Skipping final sendResponse with V1 components because a tool used V2."
      );
      // Clean up the processing message if it exists and wasn't edited/deleted by the tool
      if (procMsg) {
        await procMsg.delete().catch(() => {}); // Try deleting instead of editing
      }
    } else {
      // Original behavior: Send the response with V1 components
      // Only send if there is text or if no tools were called (initial response case)
      if (finalText || toolCalls.length === 0) {
        await sendResponse(message, procMsg, finalText, comps, effectiveLocale);
      } else if (procMsg) {
        // If only tools ran (no V2) and AI had no final text, delete processing message
        await procMsg.delete().catch(() => {});
      }
    }
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
