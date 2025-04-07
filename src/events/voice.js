import { Events } from "discord.js";
import Database from "../database/client.js";

export default {
  name: Events.VoiceStateUpdate,
  async execute(oldState, newState) {
    try {
      const { guild, member } = oldState;
      if (!member) return;

      // If it's the bot, skip XP tracking completely
      if (member.user.bot) {
        console.log(`[Voice XP] Skipping bot user ${member.user.tag}`);
        return;
      }

      const now = Date.now();
      const userId = member.id;
      const guildId = guild.id;

      console.log(
        `[Voice XP] Processing state update for user ${member.user.tag} in guild ${guild.name}`
      );

      // Small delay to ensure bot's voice state is stable
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Handle user joining a voice channel
      if (!oldState.channelId && newState.channelId) {
        const channel = newState.channel;
        const nonBotMembers = channel.members.filter((m) => !m.user.bot);

        console.log(
          `[Voice XP] User joined channel ${channel.name} with ${nonBotMembers.size} non-bot members`
        );

        if (nonBotMembers.size >= 1) {
          console.log(
            `[Voice XP] Starting voice session for ${member.user.tag}`
          );
          await Database.createVoiceSession(
            guildId,
            userId,
            newState.channelId,
            now
          );
        } else {
          console.log(`[Voice XP] Not enough users in channel for XP tracking`);
        }
        return;
      }

      // Handle user leaving voice channel completely
      if (oldState.channelId && !newState.channelId) {
        console.log(`[Voice XP] User left voice channel completely`);
        const session = await Database.getVoiceSession(guildId, userId);

        if (session) {
          console.log(
            `[Voice XP] Found active session for ${member.user.tag}, processing XP`
          );
          const { timeSpent, xpAmount } = await Database.calculateAndAddVoiceXP(
            guildId,
            userId,
            session
          );
          console.log(
            `[Voice XP] Session ended: ${
              timeSpent / 1000
            }s, earned ${xpAmount} XP`
          );
          await Database.removeVoiceSession(guildId, userId);
        } else {
          console.log(
            `[Voice XP] No active session found for ${member.user.tag}`
          );
        }
        return;
      }

      // Handle channel switching
      if (
        oldState.channelId &&
        newState.channelId &&
        oldState.channelId !== newState.channelId
      ) {
        const oldChannel = oldState.channel;
        const newChannel = newState.channel;
        const session = await Database.getVoiceSession(guildId, userId);

        // Process XP for the old channel if there was an active session
        if (session) {
          console.log(
            `[Voice XP] Found active session during channel switch for ${member.user.tag}`
          );
          const { timeSpent, xpAmount } = await Database.calculateAndAddVoiceXP(
            guildId,
            userId,
            session
          );
          console.log(
            `[Voice XP] Channel switch: ${
              timeSpent / 1000
            }s in previous channel, earned ${xpAmount} XP`
          );
          // Remove the old session before potentially creating a new one
          await Database.removeVoiceSession(guildId, userId);
        }

        // Check if new channel has enough users for XP tracking
        const nonBotMembers = newChannel.members.filter((m) => !m.user.bot);
        if (nonBotMembers.size >= 1) {
          console.log(
            `[Voice XP] Starting new session in channel ${newChannel.name}`
          );
          await Database.createVoiceSession(
            guildId,
            userId,
            newState.channelId,
            now
          );
        } else {
          console.log(
            `[Voice XP] Not enough users in new channel for XP tracking`
          );
        }
      }

      // Handle user updates (mute/deafen) while in same channel
      if (
        oldState.channelId &&
        newState.channelId &&
        oldState.channelId === newState.channelId
      ) {
        // Optional: Add logic here if you want to handle mute/deafen states
      }
    } catch (error) {
      console.error("[Voice XP] Error in voice state update handler:", error);
    }
  },
};
