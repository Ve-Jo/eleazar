import { Events, Collection } from "discord.js";
import Database from "../database/client.js";
import i18n from "../utils/newI18n.js";

// Cooldown collection for tracking command usage
const cooldowns = new Collection();

export default {
  name: Events.InteractionCreate,
  async execute(interaction) {
    // Only handle slash commands
    if (!interaction.isChatInputCommand()) return;

    // Log information about the interaction
    console.log(`Received command interaction: ${interaction.commandName}`);

    // Get command information
    const commandName = interaction.commandName;
    const subcommandName = interaction.options.getSubcommand(false);
    const fullCommandName = subcommandName
      ? `${commandName}_${subcommandName}`
      : commandName;

    console.log("FULL COMMAND NAME");
    console.log(fullCommandName);

    try {
      const command = interaction.client.commands.get(commandName);

      if (!command) {
        console.error(`No command matching ${commandName} was found.`);
        return interaction.reply({
          content: "This command is not currently available.",
          ephemeral: true,
        });
      }

      // Handle cooldowns
      let cooldownAmount;
      if (subcommandName && command.subcommands?.[subcommandName]?.cooldown) {
        cooldownAmount = command.subcommands[subcommandName].cooldown;
      } else if (command.cooldown) {
        cooldownAmount = command.cooldown;
      }

      if (cooldownAmount) {
        if (!cooldowns.has(fullCommandName)) {
          cooldowns.set(fullCommandName, new Collection());
        }

        const now = Date.now();
        const timestamps = cooldowns.get(fullCommandName);
        const cooldownMs = cooldownAmount * 1000;

        if (timestamps.has(interaction.user.id)) {
          const expirationTime =
            timestamps.get(interaction.user.id) + cooldownMs;

          if (now < expirationTime) {
            const timeLeft = (expirationTime - now) / 1000;
            return interaction.reply({
              content: `Please wait ${timeLeft.toFixed(
                1
              )} more second(s) before reusing the \`${fullCommandName}\` command.`,
              ephemeral: true,
            });
          }
        }

        timestamps.set(interaction.user.id, now);
        setTimeout(() => timestamps.delete(interaction.user.id), cooldownMs);
      }

      // Set locale based on user or guild preferences
      let locale =
        interaction.locale || interaction.guild?.preferredLocale || "en";

      // Normalize locale (replacing hyphens, ensuring it's a supported locale)
      if (locale.includes("-")) {
        locale = locale.split("-")[0].toLowerCase();
      }

      // If locale is not supported, fall back to en
      if (!["en", "ru", "uk"].includes(locale)) {
        console.log(`Locale ${locale} not supported, falling back to en`);
        locale = "en";
      }

      console.log(
        `Setting locale to ${locale} for user ${interaction.user.tag}`
      );
      i18n.setLocale(locale);

      // Create context-specific i18n for this command
      let commandI18n;

      // If this is a subcommand
      if (subcommandName && command.subcommands?.[subcommandName]) {
        // Get category from command or use command name as category
        const category = command.data?.category || commandName;

        // Create context-aware i18n for the subcommand - without duplicating category
        // Fix: Use just the subcommand name, not category.subcommandName as the path
        console.log(`Creating context for ${category}.${subcommandName}`);

        commandI18n = i18n.createContextI18n("commands", `${category}`, locale);

        console.log(commandI18n);

        // Register any localizations if present - with the correct scope
        if (command.subcommands[subcommandName].localization_strings) {
          i18n.registerLocalizations(
            "commands",
            `${category}`,
            command.subcommands[subcommandName].localization_strings
          );
        }

        // Execute the subcommand
        await command.subcommands[subcommandName].execute(
          interaction,
          commandI18n
        );
      }
      // Regular command without subcommands
      else if (command.execute) {
        // Get category from command or use command name as category
        const category = command.data?.category || commandName;

        // Create context-aware i18n for the command
        commandI18n = i18n.createContextI18n("commands", category, locale);

        // Register any localizations if present
        if (command.localization_strings) {
          i18n.registerLocalizations(
            "commands",
            category,
            command.localization_strings
          );
        }

        // Execute the command
        await command.execute(interaction, commandI18n);
      } else {
        console.error(`Command ${commandName} has no execute method`);
        return interaction.reply({
          content: "This command is not properly configured.",
          ephemeral: true,
        });
      }

      // Update user's last activity - with guild creation if needed
      await Database.ensureGuildUser(interaction.guild.id, interaction.user.id);
    } catch (error) {
      console.error(`Error executing ${commandName}:`, error);

      // Check if we can still respond to the interaction
      if (!interaction.replied && !interaction.deferred) {
        try {
          await interaction.reply({
            content: "There was an error while executing this command!",
            ephemeral: true,
          });
        } catch (replyError) {
          console.error("Failed to send error response:", replyError);
        }
      } else if (interaction.deferred) {
        try {
          await interaction.editReply({
            content: "There was an error while executing this command!",
          });
        } catch (replyError) {
          console.error("Failed to edit reply with error message:", replyError);
        }
      }
    }
  },
};
