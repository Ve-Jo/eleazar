import { SlashCommandBuilder } from "discord.js";
import test from "./test.js";

//this command should send a embed with categories of commands (and also button collector), when user click on category, it should edit current message with new embed (with commands of that category)

export default {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Get help with the bot")
    .setDescriptionLocalizations({
      ru: "Получить помощь с ботом",
      uk: "Отримати допомогу з ботом",
    })
    .addSubcommand(test.data),
  server: true,
  async execute(interaction) {
    if (interaction.options.data[0].name === "test") {
      test.execute(interaction);
    } else {
      const embed = new EmbedBuilder();
    }
  },
};
