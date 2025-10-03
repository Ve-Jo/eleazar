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
import hubClient from "../api/hubClient.js";
import fetch from "node-fetch";
import { Groq } from "groq-sdk";
import CONFIG from "../config/aiConfig.js";
import i18n from "../utils/i18n.js";
import OpenAI from "openai";

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
} from "../ai.js";

import processAiRequest from "../handlers/processAiRequest.js";

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
      reasoning: {
        on: {
          en: "Reasoning: ON",
          ru: "Рассуждение: ВКЛ",
          uk: "Міркування: ВКЛ",
        },
        off: {
          en: "Reasoning: OFF",
          ru: "Рассуждение: ВЫКЛ",
          uk: "Міркування: ВИМК",
        },
        offModel: {
          en: "Reasoning: OFF (Model)",
          ru: "Рассуждение: ВЫКЛ (Модель)",
          uk: "Міркування: ВИМК (Модель)",
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
        visionSupport: {
          en: "Images",
          ru: "Изображения",
          uk: "Зображення",
        },
        reasoningSupport: {
          en: "Reasoning",
          ru: "Рассуждение",
          uk: "Міркування",
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
          ru: "Системный промт",
          uk: "Системне повідомлення",
        },
        systemPromptEnabled: {
          en: "System instructions enabled",
          ru: "Системные инструкции включены",
          uk: "Системні інструкції увімкнено",
        },
        systemPromptDisabled: {
          en: "System instructions disabled",
          ru: "Системные инструкции отключены",
          uk: "Системні інструкції вимкнено",
        },
        tools: {
          en: "AI Tools",
          ru: "Инструменты ИИ",
          uk: "Інструменти ШІ",
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
          ru: "Поиск в интернете",
          uk: "Пошук в інтернеті",
        },
        webSearchEnabled: {
          en: "Web search enabled",
          ru: "Поиск в интернете включен",
          uk: "Пошук в інтернеті увімкнено",
        },
        webSearchDisabled: {
          en: "Web search disabled",
          ru: "Поиск в интернете отключен",
          uk: "Пошук в інтернеті вимкнено",
        },
        reasoning: {
          en: "AI Reasoning",
          ru: "Рассуждение ИИ",
          uk: "Міркування ШІ",
        },
        reasoningOff: {
          en: "Reasoning disabled",
          ru: "Рассуждение отключено",
          uk: "Міркування вимкнено",
        },
      },
      settingsOptions: {
        systemPrompt: {
          en: "Toggle system instructions for AI",
          ru: "Включить/выключить системные инструкции для ИИ",
          uk: "Увімкнути/вимкнути системні інструкції для ШІ",
        },
        tools: {
          en: "Toggle AI tools functionality",
          ru: "Включить/выключить функциональность инструментов ИИ",
          uk: "Увімкнути/вимкнути функціональність інструментів ШІ",
        },
        reasoning: {
          en: "Toggle AI reasoning capabilities",
          ru: "Включить/выключить возможности рассуждения ИИ",
          uk: "Увімкнути/вимкнути можливості міркування ШІ",
        },
        clearContext: {
          en: "Clear conversation history",
          ru: "Очистить историю разговора",
          uk: "Очистити історію розмови",
        },
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
        reasoningSettings: {
          en: "Configure AI reasoning parameters",
          ru: "Настроить параметры рассуждения ИИ",
          uk: "Налаштувати параметри міркування ШІ",
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
    finetune: {
      buttonLabel: {
        en: "Fine-tune Settings",
        ru: "Настройки параметров",
        uk: "Налаштування параметрів",
      },
      selectParameter: {
        en: "Select parameter to adjust",
        ru: "Выберите параметр для настройки",
        uk: "Виберіть параметр для налаштування",
      },
      selectParameterPrompt: {
        en: "Select an AI parameter to adjust:",
        ru: "Выберите параметр ИИ для настройки:",
        uk: "Виберіть параметр ШІ для налаштування:",
      },
      parameterUpdated: {
        en: "{parameter} updated to {value}.",
        ru: "{parameter} изменен на {value}.",
        uk: "{parameter} змінено на {value}.",
      },
      selectionTimeout: {
        en: "Parameter selection timed out.",
        ru: "Время выбора параметра истекло.",
        uk: "Час вибору параметра закінчився.",
      },
      modalTitle: {
        en: "Fine-tune AI Parameters",
        ru: "Настройка параметров ИИ",
        uk: "Налаштування параметрів ШІ",
      },
      modalTitlePage2: {
        en: "Fine-tune AI Parameters (Page 2)",
        ru: "Настройка параметров ИИ (Страница 2)",
        uk: "Налаштування параметрів ШІ (Сторінка 2)",
      },
      processingFirstSet: {
        en: "Processing first set of parameters... Please fill in the remaining parameters.",
        ru: "Обработка первого набора параметров... Пожалуйста, заполните оставшиеся параметры.",
        uk: "Обробка першого набору параметрів... Будь ласка, заповніть решту параметрів.",
      },
      chooseOption: {
        en: "Please choose an option below:",
        ru: "Пожалуйста, выберите опцию ниже:",
        uk: "Будь ласка, виберіть опцію нижче:",
      },
      configureMore: {
        en: "Configure More Parameters",
        ru: "Настроить больше параметров",
        uk: "Налаштувати більше параметрів",
      },
      saveCurrentSettings: {
        en: "Save Current Settings",
        ru: "Сохранить текущие настройки",
        uk: "Зберегти поточні налаштування",
      },
      resetToDefaults: {
        en: "Reset to Defaults",
        ru: "Сбросить на значения по умолчанию",
        uk: "Скинути до значень за замовчуванням",
      },
      allParametersUpdated: {
        en: "All AI parameters updated successfully!",
        ru: "Все параметры ИИ успешно обновлены!",
        uk: "Всі параметри ШІ успішно оновлені!",
      },
      firstSetUpdated: {
        en: "First set of parameters saved successfully!",
        ru: "Первый набор параметров успешно сохранен!",
        uk: "Перший набір параметрів успішно збережено!",
      },
      parametersReset: {
        en: "All AI parameters have been reset to default values!",
        ru: "Все параметры ИИ были сброшены на значения по умолчанию!",
        uk: "Всі параметри ШІ були скинуті до значень за замовчуванням!",
      },
      error: {
        en: "An error occurred while processing your parameters.",
        ru: "Произошла ошибка при обработке ваших параметров.",
        uk: "Виникла помилка під час обробки ваших параметрів.",
      },
      defaultUpdated: {
        en: "First set of parameters updated by default since no further action was taken.",
        ru: "Первый набор параметров обновлен по умолчанию, так как дальнейших действий не было.",
        uk: "Перший набір параметрів оновлено за замовчуванням, оскільки подальших дій не було.",
      },
      parameters: {
        temperature: {
          label: {
            en: "Temperature",
            ru: "Температура",
            uk: "Температура",
          },
          description: {
            en: "Controls randomness: higher values produce more creative results",
            ru: "Контролирует случайность: более высокие значения дают более творческие результаты",
            uk: "Контролює випадковість: вищі значення дають більш творчі результати",
          },
        },
        top_p: {
          label: {
            en: "Top P",
            ru: "Top P",
            uk: "Top P",
          },
          description: {
            en: "Nucleus sampling: considers tokens with top_p probability mass",
            ru: "Выборка ядра: рассматривает токены с вероятностной массой top_p",
            uk: "Вибірка ядра: розглядає токени з імовірнісною масою top_p",
          },
        },
        top_k: {
          label: {
            en: "Top K",
            ru: "Top K",
            uk: "Top K",
          },
          description: {
            en: "Only sample from the K most likely tokens",
            ru: "Выборка только из K наиболее вероятных токенов",
            uk: "Вибірка тільки з K найбільш ймовірних токенів",
          },
        },
        frequency_penalty: {
          label: {
            en: "Frequency Penalty",
            ru: "Штраф частоты",
            uk: "Штраф частоти",
          },
          description: {
            en: "Decreases repetition of frequent tokens",
            ru: "Уменьшает повторение частых токенов",
            uk: "Зменшує повторення частих токенів",
          },
        },
        presence_penalty: {
          label: {
            en: "Presence Penalty",
            ru: "Штраф присутствия",
            uk: "Штраф присутності",
          },
          description: {
            en: "Decreases repetition of used tokens",
            ru: "Уменьшает повторение использованных токенов",
            uk: "Зменшує повторення використаних токенів",
          },
        },
        repetition_penalty: {
          label: {
            en: "Repetition Penalty",
            ru: "Штраф повторения",
            uk: "Штраф повторення",
          },
          description: {
            en: "Higher values prevent repetition",
            ru: "Более высокие значения предотвращают повторение",
            uk: "Вищі значення запобігають повторенню",
          },
        },
        min_p: {
          label: {
            en: "Min P",
            ru: "Min P",
            uk: "Min P",
          },
          description: {
            en: "Only tokens with at least this probability are considered",
            ru: "Рассматриваются только токены с вероятностью не меньше этой",
            uk: "Розглядаються тільки токени з імовірністю не менше цієї",
          },
        },
        top_a: {
          label: {
            en: "Top A",
            ru: "Top A",
            uk: "Top A",
          },
          description: {
            en: "Dynamic nucleus sampling threshold",
            ru: "Динамический порог выборки ядра",
            uk: "Динамічний поріг вибірки ядра",
          },
        },
        max_completion_tokens: {
          label: {
            en: "Max Tokens",
            ru: "Макс. токенов",
            uk: "Макс. токенів",
          },
          description: {
            en: "Maximum number of tokens to generate",
            ru: "Максимальное количество токенов для генерации",
            uk: "Максимальна кількість токенів для генерації",
          },
        },
      },
    },
    reasoning: {
      buttonLabel: {
        en: "Reasoning Settings",
        ru: "Настройки рассуждения",
        uk: "Налаштування міркування",
      },
      selectParameter: {
        en: "Configure reasoning",
        ru: "Настроить рассуждение",
        uk: "Налаштувати міркування",
      },
      settingsUpdated: {
        en: "Reasoning settings updated: Effort={effort}, Max Tokens={maxTokens}, Exclude={exclude}",
        ru: "Настройки рассуждения обновлены: Усилие={effort}, Макс. токенов={maxTokens}, Исключить={exclude}",
        uk: "Налаштування міркування оновлені: Зусилля={effort}, Макс. токенів={maxTokens}, Виключити={exclude}",
      },
      error: {
        en: "An error occurred while updating reasoning settings.",
        ru: "Произошла ошибка при обновлении настроек рассуждения.",
        uk: "Виникла помилка під час оновлення налаштувань міркування.",
      },
      parameters: {
        effort: {
          label: {
            en: "Reasoning Effort",
            ru: "Усилие рассуждения",
            uk: "Зусилля міркування",
          },
          description: {
            en: "Controls how much reasoning the model should do",
            ru: "Контролирует, насколько много рассуждений должна делать модель",
            uk: "Контролює, наскільки багато міркувань повинна робити модель",
          },
        },
        maxTokens: {
          label: {
            en: "Max Reasoning Tokens",
            ru: "Макс. токенов рассуждения",
            uk: "Макс. токенів міркування",
          },
          description: {
            en: "Maximum tokens to use for reasoning",
            ru: "Максимальное количество токенов для рассуждения",
            uk: "Максимальна кількість токенів для міркування",
          },
        },
        exclude: {
          label: {
            en: "Exclude Reasoning",
            ru: "Исключить рассуждение",
            uk: "Виключити міркування",
          },
          description: {
            en: "Whether to exclude reasoning from the response",
            ru: "Исключать ли рассуждение из ответа",
            uk: "Чи виключати міркування з відповіді",
          },
        },
      },
    },
    stream: {
      stop: {
        en: "Stop",
        ru: "Стоп",
        uk: "Стоп",
      },
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

  if (!process.env.OPENROUTER_API_KEY) {
    console.warn(
      "⚠️ Missing OPENROUTER_API_KEY environment variable. OpenRouter models will not be available."
    );
  }

  if (missingVars.length > 0 && !process.env.OPENROUTER_API_KEY) {
    console.error(
      `❌ AI module cannot function without at least one API key: ${missingVars.join(
        ", "
      )} or OPENROUTER_API_KEY`
    );
    isValid = false;
  } else if (missingVars.length > 0) {
    console.log(
      `⚠️ AI module running with missing optional keys: ${missingVars.join(
        ", "
      )}. Some providers may be unavailable.`
    );
  } else {
    console.log("✅ AI module environment variables validated");
  }

  return isValid;
}

validateEnvironment();

// --- Start MessageCreate Handler Localization ---
export default {
  name: Events.MessageCreate,
  localization_strings: localization_strings, // Add the strings object to the export
  async execute(message) {
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
        const client = message.client; // Get client object
        const availableModels = await getAvailableModels(
          client,
          isVisionRequest ? "vision" : null
        );
        console.log(`Found ${availableModels.length} available models`);

        if (availableModels.length === 0) {
          // Use determined locale for the reply
          await message.reply(
            await i18n.__(
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
          content: await i18n.__(
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

            // Immediately defer the update to show loading state
            await interaction.deferUpdate().catch((err) => {
              console.error("Initial Collector: Failed to defer update:", err);
            });
            console.log("Initial Collector: Interaction deferred.");

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
                // Use locale for the edit message - no need to defer again
                await promptMsg
                  .edit({
                    content: await i18n.__(
                      "events.ai.messages.modelSelectedProcessing",
                      { model: selectedModelId },
                      effectiveLocale
                    ),
                    components: [],
                  })
                  .catch((err) => {
                    console.error(
                      "Initial Collector: Failed to update prompt message:",
                      err
                    );
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
                    await i18n.__(
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
                  content: await i18n.__("events.ai.messages.modelSelected", {
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

        collector.on("end", async (collected, reason) => {
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
                  content: await i18n.__(
                    "events.ai.messages.selectionTimeout",
                    effectiveLocale
                  ),
                  components: [],
                })
                .catch(async (e) =>
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
          .reply(
            await i18n.__("events.ai.messages.selectionError", effectiveLocale)
          )
          .catch((e) => {});
      }

      return; // Stop processing, wait for interaction
    }

    // Check if selected model is rate-limited
    if (prefs.selectedModel) {
      if (isModelRateLimited(prefs.selectedModel)) {
        // Get the remaining time from state
        const expireTime = state.modelStatus.rateLimits[prefs.selectedModel];
        const now = Date.now();
        const minutes = Math.ceil((expireTime - now) / 1000 / 60); // in minutes

        await message.reply(
          await i18n.__(
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
