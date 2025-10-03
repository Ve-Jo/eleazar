import { SlashCommandBuilder } from "discord.js";

export default {
  data: () => {
    const command = new SlashCommandBuilder()
      .setName("economy")
      .setDescription("Commands for economy");

    return command;
  },

  localization_strings: {
    name: {
      ru: "экономика",
      uk: "економіка",
    },
    description: {
      ru: "Команды для экономики",
      uk: "Команди для економіки",
    },
    imageError: {
      en: "Error generating image",
      ru: "Ошибка при создании изображения",
      uk: "Помилка при створенні зображення",
    },
    userNotFound: {
      en: "User not found",
      ru: "Пользователь не найден",
      uk: "Користувач не знайдений",
    },
    error: {
      en: "An error occurred while processing your request",
      ru: "Произошла ошибка при обработке вашего запроса",
      uk: "Сталася помилка під час обробки вашого запиту",
    },
    notEnoughMoney: {
      en: "You don't have enough money",
      ru: "У вас недостаточно денег",
      uk: "У вас недостатньо грошей",
    },
    invalidAmount: {
      en: "Please enter a valid amount",
      ru: "Пожалуйста, введите правильную сумму",
      uk: "Будь ласка, введіть правильну суму",
    },
    cooldownActive: {
      en: "This command is on cooldown",
      ru: "Эта команда находится на перезарядке",
      uk: "Ця команда на перезарядці",
    },
  },
};
