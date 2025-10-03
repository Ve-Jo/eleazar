import { SlashCommandBuilder } from "discord.js";

export default {
  data: () => {
    const command = new SlashCommandBuilder()
      .setName("counting")
      .setDescription("Commands for counting");

    return command;
  },

  localization_strings: {
    name: {
      ru: "считалочка",
      uk: "підрахунок",
    },
    description: {
      ru: "Установка и управление каналом для счета",
      uk: "Налаштування і керування каналом для підрахунку",
    },
    no_perms: {
      en: "You don't have permissions to manage channels",
      ru: "У вас нет прав на управление каналами",
      uk: "У вас немає прав на керування каналами",
    },
    no_channel: {
      en: "No counting channel is set up",
      ru: "Канал для счета не настроен",
      uk: "Канал для рахунку не налаштовано",
    },
  },
};
