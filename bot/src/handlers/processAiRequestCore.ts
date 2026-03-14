import i18n from "../utils/i18n.ts";
import hubClient from "../api/hubClient.ts";
import { v4 as uuidv4 } from "uuid";
import {
  state,
  getUserPreferences,
  updateUserPreference,
  addConversationToHistory,
  isModelRateLimited,
  getModelCapabilities,
  getAvailableModels,
  sendResponse,
  buildInteractionComponents,
  buildErrorComponents,
} from "../ai.ts";
import {
  removeThinkTags,
  getUserInfoForPrompt,
  processToolCallsThroughHub,
  buildEnhancedSystemPrompt,
  buildUserMessageContent,
} from "./processAiRequestHelpers.ts";
import type { MessageLike, ProcessingMessageLike } from "./processAiRequest.ts";
import type {
  AiProcessRequest,
  AiStreamChunk,
} from "../../../hub/shared/src/contracts/hub.ts";

type AiPreferences = {
  selectedModel?: string;
  messageHistory: Array<{ role: string; content: unknown }>;
  systemPromptEnabled?: boolean;
  toolsEnabled?: boolean;
  aiParams: {
    temperature?: number;
    top_p?: number;
    frequency_penalty?: number;
    presence_penalty?: number;
  };
};

type ModelCapabilities = {
  vision?: boolean;
};

type ToolCall = {
  id: string;
  function: { name: string };
};

type AiFollowUpResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

function isToolCall(value: unknown): value is ToolCall {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  const fn = record.function;
  return (
    typeof record.id === "string" &&
    !!fn &&
    typeof fn === "object" &&
    typeof (fn as Record<string, unknown>).name === "string"
  );
}

