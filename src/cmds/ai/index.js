import { I18nCommandBuilder } from "../../utils/builders/index.js";

export default {
  data: () => {
    const i18nBuilder = new I18nCommandBuilder("ai");
    const command = i18nBuilder.createCommand();

    return command;
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
  localization_strings: {
    name: {
      en: "ai",
      ru: "ai",
      uk: "ai",
    },
    description: {
      en: "AI commands",
      ru: "Команды AI",
      uk: "Команди AI",
    },
  },
};
