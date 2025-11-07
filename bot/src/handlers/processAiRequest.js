import i18n from "../utils/i18n.js";
import hubClient from "../api/hubClient.js";
import { v4 as uuidv4 } from "uuid";

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

  // Model management
  getModelCapabilities,
  getAvailableModels,

  // Message handling
  splitMessage,
  sendResponse,
  buildInteractionComponents,
  buildErrorComponents,
} from "../ai.js";

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

  // Get model capabilities - hub handles the rest
  let capabilities;
  try {
    capabilities = await getModelCapabilities(client, prefs.selectedModel);
    console.log(`Model capabilities for ${prefs.selectedModel}:`, capabilities);
  } catch (error) {
    console.error(
      `Failed to get capabilities for ${prefs.selectedModel}:`,
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
    const visionModels = await getAvailableModels(client, "vision", userId);
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
        content: await i18n.__(
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
      await i18n.__("events.ai.messages.processing", {
        model: prefs.selectedModel,
      })
    );
  } else {
    await procMsg
      .edit({
        content: await i18n.__("events.ai.messages.processing", {
          model: prefs.selectedModel,
        }),
        components: [],
      })
      .catch(() => {});
  }

  try {
    // Build conversation context - hub handles context management
    let apiMessages = [...prefs.messageHistory];

    // Add system prompt if enabled
    if (prefs.systemPromptEnabled) {
      // Get user information for the system prompt
      const {
        userInfo,
        mentionedUsersInfo,
        serverInfo,
        mentionedChannelsInfo,
        currentChannelInfo,
      } = await getUserInfoForPrompt(message);

      // Create an enhanced system prompt with user information
      let enhancedSystemPrompt =
        "You are a helpful AI assistant integrated with Discord. Be friendly, informative, and adapt your responses to the Discord context.";

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
      // Remove any existing system message if disabled
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

    // Tools are handled by the hub, no need for complex tool logic on bot side
    const baseTools = [];

    // Use AI Hub for processing by default
    console.log(
      `[processAiRequest] Using AI Hub for model: ${prefs.selectedModel}`
    );

    try {
      // Prepare hub request payload - simplified since hub handles most logic
      let hubPayload = {
        requestId: uuidv4(),
        model: prefs.selectedModel,
        messages: apiMessages,
        parameters: {
          temperature: prefs.aiParams.temperature,
          top_p: prefs.aiParams.top_p,
          frequency_penalty: prefs.aiParams.frequency_penalty,
          presence_penalty: prefs.aiParams.presence_penalty,
          stream: false,
          tools: baseTools,
        },
        userId: userId,
        guildId: message.guild?.id,
      };

      // Stream from hub by default
      let finalText = "";
      let toolCalls = [];
      let reasoningText = ""; // Keep for potential future use but not displayed
      // Throttle and dedupe edit loop to avoid Discord rate limits
      let lastEditAt = Date.now();
      let lastPreviewContent = "";
      let lastSentFinalLength = 0;
      let lastSentReasoningLength = 0;
      let minEditIntervalMs = 3000; // Minimum 3 seconds between edits (user request)
      let nextAllowedEditAt = 0; // dynamic backoff gate
      let editErrorCount = 0; // increases on edit failures
      let isEditing = false; // prevent concurrent edits
      const MIN_INTERVAL_MS = 3000; // minimum 3 seconds between edits (user request)
      const MAX_INTERVAL_MS = 5000; // maximum cadence for calm updates
      let currentIntervalMs = 3000; // start at 3 seconds (user request)

      // Helper function to check if enough time has passed for an edit
      const canEdit = (now) => {
        const timeSinceLastEdit = now - lastEditAt;
        return (
          timeSinceLastEdit >= MIN_INTERVAL_MS &&
          !isEditing &&
          now >= nextAllowedEditAt
        );
      };
      let schedulerId = null;
      let didFirstFinalEdit = false;
      let streamDone = false;
      const MIN_FINAL_DELTA = 250; // default meaningful delta
      const MIN_FINAL_DELTA_BOUNDARY = 120; // smaller delta if ending on sentence/newline boundary
      let lastMeasureAt = Date.now();
      let lastMeasureLen = 0;
      const enableReasoningPreview = true; // enable reasoning preview during streaming

      // Enable streaming in payload
      hubPayload = {
        ...hubPayload,
        parameters: { ...(hubPayload.parameters || {}), stream: true },
      };

      console.log(
        `[processAiRequest] Using hub streaming for model: ${prefs.selectedModel}`
      );

      // Cache localized stream-start label once to avoid repeated i18n calls in loop
      const streamStartLabel =
        (await i18n.__("events.ai.messages.streamStart", effectiveLocale)) ||
        "Thinking...";

      // Immediately show Thinking… while waiting for first chunks (render smaller text)
      if (procMsg) {
        try {
          // Use -# prefix to render smaller text per prior UX
          const initialPreview = `-# ${streamStartLabel}`;
          await procMsg.edit({ content: initialPreview });
          lastPreviewContent = initialPreview;
          lastEditAt = Date.now();
        } catch (_) {}
      }

      // Scheduled preview updater to coalesce edits
      const tryScheduledEdit = async () => {
        if (streamDone) return;
        const now = Date.now();
        if (isEditing) return;
        if (now < nextAllowedEditAt) return;

        // Allow scheduler to continue updating even after first edit
        // This ensures we get all streaming chunks, not just the first one

        const hasFinal = !!finalText && finalText.length > 0;
        const hasReasoning = !!reasoningText && reasoningText.length > 0;

        // Show reasoning content during streaming (before final content is ready)
        if (hasReasoning && !hasFinal && procMsg && enableReasoningPreview) {
          const now = Date.now();

          if (canEdit(now)) {
            // Format reasoning text with Discord's small text formatting (-#)
            const formattedReasoning = reasoningText
              .split("\n")
              .map((line) => (line.trim() ? `-# ${line}` : line))
              .join("\n");

            const reasoningPreview =
              formattedReasoning.length > 1900
                ? `${formattedReasoning.slice(0, 1900)}...`
                : formattedReasoning;

            const contentChanged =
              reasoningPreview && reasoningPreview !== lastPreviewContent;

            if (contentChanged) {
              try {
                isEditing = true;
                await procMsg.edit({ content: reasoningPreview });
                lastPreviewContent = reasoningPreview;
                lastEditAt = now;
                editErrorCount = 0;
                nextAllowedEditAt = 0;
              } catch (e) {
                editErrorCount += 1;
                const backoffMs = Math.min(
                  30000,
                  1000 * Math.pow(2, editErrorCount)
                );
                nextAllowedEditAt = Date.now() + backoffMs;
              } finally {
                isEditing = false;
              }
            }
          }
        } else if (hasFinal) {
          // Show final content when available
          const preview =
            finalText.length > 1900
              ? `${finalText.slice(0, 1900)}...`
              : finalText;
          const contentChanged = preview && preview !== lastPreviewContent;
          const finalDelta = Math.max(
            0,
            finalText.length - lastSentFinalLength
          );
          const endsBoundary =
            /[.!?]\s$/.test(finalText) || /\n$/.test(finalText);
          const meaningfulDelta =
            finalDelta >= MIN_FINAL_DELTA ||
            (endsBoundary && finalDelta >= MIN_FINAL_DELTA_BOUNDARY);
          if (!procMsg || !contentChanged || !meaningfulDelta) return;
          try {
            isEditing = true;
            await procMsg.edit({ content: preview });
            lastPreviewContent = preview;
            lastSentFinalLength = finalText.length;
            lastEditAt = now;
            editErrorCount = 0;
            nextAllowedEditAt = 0;
          } catch (e) {
            editErrorCount += 1;
            const backoffMs = Math.min(
              30000,
              1000 * Math.pow(2, editErrorCount)
            );
            nextAllowedEditAt = Date.now() + backoffMs;
          } finally {
            isEditing = false;
          }
        }
      };
      const scheduleNext = () => {
        if (streamDone) return;
        schedulerId = setTimeout(() => {
          tryScheduledEdit().catch(() => {});
          scheduleNext();
        }, currentIntervalMs);
      };
      scheduleNext();

      await hubClient.processAIHubStream(
        hubPayload,
        async (chunk) => {
          // Accumulate content - hubClient handles format conversion
          if (chunk?.content) finalText += chunk.content;
          if (chunk?.reasoning) reasoningText += chunk.reasoning;
          if (chunk?.tool_call) toolCalls.push(chunk.tool_call);

          const hasFinal = !!finalText && finalText.length > 0;
          const hasReasoning = !!reasoningText && reasoningText.length > 0;

          if (hasFinal && !didFirstFinalEdit && procMsg) {
            // Final content appeared - replace thinking with final response
            const now = Date.now();

            if (canEdit(now)) {
              const preview =
                finalText.length > 1900
                  ? `${finalText.slice(0, 1900)}...`
                  : finalText;
              try {
                isEditing = true;
                await procMsg.edit({ content: preview });
                lastPreviewContent = preview;
                lastSentFinalLength = finalText.length;
                lastEditAt = now;
                editErrorCount = 0;
                nextAllowedEditAt = 0;
                // Don't set didFirstFinalEdit here - let scheduler continue updating
                // didFirstFinalEdit = true;
              } catch (e) {
                editErrorCount += 1;
                const backoffMs = Math.min(
                  30000,
                  1000 * Math.pow(2, editErrorCount)
                );
                nextAllowedEditAt = Date.now() + backoffMs;
              } finally {
                isEditing = false;
              }
            }
            // Don't set didFirstFinalEdit to true here - let the scheduler handle subsequent updates
          }

          // Adapt scheduler cadence based on streaming rate
          if (hasFinal) {
            const now = Date.now();
            const dt = now - lastMeasureAt;
            if (dt >= 1000) {
              const dchar = finalText.length - lastMeasureLen;
              const cps = dchar / (dt / 1000); // chars per second
              if (cps >= 60) {
                currentIntervalMs = MIN_INTERVAL_MS; // fast stream → faster updates
              } else if (cps >= 30) {
                currentIntervalMs = 3000;
              } else if (cps >= 15) {
                currentIntervalMs = 4000;
              } else {
                currentIntervalMs = MAX_INTERVAL_MS; // slow stream → calmer updates
              }
              lastMeasureAt = now;
              lastMeasureLen = finalText.length;
            }
          }
        },
        async (err) => {
          // Streaming error
          console.error("[processAiRequest] Hub streaming error:", err);

          // Check if it's a WebSocket connection issue
          if (
            err.message &&
            (err.message.includes("WebSocket") ||
              err.message.includes("connection"))
          ) {
            console.error(
              "[processAiRequest] Connection error detected, will attempt to handle gracefully"
            );
            if (procMsg) {
              try {
                await procMsg.edit({
                  content: `😥 Connection error: ${err.message}. Please try again.`,
                });
              } catch (_) {}
            }
          } else {
            // Other types of errors
            if (procMsg) {
              try {
                await procMsg.edit({ content: `😥 Error: ${err.message}` });
              } catch (_) {}
            }
          }

          if (schedulerId) {
            try {
              clearTimeout(schedulerId);
            } catch (_) {}
          }
          streamDone = true;
          didFirstFinalEdit = true; // Ensure scheduler stops trying to edit
          throw err;
        },
        (completionData) => {
          // Process final completion data from hub
          console.log(
            `[processAiRequest] Stream completed with data:`,
            completionData
          );

          // Extract final content from unified hub response format
          if (
            completionData &&
            completionData.content &&
            completionData.content.text
          ) {
            finalText = completionData.content.text;
            console.log(
              `[processAiRequest] Final content set from completion: ${finalText.length} chars`
            );
          }

          // Extract tool calls if present
          if (
            completionData &&
            completionData.content &&
            completionData.content.toolCalls
          ) {
            toolCalls = completionData.content.toolCalls;
            console.log(
              `[processAiRequest] Final tool calls set from completion: ${toolCalls.length} tools`
            );
          }

          if (schedulerId) {
            try {
              clearTimeout(schedulerId);
            } catch (_) {}
          }
          streamDone = true;
          didFirstFinalEdit = true; // Ensure scheduler stops trying to edit

          // Force one final update to show the complete response
          if (procMsg && finalText) {
            const finalContent = removeThinkTags(finalText);
            const preview =
              finalContent.length > 1900
                ? `${finalContent.slice(0, 1900)}...`
                : finalContent;

            procMsg.edit({ content: preview }).catch((err) => {
              console.error(
                "[processAiRequest] Error in final completion update:",
                err
              );
            });
          }
        }
      );

      // If we have tool calls and tools enabled, process them and do a follow-up request
      if (toolCalls.length > 0 && prefs.toolsEnabled) {
        console.log(
          `[processAiRequest] Processing ${toolCalls.length} tool calls through hub`
        );

        const toolResults = await processToolCallsThroughHub(
          toolCalls,
          message,
          userId
        );

        if (toolResults.length > 0) {
          const followUpPayload = {
            ...hubPayload,
            parameters: { ...(hubPayload.parameters || {}), stream: false },
            messages: [
              ...apiMessages,
              { role: "assistant", content: finalText },
              ...toolResults,
            ],
          };

          const followUpResponse = await hubClient.processAIHubRequest(
            followUpPayload
          );
          if (
            followUpResponse &&
            followUpResponse.choices &&
            followUpResponse.choices.length > 0
          ) {
            finalText =
              followUpResponse.choices[0].message.content?.trim() || finalText;
          }
        }
      }

      // Create response object compatible with existing code
      const response = {
        choices: [
          {
            message: {
              content: finalText,
              tool_calls: toolCalls,
            },
          },
        ],
        _toolsDisabled: !prefs.toolsEnabled,
        _internalToolFollowUpDone: false,
      };

      // Send final response
      addConversationToHistory(userId, messageContent, finalText);

      // Apply settings menu after streaming is complete
      const models = await getAvailableModels(
        client,
        isVisionRequest ? "vision" : null,
        userId
      );
      const comps = await buildInteractionComponents(
        userId,
        models,
        isVisionRequest,
        false,
        effectiveLocale,
        client
      );

      // Send final response with components
      if (finalText || toolCalls.length === 0) {
        // After streaming is complete, update the message with settings components
        const finalMsg = await sendResponse(
          message,
          procMsg,
          finalText,
          comps,
          effectiveLocale,
          false
        );
      } else if (procMsg) {
        // If only tools ran (no V2) and AI had no final text, delete processing message
        await procMsg.delete().catch(() => {});
      }

      return response;
    } catch (hubError) {
      console.error(`[processAiRequest] Hub processing failed:`, hubError);
      throw new Error(`AI Hub processing failed: ${hubError.message}`);
    }
  } catch (error) {
    console.error(`[DEBUG] Error in processAiRequest:`, error);
    const errMsg = await i18n.__(
      "events.ai.messages.errorOccurred",
      { error: error.message },
      effectiveLocale
    );

    // Get available models for error components
    let availableModels = [];
    try {
      availableModels = await getAvailableModels(
        client,
        isVisionRequest ? "vision" : null,
        userId
      );
    } catch (modelsError) {
      console.error(
        "Error getting available models for error components:",
        modelsError
      );
    }

    // Build error-specific components
    let errorComponents = [];
    try {
      errorComponents = await buildErrorComponents(
        userId,
        availableModels,
        isVisionRequest,
        effectiveLocale,
        client
      );
    } catch (componentsError) {
      console.error("Error building error components:", componentsError);
    }

    await sendResponse(
      message,
      procMsg,
      errMsg,
      errorComponents,
      effectiveLocale,
      false
    );
  }
}

/**
 * Processes tool calls through the AI Hub
 */
async function processToolCallsThroughHub(toolCalls, message, userId) {
  const toolResults = [];

  for (const toolCall of toolCalls) {
    try {
      console.log(
        `[processAiRequest] Executing tool through hub: ${toolCall.function.name}`
      );

      // Send tool execution request to hub
      const toolResult = await hubClient.processToolExecution({
        toolCall,
        messageContext: {
          guildId: message.guild?.id,
          channelId: message.channel.id,
          userId: message.author.id,
          messageId: message.id,
        },
        userId,
      });

      if (toolResult) {
        toolResults.push({
          tool_call_id: toolCall.id,
          role: "tool",
          name: toolCall.function.name,
          content: toolResult.content || "Tool executed successfully",
        });
      }
    } catch (error) {
      console.error(
        `[processAiRequest] Error executing tool ${toolCall.function.name}:`,
        error
      );
      toolResults.push({
        tool_call_id: toolCall.id,
        role: "tool",
        name: toolCall.function.name,
        content: `Error executing tool: ${error.message}`,
      });
    }
  }

  return toolResults;
}