async function processAiRequestCore(
  message: MessageLike,
  userId: string,
  messageContent: string,
  isVisionRequest: boolean,
  processingMessage: ProcessingMessageLike | null = null,
  effectiveLocale = "en"
): Promise<unknown> {
  console.log(`Starting processAiRequest for user ${userId}`);

  const client = message.client;
  const channel = message.channel;
  const author = message.author;

  if (!author) {
    console.error("Could not determine author for AI request.");
    if (channel) await channel.send("Error: Could not identify user for request.").catch(() => {});
    return;
  }

  const prefs = getUserPreferences(userId) as AiPreferences;
  if (!prefs.selectedModel) {
    console.error(`processAiRequest called for user ${userId} without a selected model.`);
    if (channel) {
      await channel.send("Error: No AI model selected. Please select a model first.").catch(() => {});
    }
    return;
  }

  console.log(`Using model ${prefs.selectedModel} for user ${userId}`);

  let capabilities: ModelCapabilities;
  try {
    capabilities = await getModelCapabilities(client, prefs.selectedModel);
    console.log(`Model capabilities for ${prefs.selectedModel}:`, capabilities);
  } catch (error) {
    const typedError = error as Error;
    console.error(`Failed to get capabilities for ${prefs.selectedModel}:`, error);
    const errMsg = `😥 Error checking model details: ${typedError.message}`;
    if (processingMessage) {
      await sendResponse(message, processingMessage, errMsg, []);
    } else if (channel) {
      await channel.send(errMsg).catch(() => {});
    }
    return;
  }

  if (isVisionRequest && !capabilities.vision) {
    const errMsg = `Model \`${prefs.selectedModel}\` does not support image input. Please select a model with 'Vision' capability for this request.`;
    console.log(`Vision request blocked for non-vision model ${prefs.selectedModel}.`);
    const visionModels = await getAvailableModels(
      client,
      "vision",
      userId
    );
    const comps = await buildInteractionComponents(
      userId,
      visionModels,
      true,
      false,
      effectiveLocale,
      client
    );
    channel?.sendTyping?.();
    const promptMsg = await channel?.send({ content: errMsg, components: comps });
    const collector = promptMsg?.createMessageComponentCollector?.({
      filter: (interaction: unknown) => {
        const candidate = interaction as {
          user?: { id?: string };
          isStringSelectMenu?: () => boolean;
        };
        return candidate.user?.id === userId && candidate.isStringSelectMenu?.() === true;
      },
      time: 5 * 60 * 1000,
    });
    collector?.on("collect", async (interaction: unknown) => {
      const candidate = interaction as {
        isStringSelectMenu?: () => boolean;
        values?: string[];
        deferUpdate?: () => Promise<unknown>;
      };
      if (!candidate.isStringSelectMenu?.()) return;
      const selectedModelId = candidate.values?.[0];
      if (!selectedModelId) return;
      updateUserPreference(userId, "selectedModel", selectedModelId);
      await candidate.deferUpdate?.();
      await promptMsg.edit({
        content: await i18n.__("events.ai.messages.modelSelectedProcessing", { model: selectedModelId }, effectiveLocale),
        components: [],
      });
      await processAiRequestCore(message, userId, messageContent, true, promptMsg, effectiveLocale);
    });
    return;
  }

  if (isModelRateLimited(prefs.selectedModel)) {
    const retryTime = state.modelStatus?.rateLimits?.[prefs.selectedModel] ?? Date.now();
    const minutesLeft = Math.ceil((retryTime - Date.now()) / 60000);
    const errMsg = `Model \`${prefs.selectedModel}\` is currently rate-limited. Please try again in about ${minutesLeft} minute(s) or select a different model.`;
    console.log(`Prevented call to rate-limited model ${prefs.selectedModel}.`);
    if (processingMessage) await sendResponse(message, processingMessage, errMsg, []);
    else await channel?.send(errMsg).catch(() => {});
    return;
  }

  let procMsg = processingMessage;
  if (!procMsg) {
    channel?.sendTyping?.();
    procMsg = (await channel?.send(await i18n.__("events.ai.messages.processing", { model: prefs.selectedModel }))) as ProcessingMessageLike;
  } else {
    await procMsg.edit({ content: await i18n.__("events.ai.messages.processing", { model: prefs.selectedModel }), components: [] }).catch(() => {});
  }

  try {
    let apiMessages = [...prefs.messageHistory];
    if (prefs.systemPromptEnabled) {
      const promptSnapshot = await getUserInfoForPrompt(message as unknown as Parameters<typeof getUserInfoForPrompt>[0]);
      const enhancedSystemPrompt = buildEnhancedSystemPrompt(promptSnapshot);
      apiMessages = apiMessages.filter((entry) => entry.role !== "system");
      apiMessages.unshift({ role: "system", content: enhancedSystemPrompt });
      console.log(`Prepending enhanced system prompt with user info for model: ${prefs.selectedModel}`);
    } else {
      apiMessages = apiMessages.filter((entry) => entry.role !== "system");
    }

    const userMsg = {
      role: "user",
      content: buildUserMessageContent(messageContent, isVisionRequest, message.attachments?.first?.()),
    };
    apiMessages.push(userMsg);

    let hubPayload: AiProcessRequest = {
      requestId: uuidv4(),
      model: prefs.selectedModel,
      messages: apiMessages,
      parameters: {
        temperature: prefs.aiParams.temperature,
        top_p: prefs.aiParams.top_p,
        frequency_penalty: prefs.aiParams.frequency_penalty,
        presence_penalty: prefs.aiParams.presence_penalty,
        stream: true,
        tools: [],
      },
      userId,
      guildId: message.guild?.id,
    };

    let finalText = "";
    let toolCalls: ToolCall[] = [];
    let reasoningText = "";
    let lastEditAt = Date.now();
    let lastPreviewContent = "";
    let lastSentFinalLength = 0;
    let nextAllowedEditAt = 0;
    let editErrorCount = 0;
    let isEditing = false;
    const MIN_INTERVAL_MS = 3000;
    const MAX_INTERVAL_MS = 5000;
    let currentIntervalMs = 3000;
    let schedulerId: ReturnType<typeof setTimeout> | null = null;
    let streamDone = false;
    let lastMeasureAt = Date.now();
    let lastMeasureLen = 0;
    const MIN_FINAL_DELTA = 250;
    const MIN_FINAL_DELTA_BOUNDARY = 120;

    const canEdit = (now: number) => now - lastEditAt >= MIN_INTERVAL_MS && !isEditing && now >= nextAllowedEditAt;
    const applyBackoff = () => {
      editErrorCount += 1;
      nextAllowedEditAt = Date.now() + Math.min(30000, 1000 * Math.pow(2, editErrorCount));
    };

    const streamStartLabel = ((await i18n.__("events.ai.messages.streamStart", effectiveLocale)) as string | null) || "Thinking...";
    if (procMsg) {
      try {
        const initialPreview = `-# ${streamStartLabel}`;
        await procMsg.edit({ content: initialPreview });
        lastPreviewContent = initialPreview;
        lastEditAt = Date.now();
      } catch {}
    }

    const tryScheduledEdit = async () => {
      if (streamDone || isEditing || Date.now() < nextAllowedEditAt) return;
      const now = Date.now();
      const hasFinal = finalText.length > 0;
      const hasReasoning = reasoningText.length > 0;

      if (hasReasoning && !hasFinal && procMsg) {
        if (!canEdit(now)) return;
        const formattedReasoning = reasoningText.split("\n").map((line) => (line.trim() ? `-# ${line}` : line)).join("\n");
        const reasoningPreview = formattedReasoning.length > 1900 ? `${formattedReasoning.slice(0, 1900)}...` : formattedReasoning;
        if (!reasoningPreview || reasoningPreview === lastPreviewContent) return;
        try {
          isEditing = true;
          await procMsg.edit({ content: reasoningPreview });
          lastPreviewContent = reasoningPreview;
          lastEditAt = now;
          editErrorCount = 0;
          nextAllowedEditAt = 0;
        } catch {
          applyBackoff();
        } finally {
          isEditing = false;
        }
        return;
      }

      if (!hasFinal || !procMsg) return;
      const preview = finalText.length > 1900 ? `${finalText.slice(0, 1900)}...` : finalText;
      const finalDelta = Math.max(0, finalText.length - lastSentFinalLength);
      const endsBoundary = /[.!?]\s$/.test(finalText) || /\n$/.test(finalText);
      const meaningfulDelta = finalDelta >= MIN_FINAL_DELTA || (endsBoundary && finalDelta >= MIN_FINAL_DELTA_BOUNDARY);
      if (!preview || preview === lastPreviewContent || !meaningfulDelta) return;
      try {
        isEditing = true;
        await procMsg.edit({ content: preview });
        lastPreviewContent = preview;
        lastSentFinalLength = finalText.length;
        lastEditAt = now;
        editErrorCount = 0;
        nextAllowedEditAt = 0;
      } catch {
        applyBackoff();
      } finally {
        isEditing = false;
      }
    };

    const scheduleNext = () => {
      if (streamDone) return;
      schedulerId = setTimeout(() => {
        void tryScheduledEdit();
        scheduleNext();
      }, currentIntervalMs);
    };
    scheduleNext();

    await hubClient.processAIHubStream(
      hubPayload,
      async (chunk: AiStreamChunk) => {
        if (chunk.content) finalText += chunk.content;
        if (chunk.reasoning) reasoningText += chunk.reasoning;
        if (isToolCall(chunk.tool_call)) toolCalls.push(chunk.tool_call);
        const hasFinal = finalText.length > 0;
        if (hasFinal && procMsg && canEdit(Date.now())) {
          const preview = finalText.length > 1900 ? `${finalText.slice(0, 1900)}...` : finalText;
          try {
            isEditing = true;
            await procMsg.edit({ content: preview });
            lastPreviewContent = preview;
            lastSentFinalLength = finalText.length;
            lastEditAt = Date.now();
            editErrorCount = 0;
            nextAllowedEditAt = 0;
          } catch {
            applyBackoff();
          } finally {
            isEditing = false;
          }
        }
        if (hasFinal) {
          const now = Date.now();
          const dt = now - lastMeasureAt;
          if (dt >= 1000) {
            const cps = (finalText.length - lastMeasureLen) / (dt / 1000);
            currentIntervalMs = cps >= 60 ? MIN_INTERVAL_MS : cps >= 30 ? 3000 : cps >= 15 ? 4000 : MAX_INTERVAL_MS;
            lastMeasureAt = now;
            lastMeasureLen = finalText.length;
          }
        }
      },
      async (err: Error) => {
        console.error("[processAiRequest] Hub streaming error:", err);
        if (procMsg) {
          try {
            await procMsg.edit({ content: err.message.includes("WebSocket") || err.message.includes("connection") ? `😥 Connection error: ${err.message}. Please try again.` : `😥 Error: ${err.message}` });
          } catch {}
        }
        if (schedulerId) clearTimeout(schedulerId);
        streamDone = true;
        throw err;
      },
      (_completionData) => {
        console.log(`[processAiRequest] Stream completed with data:`, _completionData);
        if (schedulerId) clearTimeout(schedulerId);
        streamDone = true;
        if (procMsg && finalText) {
          const finalContent = removeThinkTags(finalText) || "";
          const preview = finalContent.length > 1900 ? `${finalContent.slice(0, 1900)}...` : finalContent;
          void procMsg.edit({ content: preview }).catch((error: Error) => {
            console.error("[processAiRequest] Error in final completion update:", error);
          });
        }
      }
    );

    if (toolCalls.length > 0 && prefs.toolsEnabled) {
      console.log(`[processAiRequest] Processing ${toolCalls.length} tool calls through hub`);
      const toolResults = await processToolCallsThroughHub(
        toolCalls,
        message as unknown as Parameters<typeof processToolCallsThroughHub>[1],
        userId
      );
      if (toolResults.length > 0) {
        const followUpResponse = (await hubClient.processAIHubRequest({
          ...hubPayload,
          parameters: { ...(hubPayload.parameters || {}), stream: false },
          messages: [...apiMessages, { role: "assistant", content: finalText }, ...toolResults],
        })) as AiFollowUpResponse;
        const followUpContent = followUpResponse?.choices?.[0]?.message?.content;
        if (typeof followUpContent === "string" && followUpContent.trim()) {
          finalText = followUpContent.trim();
        }
      }
    }

    const response = {
      choices: [{ message: { content: finalText, tool_calls: toolCalls } }],
      _toolsDisabled: !prefs.toolsEnabled,
      _internalToolFollowUpDone: false,
    };

    addConversationToHistory(userId, messageContent, finalText);
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

    if (finalText || toolCalls.length === 0) {
      await sendResponse(message, procMsg, finalText, comps, effectiveLocale, false);
    } else if (procMsg?.delete) {
      await procMsg.delete().catch(() => {});
    }

    return response;
  } catch (error) {
    const typedError = error as Error;
    console.error(`[DEBUG] Error in processAiRequest:`, error);
    const errMsg = await i18n.__("events.ai.messages.errorOccurred", { error: typedError.message }, effectiveLocale);
    let availableModels: unknown[] = [];
    try {
      availableModels = await getAvailableModels(
        client,
        isVisionRequest ? "vision" : null,
        userId
      );
    } catch (modelsError) {
      console.error("Error getting available models for error components:", modelsError);
    }
    let errorComponents: unknown[] = [];
    try {
      errorComponents = (await buildErrorComponents(
        userId,
        availableModels,
        isVisionRequest,
        effectiveLocale,
        client
      )) as unknown[];
    } catch (componentsError) {
      console.error("Error building error components:", componentsError);
    }
    await sendResponse(message, procMsg, errMsg, errorComponents, effectiveLocale, false);
  }
}

export default processAiRequestCore;
