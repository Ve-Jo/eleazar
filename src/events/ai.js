import {
  Events,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ActionRowBuilder,
  ComponentType,
  InteractionType,
} from "discord.js";
import { translate } from "bing-translate-api";
import { Memer } from "memer.ts";
import Database from "../database/client.js";
import fetch from "node-fetch";
import { Groq } from "groq-sdk";
import CONFIG from "../config/aiConfig.js";
import i18n from "../utils/newI18n.js";
import {
  state,
  isModelRateLimited,
  setModelRateLimit,
} from "../state/state.js";
import {
  fetchGroqModels,
  extractModelSize,
  getAvailableModels,
  getAvailableModel,
  updateModelCooldown,
  getModelCapabilities,
  getApiClientForModel,
} from "../services/groqModels.js";
import {
  generateToolsFromCommands,
  getParameterType,
} from "../services/tools.js";
import {
  splitMessage,
  buildInteractionComponents,
  sendResponse,
} from "../services/messages.js";
import processAiRequest from "../handlers/processAiRequest.js";
import {
  getUserPreferences,
  updateUserPreference,
  clearUserHistory,
  addConversationToHistory,
} from "../state/prefs.js";

// --- Start Localization Definitions ---
const localization_strings = {
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
  },
  buttons: {
    systemPrompt: {
      on: {
        en: "System Prompt: ON",
        ru: "Системный промт: ВКЛ",
        uk: "Системне повідомлення: ВКЛ",
      },
      off: {
        en: "System Prompt: OFF",
        ru: "Системный промт: ВЫКЛ",
        uk: "Системне повідомлення: ВИКЛ",
      },
      tools: {
        on: {
          en: "Tools: ON",
          ru: "Инструменты: ВКЛ",
          uk: "Інструменти: ВКЛ",
        },
        off: {
          en: "Tools: OFF",
          ru: "Инструменты: ВЫКЛ",
          uk: "Інструменти: ВИМК",
        },
        offModel: {
          en: "Tools: OFF (Model)",
          ru: "Инструменты: ВЫКЛ (Модель)",
          uk: "Інструменти: ВИМК (Модель)",
        },
      },
      clearContext: {
        en: "Context ({current}/{max})",
        ru: "Контекст ({current}/{max})",
        uk: "Контекст ({current}/{max})",
      },
    },
    menus: {
      modelSelect: {
        placeholder: {
          en: "Select an AI model",
          ru: "Выберите модель AI",
          uk: "Виберіть модель AI",
        },
      },
    },
    toolResult: {
      successPrefix: {
        en: "🔧 **Tool Result ({command}):**",
        ru: "🔧 **Результат инструмента ({command}):**",
        uk: "🔧 **Результат інструменту ({command}):**",
      },
      errorPrefix: {
        en: "⚠️ **Tool Error ({command}):**",
        ru: "⚠️ **Ошибка инструмента ({command}):**",
        uk: "⚠️ **Помилка інструменту ({command}):**",
      },
    },
    toolExec: {
      parseError: {
        en: "Error: Could not parse the arguments provided for the command {command}. Please ensure arguments are a valid JSON string. Received: {args}",
        ru: "Ошибка: Не удалось разобрать аргументы, предоставленные для команды {command}. Пожалуйста, убедитесь, что аргументы являются допустимой строкой JSON. Получено: {args}",
        uk: "Помилка: Не вдалося розібрати аргументи, надані для команди {command}. Будь ласка, переконайтеся, що аргументи є допустимою рядковою строкою JSON. Отримано: {args}",
      },
      commandNotFound: {
        en: 'Command "{command}" not found.',
        ru: 'Команда "{command}" не найдена.',
        uk: 'Команда "{command}" не знайдена.',
      },
      dmRestricted: {
        en: "Error: This command can only be used in servers, not in DMs.",
        ru: "Ошибка: Эта команда может быть использована только в серверах, а не в личных сообщениях.",
        uk: "Помилка: Ця команда може бути використана тільки в серверах, а не в особистих повідомленнях.",
      },
      economyDepositError: {
        en: "The 'deposit' command is for your own bank. Use 'transfer' to send money to someone else.",
        ru: "Команда 'deposit' предназначена для вашего собственного банка. Используйте 'transfer', чтобы перевести деньги кому-либо другому.",
        uk: "Команда 'deposit' призначена для вашого власного банку. Використовуйте 'transfer', щоб передати гроші іншому.",
      },
      economyTransferError: {
        en: "To put money in your bank, use the 'deposit' command.",
        ru: "Чтобы положить деньги в ваш банк, используйте команду 'deposit'.",
        uk: "Щоб покласти гроші в ваш банк, використовуйте команду 'deposit'.",
      },
      economyWithdrawError: {
        en: "The 'withdraw' command is only for your own bank.",
        ru: "Команда 'withdraw' предназначена только для вашего собственного банка.",
        uk: "Команда 'withdraw' призначена тільки для вашого власного банку.",
      },
      missingParams: {
        en: "Error: Missing required parameters for command '{command}': {missing}. Required: {required}. Please provide values for these.",
        ru: "Ошибка: Отсутствуют обязательные параметры для команды '{command}': {missing}. Обязательно: {required}. Пожалуйста, предоставьте значения для этих параметров.",
        uk: "Помилка: Відсутні обов'язкові параметри для команди '{command}': {missing}. Обов'язково: {required}. Будь ласка, надайте значення для цих параметрів.",
      },
      userNotFound: {
        en: "Error: Could not find the user specified: {user}. Please provide a valid user mention, ID, or username.",
        ru: "Ошибка: Не удалось найти указанного пользователя: {user}. Пожалуйста, предоставьте допустимый упоминание пользователя, ID или имя пользователя.",
        uk: "Помилка: Не вдалося знайти вказаного користувача: {user}. Будь ласка, надайте допустимий упоминання користувача, ID або ім'я користувача.",
      },
      missingPermissions: {
        en: "I seem to be missing the required permissions to do that.",
        ru: "Я кажусь, что у меня нет необходимых разрешений для этого.",
        uk: "Я здаюсь, що у мене немає необхідних дозволів для цього.",
      },
      errorGeneric: {
        en: "An error occurred while running the command: {error}",
        ru: "Произошла ошибка при выполнении команды: {error}",
        uk: "Виникла помилка при виконанні команди: {error}",
      },
      successGeneric: {
        en: "Command executed successfully.",
        ru: "Команда выполнена успешно.",
        uk: "Команда виконана успішно.",
      },
    },
    collector: {
      contextClear: {
        success: {
          en: "Conversation context cleared!",
          ru: "Контекст диалога очищен!",
          uk: "Контекст діалогу очищений!",
        },
      },
      modelChange: {
        success: {
          en: "Model changed to `{model}`. This will be used for your next request.",
          ru: "Модель изменена на `{model}`. Это будет использоваться для вашего следующего запроса.",
          uk: "Модель змінена на `{model}`. Це буде використовуватися для вашого наступного запиту.",
        },
      },
    },
    sanitization: {
      // Optional: Keep these internal?
      mention: { en: "(mention)", ru: "(упоминание)", uk: "(упоминання)" },
      everyone: { en: "@ everyone", ru: "@ всех", uk: "@ всіх" },
      here: { en: "@ here", ru: "@ здесь", uk: "@ тут" },
    },
  },
};
// --- End Localization Definitions ---

