import { SlashCommandBuilder } from "discord.js";
import i18n from "../../utils/i18n.js";
import sfw from "./sfw.js";
import nsfw from "./nsfw.js";

export default {
  data: new SlashCommandBuilder()
    .setName("images")
    .setDescription("Choose an image")
    .setDescriptionLocalizations({
      ru: "Выберите изображение",
      uk: "Виберіть зображення",
    })
    .addSubcommand(sfw.data)
    .addSubcommand(nsfw.data),
  server: true,
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const subcommands = { sfw, nsfw };

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
