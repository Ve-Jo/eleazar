import { SlashCommandBuilder } from "discord.js";

const command = {
  data: (): SlashCommandBuilder => {
    return new SlashCommandBuilder()
      .setName("voice-rooms")
      .setDescription("Manage temporary voice rooms");
  },
  localization_strings: {
    name: {
      ru: "голосовые-комнаты",
      uk: "голосові-кімнати",
    },
    description: {
      ru: "Управление временными голосовыми комнатами",
      uk: "Керування тимчасовими голосовими кімнатами",
    },
    no_perms: {
      en: "You don't have permissions to manage voice rooms",
      ru: "У вас нет прав для управления голосовыми комнатами",
      uk: "У вас немає прав для керування голосовими кімнатами",
    },
  },
};

export default command;
