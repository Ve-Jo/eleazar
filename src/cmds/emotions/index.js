import { SlashCommandBuilder } from "discord.js";
import i18n from "../../utils/i18n.js";
import positive from "./positive.js";
import negative from "./negative.js";
import myself from "./myself.js";

export default {
  data: new SlashCommandBuilder()
    .setName("emotions")
    .setDescription("Select an emotion type and emotion")
    .setDescriptionLocalizations({
      ru: "Выберите тип эмоции и саму эмоцию",
    })
    .addSubcommand(positive.data)
    .addSubcommand(negative.data)
    .addSubcommand(myself.data),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const subcommands = { positive, negative, myself };

    if (subcommands[subcommand]) {
      await subcommands[subcommand].execute(interaction);
    } else {
      await interaction.reply({
        content: i18n.__("invalidSubcommand"),
        ephemeral: true,
      });
    }
  },
};
