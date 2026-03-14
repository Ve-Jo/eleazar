import { Events } from "discord.js";
import hubClient from "../api/hubClient.ts";
import { handleLevelUp } from "../utils/levelUpHandler.ts";

const event = {
  name: Events.VoiceStateUpdate,
  async execute(oldState: any, newState: any): Promise<void> {
    try {
      const { guild, member } = oldState;
      if (!member) return;

      if (member.user.bot) {
        console.log(`[Voice XP] Skipping bot user ${member.user.tag}`);
        return;
      }

      const userId = member.id;
      const guildId = guild.id;

      console.log(
        `[Voice XP] Processing state update for user ${member.user.tag} in guild ${guild.name}`
      );

      await new Promise((resolve) => setTimeout(resolve, 500));

      if (!oldState.channelId && newState.channelId) {
        const channel = newState.channel;
        const nonBotMembers = channel.members.filter((m: any) => !m.user.bot);

        console.log(
          `[Voice XP] User joined channel ${channel.name} with ${nonBotMembers.size} non-bot members`
        );

        if (nonBotMembers.size >= 1) {
          console.log(`[Voice XP] Starting voice session for ${member.user.tag}`);
          await hubClient.createVoiceSession(userId, guildId, newState.channelId);
        } else {
          console.log("[Voice XP] Not enough users in channel for XP tracking");
        }
        return;
      }

      if (oldState.channelId && !newState.channelId) {
        console.log("[Voice XP] User left voice channel completely");
        const session = await hubClient.getVoiceSession(guildId, userId);

        if (session) {
          console.log(
            `[Voice XP] Found active session for ${member.user.tag}, processing XP`
          );
          const sessionDuration = Date.now() - session.joinTime;
          const { timeSpent, xpAmount, levelUp } = await hubClient.calculateVoiceXP(
            guildId,
            userId,
            sessionDuration
          );
          console.log(
            `[Voice XP] Session ended: ${timeSpent / 1000}s, earned ${xpAmount} XP`
          );

          if (levelUp) {
            const channel = oldState.channel;

            if (levelUp.assignedRole) {
              try {
                const botMember = await guild.members.fetchMe();
                if (!botMember.permissions.has("ManageRoles")) {
                  console.warn(
                    `[Voice XP] Bot lacks ManageRoles permission in guild ${guildId} to assign level roles.`
                  );
                } else {
                  const roleToAdd = await guild.roles.fetch(levelUp.assignedRole).catch(() => null);
                  if (roleToAdd) {
                    if (botMember.roles.highest.comparePositionTo(roleToAdd) > 0) {
                      await member.roles.add(roleToAdd, "Voice level up reward");
                      console.log(
                        `[Voice XP] Assigned level role ${roleToAdd.name} (${roleToAdd.id}) to ${member.user.tag}`
                      );

                      if (levelUp.removedRoles && levelUp.removedRoles.length > 0) {
                        for (const roleId of levelUp.removedRoles) {
                          const roleToRemove = await guild.roles.fetch(roleId).catch(() => null);
                          if (
                            roleToRemove &&
                            botMember.roles.highest.comparePositionTo(roleToRemove) > 0
                          ) {
                            await member.roles.remove(
                              roleToRemove,
                              "Replaced by higher level role"
                            );
                            console.log(
                              `[Voice XP] Removed level role ${roleToRemove.name} (${roleToRemove.id}) from ${member.user.tag}`
                            );
                          }
                        }
                      }
                    } else {
                      console.warn(
                        `[Voice XP] Cannot assign role ${roleToAdd.name} (${roleToAdd.id}) to ${member.user.tag} due to role hierarchy.`
                      );
                    }
                  } else {
                    console.warn(
                      `[Voice XP] Level role ID ${levelUp.assignedRole} not found in guild ${guildId}.`
                    );
                  }
                }
              } catch (roleError) {
                console.error(
                  `[Voice XP] Error assigning level roles to ${member.user.tag}:`,
                  roleError
                );
              }
            }

            await handleLevelUp(member.client, guildId, userId, levelUp, "voice", channel);
          }

          await hubClient.removeVoiceSession(guildId, userId);
        } else {
          console.log(`[Voice XP] No active session found for ${member.user.tag}`);
        }
        return;
      }

      if (
        oldState.channelId &&
        newState.channelId &&
        oldState.channelId !== newState.channelId
      ) {
        const oldChannel = oldState.channel;
        const newChannel = newState.channel;
        const session = await hubClient.getVoiceSession(guildId, userId);

        if (session) {
          console.log(
            `[Voice XP] Found active session during channel switch for ${member.user.tag}`
          );
          const sessionDuration = Date.now() - session.joinTime;
          const { timeSpent, xpAmount, levelUp } = await hubClient.calculateVoiceXP(
            guildId,
            userId,
            sessionDuration
          );
          console.log(
            `[Voice XP] Channel switch: ${timeSpent / 1000}s in previous channel, earned ${xpAmount} XP`
          );

          if (levelUp) {
            if (levelUp.assignedRole) {
              try {
                const botMember = await guild.members.fetchMe();
                if (!botMember.permissions.has("ManageRoles")) {
                  console.warn(
                    `[Voice XP] Bot lacks ManageRoles permission in guild ${guildId} to assign level roles.`
                  );
                } else {
                  const roleToAdd = await guild.roles.fetch(levelUp.assignedRole).catch(() => null);
                  if (roleToAdd) {
                    if (botMember.roles.highest.comparePositionTo(roleToAdd) > 0) {
                      await member.roles.add(roleToAdd, "Voice level up reward");
                      console.log(
                        `[Voice XP] Assigned level role ${roleToAdd.name} (${roleToAdd.id}) to ${member.user.tag}`
                      );

                      if (levelUp.removedRoles && levelUp.removedRoles.length > 0) {
                        for (const roleId of levelUp.removedRoles) {
                          const roleToRemove = await guild.roles.fetch(roleId).catch(() => null);
                          if (
                            roleToRemove &&
                            botMember.roles.highest.comparePositionTo(roleToRemove) > 0
                          ) {
                            await member.roles.remove(
                              roleToRemove,
                              "Replaced by higher level role"
                            );
                            console.log(
                              `[Voice XP] Removed level role ${roleToRemove.name} (${roleToRemove.id}) from ${member.user.tag}`
                            );
                          }
                        }
                      }
                    } else {
                      console.warn(
                        `[Voice XP] Cannot assign role ${roleToAdd.name} (${roleToAdd.id}) to ${member.user.tag} due to role hierarchy.`
                      );
                    }
                  } else {
                    console.warn(
                      `[Voice XP] Level role ID ${levelUp.assignedRole} not found in guild ${guildId}.`
                    );
                  }
                }
              } catch (roleError) {
                console.error(
                  `[Voice XP] Error assigning level roles to ${member.user.tag}:`,
                  roleError
                );
              }
            }

            await handleLevelUp(member.client, guildId, userId, levelUp, "voice", oldChannel);
          }

          await hubClient.removeVoiceSession(guildId, userId);
        }

        const nonBotMembers = newChannel.members.filter((m: any) => !m.user.bot);
        if (nonBotMembers.size >= 1) {
          console.log(`[Voice XP] Starting new session in channel ${newChannel.name}`);
          await hubClient.createVoiceSession(userId, guildId, newState.channelId);
        } else {
          console.log("[Voice XP] Not enough users in new channel for XP tracking");
        }
      }
    } catch (error) {
      console.error("[Voice XP] Error in voice state update handler:", error);
    }
  },
};

export default event;
