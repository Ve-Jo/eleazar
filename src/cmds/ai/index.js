import { SlashCommandBuilder } from "discord.js";

export default {
  data: () => {
    const command = new SlashCommandBuilder()
      .setName("ai")
      .setDescription("AI-powered features and tools");

    return command;
  },

  localization_strings: {
    name: {
      ru: "ai",
      uk: "ai",
    },
    description: {
      ru: "Функции и инструменты на базе ИИ",
      uk: "Функції та інструменти на базі ШІ",
    },
    help: {
      en: "Use one of the AI subcommands to access different AI features.",
      ru: "Используйте одну из подкоманд ИИ для доступа к различным функциям ИИ.",
      uk: "Використовуйте одну з підкоманд ШІ для доступу до різних функцій ШІ.",
    },
  },

  server: true,
  generate_image: {
    cooldown: 40,
  },
  transcribe_audio: {
    cooldown: 15,
  },
  upscale_image: {
    cooldown: 20,
  },
};
