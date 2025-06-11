import i18n from "../utils/newI18n.js";
import CONFIG from "../config/aiConfig.js";
import { ButtonBuilder, ActionRowBuilder } from "discord.js";

// Import from the unified AI API
import {
  // State
  state,

  // User preferences and history
  getUserPreferences,
  updateUserPreference,
  addConversationToHistory,

  // Model status
  isModelRateLimited,
  markModelAsNotSupportingTools,
  supportsReasoning,

  // Model management
  getApiClientForModel,
  getModelCapabilities,
  getAvailableModels,

  // Message handling
  splitMessage,
  sendResponse,
  buildInteractionComponents,

  // Tools
  generateToolsFromCommands,
} from "../ai.js";

// Helper function to detect if AI is trying to use a "fake" tool in text format
function detectFakeToolCalls(content) {
  // Disabled - always return null to prevent fake tool call detection
  return null;

  /* Original code kept for reference but not executed
  console.log(
    `[DEBUG] Checking for fake tool calls in text: ${content.substring(
      0,
      100
    )}${content.length > 100 ? "..." : ""}`
  );

  // Pattern to detect attempted tool calls in several formats
  const patterns = [
    // Match format: !command argument or /command argument
    // Fix the regex to properly escape the forward slash
    /[!\/]([a-z0-9_]+)(.*)/i,
    // Match format: @bot command argument
    /@[a-z0-9_]+\s+([a-z0-9_]+)(.*)/i,
    // Match format: command(arguments) or command({json})
    /\b([a-z0-9_]+)\(([^)]*)\)/i,
    // Match JSON-like format: {"command": "name", "arguments": {...}}
    /{[\s\n]*"command"[\s\n]*:[\s\n]*"([^"]+)"[\s\n]*,[\s\n]*"arguments"[\s\n]*:[\s\n]*([\s\S]*?)}/i,
  ];

  for (const pattern of patterns) {
    console.log(`[DEBUG] Trying pattern: ${pattern}`);
    const match = content.match(pattern);
    if (match) {
      const fullMatch = match[0];
      const name = match[1];
      const argString = match[2]?.trim() || "{}";
      console.log(
        `[DEBUG] Found match with pattern. Command: ${name}, Args: ${argString}`
      );

      // Try to parse arguments as JSON if they look like JSON
      let args = {};
      if (argString.startsWith("{") && argString.endsWith("}")) {
        try {
          args = JSON.parse(argString);
          console.log(
            `[DEBUG] Successfully parsed args as JSON: ${JSON.stringify(args)}`
          );
        } catch (e) {
          // If parsing fails, use as string
          console.log(`[DEBUG] Failed to parse args as JSON: ${e.message}`);
          const paramName = name === "say" ? "text" : "prompt";
          args = { [paramName]: argString };
        }
      } else if (argString) {
        // For simple text arguments, try to intelligently assign to parameter
        const paramName = name === "say" ? "text" : "prompt";
        args = { [paramName]: argString };
        console.log(
          `[DEBUG] Using string arg with param ${paramName}: ${argString}`
        );
      }

      return {
        fullMatch,
        name,
        args,
      };
    }
  }

  console.log(`[DEBUG] No fake tool calls detected in text`);
  return null;
  */
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

// Function to gather user information for the system prompt
async function getUserInfoForPrompt(message) {
  const author = message.author;
  const mentions = message.mentions.users;
  const channelMentions = message.mentions.channels;
  let userInfo = {};
  let mentionedUsersInfo = [];
  let mentionedChannelsInfo = [];
  let serverInfo = {};
  let currentChannelInfo = {};

  // Get author info
  if (author) {
    userInfo = {
      id: author.id,
      username: author.username,
      nickname: message.member?.nickname || author.username,
      isBot: author.bot,
      roles: message.member?.roles.cache.map((role) => role.name) || [],
      joinedAt: message.member?.joinedAt
        ? message.member.joinedAt.toISOString()
        : null,
      joinedAtRelative: message.member?.joinedAt
        ? getRelativeTimeString(message.member.joinedAt)
        : "unknown time",
    };
  }

  // Get info about mentioned users
  if (mentions && mentions.size > 0) {
    await Promise.all(
      Array.from(mentions.values()).map(async (user) => {
        if (user.id === message.client.user.id) return; // Skip the bot itself

        const member = message.guild
          ? await message.guild.members.fetch(user.id).catch(() => null)
          : null;

        if (member) {
          mentionedUsersInfo.push({
            id: user.id,
            username: user.username,
            nickname: member.nickname || user.username,
            isBot: user.bot,
            roles: member.roles.cache.map((role) => role.name) || [],
            joinedAt: member.joinedAt ? member.joinedAt.toISOString() : null,
            joinedAtRelative: member.joinedAt
              ? getRelativeTimeString(member.joinedAt)
              : "unknown time",
          });
        }
      })
    );
  }

  // Get current channel info
  if (message.channel) {
    currentChannelInfo = {
      id: message.channel.id,
      name: message.channel.name,
      type: message.channel.type,
      isThread: message.channel.isThread,
      isDM: message.channel.type === "DM",
      topic: message.channel.topic || "No topic set",
      parentName: message.channel.parent ? message.channel.parent.name : null,
      messageCount: message.channel.messages?.cache?.size || "unknown",
    };
  }

  // Get info about mentioned channels
  if (channelMentions && channelMentions.size > 0) {
    Array.from(channelMentions.values()).forEach((channel) => {
      mentionedChannelsInfo.push({
        id: channel.id,
        name: channel.name,
        type: channel.type,
        isThread: channel.isThread,
        isDM: channel.type === "DM",
        topic: channel.topic || "No topic set",
        parentName: channel.parent ? channel.parent.name : null,
      });
    });
  }

  // Get server info if available
  if (message.guild) {
    serverInfo = {
      name: message.guild.name,
      memberCount: message.guild.memberCount,
      createdAt: message.guild.createdAt.toISOString(),
      createdAtRelative: getRelativeTimeString(message.guild.createdAt),
      channelName: message.channel.name,
      isThread: !!message.channel.isThread,
      isDM: message.channel.type === "DM",
    };
  }

  return {
    userInfo,
    mentionedUsersInfo,
    mentionedChannelsInfo,
    serverInfo,
    currentChannelInfo,
  };
}

// Helper function to get relative time string
function getRelativeTimeString(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 30) return `${diffDays} days ago`;

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12)
    return `${diffMonths} month${diffMonths > 1 ? "s" : ""} ago`;

  const diffYears = Math.floor(diffMonths / 12);
  return `${diffYears} year${diffYears > 1 ? "s" : ""} ago`;
}

