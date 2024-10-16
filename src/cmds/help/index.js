import { SlashCommandBuilder } from "discord.js";
import commands from "./commands.js";

//this command should send a embed with categories of commands (and also button collector), when user click on category, it should edit current message with new embed (with commands of that category)

export default {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Get help with the bot")
    .setDescriptionLocalizations({
      ru: "Получить помощь с ботом",
      uk: "Отримати допомогу з ботом",
    })
    .addSubcommand(commands.data),
  server: true,
  async execute(interaction) {
    if (interaction.options.data[0].name === "commands") {
      await interaction.deferReply();
      await commands.execute(interaction);
    }
  },
};