function validateEnvironment() {
  let isValid = true;
  const missingVars = [];

  if (!process.env.GROQ_API) {
    console.error("⚠️ Missing GROQ_API environment variable");
    missingVars.push("GROQ_API");
    isValid = false;
  }

  if (!isValid) {
    console.error(
      `❌ AI module cannot function without: ${missingVars.join(", ")}`
    );
  } else {
    console.log("✅ AI module environment variables validated");
  }

  return isValid;
}

validateEnvironment();

async function checkAndInitGroqClient(client) {
  const clientPath = CONFIG.groq.clientPath;

  if (!client[clientPath]) {
    console.warn(`⚠️ Groq client not found at client.${clientPath}`);
    console.log("Attempting to initialize Groq client");

    try {
      if (CONFIG.groq.apiKey) {
        client[clientPath] = new Groq({
          apiKey: CONFIG.groq.apiKey,
        });
        console.log("✅ Successfully initialized Groq client");
      } else {
        console.error("❌ Cannot initialize Groq client: missing API key");
      }
    } catch (error) {
      console.error("❌ Failed to initialize Groq client:", error.message);
      console.error("Make sure you have the 'groq-sdk' package installed");
    }
  } else {
    console.log(`✅ Groq client already exists at client.${clientPath}`);
  }

  return !!client[clientPath];
}

// Groq model utilities are now imported from ../services/groqModels.js

