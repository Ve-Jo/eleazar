import { handleRemoveBanner } from "../cmds/images/setbanner.js";
import { Events } from "discord.js";
import Database from "../database/client.js";

async function updateInteractionStats(
  guildId,
  userId,
  interactionType,
  interactionName
) {
  try {
    const stats = await Database.client.statistics.findUnique({
      where: {
        userId_guildId: { userId, guildId },
      },
      select: { interactionStats: true },
    });

    let interactionStats = stats?.interactionStats || {
      commands: {},
      buttons: {},
      selectMenus: {},
      modals: {},
    };

    if (typeof interactionStats === "string") {
      interactionStats = JSON.parse(interactionStats);
    }

    // Initialize category if it doesn't exist
    if (!interactionStats[interactionType]) {
      interactionStats[interactionType] = {};
    }

    // Increment the count for this specific interaction
    interactionStats[interactionType][interactionName] =
      (interactionStats[interactionType][interactionName] || 0) + 1;

    // Update the statistics
    await Database.client.statistics.upsert({
      where: {
        userId_guildId: { userId, guildId },
      },
      create: {
        user: {
          connectOrCreate: {
            where: {
              guildId_id: { guildId, id: userId },
            },
            create: {
              id: userId,
              guild: {
                connectOrCreate: {
                  where: { id: guildId },
                  create: { id: guildId },
                },
              },
              lastActivity: BigInt(Date.now()),
            },
          },
        },
        interactionStats,
        totalEarned: 0,
        messageCount: 0,
        commandCount: 0,
        voiceTime: 0n,
        lastUpdated: BigInt(Date.now()),
        gameRecords: { 2048: { highScore: 0 }, snake: { highScore: 0 } },
        xpStats: { chat: 0, voice: 0 },
        gameXpStats: { snake: 0, 2048: 0 },
      },
      update: {
        interactionStats,
      },
    });
  } catch (error) {
    console.error("Error updating interaction stats:", error);
  }
}

export default {
  name: Events.InteractionCreate,
  essential: true,
  async execute(interaction) {
    if (!interaction.guild) return;

    const { user, guild } = interaction;

    try {
      // Track different types of interactions
      if (interaction.isChatInputCommand()) {
        await updateInteractionStats(
          guild.id,
          user.id,
          "commands",
          interaction.commandName
        );
        await Database.incrementCommandCount(guild.id, user.id);
      } else if (interaction.isButton()) {
        await updateInteractionStats(
          guild.id,
          user.id,
          "buttons",
          interaction.customId
        );
        if (interaction.customId.startsWith("remove_banner:")) {
          await handleRemoveBanner(interaction);
          return;
        }
      } else if (
        interaction.isStringSelectMenu() ||
        interaction.isChannelSelectMenu() ||
        interaction.isRoleSelectMenu() ||
        interaction.isUserSelectMenu()
      ) {
        await updateInteractionStats(
          guild.id,
          user.id,
          "selectMenus",
          interaction.customId
        );
      } else if (interaction.isModalSubmit()) {
        await updateInteractionStats(
          guild.id,
          user.id,
          "modals",
          interaction.customId
        );
      }
    } catch (error) {
      console.error("Error in interaction create event:", error);
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: "There was an error while executing this interaction!",
          ephemeral: true,
        });
      } else {
        await interaction.reply({
          content: "There was an error while executing this interaction!",
          ephemeral: true,
        });
      }
    }
  },
};
