import { Events } from "discord.js";
import hubClient from "../api/hubClient.js";
import { handleLevelUp } from "../utils/levelUpHandler.js";

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
        `[Voice XP] Processing state update for user ${member.user.tag} in guild ${guild.name}`,
      );

      // Small delay to ensure bot's voice state is stable
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Handle user joining a voice channel
      if (!oldState.channelId && newState.channelId) {
        const channel = newState.channel;
        const nonBotMembers = channel.members.filter((m) => !m.user.bot);

        console.log(
          `[Voice XP] User joined channel ${channel.name} with ${nonBotMembers.size} non-bot members`,
        );

        if (nonBotMembers.size >= 1) {
          console.log(
            `[Voice XP] Starting voice session for ${member.user.tag}`,
          );
          await hubClient.createVoiceSession(
            userId,
            guildId,
            newState.channelId,
          );
        } else {
          console.log(`[Voice XP] Not enough users in channel for XP tracking`);
        }
        return;
      }

      // Handle user leaving voice channel completely
      if (oldState.channelId && !newState.channelId) {
        console.log(`[Voice XP] User left voice channel completely`);
        const session = await hubClient.getVoiceSession(guildId, userId);

        if (session) {
          console.log(
            `[Voice XP] Found active session for ${member.user.tag}, processing XP`,
          );
          const sessionDuration = Date.now() - session.joinTime;
          const { timeSpent, xpAmount, levelUp } =
            await hubClient.calculateVoiceXP(guildId, userId, sessionDuration);
          console.log(
            `[Voice XP] Session ended: ${
              timeSpent / 1000
            }s, earned ${xpAmount} XP`,
          );

          // Handle level-up notification if user leveled up
          if (levelUp) {
            const channel = oldState.channel;

            // Handle level roles if applicable
            if (levelUp.assignedRole) {
              try {
                // Check bot permissions
                const botMember = await guild.members.fetchMe();
                if (!botMember.permissions.has("ManageRoles")) {
                  console.warn(
                    `[Voice XP] Bot lacks ManageRoles permission in guild ${guildId} to assign level roles.`,
                  );
                } else {
                  // Add the new role
                  const roleToAdd = await guild.roles
                    .fetch(levelUp.assignedRole)
                    .catch(() => null);
                  if (roleToAdd) {
                    if (
                      botMember.roles.highest.comparePositionTo(roleToAdd) > 0
                    ) {
                      // Check hierarchy
                      await member.roles.add(
                        roleToAdd,
                        "Voice level up reward",
                      );
                      console.log(
                        `[Voice XP] Assigned level role ${roleToAdd.name} (${roleToAdd.id}) to ${member.user.tag}`,
                      );

                      // Remove any lower level roles if specified
                      if (
                        levelUp.removedRoles &&
                        levelUp.removedRoles.length > 0
                      ) {
                        for (const roleId of levelUp.removedRoles) {
                          const roleToRemove = await guild.roles
                            .fetch(roleId)
                            .catch(() => null);
                          if (
                            roleToRemove &&
                            botMember.roles.highest.comparePositionTo(
                              roleToRemove,
                            ) > 0
                          ) {
                            await member.roles.remove(
                              roleToRemove,
                              "Replaced by higher level role",
                            );
                            console.log(
                              `[Voice XP] Removed level role ${roleToRemove.name} (${roleToRemove.id}) from ${member.user.tag}`,
                            );
                          }
                        }
                      }
                    } else {
                      console.warn(
                        `[Voice XP] Cannot assign role ${roleToAdd.name} (${roleToAdd.id}) to ${member.user.tag} due to role hierarchy.`,
                      );
                    }
                  } else {
                    console.warn(
                      `[Voice XP] Level role ID ${levelUp.assignedRole} not found in guild ${guildId}.`,
                    );
                  }
                }
              } catch (roleError) {
                console.error(
                  `[Voice XP] Error assigning level roles to ${member.user.tag}:`,
                  roleError,
                );
              }
            }

            await handleLevelUp(
              member.client,
              guildId,
              userId,
              levelUp,
              "voice",
              channel,
            );
          }

          await hubClient.removeVoiceSession(guildId, userId);
        } else {
          console.log(
            `[Voice XP] No active session found for ${member.user.tag}`,
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
        const session = await hubClient.getVoiceSession(guildId, userId);

        // Process XP for the old channel if there was an active session
        if (session) {
          console.log(
            `[Voice XP] Found active session during channel switch for ${member.user.tag}`,
          );
          const sessionDuration = Date.now() - session.joinTime;
          const { timeSpent, xpAmount, levelUp } =
            await hubClient.calculateVoiceXP(guildId, userId, sessionDuration);
          console.log(
            `[Voice XP] Channel switch: ${
              timeSpent / 1000
            }s in previous channel, earned ${xpAmount} XP`,
          );

          // Handle level-up notification if user leveled up
          if (levelUp) {
            // Handle level roles if applicable
            if (levelUp.assignedRole) {
              try {
                // Check bot permissions
                const botMember = await guild.members.fetchMe();
                if (!botMember.permissions.has("ManageRoles")) {
                  console.warn(
                    `[Voice XP] Bot lacks ManageRoles permission in guild ${guildId} to assign level roles.`,
                  );
                } else {
                  // Add the new role
                  const roleToAdd = await guild.roles
                    .fetch(levelUp.assignedRole)
                    .catch(() => null);
                  if (roleToAdd) {
                    if (
                      botMember.roles.highest.comparePositionTo(roleToAdd) > 0
                    ) {
                      // Check hierarchy
                      await member.roles.add(
                        roleToAdd,
                        "Voice level up reward",
                      );
                      console.log(
                        `[Voice XP] Assigned level role ${roleToAdd.name} (${roleToAdd.id}) to ${member.user.tag}`,
                      );

                      // Remove any lower level roles if specified
                      if (
                        levelUp.removedRoles &&
                        levelUp.removedRoles.length > 0
                      ) {
                        for (const roleId of levelUp.removedRoles) {
                          const roleToRemove = await guild.roles
                            .fetch(roleId)
                            .catch(() => null);
                          if (
                            roleToRemove &&
                            botMember.roles.highest.comparePositionTo(
                              roleToRemove,
                            ) > 0
                          ) {
                            await member.roles.remove(
                              roleToRemove,
                              "Replaced by higher level role",
                            );
                            console.log(
                              `[Voice XP] Removed level role ${roleToRemove.name} (${roleToRemove.id}) from ${member.user.tag}`,
                            );
                          }
                        }
                      }
                    } else {
                      console.warn(
                        `[Voice XP] Cannot assign role ${roleToAdd.name} (${roleToAdd.id}) to ${member.user.tag} due to role hierarchy.`,
                      );
                    }
                  } else {
                    console.warn(
                      `[Voice XP] Level role ID ${levelUp.assignedRole} not found in guild ${guildId}.`,
                    );
                  }
                }
              } catch (roleError) {
                console.error(
                  `[Voice XP] Error assigning level roles to ${member.user.tag}:`,
                  roleError,
                );
              }
            }

            await handleLevelUp(
              member.client,
              guildId,
              userId,
              levelUp,
              "voice",
              oldChannel,
            );
          }

          // Remove the old session before potentially creating a new one
          await hubClient.removeVoiceSession(guildId, userId);
        }

        // Check if new channel has enough users for XP tracking
        const nonBotMembers = newChannel.members.filter((m) => !m.user.bot);
        if (nonBotMembers.size >= 1) {
          console.log(
            `[Voice XP] Starting new session in channel ${newChannel.name}`,
          );
          await hubClient.createVoiceSession(
            userId,
            guildId,
            newState.channelId,
          );
        } else {
          console.log(
            `[Voice XP] Not enough users in new channel for XP tracking`,
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