// --- Start MessageCreate Handler Localization ---
export default {
  name: Events.MessageCreate,
  localization_strings: localization_strings, // Add the strings object to the export
  async execute(message) {
    if (!message.client._groqChecked) {
      message.client._groqChecked = true;
      await checkAndInitGroqClient(message.client);
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
      const userDbLocale = await Database.getUserLocale(
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
    } catch (dbError) {
      console.error(
        `Error fetching user locale for ${userId}, defaulting to 'en':`,
        dbError
      );
    }
    // Set locale for subsequent i18n calls within this scope if needed
    i18n.setLocale(effectiveLocale);

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
        const availableModels = await getAvailableModels(isVisionRequest);
        console.log(`Found ${availableModels.length} available models`);

        if (availableModels.length === 0) {
          // Use determined locale for the reply
          await message.reply(
            i18n.__(
              "events.ai.messages.noModelsFound",
              { vision: isVisionRequest ? "vision" : "text" },
              effectiveLocale
            )
          );
          return;
        }

        // Pass locale to build components
        const components = await buildInteractionComponents(
          userId,
          availableModels,
          isVisionRequest,
          true,
          effectiveLocale
        );

        console.log("Sending model selection prompt");
        // Use locale for the prompt message
        let promptMsg = await message.reply({
          content: i18n.__(
            "events.ai.messages.selectModelPrompt",
            effectiveLocale
          ),
          components: components,
        });

        state.pendingInteractions[userId] = message;
        console.log(`Stored pending interaction for user ${userId}`);

        const collector = promptMsg.createMessageComponentCollector({
          filter: (i) => i.user.id === userId,
          time: 5 * 60 * 1000,
        });

        console.log(`Created message component collector for user ${userId}`);

        collector.on("collect", async (interaction) => {
          console.log(
            `Initial Collector: Received interaction - Type: ${interaction.componentType}, Custom ID: ${interaction.customId}, User: ${interaction.user.id}`
          );

          const customId = interaction.customId;

          if (
            interaction.isStringSelectMenu() &&
            customId.startsWith("ai_select_model_")
          ) {
            console.log(
              "Initial Collector: Handling StringSelectMenu interaction."
            );
            const selectedModelId = interaction.values[0];
            console.log(
              `Initial Collector: Raw selected value: ${selectedModelId}`
            );

            updateUserPreference(userId, "selectedModel", selectedModelId);
            console.log(
              `Initial Collector: User ${userId} preference updated to model: ${selectedModelId}`
            );

            const originalMessage = state.pendingInteractions[userId];
            if (originalMessage) {
              console.log(
                `Initial Collector: Found pending message ${originalMessage.id}.`
              );
              delete state.pendingInteractions[userId];
              collector.stop("model_selected");
              console.log("Initial Collector: Stopped collector.");

              try {
                await interaction.deferUpdate();
                console.log("Initial Collector: Interaction deferred.");

                // Use locale for the edit message
                await promptMsg.edit({
                  content: i18n.__(
                    "events.ai.messages.modelSelectedProcessing",
                    { model: selectedModelId },
                    effectiveLocale
                  ),
                  components: [],
                });
                console.log(
                  `Initial Collector: Edited prompt message ${promptMsg.id}.`
                );
              } catch (updateError) {
                console.error(
                  "Initial Collector: Error deferring/editing interaction/prompt message: ",
                  updateError
                );
                // Use locale for the fallback message
                await message.channel
                  .send(
                    i18n.__(
                      "events.ai.messages.modelSelectedProcessing",
                      { model: selectedModelId },
                      effectiveLocale
                    )
                  )
                  .catch((e) =>
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
                  content: i18n.__("events.ai.messages.modelSelected", {
                    model: selectedModelId,
                  }),
                  components: [],
                });
              } catch (e) {
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

        collector.on("end", (collected, reason) => {
          console.log(
            `Collector for ${userId} ended with reason: ${reason}, collected ${collected.size} interactions`
          );

          if (
            reason === "time" &&
            state.pendingInteractions[userId] === message
          ) {
            delete state.pendingInteractions[userId];
            if (collected.size === 0) {
              // Use locale for the timeout message
              promptMsg
                .edit({
                  content: i18n.__(
                    "events.ai.messages.selectionTimeout",
                    effectiveLocale
                  ),
                  components: [],
                })
                .catch((e) =>
                  console.error("Failed to edit timeout message:", e)
                );
              console.log(`Pending interaction timed out for user ${userId}`);
            }
          }
        });
      } catch (error) {
        console.error("Error during model selection process:", error);
        // Use locale for the error message
        await message
          .reply(i18n.__("events.ai.messages.selectionError", effectiveLocale))
          .catch((e) => {});
      }

      return; // Stop processing, wait for interaction
    }

    console.log(
      `Processing message from ${message.author.tag} with model ${prefs.selectedModel}`
    );
    // Pass effectiveLocale to processAiRequest
    await processAiRequest(
      message,
      userId,
      messageContent,
      isVisionRequest,
      null,
      effectiveLocale
    );
  },
};
// --- End MessageCreate Handler Localization ---

// User preferences now managed in src/state/prefs.js
// Model capabilities and API client are imported from services/groqModels.js
