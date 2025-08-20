import { Events, Collection } from "discord.js";
import hubClient from "../api/hubClient.js";
import { I18n } from "../utils/i18n.js";
import { handleLevelUp } from "../utils/levelUpHandler.js";

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

      // Create a fresh i18n instance for this interaction to maintain thread safety
      const commandI18n = new I18n();
      commandI18n.setLocale(locale);

      // Save the determined locale to the database for future use
      // Do this asynchronously, don't wait for it to finish
      hubClient
        .setUserLocale(interaction.guild.id, interaction.user.id, locale)
        .catch((err) => {
          console.error(
            `Failed to save locale for user ${interaction.user.id}:`,
            err
          );
        });

      // If this is a subcommand
      if (subcommandName && command.subcommands?.[subcommandName]) {
        // Execute the subcommand with the i18n instance
        await command.subcommands[subcommandName].execute(
          interaction,
          commandI18n
        );
      }
      // Regular command without subcommands
      else if (command.execute) {
        // Execute the command with the i18n instance
        await command.execute(interaction, commandI18n);
      } else {
        console.error(`Command ${commandName} has no execute method`);
        return interaction.reply({
          content: "This command is not properly configured.",
          ephemeral: true,
        });
      }

      // Update user's last activity - with guild creation if needed
      await hubClient.ensureGuildUser(
        interaction.user.id,
        interaction.guild.id
      );

      // Increment command count
      await hubClient.updateStats(
        interaction.guild.id,
        interaction.user.id,
        "commandCount",
        1
      );

      // Add XP for using a command
      // Get guild settings for XP amount per command
      const guildSettings = await hubClient.getGuild(interaction.guild.id);

      // Default XP per command is 5, can be customized in guild settings
      const xpPerCommand = guildSettings?.settings?.xp_per_command || 5;

      // Add XP and check for level-up
      if (xpPerCommand > 0) {
        const xpResult = await hubClient.addXP(
          interaction.guild.id,
          interaction.user.id,
          xpPerCommand
        );

        // Handle level-up notification if user leveled up
        if (xpResult.levelUp) {
          await handleLevelUp(
            interaction.client,
            interaction.guild.id,
            interaction.user.id,
            xpResult.levelUp,
            xpResult.type,
            interaction.channel
          );
        }
      }
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
