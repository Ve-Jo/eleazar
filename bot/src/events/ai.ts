import { Events, StringSelectMenuBuilder, ActionRowBuilder } from "discord.js";
import hubClient from "../api/hubClient.ts";
import i18n from "../utils/i18n.ts";
import { recordEventCall } from "../services/metrics.ts";

// Import everything from the unified AI API
import {
  // State
  state,

  // User preferences
  getUserPreferences,
  updateUserPreference,

  // Model status
  isModelRateLimited,

  // Model management
  getAvailableModels,
  initializeApiClients,

  // UI components
  buildInteractionComponents,
  buildProviderOptions,
  buildPaginatedModelMenu,

  // Redis-backed pending interactions
  setPendingInteraction,
  getPendingInteraction,
  deletePendingInteraction,
  hasPendingInteraction,
} from "../ai.ts";

import processAiRequest from "../handlers/processAiRequest.ts";

// --- Start Localization Definitions ---
const localization_strings: Record<string, any> = {
  messages: {
    processing: {
      en: "Processing your request with `{model}`...",
      ru: "Обрабатываю ваш запрос с `{model}`...",
      uk: "Обробляю ваш запит з `{model}`...",
    },
    rateLimited: {
      en: "Model `{model}` is currently rate-limited. Please try again in about {minutes} minute(s) or select a different model.",
      ru: "Модель `{model}` в даний момент обмежена. Будь ласка, спробуйте ще раз через {minutes} хвилин або виберіть іншу модель.",
      uk: "Модель `{model}` в даний момент обмежена. Будь ласка, спробуйте ще раз через {minutes} хвилин або виберіть іншу модель.",
    },
    streamStart: {
      en: "Thinking...",
      ru: "Думаю...",
      uk: "Думаю...",
    },
    streamProcessing: {
      en: "Processing...",
      ru: "Обработка...",
      uk: "Обробка...",
    },
    streamStopped: {
      en: "Generation stopped.",
      ru: "Генерация остановлена.",
      uk: "Генерація зупинена.",
    },
    streamError: {
      en: "Error during streaming: {error}",
      ru: "Ошибка при стриминге: {error}",
      uk: "Помилка під час стрімінгу: {error}",
    },
    visionMismatch: {
      en: "Model `{model}` does not support image input. Please select a model with 'Vision' capability for this request.",
      ru: "Модель `{model}` не підтримує зображення. Будь ласка, виберіть модель з 'Vision' функціоналом для цього запиту.",
      uk: "Модель `{model}` не підтримує зображення. Будь ласка, виберіть модель з 'Vision' функціоналом для цього запиту.",
    },
    errorOccurred: {
      en: "😥 An error occurred: {error}",
      ru: "😥 Произошла ошибка: {error}",
      uk: "😥 Виникла помилка: {error}",
    },
    modelDetailsError: {
      en: "😥 Error checking model details: {error}",
      ru: "😥 Ошибка при проверке деталей модели: {error}",
      uk: "😥 Помилка при перевірці деталей моделі: {error}",
    },
    noModelsFound: {
      en: "Sorry, I couldn't find any suitable AI models to use right now{vision, select, vision { for image analysis} other {}}.",
      ru: "Извините, я не смог найти подходящие модели для использования в данный момент{vision, select, vision { для анализа изображений} other {}}.",
      uk: "Вибачте, я не зміг знайти підходящі моделі для використання в даний момент{vision, select, vision { для аналізу зображень} other {}}.",
    },
    selectModelPrompt: {
      en: "Please select an AI model to use for this chat. You can also configure context memory and tool usage below.",
      ru: "Пожалуйста, выберите модель для использования в этом чате. Вы также можете настроить контекстную память и использование инструментов ниже.",
      uk: "Будь ласка, виберіть модель для використання в цьому чаті. Ви також можете налаштувати контекстну память та використання інструментів нижче.",
    },
    modelSelectedProcessing: {
      en: "Model selected: `{model}`. Processing your request...",
      ru: "Модель выбрана: `{model}`. Обрабатываю ваш запрос...",
      uk: "Модель вибрана: `{model}`. Обробляю ваш запит...",
    },
    selectionTimeout: {
      en: "Model selection timed out.",
      ru: "Выбор модели завершен.",
      uk: "Вибір моделі завершено.",
    },
    selectionError: {
      en: "Sorry, I encountered an error while preparing model selection options.",
      ru: "Извините, я столкнулся с ошибкой при подготовке вариантов выбора модели.",
      uk: "Вибачте, я зустрів помилку при підготовці варіантів вибору моделі.",
    },
    toolComplete: {
      en: "Tool actions completed.",
      ru: "Действия инструментов завершены.",
      uk: "Дії інструментів завершено.",
    },
    noTextResponse: {
      en: "I didn't get a text response for that.",
      ru: "Я не получил текстового ответа на этот запрос.",
      uk: "Я не отримав текстового відповіді на цей запит.",
    },
    noTextResponseInternal: {
      en: "(No text response received)",
      ru: "(Не получен текстовый ответ)",
      uk: "(Не отримано текстового відповіді)",
    },
    emptyResponseInternal: {
      en: "(Received an empty response from the AI)",
      ru: "(Получен пустой ответ от AI)",
      uk: "(Отримано порожній відповідь від AI)",
    },
    toolsDisabledNote: {
      en: "*(AI tried to use tools, but they are currently disabled.)*",
      ru: "*(AI попытался использовать инструменты, но они в данный момент отключены.)*",
      uk: "*(AI спробував використовувати інструменти, але вони в даний момент відключені.)*",
    },
    reasoningDisabled: {
      en: "*(AI tried to use reasoning, but it is currently disabled.)*",
      ru: "*(AI попытался использовать рассуждение, но оно в данный момент отключено.)*",
      uk: "*(AI спробував використовувати міркування, але воно в даний момент вимкнено.)*",
    },
  },
  buttons: {
    menus: {
      modelSelect: {
        providerPlaceholder: {
          en: "Select a provider",
          ru: "Выберите провайдера",
          uk: "Виберіть провайдера",
        },
        placeholder: {
          en: "Select an AI model",
          ru: "Выберите модель ИИ",
          uk: "Виберіть модель ШІ",
        },
        pagePrev: {
          en: "Previous Page",
          ru: "Предыдущая страница",
          uk: "Попередня сторінка",
        },
        pageNext: {
          en: "Next Page",
          ru: "Следующая страница",
          uk: "Наступна сторінка",
        },
        backProviders: {
          en: "Back to Providers",
          ru: "Назад к провайдерам",
          uk: "Назад до провайдерів",
        },
      },
      settingsSelect: {
        placeholder: {
          en: "Settings",
          ru: "Настройки",
          uk: "Налаштування",
        },
        systemPrompt: {
          en: "System Prompt",
          ru: "Системные инструкции",
          uk: "Системні інструкції",
        },
        systemPromptEnabled: {
          en: "System prompt enabled",
          ru: "Системные инструкции включены",
          uk: "Системні інструкції увімкнено",
        },
        systemPromptDisabled: {
          en: "System prompt disabled",
          ru: "Системные инструкции отключены",
          uk: "Системні інструкції вимкнено",
        },
        tools: {
          en: "Tools",
          ru: "Инструменты",
          uk: "Інструменти",
        },
        toolsEnabled: {
          en: "Tools enabled",
          ru: "Инструменты включены",
          uk: "Інструменти увімкнено",
        },
        toolsDisabled: {
          en: "Tools disabled",
          ru: "Инструменты отключены",
          uk: "Інструменти вимкнено",
        },
        webSearch: {
          en: "Web Search",
          ru: "Веб-поиск",
          uk: "Веб-пошук",
        },
        webSearchEnabled: {
          en: "Search enabled",
          ru: "Поиск включен",
          uk: "Пошук увімкнено",
        },
        webSearchDisabled: {
          en: "Search disabled",
          ru: "Поиск отключен",
          uk: "Пошук вимкнено",
        },
      },
      settingsOptions: {
        finetune: {
          en: "Adjust AI generation parameters",
          ru: "Настроить параметры генерации ИИ",
          uk: "Налаштувати параметри генерації ШІ",
        },
        switchModel: {
          label: {
            en: "Switch Model",
            ru: "Сменить модель",
            uk: "Змінити модель",
          },
          description: {
            en: "Change the AI model",
            ru: "Изменить модель искусственного интеллекта",
            uk: "Змінити модель штучного інтелекту",
          },
        },
      },
    },
    systemPrompt: {
      clearContext: {
        en: "Clear Context ({current}/{max})",
        ru: "Очистить контекст ({current}/{max})",
        uk: "Очистити контекст ({current}/{max})",
      },
    },
    finetune: {
      buttonLabel: {
        en: "Fine-tune Settings",
        ru: "Настройки параметров",
        uk: "Налаштування параметрів",
      },
    },
    sanitization: {
      mention: { en: "(mention)", ru: "(упоминание)", uk: "(упоминання)" },
      everyone: { en: "@ everyone", ru: "@ всех", uk: "@ всіх" },
      here: { en: "@ here", ru: "@ здесь", uk: "@ тут" },
    },
  },
  errorMenu: {
    placeholder: {
      en: "Fix this error...",
      ru: "Исправить ошибку...",
      uk: "Виправити помилку...",
    },
    retry: {
      en: "Retry",
      ru: "Повторить",
      uk: "Повторити",
    },
    retryDescription: {
      en: "Try the request again",
      ru: "Попробуйте запрос снова",
      uk: "Спробуйте запит знову",
    },
    switchModel: {
      en: "Switch Model",
      ru: "Сменить модель",
      uk: "Змінити модель",
    },
    switchModelDescription: {
      en: "Try a different AI model",
      ru: "Попробуйте другую модель ИИ",
      uk: "Спробуйте іншу модель ШІ",
    },
    settings: {
      en: "Settings",
      ru: "Настройки",
      uk: "Налаштування",
    },
    settingsDescription: {
      en: "Configure AI settings",
      ru: "Настроить параметры ИИ",
      uk: "Налаштувати параметри ШІ",
    },
    clearContext: {
      en: "Clear Context",
      ru: "Очистить контекст",
      uk: "Очистити контекст",
    },
    clearContextDescription: {
      en: "Reset conversation memory",
      ru: "Сбросить память разговора",
      uk: "Скинути пам'ять розмови",
    },
  },
};
// --- End Localization Definitions ---

