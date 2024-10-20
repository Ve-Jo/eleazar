import { SlashCommandBuilder } from "discord.js";
import commands from "./commands.js";
import premium from "./premium.js";

//this command should send a embed with categories of commands (and also button collector), when user click on category, it should edit current message with new embed (with commands of that category)

export default {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Get help with the bot")
    .setDescriptionLocalizations({
      ru: "Получить помощь с ботом",
      uk: "Отримати допомогу з ботом",
    })
    .addSubcommand(commands.data)
    .addSubcommand(premium.data),
  commands: {
    execute: commands.execute,
  },
  premium: {
    execute: premium.execute,
  },
  server: true,
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (this[subcommand]) {
      await this[subcommand].execute(interaction);
    } else {
      await interaction.reply({
        content: "Invalid subcommand",
        ephemeral: true,
      });
    }
  },
};
