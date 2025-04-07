export default {
  data: () => {
    const command = new LocalizedCommand({
      category: "counting",
      name: "counting",
      description: "Commands for counting",
      localizationStrings: {
        name: {
          ru: "считалочка",
          uk: "підрахунок",
        },
        description: {
          ru: "Установка и управление каналом для счета",
          uk: "Налаштування і керування каналом для підрахунку",
        },
      },
    });
    return command;
  },
  server: true,
  ai: false,
};