// Environment validation no longer needed since hub handles API keys
console.log("🤖 AI module using hub integration - API keys managed by hub");

// --- Start MessageCreate Handler Localization ---
async function translate(...args: any[]): Promise<string> {
  const result = await (i18n as any).__(...args);
  if (typeof result === "string") {
    return result;
  }
  return result?.translation || "";
}

export default {
  name: Events.MessageCreate,
  localization_strings: localization_strings, // Add the strings object to the export
  async execute(message: any): Promise<void> {
    const startTime = Date.now();
    let isError = false;

    try {
      // Initialize AI clients if not already done
      if (!message.client._aiClientsChecked) {
        message.client._aiClientsChecked = true;
        await initializeApiClients(message.client);
      }

      if (message.author.bot) return;

      const userId = message.author.id;

      console.log(
        `Message received from ${
          message.author.tag
        }: "${message.content.substring(0, 50)}${
          message.content.length > 50 ? "..." : ""
        }"`
      );

      if (!message.mentions.users.has(message.client.user.id)) {
        console.log("Message doesn't mention bot, ignoring");
        return;
      }

      const messageContent = message.content
        .replace(new RegExp(`<@!?${message.client.user.id}>`, "g"), "")
        .trim();

      if (!messageContent && message.attachments.size === 0) {
        console.log("Message only contains ping, no content or attachments");
        return;
      }

      const prefs = getUserPreferences(userId);
      console.log(`User preferences for ${userId}:`, {
        selectedModel: prefs.selectedModel,
        systemPromptEnabled: prefs.systemPromptEnabled,
        toolsEnabled: prefs.toolsEnabled,
      });

      // Determine locale early for potential messages
      let effectiveLocale = "en";
      try {
        const userDbLocale = await hubClient.getUserLocale(
          message.guild?.id,
          userId
        );
        if (userDbLocale && ["en", "ru", "uk"].includes(userDbLocale)) {
          effectiveLocale = userDbLocale;
        } else if (message.guild?.preferredLocale) {
          const normalizedGuildLocale = message.guild.preferredLocale
            .split("-")[0]
            .toLowerCase();
          if (["en", "ru", "uk"].includes(normalizedGuildLocale)) {
            effectiveLocale = normalizedGuildLocale;
          }
        }
      } catch (dbError: any) {
        console.error(
          `Error fetching user locale for ${userId}, defaulting to 'en':`,
          dbError
        );
      }
      // Set locale for subsequent i18n calls within this scope if needed
      i18n.setLocale(effectiveLocale);

      // Ensure translations for events.ai are registered once per process, then prewarm group cache
      if (!(globalThis as any).__eventsAiTranslationsRegistered) {
        try {
          await i18n.registerLocalizations(
            "events",
            "ai",
            localization_strings,
            true
          );
          (globalThis as any).__eventsAiTranslationsRegistered = true;
        } catch (e: any) {
          console.warn("Failed to register events.ai localizations:", e);
        }
      }
      try {
        await i18n.getTranslationGroup("events.ai", effectiveLocale);
      } catch (e: any) {
        console.warn("Failed to prewarm events.ai translation group:", e);
      }

      const isVisionRequest =
        message.attachments.size > 0 &&
        message.attachments.first().contentType?.startsWith("image/");

      if (isVisionRequest) {
        console.log(
          `Vision request detected with attachment: ${
            message.attachments.first().name
          }`
        );
      }

      if (!prefs.selectedModel) {
        console.log(
          `User ${userId} has no model selected. Prompting for selection.`
        );
        message.channel.sendTyping();

        try {
          const client = message.client; // Get client object
          const availableModels = await getAvailableModels(
            client,
            isVisionRequest ? "vision" : null,
            userId
          );
          console.log(`Found ${availableModels.length} available models`);

          if (availableModels.length === 0) {
            // Use determined locale for the reply
            await message.reply(
              await translate(
                "events.ai.messages.noModelsFound",
                { vision: isVisionRequest ? "vision" : "text" },
                effectiveLocale
              )
            );
            return;
          }

          // Pass client to buildInteractionComponents
          const components = await buildInteractionComponents(
            userId,
            availableModels,
            isVisionRequest,
            true,
            effectiveLocale,
            message.client // Pass client parameter
          );

          console.log("Sending model selection prompt");
          // Use locale for the prompt message
          let promptMsg = await message.reply({
            content: await translate(
              "events.ai.messages.selectModelPrompt",
              effectiveLocale
            ),
            components: components,
          });

          await setPendingInteraction(userId, message);
          console.log(`Stored pending interaction for user ${userId}`);

          const collector = promptMsg.createMessageComponentCollector({
            filter: (i: any) => i.user.id === userId,
            time: 5 * 60 * 1000,
          });

          console.log(`Created message component collector for user ${userId}`);

          collector.on("collect", async (interaction: any) => {
            console.log(
              `Initial Collector: Received interaction - Type: ${interaction.componentType}, Custom ID: ${interaction.customId}, User: ${interaction.user.id}`
            );

            const customId = interaction.customId;

            // Handle provider selection to show paginated model menu
            if (
              interaction.isStringSelectMenu() &&
              customId === `ai_select_provider_${userId}`
            ) {
              const providerToken = interaction.values[0];
              const provider = providerToken
                .replace("__provider_", "")
                .replace("__", "")
                .toLowerCase();

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
                effectiveLocale
              );

              await interaction.update({ components: [row] });
              return;
            }

            // Handle paginated model selection with navigation controls
            if (
              interaction.isStringSelectMenu() &&
              customId.startsWith("ai_select_model_")
            ) {
              console.log(
                "Initial Collector: Handling StringSelectMenu interaction."
              );
              const selectedValue = interaction.values[0];
              console.log(
                `Initial Collector: Raw selected value: ${selectedValue}`
              );

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
                  effectiveLocale
                );

                await interaction.update({ components: [row] });
                return;
              }

              if (selectedValue === "__back_providers__") {
                const models = await getAvailableModels(
                  message.client,
                  isVisionRequest ? "vision" : null
                );
                const providerMenu = new StringSelectMenuBuilder()
                  .setCustomId(`ai_select_provider_${userId}`)
                  .setPlaceholder(
                    (await translate(
                      "events.ai.buttons.menus.modelSelect.providerPlaceholder",
                      effectiveLocale
                    )) || "Select a provider"
                  );
                const providerOpts = await buildProviderOptions(
                  models,
                  effectiveLocale
                );
                providerMenu.addOptions(providerOpts);
                await interaction.update({
                  components: [
                    new ActionRowBuilder().addComponents(providerMenu),
                  ],
                });
                return;
              }

              const selectedModelId = selectedValue;

              // Immediately defer the update to show loading state
              await interaction.deferUpdate().catch((err: any) => {
                console.error("Initial Collector: Failed to defer update:", err);
              });
              console.log("Initial Collector: Interaction deferred.");

              updateUserPreference(userId, "selectedModel", selectedModelId);
              console.log(
                `Initial Collector: User ${userId} preference updated to model: ${selectedModelId}`
              );

              const originalMessage = (await getPendingInteraction(userId)) as any;
              if (originalMessage) {
                console.log(
                  `Initial Collector: Found pending message ${originalMessage.id}.`
                );
                await deletePendingInteraction(userId);
                collector.stop("model_selected");
                console.log("Initial Collector: Stopped collector.");

                try {
                  // Use locale for the edit message - no need to defer again
                  await promptMsg
                    .edit({
                      content: await translate(
                        "events.ai.messages.modelSelectedProcessing",
                        { model: selectedModelId },
                        effectiveLocale
                      ),
                      components: [],
                    })
                    .catch((err: any) => {
                      console.error(
                        "Initial Collector: Failed to update prompt message:",
                        err
                      );
                    });
                  console.log(
                    `Initial Collector: Edited prompt message ${promptMsg.id}.`
                  );
                } catch (updateError: any) {
                  console.error(
                    "Initial Collector: Error deferring/editing interaction/prompt message: ",
                    updateError
                  );
                  // Use locale for the fallback message
                  await message.channel
                    .send(
                      await translate(
                        "events.ai.messages.modelSelectedProcessing",
                        { model: selectedModelId },
                        effectiveLocale
                      )
                    )
                    .catch((e: any) =>
                      console.error("Failed to send fallback message:", e)
                    );
                  promptMsg = null;
                }

                const messageContent = originalMessage.content
                  .replace(
                    new RegExp(`<@!?${originalMessage.client.user.id}>`, "g"),
                    ""
                  )
                  .trim();
                const isVisionRequest =
                  originalMessage.attachments.size > 0 &&
                  originalMessage.attachments
                    .first()
                    .contentType?.startsWith("image/");

                console.log("Initial Collector: Calling processAiRequest...");
                await processAiRequest(
                  originalMessage,
                  userId,
                  messageContent,
                  isVisionRequest,
                  promptMsg,
                  effectiveLocale // Pass locale here
                );
                console.log("Initial Collector: processAiRequest call finished.");
              } else {
                console.warn(
                  `Initial Collector: No pending message found for user ${userId} after model selection.`
                );
                try {
                  await interaction.update({
                    content: await translate("events.ai.messages.modelSelected", {
                      model: selectedModelId,
                    }),
                    components: [],
                  });
                } catch (e: any) {
                  console.error(
                    "Couldn't update interaction after model selection (no pending message)",
                    e
                  );
                }
              }
            } else {
              console.log(
                `Initial Collector: Interaction ${customId} is not the model select menu. Ignoring in this collector.`
              );
            }

            // NOTE: Removed toggle and retry button logic from this initial collector.
            // They are now handled by the collector attached in sendResponse.
          });

          collector.on("end", async (collected: any, reason: any) => {
            console.log(
              `Collector for ${userId} ended with reason: ${reason}, collected ${collected.size} interactions`
            );

            if (
              reason === "time" &&
              (await hasPendingInteraction(userId))
            ) {
              const pendingMsg = await getPendingInteraction(userId);
              if (pendingMsg === message) {
                await deletePendingInteraction(userId);
                if (collected.size === 0) {
                  // Use locale for the timeout message
                  promptMsg
                    .edit({
                      content: await translate(
                        "events.ai.messages.selectionTimeout",
                        effectiveLocale
                      ),
                      components: [],
                    })
                    .catch(async (e: any) =>
                      console.error("Failed to edit timeout message:", e)
                    );
                  console.log(`Pending interaction timed out for user ${userId}`);
                }
              }
            }
          });
        } catch (error: any) {
          console.error("Error during model selection process:", error);
          // Use locale for the error message
          await message
            .reply(
              await translate("events.ai.messages.selectionError", effectiveLocale)
            )
            .catch((e: any) => {});
        }

        return; // Stop processing, wait for interaction
      }

      // Check if selected model is rate-limited
      if (prefs.selectedModel) {
        if (isModelRateLimited(prefs.selectedModel)) {
          // Get the remaining time from state
          const expireTime = state.modelStatus.rateLimits[prefs.selectedModel] || Date.now();
          const now = Date.now();
          const minutes = Math.ceil((expireTime - now) / 1000 / 60); // in minutes

          await message.reply(
            await translate(
              "events.ai.messages.rateLimited",
              {
                model: prefs.selectedModel,
                minutes: minutes,
              },
              effectiveLocale
            )
          );
          return;
        }
      }

      console.log(
        `Processing message from ${message.author.tag} with model ${prefs.selectedModel}`
      );
      // Use hub-based processing instead of direct API calls
      try {
        // hubClient is already imported at the top of the file

        // Prepare request data for hub
        const requestData = {
          userId,
          guildId: message.guild?.id,
          channelId: message.channel.id,
          messageId: message.id,
          content: messageContent,
          isVisionRequest,
          locale: effectiveLocale,
          userPreferences: prefs,
          attachments: message.attachments.map((att: any) => ({
            url: att.url,
            contentType: att.contentType,
            name: att.name,
            size: att.size,
          })),
          mentions: {
            users: Array.from(message.mentions.users.values()).map((user: any) => ({
              id: user.id,
              username: user.username,
              bot: user.bot,
            })),
            channels: Array.from(message.mentions.channels.values()).map(
              (channel: any) => ({
                id: channel.id,
                name: channel.name,
                type: channel.type,
              })
            ),
            roles: Array.from(message.mentions.roles.values()).map((role: any) => ({
              id: role.id,
              name: role.name,
            })),
          },
          guildInfo: message.guild
            ? {
                id: message.guild.id,
                name: message.guild.name,
                memberCount: message.guild.memberCount,
                createdAt: message.guild.createdAt.toISOString(),
              }
            : null,
          channelInfo: {
            id: message.channel.id,
            name: message.channel.name,
            type: message.channel.type,
            topic: message.channel.topic || null,
            isThread: message.channel.isThread,
            isDM: message.channel.type === "DM",
          },
          authorInfo: {
            id: message.author.id,
            username: message.author.username,
            bot: message.author.bot,
            nickname: message.member?.nickname || message.author.username,
            joinedAt: message.member?.joinedAt?.toISOString() || null,
            roles: message.member?.roles.cache.map((role: any) => role.name) || [],
          },
        };

        // Send processing message
        message.channel.sendTyping();
        const processingMsg = await message.reply(
          await translate(
            "events.ai.messages.processing",
            { model: prefs.selectedModel },
            effectiveLocale
          )
        );

        // Delegate processing to unified handler
        await processAiRequest(
          message,
          userId,
          messageContent,
          isVisionRequest,
          processingMsg,
          effectiveLocale
        );
      } catch (error: any) {
        console.error("AI Hub processing error:", error);
        isError = true;
        await message.reply(
          await translate(
            "events.ai.messages.errorOccurred",
            { error: error.message },
            effectiveLocale
          )
        );
      }
    } catch (error: any) {
      console.error("AI event error:", error);
      isError = true;
    } finally {
      const duration = Date.now() - startTime;
      recordEventCall("aiMessageCreate", duration, isError);
    }
  },
};
// --- End MessageCreate Handler Localization ---

// User preferences now managed in src/state/prefs.js
// Model capabilities and API client are imported from services/groqModels.js