// Function to process the AI response with reasoning tokens
function processResponseWithReasoning(
  responseContent,
  reasoningContent = null
) {
  // If there's no reasoning content, just return the response content
  if (!reasoningContent || reasoningContent.trim() === "") {
    console.log(
      `[DEBUG] No reasoning content to format, returning original response`
    );
    return responseContent;
  }

  console.log(
    `[DEBUG] Formatting reasoning content with -# prefix. Original length: ${reasoningContent.length}`
  );

  // Format each line of reasoning with "-#" prefix
  const formattedReasoning = reasoningContent
    .split("\n")
    .map((line) => `-# ${line}`)
    .join("\n");

  console.log(
    `[DEBUG] Formatted reasoning length: ${formattedReasoning.length}`
  );
  console.log(
    `[DEBUG] Combined response will have reasoning followed by response`
  );

  // Format the content with reasoning
  return `${formattedReasoning}\n\n${responseContent}`;
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
      // Get user information for the system prompt
      const {
        userInfo,
        mentionedUsersInfo,
        serverInfo,
        mentionedChannelsInfo,
        currentChannelInfo,
      } = await getUserInfoForPrompt(message);

      // Create an enhanced system prompt with user information
      let enhancedSystemPrompt = CONFIG.initialSystemContext;

      // Add user information section
      enhancedSystemPrompt += `\n\nUSER INFORMATION:
- You are currently talking to ${userInfo.nickname} (username: ${
        userInfo.username
      })
- User ID: ${userInfo.id}
- Joined server: ${userInfo.joinedAtRelative}
- Roles: ${userInfo.roles.join(", ") || "none"}`;

      // Add current channel information
      enhancedSystemPrompt += `\n\nCURRENT CHANNEL:
- Name: #${currentChannelInfo.name}
- Type: ${
        currentChannelInfo.isThread
          ? "Thread"
          : currentChannelInfo.isDM
          ? "Direct Message"
          : "Text Channel"
      }
- Topic: ${currentChannelInfo.topic || "No topic set"}
${
  currentChannelInfo.parentName
    ? `- Parent: ${currentChannelInfo.parentName}`
    : ""
}`;

      // Add mentioned users if any
      if (mentionedUsersInfo.length > 0) {
        enhancedSystemPrompt += `\n\nMENTIONED USERS:`;
        mentionedUsersInfo.forEach((user) => {
          enhancedSystemPrompt += `
- ${user.nickname} (username: ${user.username})
  - User ID: ${user.id}
  - Joined server: ${user.joinedAtRelative}
  - Roles: ${user.roles.join(", ") || "none"}`;
        });
      }

      // Add mentioned channels if any
      if (mentionedChannelsInfo.length > 0) {
        enhancedSystemPrompt += `\n\nMENTIONED CHANNELS:`;
        mentionedChannelsInfo.forEach((channel) => {
          enhancedSystemPrompt += `
- #${channel.name}
  - Type: ${
    channel.isThread
      ? "Thread"
      : channel.isDM
      ? "Direct Message"
      : "Text Channel"
  }
  - Topic: ${channel.topic || "No topic set"}
  ${channel.parentName ? `- Parent: ${channel.parentName}` : ""}`;
        });
      }

      // Add server information if available
      if (serverInfo.name) {
        enhancedSystemPrompt += `\n\nSERVER CONTEXT:
- Server: ${serverInfo.name}
- Members: ${serverInfo.memberCount}
- Server created: ${serverInfo.createdAtRelative}`;
      }

      // Ensure only one system message exists
      apiMessages = apiMessages.filter((m) => m.role !== "system");
      apiMessages.unshift({
        role: "system",
        content: enhancedSystemPrompt,
      });
      console.log(
        `Prepending enhanced system prompt with user info for model: ${prefs.selectedModel}`
      );
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

    // Generate command reference for AI awareness
    console.log(
      `Tools enabled in preferences for user ${userId}:`,
      prefs.toolsEnabled
    );
    let shouldUseTools = false; // Always set to false to disable tools
    const modelToolSupportKey = `${apiClientInfo.provider}/${apiClientInfo.modelId}`;

    // Get command definitions for AI awareness, but don't send them to the model
    const commandDefinitions = generateToolsFromCommands(client);
    console.log(
      `Generated ${commandDefinitions.length} command definitions for AI reference`
    );

    // Always use an empty array for baseTools when sending to AI
    const baseTools = [];

    if (capabilities.tools) {
      console.warn(
        `Tools are supported by the model but disabled by configuration. Commands are scanned for reference only.`
      );
    }

    // Check if this model is known to not support tools from previous requests
    if (
      shouldUseTools &&
      state.modelStatus.toolSupport.has(modelToolSupportKey) &&
      !state.modelStatus.toolSupport.get(modelToolSupportKey)
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

      let internalToolFollowUpDone = false; // Initialize flag

      console.log(
        `[DEBUG] makeApiRequest called with withTools=${withTools}, effectiveShouldUseTools=${effectiveShouldUseTools}`
      );
      console.log(`[DEBUG] Capabilities: ${JSON.stringify(capabilities)}`);
      console.log(
        `[DEBUG] prefs.toolsEnabled: ${prefs.toolsEnabled}, baseTools.length: ${baseTools.length}`
      );

      // Set up common parameters (provider-agnostic)
      const payload = {
        model: modelId,
        messages: apiMessages,
        stream: true, // Enable streaming for both providers
      };

      // Add tools if applicable
      if (effectiveShouldUseTools) {
        payload.tools = baseTools;
        payload.tool_choice = "auto";
        console.log(`[DEBUG] Added ${baseTools.length} tools to payload`);
      }

      // Add reasoning configuration if enabled and supported
      if (
        supportsReasoning(modelId) &&
        prefs.reasoningEnabled &&
        prefs.reasoningLevel !== "off"
      ) {
        console.log(
          `[DEBUG] Adding reasoning configuration for ${modelId} with level ${prefs.reasoningLevel}`
        );

        // Add reasoning configuration to the payload
        payload.reasoning = {
          effort: prefs.reasoningLevel || "medium",
        };

        console.log(
          `[DEBUG] Reasoning config: ${JSON.stringify(payload.reasoning)}`
        );
      } else if (supportsReasoning(modelId)) {
        // Explicitly set reasoning to be disabled with max_tokens: 0 instead of exclude: true
        if (prefs.reasoningLevel === "off") {
          console.log(
            `[DEBUG] Explicitly disabling reasoning for ${modelId} by setting max_tokens: 0`
          );
          payload.reasoning = { max_tokens: 0 };
        } else {
          console.log(
            `[DEBUG] Model supports reasoning, but reasoning is disabled in user preferences`
          );
        }
      }

      // Add AI generation parameters based on provider
      if (provider === "groq") {
        // Groq-specific parameters
        Object.assign(payload, {
          temperature: prefs.aiParams.temperature,
          top_p: prefs.aiParams.top_p,
          frequency_penalty: prefs.aiParams.frequency_penalty,
          presence_penalty: prefs.aiParams.presence_penalty,
          // Specific to Groq
          max_tokens: 4096, // Use max_tokens instead of max_completion_tokens (standardized param)
          // Do NOT include repetition_penalty as it's not supported by Groq
        });

        console.log(`[DEBUG] Configured Groq-specific parameters`);
      } else if (provider === "openrouter") {
        // OpenRouter parameters (with more options)
        Object.assign(payload, {
          temperature: prefs.aiParams.temperature,
          top_p: prefs.aiParams.top_p,
          top_k: prefs.aiParams.top_k,
          frequency_penalty: prefs.aiParams.frequency_penalty,
          presence_penalty: prefs.aiParams.presence_penalty,
          // OpenRouter specific
          min_p: prefs.aiParams.min_p,
          top_a: prefs.aiParams.top_a,
          repetition_penalty: prefs.aiParams.repetition_penalty,
        });

        console.log(`[DEBUG] Configured OpenRouter-specific parameters`);
      } else {
        // Generic fallback for other providers
        Object.assign(payload, {
          temperature: prefs.aiParams.temperature,
          top_p: prefs.aiParams.top_p,
          frequency_penalty: prefs.aiParams.frequency_penalty,
          presence_penalty: prefs.aiParams.presence_penalty,
        });

        console.log(`[DEBUG] Configured generic provider parameters`);
      }

      console.log(
        `Final tools decision: Using tools? ${effectiveShouldUseTools}`
      );
      console.log(
        `Making ${provider} API request ${
          effectiveShouldUseTools ? "with" : "without"
        } tools and custom parameters:`
      );
      console.log(
        `Parameters: temperature=${payload.temperature}, top_p=${
          payload.top_p
        }${payload.top_k ? `, top_k=${payload.top_k}` : ""}${
          payload.repetition_penalty
            ? `, repetition_penalty=${payload.repetition_penalty}`
            : ""
        }`
      );

      try {
        // Create a stop button
        const stopButton = new ButtonBuilder()
          .setCustomId(`ai_stop_stream_${userId}`)
          .setLabel(
            i18n.__("events.ai.buttons.stream.stop", effectiveLocale) || "Stop"
          )
          .setStyle(4) // Red button (DANGER)
          .setEmoji("⏹️");

        const stopRow = new ActionRowBuilder().addComponents([stopButton]);

        // Set up message to show streaming
        await procMsg.edit({
          content:
            i18n.__("events.ai.messages.streamStart", effectiveLocale) ||
            "Thinking...",
          components: [stopRow],
        });
        console.log(`[DEBUG] Stream message updated with stop button`);

        // Create flags to manage the stream
        let shouldStop = false;
        let responseAccumulator = "";
        let toolCalls = [];
        let isFirstChunk = true;
        let lastUpdateTime = Date.now();
        const UPDATE_INTERVAL = 1000; // Update message every 1 second
        let finalFinishReason = null; // Store the final finish reason
        let needsImmediateExecution = false; // Flag for immediate execution after stream completion

        // Set up collector for stop button
        const collector = procMsg.createMessageComponentCollector({
          filter: (i) =>
            i.customId === `ai_stop_stream_${userId}` && i.user.id === userId,
          time: 5 * 60 * 1000, // 5 minutes timeout
        });

        collector.on("collect", async (interaction) => {
          shouldStop = true;
          await interaction.update({
            content:
              i18n.__("events.ai.messages.streamStopped", effectiveLocale) ||
              "Generation stopped.",
            components: [],
          });
          collector.stop("user_stopped");
        });

        console.log(`[DEBUG] Starting API stream request to ${provider}`);
        console.log(
          `[DEBUG] Payload: model=${payload.model}, stream=${
            payload.stream
          }, has_tools=${!!payload.tools}`
        );

        // Start streaming with timeout handling
        let stream;
        try {
          // Set a timeout for the API request
          const timeoutMs = 60000; // 60 seconds timeout
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(
              () =>
                reject(
                  new Error(
                    `API request timed out after ${timeoutMs / 1000} seconds`
                  )
                ),
              timeoutMs
            );
          });

          const apiPromise = apiClient.chat.completions.create({
            ...payload,
            stream: true,
          });

          stream = await Promise.race([apiPromise, timeoutPromise]);
          console.log(`[DEBUG] Stream initialized successfully`);
        } catch (streamError) {
          console.error(`[DEBUG] Error initializing stream:`, streamError);
          // Provide more specific error message based on error type
          if (
            streamError.message &&
            streamError.message.includes("timed out")
          ) {
            throw new Error(
              `API request timed out. Provider: ${provider}, Model: ${modelId}`
            );
          } else if (streamError.status) {
            throw new Error(
              `API returned status ${streamError.status}: ${
                streamError.message || "Unknown error"
              }`
            );
          } else {
            throw streamError; // Rethrow original error
          }
        }

        // Process the stream
        let functionCall = null;
        let completedToolCalls = [];
        let pendingToolResults = [];
        let isWaitingForToolResults = false;
        let chunkCount = 0;

        console.log(`[DEBUG] Starting to process stream chunks`);
        for await (const chunk of stream) {
          chunkCount++;
          if (chunkCount % 10 === 0) {
            console.log(`[DEBUG] Processed ${chunkCount} chunks so far`);
          }

          if (shouldStop) {
            console.log(`[DEBUG] Stream stopped by user`);
            break;
          }

          const content = chunk.choices[0]?.delta?.content || "";
          const functionDelta = chunk.choices[0]?.delta?.tool_calls?.[0];
          const finishReason = chunk.choices[0]?.finish_reason;

          if (finishReason) {
            console.log(
              `[DEBUG] Stream chunk has finish_reason: ${finishReason}`
            );
            finalFinishReason = finishReason; // Store the final finish reason
            if (finishReason === "tool_calls") {
              needsImmediateExecution = true;
            }
          }

          // Handle content
          if (content) {
            responseAccumulator += content;
            if (content.length > 50) {
              console.log(
                `[DEBUG] Received large content chunk: ${content.length} chars`
              );
            }

            // Update the message periodically to avoid rate limits
            const now = Date.now();
            if (now - lastUpdateTime > UPDATE_INTERVAL || isFirstChunk) {
              lastUpdateTime = now;
              isFirstChunk = false;

              // Sanitize and remove thinking tags
              const sanitizedText = removeThinkTags(responseAccumulator);
              console.log(
                `[DEBUG] Updating message with accumulated content (${responseAccumulator.length} chars)`
              );

              // Show periodic updates
              await procMsg
                .edit({
                  content:
                    sanitizedText ||
                    i18n.__(
                      "events.ai.messages.streamProcessing",
                      effectiveLocale
                    ) ||
                    "Processing...",
                  components: [stopRow],
                })
                .catch((error) => {
                  // Handle potential edit errors due to rate limits
                  console.log(
                    `[DEBUG] Rate limit hit on message edit: ${error.message}`
                  );
                });
            }
          }

          // Handle function/tool calls in stream
          if (functionDelta) {
            console.log(
              `[DEBUG] Received functionDelta in chunk: ${JSON.stringify(
                functionDelta
              )}`
            );
            if (functionDelta.index === 0 && !functionCall) {
              functionCall = {
                id: functionDelta.id,
                type: functionDelta.type, // Ensure type is copied from the delta
                function: {
                  name: functionDelta.function?.name || "",
                  arguments: functionDelta.function?.arguments || "",
                },
              };
              console.log(
                `[DEBUG] Started new functionCall: ${functionCall.function.name}, type: ${functionCall.type}`
              );
            } else if (functionCall && functionDelta.function) {
              // Append more data to function call
              if (functionDelta.function.name) {
                functionCall.function.name += functionDelta.function.name;
              }
              if (functionDelta.function.arguments) {
                functionCall.function.arguments +=
                  functionDelta.function.arguments;
              }
              console.log(
                `[DEBUG] Appended to functionCall: name=${functionCall.function.name}, args length=${functionCall.function.arguments.length}`
              );
            }
          }

          // Handle end of function call
          if (chunk.choices[0]?.delta?.tool_calls === null && functionCall) {
            console.log(
              `[DEBUG] Completed tool call in stream: ${functionCall.function.name} with args: ${functionCall.function.arguments}`
            );
            completedToolCalls.push(functionCall);

            // Execute tool call as soon as it's complete
            if (functionCall.function && functionCall.function.name) {
              console.log(
                `[DEBUG] Executing streaming tool call: ${functionCall.function.name}`
              );
              isWaitingForToolResults = true;

              try {
                // Ensure arguments is valid JSON even if empty
                if (
                  !functionCall.function.arguments ||
                  functionCall.function.arguments.trim() === ""
                ) {
                  functionCall.function.arguments = "{}";
                  console.log(
                    `[DEBUG] Empty arguments detected, defaulting to {}`
                  );
                } else {
                  // Validate JSON format
                  try {
                    JSON.parse(functionCall.function.arguments);
                  } catch (jsonError) {
                    console.log(
                      `[DEBUG] Invalid JSON in arguments, attempting to fix: ${jsonError.message}`
                    );
                    // Try to fix common JSON issues (missing quotes around keys, etc)
                    const fixedJson = functionCall.function.arguments.replace(
                      /([{,]\s*)([a-zA-Z0-9_]+)(\s*:)/g,
                      '$1"$2"$3'
                    ); // Add quotes to keys

                    try {
                      JSON.parse(fixedJson);
                      functionCall.function.arguments = fixedJson;
                      console.log(
                        `[DEBUG] Successfully fixed JSON arguments: ${fixedJson}`
                      );
                    } catch (fixError) {
                      // If we still can't parse it, just use an empty object
                      console.log(
                        `[DEBUG] Could not fix JSON arguments, defaulting to {}`
                      );
                      functionCall.function.arguments = "{}";
                    }
                  }
                }

                // Update message to show tool execution
                await procMsg.edit({
                  content: `${removeThinkTags(responseAccumulator)}\n\n${
                    i18n.__(
                      "events.ai.messages.streamToolExecution",
                      { tool: functionCall.function.name },
                      effectiveLocale
                    ) || `Executing ${functionCall.function.name}...`
                  }`,
                  components: [stopRow],
                });

                // --- Direct command execution for all tools ---
                // Use direct execution approach for all tools
                let result;

                console.log(
                  `[DEBUG] Attempting direct execution for ${functionCall.function.name}`
                );

                // Parse the command parts
                const commandParts = functionCall.function.name.split("_");
                const commandName = commandParts[0];
                const subCommandName =
                  commandParts.length > 1
                    ? commandParts.slice(1).join("_")
                    : null;

                // Get the command directly
                const command = message.client.commands.get(commandName);
                console.log(
                  `[DEBUG] Immediate execution - Command lookup for '${commandName}': ${!!command}`
                );
                if (command) {
                  console.log(`[DEBUG] Found base command: ${commandName}`);
                  console.log(`[DEBUG] Command structure:`, {
                    hasExecute: typeof command.execute === "function",
                    hasSubcommands: !!command.subcommands,
                    subcommandNames: command.subcommands
                      ? Object.keys(command.subcommands)
                      : [],
                  });

                  let targetCommand;
                  if (
                    subCommandName &&
                    command.subcommands &&
                    command.subcommands[subCommandName]
                  ) {
                    console.log(`[DEBUG] Found subcommand: ${subCommandName}`);
                    targetCommand = command.subcommands[subCommandName];
                  } else if (!subCommandName) {
                    console.log(`[DEBUG] Using base command directly`);
                    targetCommand = command;
                  } else if (
                    subCommandName &&
                    command[`execute_${subCommandName}`]
                  ) {
                    console.log(
                      `[DEBUG] Found alternate execution method: execute_${subCommandName}`
                    );
                    targetCommand = {
                      execute:
                        command[`execute_${subCommandName}`].bind(command),
                    };
                  }

                  if (targetCommand) {
                    console.log(
                      `[DEBUG] Target command found, has execute: ${
                        typeof targetCommand.execute === "function"
                      }`
                    );
                  } else {
                    console.log(
                      `[DEBUG] No target command found for ${functionCall.function.name}`
                    );
                  }

                  if (
                    targetCommand &&
                    typeof targetCommand.execute === "function"
                  ) {
                    console.log(`[DEBUG] Found executable target command`);

                    // Create a defer message
                    const deferMsg = await message.reply({
                      content: `⏳ Processing ${functionCall.function.name} command...`,
                      fetchReply: true,
                    });

                    // Create a proxy for the command
                    const proxy = {
                      _isAiProxy: true,
                      options: {
                        getMember: (name) => {
                          if (
                            name === "user" &&
                            (!functionCall.function.arguments.user ||
                              functionCall.function.arguments.user === "")
                          ) {
                            console.log(
                              `[DEBUG] Returning message.member for empty user param`
                            );
                            return message.member;
                          }
                          // Handle user parameter
                          const value = functionCall.function.arguments[name];
                          if (!value) return null;
                          // Rest of getMember logic
                          if (/^\d{17,19}$/.test(value)) {
                            return (
                              message.guild?.members.cache.get(value) || null
                            );
                          }
                          if (value.startsWith("<@") && value.endsWith(">")) {
                            const userId = value.replace(/[<@!>]/g, "");
                            return (
                              message.guild?.members.cache.get(userId) || null
                            );
                          }
                          const memberByName =
                            message.guild?.members.cache.find(
                              (member) =>
                                member.user.username.toLowerCase() ===
                                value.toLowerCase().replace("@", "")
                            );
                          return memberByName || null;
                        },
                        getString: (name) =>
                          functionCall.function.arguments[name] || null,
                        getInteger: (name) => {
                          const val = functionCall.function.arguments[name];
                          return val !== undefined ? parseInt(val, 10) : null;
                        },
                        getNumber: (name) => {
                          const val = functionCall.function.arguments[name];
                          return val !== undefined ? parseFloat(val) : null;
                        },
                        getBoolean: (name) => {
                          const val = functionCall.function.arguments[name];
                          if (val === undefined) return null;
                          if (typeof val === "boolean") return val;
                          if (val === "true" || val === "1") return true;
                          if (val === "false" || val === "0") return false;
                          return null;
                        },
                        getChannel: (name) => {
                          const val = functionCall.function.arguments[name];
                          if (!val) return null;
                          if (/^\d{17,19}$/.test(val)) {
                            return (
                              message.guild?.channels.cache.get(val) || null
                            );
                          }
                          if (val.startsWith("<#") && val.endsWith(">")) {
                            const channelId = val.replace(/[<#>]/g, "");
                            return (
                              message.guild?.channels.cache.get(channelId) ||
                              null
                            );
                          }
                          return (
                            message.guild?.channels.cache.find(
                              (channel) =>
                                channel.name.toLowerCase() === val.toLowerCase()
                            ) || null
                          );
                        },
                        getRole: (name) => {
                          const val = functionCall.function.arguments[name];
                          if (!val) return null;
                          if (/^\d{17,19}$/.test(val)) {
                            return message.guild?.roles.cache.get(val) || null;
                          }
                          if (val.startsWith("<@&") && val.endsWith(">")) {
                            const roleId = val.replace(/[<@&>]/g, "");
                            return (
                              message.guild?.roles.cache.get(roleId) || null
                            );
                          }
                          return (
                            message.guild?.roles.cache.find(
                              (role) =>
                                role.name.toLowerCase() === val.toLowerCase()
                            ) || null
                          );
                        },
                        getSubcommand: () => subCommandName || null,
                      },
                      guild: message.guild,
                      channel: message.channel,
                      member: message.member,
                      user: message.author,
                      client: message.client,
                      replied: false,
                      deferred: true,
                      locale: effectiveLocale,
                      async reply(options) {
                        this.replied = true;
                        return deferMsg.edit(options);
                      },
                      async editReply(options) {
                        this.replied = true;
                        return deferMsg.edit(options);
                      },
                      async followUp(options) {
                        return message.channel.send(options);
                      },
                      async deferReply() {
                        return deferMsg;
                      },
                    };

                    try {
                      // Execute command directly
                      console.log(
                        `[DEBUG] Executing ${functionCall.function.name} command with proxy`
                      );
                      const cmdResult = await targetCommand.execute(
                        proxy,
                        i18n
                      );
                      console.log(
                        `[DEBUG] Command execution result:`,
                        cmdResult
                      );
                      console.log(`[DEBUG] Command replied:`, proxy.replied);

                      // Add result to pendingToolResults
                      pendingToolResults.push({
                        tool_call_id: functionCall.id,
                        role: "tool",
                        name: functionCall.function.name,
                        content: `Successfully executed ${functionCall.function.name}`,
                      });

                      console.log(
                        `[DEBUG] Successfully executed ${functionCall.function.name} command directly`
                      );
                    } catch (cmdError) {
                      console.error(
                        `[DEBUG] Error in direct command execution: ${cmdError.message}`,
                        cmdError.stack
                      );
                      pendingToolResults.push({
                        tool_call_id: functionCall.id,
                        role: "tool",
                        name: functionCall.function.name,
                        content: `Error executing ${functionCall.function.name}: ${cmdError.message}`,
                      });
                    }
                  } else {
                    console.log(
                      `[DEBUG] Target command not found or not executable, falling back to normal execution`
                    );
                    try {
                      const result = await executeToolCall(
                        functionCall,
                        message,
                        effectiveLocale
                      );
                      pendingToolResults.push({
                        tool_call_id: functionCall.id,
                        role: "tool",
                        name: functionCall.function.name,
                        content:
                          result.response ||
                          (result.success ? "OK" : "Error executing tool"),
                      });
                    } catch (error) {
                      console.error(
                        `[DEBUG] Error in immediate execution:`,
                        error
                      );
                      pendingToolResults.push({
                        tool_call_id: functionCall.id,
                        role: "tool",
                        name: functionCall.function.name,
                        content: `Error: ${error.message}`,
                      });
                    }
                  }
                } else {
                  console.log(
                    `[DEBUG] Base command not found, falling back to normal execution`
                  );
                  try {
                    const result = await executeToolCall(
                      functionCall,
                      message,
                      effectiveLocale
                    );
                    pendingToolResults.push({
                      tool_call_id: functionCall.id,
                      role: "tool",
                      name: functionCall.function.name,
                      content:
                        result.response ||
                        (result.success ? "OK" : "Error executing tool"),
                    });
                  } catch (error) {
                    console.error(
                      `[DEBUG] Error in immediate execution:`,
                      error
                    );
                    pendingToolResults.push({
                      tool_call_id: functionCall.id,
                      role: "tool",
                      name: functionCall.function.name,
                      content: `Error: ${error.message}`,
                    });
                  }
                }
              } catch (error) {
                console.error(`[DEBUG] Error in immediate execution:`, error);
                pendingToolResults.push({
                  tool_call_id: functionCall.id,
                  role: "tool",
                  name: functionCall.function.name,
                  content: `Error: ${error.message}`,
                });
              }

              isWaitingForToolResults = false;
            }

            functionCall = null;
          }

          // Handle end of stream
          if (finishReason === "stop" || finishReason === "tool_calls") {
            console.log(`[DEBUG] Stream finished with reason: ${finishReason}`);
            break;
          }
        }

        // Ensure any in-progress functionCall is added if the stream ended with tool_calls
        if (finalFinishReason === "tool_calls" && functionCall) {
          console.log(
            `[DEBUG] Stream ended with tool_calls and an active functionCall: ${functionCall.function.name}. Adding to completedToolCalls.`
          );
          completedToolCalls.push(functionCall);
          functionCall = null; // Clear it as it's now processed
        }

        console.log(
          `[DEBUG] Stream processing complete after ${chunkCount} chunks. Stopping collector. Final reason: ${finalFinishReason}, needsImmediateExecution: ${needsImmediateExecution}`
        );
        // Stop the collector when stream ends
        collector.stop("stream_complete");

        // HANDLE IMMEDIATE TOOL EXECUTION
        // This is necessary because the streaming code might end before our tool calls are fully processed
        if (needsImmediateExecution && completedToolCalls.length > 0) {
          console.log(
            `[DEBUG] Processing ${completedToolCalls.length} completed tool calls after stream`
          );

          // Debug the available commands
          console.log(
            `[DEBUG] Available commands for lookup:`,
            Array.from(message.client.commands.keys()).join(", ")
          );

          for (const toolCall of completedToolCalls) {
            console.log(
              `[DEBUG] Processing post-stream tool call: ${toolCall.function.name}`
            );

            // Special handling for economy_balance command
            if (toolCall.function.name === "economy_balance") {
              console.log(
                `[DEBUG] Special handling for economy_balance command`
              );

              try {
                // Parse arguments
                let args = {};
                try {
                  if (
                    toolCall.function.arguments &&
                    toolCall.function.arguments.trim() !== ""
                  ) {
                    args = JSON.parse(toolCall.function.arguments);
                  }
                } catch (e) {
                  console.error(
                    `[DEBUG] Error parsing arguments: ${e.message}`
                  );
                  args = {};
                }

                // Get the economy command
                const economyCommand = message.client.commands.get("economy");
                if (!economyCommand) {
                  console.error(`[DEBUG] Economy command not found!`);
                  throw new Error("Economy command not found");
                }

                console.log(`[DEBUG] Retrieved economy command:`, {
                  hasExecute: typeof economyCommand.execute === "function",
                  hasSubcommands: !!economyCommand.subcommands,
                });

                // Find the balance subcommand in the economy folder directly
                const balancePath = `../cmds/economy/balance.js`;
                console.log(
                  `[DEBUG] Attempting to import balance command directly`
                );

                await import(balancePath) // Added await here
                  .then(async (balanceModule) => {
                    console.log(`[DEBUG] Successfully imported balance module`);
                    const balanceCommand = balanceModule.default;

                    if (
                      !balanceCommand ||
                      typeof balanceCommand.execute !== "function"
                    ) {
                      console.error(
                        `[DEBUG] Balance command import failed or has no execute method`
                      );
                      throw new Error("Balance command has no execute method");
                    }

                    // Create a defer message
                    const deferMsg = await message.reply({
                      content: `⏳ Processing economy_balance command...`,
                      fetchReply: true,
                    });

                    // Create a proxy for the command
                    const proxy = {
                      _isAiProxy: true,
                      options: {
                        getMember: (name) => {
                          // Default to message.member for empty user param
                          if (
                            name === "user" &&
                            (!args.user || args.user === "")
                          ) {
                            console.log(
                              `[DEBUG] Returning message.member for empty user param`
                            );
                            return message.member;
                          }

                          // Handle user parameter
                          const value = args[name];
                          if (!value) return message.member;

                          // ID lookup
                          if (/^\d{17,19}$/.test(value)) {
                            return (
                              message.guild?.members.cache.get(value) ||
                              message.member
                            );
                          }

                          // Mention lookup
                          if (value.startsWith("<@") && value.endsWith(">")) {
                            const userId = value.replace(/[<@!>]/g, "");
                            return (
                              message.guild?.members.cache.get(userId) ||
                              message.member
                            );
                          }

                          // Name lookup
                          const memberByName =
                            message.guild?.members.cache.find(
                              (member) =>
                                member.user.username.toLowerCase() ===
                                value.toLowerCase().replace("@", "")
                            );

                          return memberByName || message.member;
                        },
                        getString: (name) => args[name] || null,
                        getInteger: (name) => {
                          const val = args[name];
                          return val !== undefined ? parseInt(val, 10) : null;
                        },
                        getNumber: (name) => {
                          const val = args[name];
                          return val !== undefined ? parseFloat(val) : null;
                        },
                        getBoolean: (name) => {
                          const val = args[name];
                          if (val === undefined) return null;
                          if (typeof val === "boolean") return val;
                          if (val === "true" || val === "1") return true;
                          if (val === "false" || val === "0") return false;
                          return null;
                        },
                        getChannel: (name) => {
                          const val = args[name];
                          if (!val) return null;
                          if (/^\d{17,19}$/.test(val)) {
                            return (
                              message.guild?.channels.cache.get(val) || null
                            );
                          }
                          if (val.startsWith("<#") && val.endsWith(">")) {
                            const channelId = val.replace(/[<#>]/g, "");
                            return (
                              message.guild?.channels.cache.get(channelId) ||
                              null
                            );
                          }
                          return (
                            message.guild?.channels.cache.find(
                              (channel) =>
                                channel.name.toLowerCase() === val.toLowerCase()
                            ) || null
                          );
                        },
                        getRole: (name) => {
                          const val = args[name];
                          if (!val) return null;
                          if (/^\d{17,19}$/.test(val)) {
                            return message.guild?.roles.cache.get(val) || null;
                          }
                          if (val.startsWith("<@&") && val.endsWith(">")) {
                            const roleId = val.replace(/[<@&>]/g, "");
                            return (
                              message.guild?.roles.cache.get(roleId) || null
                            );
                          }
                          return (
                            message.guild?.roles.cache.find(
                              (role) =>
                                role.name.toLowerCase() === val.toLowerCase()
                            ) || null
                          );
                        },
                        getSubcommand: () => "balance",
                      },
                      user: message.author,
                      guild: message.guild,
                      channel: message.channel,
                      member: message.member,
                      client: message.client,
                      replied: false,
                      deferred: true,
                      locale: effectiveLocale,
                      async reply(options) {
                        this.replied = true;
                        return deferMsg.edit(options);
                      },
                      async editReply(options) {
                        this.replied = true;
                        return deferMsg.edit(options);
                      },
                      async followUp(options) {
                        return message.channel.send(options);
                      },
                      async deferReply() {
                        return deferMsg;
                      },
                    };

                    try {
                      // Execute command directly
                      console.log(
                        `[DEBUG] Executing balance command with proxy`
                      );
                      // MODIFICATION: Assume balanceCommand.execute now returns the balance string
                      // e.g., "Your current balance is 1000 credits."
                      const executionOutcome = await balanceCommand.execute(
                        proxy,
                        i18n
                      );
                      let toolResultContent;

                      if (
                        typeof executionOutcome === "string" &&
                        executionOutcome.length > 0
                      ) {
                        toolResultContent = executionOutcome;
                        console.log(
                          `[DEBUG economy_balance_handler] Received string outcome: "${executionOutcome}"`
                        );
                      } else if (
                        typeof executionOutcome === "object" &&
                        executionOutcome !== null &&
                        typeof executionOutcome.textForAI === "string" &&
                        executionOutcome.textForAI.length > 0
                      ) {
                        toolResultContent = executionOutcome.textForAI;
                        console.log(
                          `[DEBUG economy_balance_handler] Received object outcome with textForAI: "${executionOutcome.textForAI}"`
                        );
                        // If executionOutcome.replyText exists, balanceCommand.execute should have used it with proxy.reply/editReply
                      } else {
                        // Fallback if the command didn't return a string or expected object
                        toolResultContent = `Successfully executed economy_balance command.`;
                        console.log(
                          `[DEBUG economy_balance_handler] executionOutcome was not a string or expected object, using default success message. Outcome:`,
                          executionOutcome
                        );
                      }

                      console.log(
                        `[DEBUG] Balance command execution outcome raw:`,
                        executionOutcome
                      );
                      console.log(
                        `[DEBUG] Balance command proxy replied state after execution:`,
                        proxy.replied
                      );

                      // Add result to pendingToolResults
                      pendingToolResults.push({
                        tool_call_id: toolCall.id,
                        role: "tool",
                        name: toolCall.function.name,
                        // MODIFICATION: Use the captured/returned result
                        content: toolResultContent,
                      });

                      console.log(
                        `[DEBUG] Successfully executed economy_balance command directly. Content for AI: "${toolResultContent}"`
                      );
                    } catch (cmdError) {
                      console.error(
                        `[DEBUG] Error in balance command execution:`,
                        cmdError
                      );
                      pendingToolResults.push({
                        tool_call_id: toolCall.id,
                        role: "tool",
                        name: toolCall.function.name,
                        content: `Error executing economy_balance: ${cmdError.message}`,
                      });
                    }
                  })
                  .catch((importError) => {
                    console.error(
                      `[DEBUG] Failed to import balance module:`,
                      importError
                    );
                    pendingToolResults.push({
                      tool_call_id: toolCall.id,
                      role: "tool",
                      name: toolCall.function.name,
                      content: `Error: Failed to import balance command: ${importError.message}`,
                    });
                  });

                // Skip normal processing
                continue;
              } catch (error) {
                console.error(
                  `[DEBUG] Error in special economy_balance handling:`,
                  error
                );
                pendingToolResults.push({
                  tool_call_id: toolCall.id,
                  role: "tool",
                  name: toolCall.function.name,
                  content: `Error: ${error.message}`,
                });
                continue;
              }
            }

            try {
              // Parse arguments
              let args = {};
              try {
                if (
                  toolCall.function.arguments &&
                  toolCall.function.arguments.trim() !== ""
                ) {
                  args = JSON.parse(toolCall.function.arguments);
                }
              } catch (e) {
                console.error(`[DEBUG] Error parsing arguments: ${e.message}`);
              }

              console.log(
                `[DEBUG] Executing ${toolCall.function.name} with args:`,
                args
              );

              // Update message to show tool execution
              await procMsg.edit({
                content: `${removeThinkTags(responseAccumulator)}\n\n${
                  i18n.__(
                    "events.ai.messages.streamToolExecution",
                    { tool: toolCall.function.name },
                    effectiveLocale
                  ) || `Executing ${toolCall.function.name}...`
                }`,
                components: [stopRow],
              });

              // Parse the command parts
              const commandParts = toolCall.function.name.split("_");
              const commandName = commandParts[0];
              const subCommandName =
                commandParts.length > 1
                  ? commandParts.slice(1).join("_")
                  : null;

              // Get the command directly
              const command = message.client.commands.get(commandName);
              console.log(
                `[DEBUG] Immediate execution - Command lookup for '${commandName}': ${!!command}`
              );
              if (command) {
                console.log(`[DEBUG] Found base command: ${commandName}`);
                console.log(`[DEBUG] Command structure:`, {
                  hasExecute: typeof command.execute === "function",
                  hasSubcommands: !!command.subcommands,
                  subcommandNames: command.subcommands
                    ? Object.keys(command.subcommands)
                    : [],
                });

                let targetCommand;
                if (
                  subCommandName &&
                  command.subcommands &&
                  command.subcommands[subCommandName]
                ) {
                  console.log(`[DEBUG] Found subcommand: ${subCommandName}`);
                  targetCommand = command.subcommands[subCommandName];
                } else if (!subCommandName) {
                  console.log(`[DEBUG] Using base command directly`);
                  targetCommand = command;
                } else if (
                  subCommandName &&
                  command[`execute_${subCommandName}`]
                ) {
                  console.log(
                    `[DEBUG] Found alternate execution method: execute_${subCommandName}`
                  );
                  targetCommand = {
                    execute: command[`execute_${subCommandName}`].bind(command),
                  };
                }

                if (targetCommand) {
                  console.log(
                    `[DEBUG] Target command found, has execute: ${
                      typeof targetCommand.execute === "function"
                    }`
                  );
                } else {
                  console.log(
                    `[DEBUG] No target command found for ${toolCall.function.name}`
                  );
                }

                if (
                  targetCommand &&
                  typeof targetCommand.execute === "function"
                ) {
                  console.log(`[DEBUG] Found executable target command`);

                  // Create a defer message
                  const deferMsg = await message.reply({
                    content: `⏳ Processing ${toolCall.function.name} command...`,
                    fetchReply: true,
                  });

                  // Create a proxy for the command
                  const proxy = {
                    _isAiProxy: true,
                    options: {
                      getMember: (name) => {
                        if (
                          name === "user" &&
                          (!args.user || args.user === "")
                        ) {
                          console.log(
                            `[DEBUG] Returning message.member for empty user param`
                          );
                          return message.member;
                        }
                        // Handle user parameter
                        const value = args[name];
                        if (!value) return null;
                        // Rest of getMember logic
                        if (/^\d{17,19}$/.test(value)) {
                          return (
                            message.guild?.members.cache.get(value) || null
                          );
                        }
                        if (value.startsWith("<@") && value.endsWith(">")) {
                          const userId = value.replace(/[<@!>]/g, "");
                          return (
                            message.guild?.members.cache.get(userId) || null
                          );
                        }
                        const memberByName = message.guild?.members.cache.find(
                          (member) =>
                            member.user.username.toLowerCase() ===
                            value.toLowerCase().replace("@", "")
                        );
                        return memberByName || null;
                      },
                      getString: (name) => args[name] || null,
                      getInteger: (name) => {
                        const val = args[name];
                        return val !== undefined ? parseInt(val, 10) : null;
                      },
                      getNumber: (name) => {
                        const val = args[name];
                        return val !== undefined ? parseFloat(val) : null;
                      },
                      getBoolean: (name) => {
                        const val = args[name];
                        if (val === undefined) return null;
                        if (typeof val === "boolean") return val;
                        if (val === "true" || val === "1") return true;
                        if (val === "false" || val === "0") return false;
                        return null;
                      },
                      getChannel: (name) => {
                        const val = args[name];
                        if (!val) return null;
                        if (/^\d{17,19}$/.test(val)) {
                          return message.guild?.channels.cache.get(val) || null;
                        }
                        if (val.startsWith("<#") && val.endsWith(">")) {
                          const channelId = val.replace(/[<#>]/g, "");
                          return (
                            message.guild?.channels.cache.get(channelId) || null
                          );
                        }
                        return (
                          message.guild?.channels.cache.find(
                            (channel) =>
                              channel.name.toLowerCase() === val.toLowerCase()
                          ) || null
                        );
                      },
                      getRole: (name) => {
                        const val = args[name];
                        if (!val) return null;
                        if (/^\d{17,19}$/.test(val)) {
                          return message.guild?.roles.cache.get(val) || null;
                        }
                        if (val.startsWith("<@&") && val.endsWith(">")) {
                          const roleId = val.replace(/[<@&>]/g, "");
                          return message.guild?.roles.cache.get(roleId) || null;
                        }
                        return (
                          message.guild?.roles.cache.find(
                            (role) =>
                              role.name.toLowerCase() === val.toLowerCase()
                          ) || null
                        );
                      },
                    },
                    guild: message.guild,
                    channel: message.channel,
                    member: message.member,
                    user: message.author,
                    client: message.client,
                    replied: false,
                    deferred: true,
                    locale: effectiveLocale,
                    async reply(options) {
                      this.replied = true;
                      return deferMsg.edit(options);
                    },
                    async editReply(options) {
                      this.replied = true;
                      return deferMsg.edit(options);
                    },
                    async followUp(options) {
                      return message.channel.send(options);
                    },
                    async deferReply() {
                      return deferMsg;
                    },
                  };

                  try {
                    // Execute command directly
                    console.log(
                      `[DEBUG] Executing ${toolCall.function.name} command with proxy`
                    );
                    const cmdResult = await targetCommand.execute(proxy, i18n);
                    console.log(`[DEBUG] Command execution result:`, cmdResult);
                    console.log(`[DEBUG] Command replied:`, proxy.replied);

                    // Add result to pendingToolResults
                    pendingToolResults.push({
                      tool_call_id: toolCall.id,
                      role: "tool",
                      name: toolCall.function.name,
                      content: `Successfully executed ${toolCall.function.name}`,
                    });

                    console.log(
                      `[DEBUG] Successfully executed ${toolCall.function.name} command directly`
                    );
                  } catch (cmdError) {
                    console.error(
                      `[DEBUG] Error in direct command execution:`,
                      cmdError
                    );
                    pendingToolResults.push({
                      tool_call_id: toolCall.id,
                      role: "tool",
                      name: toolCall.function.name,
                      content: `Error executing ${toolCall.function.name}: ${cmdError.message}`,
                    });
                  }
                } else {
                  console.log(
                    `[DEBUG] Target command not found or not executable, falling back to normal execution`
                  );
                  try {
                    const result = await executeToolCall(
                      toolCall,
                      message,
                      effectiveLocale
                    );
                    pendingToolResults.push({
                      tool_call_id: toolCall.id,
                      role: "tool",
                      name: toolCall.function.name,
                      content:
                        result.response ||
                        (result.success ? "OK" : "Error executing tool"),
                    });
                  } catch (error) {
                    console.error(
                      `[DEBUG] Error in immediate execution:`,
                      error
                    );
                    pendingToolResults.push({
                      tool_call_id: toolCall.id,
                      role: "tool",
                      name: toolCall.function.name,
                      content: `Error: ${error.message}`,
                    });
                  }
                }
              }
            } catch (error) {
              console.error(`[DEBUG] Error in immediate execution:`, error);
              pendingToolResults.push({
                tool_call_id: toolCall.id,
                role: "tool",
                name: toolCall.function.name,
                content: `Error: ${error.message}`,
              });
            }
          }
        }

        // If we have tool results, we need to make another API call to continue the conversation
        if (pendingToolResults.length > 0) {
          console.log(
            `[DEBUG] Making a follow-up API call with ${pendingToolResults.length} tool results`
          );

          // Add the assistant message with tool calls
          apiMessages.push({
            role: "assistant",
            content: responseAccumulator,
            tool_calls: completedToolCalls,
          });

          // Add the tool results
          apiMessages.push(...pendingToolResults);

          // Make a second API call with the tool results
          try {
            await procMsg.edit({
              content: `${removeThinkTags(responseAccumulator)}\n\n${
                i18n.__(
                  "events.ai.messages.streamContinuation",
                  effectiveLocale
                ) || "Continuing with tool results..."
              }`,
              components: [stopRow],
            });

            // Log the messages we're about to send to verify they're correct
            console.log(
              `[DEBUG] Preparing to send ${apiMessages.length} messages to follow-up API call`
            );
            apiMessages.forEach((msg, index) => {
              if (msg.role === "tool") {
                console.log(
                  `[DEBUG] API message ${index} (tool): ${msg.name} - ${
                    msg.content ? msg.content.substring(0, 50) : "null"
                  }`
                );
              } else if (msg.tool_calls) {
                console.log(
                  `[DEBUG] API message ${index} (${msg.role} with tool_calls): ${msg.tool_calls.length} tool calls`
                );
              } else {
                console.log(
                  `[DEBUG] API message ${index} (${msg.role}): ${
                    typeof msg.content === "string"
                      ? msg.content.substring(0, 50)
                      : "complex content"
                  }`
                );
              }
            });

            // Make non-streaming follow-up call to finish the conversation
            console.log(
              `[DEBUG] Starting non-streaming follow-up API call with tool results`
            );
            const followUpPayload = {
              model: modelId,
              messages: apiMessages,
              temperature: prefs.aiParams.temperature,
              top_p: prefs.aiParams.top_p,
              frequency_penalty: prefs.aiParams.frequency_penalty,
              presence_penalty: prefs.aiParams.presence_penalty,
              stream: false, // No streaming for the follow-up
            };

            console.log(
              `[DEBUG] Follow-up API call payload:`,
              JSON.stringify({
                ...followUpPayload,
                messages: `[${apiMessages.length} messages]`, // Don't log full messages
              })
            );

            const secondResponseData = await apiClient.chat.completions.create(
              followUpPayload
            );

            console.log(`[DEBUG] Follow-up API call succeeded`);
            const finalAiMsg = secondResponseData.choices[0].message;

            console.log(
              `[DEBUG] Follow-up response content: ${finalAiMsg.content?.substring(
                0,
                100
              )}${finalAiMsg.content?.length > 100 ? "..." : ""}`
            );
            responseAccumulator =
              (responseAccumulator ? responseAccumulator + "\n\n" : "") +
              (finalAiMsg.content || "");
          } catch (followUpError) {
            console.error(
              `[DEBUG] Error in tool results follow-up:`,
              followUpError
            );
            responseAccumulator += `\n\n${
              i18n.__("events.ai.messages.streamToolError", effectiveLocale) ||
              "Error processing tool results."
            }`;
          }
          internalToolFollowUpDone = true; // Set flag if follow-up happens
        } else if (
          finalFinishReason === "tool_calls" &&
          completedToolCalls.length > 0 &&
          pendingToolResults.length === 0
        ) {
          // This case handles when we have tool calls but no results were added
          console.log(
            `[DEBUG] Stream ended with tool_calls but no pendingToolResults were added. Making follow-up API call anyway.`
          );

          // Add the assistant message with tool calls
          apiMessages.push({
            role: "assistant",
            content: responseAccumulator,
            tool_calls: completedToolCalls,
          });

          // Add empty results for any tool calls that didn't get results
          const emptyResults = completedToolCalls.map((tool) => {
            console.log(
              `[DEBUG] Adding empty result for tool: ${tool.function.name}`
            );
            return {
              tool_call_id: tool.id,
              role: "tool",
              name: tool.function.name,
              content: "OK", // Simple default response
            };
          });

          apiMessages.push(...emptyResults);

          // Log the messages we're about to send to verify they're correct
          apiMessages.forEach((msg, index) => {
            if (msg.role === "tool") {
              console.log(
                `[DEBUG] API message ${index} (tool): ${
                  msg.name
                } - ${msg.content.substring(0, 50)}`
              );
            } else {
              console.log(
                `[DEBUG] API message ${index} (${msg.role}): ${
                  typeof msg.content === "string"
                    ? msg.content.substring(0, 50)
                    : "complex content"
                }`
              );
            }
          });

          try {
            await procMsg.edit({
              content: `${removeThinkTags(responseAccumulator)}\n\n${
                i18n.__(
                  "events.ai.messages.streamContinuation",
                  effectiveLocale
                ) || "Continuing after tool calls..."
              }`,
              components: [stopRow],
            });

            // Make a second API call with the tool results
            console.log(
              `[DEBUG] Starting non-streaming follow-up API call with tool results`
            );
            const followUpPayload = {
              model: modelId,
              messages: apiMessages,
              temperature: prefs.aiParams.temperature,
              top_p: prefs.aiParams.top_p,
              frequency_penalty: prefs.aiParams.frequency_penalty,
              presence_penalty: prefs.aiParams.presence_penalty,
              stream: false, // No streaming for the follow-up
            };

            console.log(
              `[DEBUG] Follow-up API call payload:`,
              JSON.stringify({
                ...followUpPayload,
                messages: `[${apiMessages.length} messages]`, // Don't log full messages
              })
            );

            const secondResponseData = await apiClient.chat.completions.create(
              followUpPayload
            );

            console.log(`[DEBUG] Follow-up API call succeeded`);
            const finalAiMsg = secondResponseData.choices[0].message;

            console.log(
              `[DEBUG] Follow-up response content: ${finalAiMsg.content?.substring(
                0,
                100
              )}${finalAiMsg.content?.length > 100 ? "..." : ""}`
            );
            responseAccumulator =
              (responseAccumulator ? responseAccumulator + "\n\n" : "") +
              (finalAiMsg.content || "");
          } catch (followUpError) {
            console.error(
              `[DEBUG] Error in empty tool results follow-up:`,
              followUpError
            );
            responseAccumulator += `\n\n${
              i18n.__("events.ai.messages.streamToolError", effectiveLocale) ||
              "Error processing tool results."
            }`;
          }
          internalToolFollowUpDone = true; // Set flag if follow-up happens
        }

        // Create response object with the accumulated text
        const response = {
          choices: [
            {
              message: {
                content: responseAccumulator,
                tool_calls:
                  completedToolCalls.length > 0
                    ? completedToolCalls
                    : undefined,
              },
            },
          ],
          _toolsDisabled: !effectiveShouldUseTools,
          _internalToolFollowUpDone: internalToolFollowUpDone, // Include flag in response
        };

        return response;
      } catch (error) {
        console.error("Streaming error:", error);
        // Remove stop button if there's an error
        await procMsg
          .edit({
            content:
              i18n.__(
                "events.ai.messages.streamError",
                { error: error.message },
                effectiveLocale
              ) || `Error: ${error.message}`,
            components: [],
          })
          .catch(() => {});
        throw error;
      }
    }

    let responseData;
    try {
      // Try first with tools if they should be used
      if (shouldUseTools && baseTools.length) {
        console.log(`[DEBUG] Attempting API request with tools first`);
        try {
          responseData = await makeApiRequest(true);
          console.log(`[DEBUG] API request with tools succeeded`);
          // If successful, update cache to indicate tools are supported
          state.modelStatus.toolSupport.set(modelToolSupportKey, true);
        } catch (toolError) {
          console.error(`[DEBUG] API request with tools failed:`, toolError);
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
              `[DEBUG] Model ${prefs.selectedModel} doesn't support tools, retrying without tools`
            );
            // Use the helper function instead of directly setting cache
            markModelAsNotSupportingTools(modelToolSupportKey);
            // Retry without tools
            responseData = await makeApiRequest(false);
            console.log(
              `[DEBUG] API request without tools after tool-support error succeeded`
            );
          } else {
            // Not a tool support error, rethrow
            console.error(
              `[DEBUG] API request error is not related to tool support, rethrowing`
            );
            throw toolError;
          }
        }
      } else {
        // Tools not requested or not available, make standard request
        console.log(`[DEBUG] Making standard API request without tools`);
        responseData = await makeApiRequest(false);
        console.log(`[DEBUG] Standard API request succeeded`);
      }
    } catch (error) {
      console.error(`[DEBUG] API request error:`, error);
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
    const internalToolFollowUpDone = responseData._internalToolFollowUpDone;

    // Debug the AI message structure
    console.log(
      `[DEBUG] AI Message structure keys: ${Object.keys(aiMsg).join(", ")}`
    );
    // Special handling for the response object to check for reasoning or thinking fields
    if (aiMsg.reasoning) {
      console.log(
        `[DEBUG] Found reasoning field in response with length: ${aiMsg.reasoning.length}`
      );
    } else if (aiMsg.thinking) {
      console.log(
        `[DEBUG] Found thinking field in response with length: ${aiMsg.thinking.length}`
      );
    } else {
      console.log(`[DEBUG] No reasoning or thinking field found in response`);

      // Dump the entire aiMsg structure for debugging (be careful with large responses)
      try {
        const aiMsgStr = JSON.stringify(aiMsg);
        console.log(
          `[DEBUG] Full aiMsg (length ${aiMsgStr.length}): ${aiMsgStr.substring(
            0,
            500
          )}${aiMsgStr.length > 500 ? "..." : ""}`
        );
      } catch (e) {
        console.log(`[DEBUG] Could not stringify aiMsg: ${e.message}`);
      }
    }

    // Remove any <think> tags from the response
    finalText = removeThinkTags(finalText);

    if (!finalText && !toolCalls.length)
      finalText = i18n.__("events.ai.messages.noTextResponse", effectiveLocale);

    // Process tool calls if there are any and tools are enabled
    let anyToolUsedV2 = false; // Declare flag before the loop
    if (toolCalls.length && prefs.toolsEnabled && !internalToolFollowUpDone) {
      console.log(`AI requested ${toolCalls.length} tool calls (second pass).`);

      // Process tool calls
      // Create a placeholder for accumulating tool responses for the AI
      let toolResponsesForApi = [];

      for (const toolCall of toolCalls) {
        console.log(`Executing tool: ${toolCall.function.name}`);

        // Execute the tool call
        const result = await executeToolCall(
          toolCall,
          message,
          effectiveLocale
        );

        console.log(
          `Tool ${toolCall.function.name} execution ${
            result.success ? "succeeded" : "failed"
          }. ` +
            `Replied: ${result.commandReplied}, Visual: ${
              result.visualResponse
            }, V2Edit: ${result.wasV2Edit}, Withheld: ${!!result.withheldData}`
        );

        // Track if any tool performed a V2 edit (important for final component handling)
        if (result.wasV2Edit) {
          anyToolUsedV2 = true;
        }

        // --- Handle Withheld Data (New Logic) ---
        if (result.wasV2Edit && result.withheldData) {
          console.log(
            `Sending withheld data from ${toolCall.function.name} via channel.send:`,
            result.withheldData
          );
          try {
            const followUpOptions = {
              ...result.withheldData, // Contains content, embeds, files
              // Decide on ephemeral based on command's intent if possible, default false
              // ephemeral: result.isEphemeral, // Assuming executeToolCall returns this if needed
              allowedMentions: { parse: [] }, // Avoid accidental pings
            };
            await message.channel.send(followUpOptions);
            console.log(`Successfully sent withheld data followUp.`);
            // If withheld data included content, we *might* not want to also add the tool result below.
            // However, the AI needs *some* response. Let's prioritize the `result.response` for the AI.
          } catch (followUpError) {
            console.error(
              `Error sending withheld data followUp:`,
              followUpError
            );
            // If sending the withheld data fails, append an error message for the AI
            toolResponsesForApi.push({
              tool_call_id: toolCall.id,
              role: "tool",
              name: toolCall.function.name,
              content: `[Error sending withheld visual elements: ${
                followUpError.message
              }]${result.response ? ` Tool response: ${result.response}` : ""}`, // Append original response if any
            });
            continue; // Skip normal tool response appending if follow-up failed
          }
        }
        // --- End Handle Withheld Data ---

        // --- Append Tool Result for AI (Revised Logic) ---
        // The AI needs a response for each tool call to continue generation.
        // The `result.response` from executeToolCall is specifically formatted for this.
        toolResponsesForApi.push({
          tool_call_id: toolCall.id, // Use the ID from the original tool call
          role: "tool",
          name: toolCall.function.name,
          // Use the response field from the result, which is null if visual or withheld, or contains text
          content:
            result.response || (result.success ? "OK" : "Error executing tool"), // Provide a minimal status if response is null
        });

        // --- Handle display of AI's initial text (Revised Logic) ---
        // If the tool itself replied visually OR if it was a V2 edit (implying visual change),
        // any pending AI text should be sent *before* the next tool call or final response.
        if (
          (result.commandReplied && result.visualResponse) ||
          result.wasV2Edit
        ) {
          if (finalText) {
            console.log(
              "Sending pending AI text before next tool call or final response due to visual/V2 tool action."
            );
            await message.channel.send(finalText).catch(console.error);
            finalText = ""; // Clear text, it has been sent
          }
        }
      }

      // --- After processing all tool calls, send the accumulated responses back to the AI ---
      if (toolResponsesForApi.length > 0) {
        console.log("Sending tool results back to AI:", toolResponsesForApi);
        apiMessages.push(aiMsg); // Add the AI's message that contained the tool calls
        apiMessages.push(...toolResponsesForApi); // Add the results

        // Make a second API call with the tool results
        console.log("Making second API call with tool results...");
        const secondResponseData = await makeApiRequest(false); // Never use tools in the second call

        if (
          !secondResponseData ||
          !secondResponseData.choices ||
          secondResponseData.choices.length === 0
        ) {
          console.error(
            "Invalid API response format after tool results:",
            secondResponseData
          );
          throw new Error(
            "Invalid response from AI provider after processing tools."
          );
        }

        const finalAiMsg = secondResponseData.choices[0].message;
        const aiFollowUpText = finalAiMsg.content?.trim() || "";

        // Combine any initial text with the follow-up text
        finalText =
          (finalText ? finalText + "\n\n" : "") +
          removeThinkTags(aiFollowUpText);
        console.log("Final text after tool processing:", finalText);
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

        // Tools are disabled - provide instructions instead
        const success = false;
        const commandReplied = false;
        const visualResponse = false;
        const response = `Tools have been disabled. Please use the /${fakeToolCall.name} command manually.`;

        console.log(
          `Detected fake tool call ${fakeToolCall.name}, instructing user to use commands manually`
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

    // Apply settings menu after streaming is complete
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
    // The message state might already be V2 from the tool.
    if (anyToolUsedV2) {
      console.log(
        "Skipping final sendResponse with V1 components because a tool performed a V2 edit."
      );
      // If there's remaining AI text after tool calls, send it as a plain message.
      if (finalText) {
        console.log(
          "Sending final AI text as plain message after V2 tool use."
        );
        await message.channel.send(finalText).catch(console.error);
      }
      // Ensure the processing message is handled (e.g., deleted or edited minimally)
      if (procMsg && procMsg.editable) {
        try {
          // Optionally edit to a simple confirmation or delete
          // await procMsg.edit({ content: "✅ Processed.", components: [] });
          await procMsg.delete();
        } catch {
          /* Ignore */
        }
      }
    } else {
      // Original behavior: Edit the procMsg with V1 components and final AI text
      if (finalText || toolCalls.length === 0) {
        // Check if there's reasoning content in the response
        let formattedText = finalText;

        // Check if the AI response includes reasoning
        // Show reasoning content in the response even if reasoningLevel is 'off'
        // so the user can see all reasoning provided by the model
        if (aiMsg.reasoning) {
          console.log(
            `[DEBUG] Response includes reasoning of length ${aiMsg.reasoning.length}`
          );
          console.log(
            `[DEBUG] Sample reasoning: ${aiMsg.reasoning.substring(0, 100)}...`
          );
          formattedText = processResponseWithReasoning(
            finalText,
            aiMsg.reasoning
          );
          console.log(
            `[DEBUG] Final formatted text length: ${formattedText.length}`
          );
        } else {
          console.log(`[DEBUG] No reasoning found in AI response`);

          // Check if there's any other field that might contain reasoning
          if (aiMsg.thinking) {
            console.log(
              `[DEBUG] Found 'thinking' field instead of 'reasoning'`
            );
            formattedText = processResponseWithReasoning(
              finalText,
              aiMsg.thinking
            );
          } else if (typeof aiMsg === "object") {
            console.log(
              `[DEBUG] Available fields in aiMsg: ${Object.keys(aiMsg).join(
                ", "
              )}`
            );
          }
        }

        // After streaming is complete, update the message with settings components
        const finalMsg = await sendResponse(
          message,
          procMsg,
          formattedText,
          comps,
          effectiveLocale,
          false
        );
      } else if (procMsg) {
        // If only tools ran (no V2) and AI had no final text, delete processing message
        await procMsg.delete().catch(() => {});
      }
    }
  } catch (error) {
    console.error(`[DEBUG] Error in processAiRequest:`, error);
    const errMsg = i18n.__(
      "events.ai.messages.errorOccurred",
      { error: error.message },
      effectiveLocale
    );
    await sendResponse(message, procMsg, errMsg, [], effectiveLocale, false);
  }
}
