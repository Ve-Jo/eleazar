import { Events } from "discord.js";
import hubClient from "../api/hubClient.ts";
import { transcribeAudio } from "../cmds/ai/transcribe_audio.ts";
import { handleLevelUp } from "../utils/levelUpHandler.ts";
import i18n from "../utils/i18n.ts";

const localization_strings = {
  transcription: {
    success: {
      en: "Transcription of voice message:\n\n{text}",
      ru: "Расшифровка голосового сообщения:\n\n{text}",
      uk: "Розшифровка голосового повідомлення:\n\n{text}",
    },
    failed: {
      en: "Sorry, I couldn't transcribe that voice message.",
      ru: "К сожалению, я не смог расшифровать это голосовое сообщение.",
      uk: "На жаль, я не зміг розшифрувати це голосове повідомлення.",
    },
  },
};

type AttachmentLike = {
  contentType?: string;
  url: string;
};

type RoleLike = {
  id: string;
  name: string;
};

type MemberLike = {
  roles: {
    cache: {
      has: (id: string) => boolean;
    };
    add: (role: RoleLike, reason?: string) => Promise<unknown>;
    remove: (role: RoleLike | RoleLike[], reason?: string) => Promise<unknown>;
  };
};

type GuildLike = {
  id: string;
  preferredLocale?: string;
  roles: {
    cache: {
      get: (id: string) => RoleLike | undefined;
    };
    fetch: (id: string) => Promise<RoleLike | null>;
  };
  members: {
    cache: {
      get: (id: string) => any;
    };
    fetch: (id: string) => Promise<any>;
    fetchMe: () => Promise<any>;
  };
};

type ChannelLike = {
  id: string;
  name?: string;
  sendTyping: () => Promise<unknown>;
};

type MessageLike = {
  author: {
    id: string;
    tag?: string;
    bot?: boolean;
  };
  guild: GuildLike | null;
  channel: ChannelLike;
  member: MemberLike | null;
  client: unknown;
  attachments: {
    size: number;
    find: (predicate: (attachment: AttachmentLike) => boolean) => AttachmentLike | undefined;
  };
  content: string;
  reply: (payload: unknown) => Promise<unknown>;
  delete: () => Promise<unknown>;
  pin: () => Promise<unknown>;
};

type CountingSettings = {
  channel_id?: string;
  message?: string;
  no_same_user?: boolean;
  lastwritter?: string;
  only_numbers?: boolean;
  pinoneach?: number;
  pinnedrole?: string;
  lastpinnedmember?: string;
  no_unique_role?: boolean;
};

type GuildSettingsLike = {
  settings?: {
    counting?: CountingSettings;
    xp_per_message?: number;
    [key: string]: unknown;
  };
};

type XpStatsLike = {
  channels?: Record<
    string,
    {
      name?: string;
      chat: number;
      voice: number;
    }
  >;
  chat?: number;
  [key: string]: unknown;
};

type StatisticsLike = {
  xpStats?: XpStatsLike | string;
};

type XpResultLike = {
  levelUp?: unknown;
  assignedRole?: string;
  removedRoles?: string[];
  type?: string;
};

const event = {
  name: Events.MessageCreate,
  localization_strings,
  async execute(message: MessageLike): Promise<void> {
    if (message.author.bot) return;

    const { guild, channel, author } = message;
    if (!guild) {
      return;
    }

    let effectiveLocale = "en";
    try {
      if (guild?.id) {
        const userDbLocale = await hubClient.getUserLocale(guild.id, author.id);
        if (userDbLocale && ["en", "ru", "uk"].includes(userDbLocale)) {
          effectiveLocale = userDbLocale;
        }
      }

      if (effectiveLocale === "en" && guild?.preferredLocale) {
        const normalizedGuildLocale = (guild.preferredLocale.split("-")[0] || "en").toLowerCase();
        if (["en", "ru", "uk"].includes(normalizedGuildLocale)) {
          effectiveLocale = normalizedGuildLocale;
        }
      }
    } catch (dbError) {
      console.error(`Error fetching user locale for ${author.id}, defaulting to 'en':`, dbError);
    }

    if (message.attachments.size > 0) {
      const audioAttachment = message.attachments.find((att) =>
        !!att.contentType?.startsWith("audio/")
      );
      if (audioAttachment) {
        try {
          await message.channel.sendTyping();
          const transcription = await transcribeAudio(message.client as any, audioAttachment.url);

          if (transcription && transcription.text) {
            const transcriptionText = transcription.text as string;

            if (transcriptionText.length > 2000) {
              const chunks = transcriptionText.match(/.{1,2000}/g) || [];
              for (const chunk of chunks) {
                await message.reply(chunk);
              }
            } else {
              await message.reply(
                await i18n.__(
                  "events.message.transcription.success",
                  { text: transcriptionText },
                  effectiveLocale
                )
              );
            }
          } else {
            await message.reply(
              await i18n.__("events.message.transcription.failed", effectiveLocale)
            );
          }
        } catch (error) {
          console.error("Error transcribing voice message:", error);
          await message.reply(
            await i18n.__("events.message.transcription.failed", effectiveLocale)
          );
        }
      }
    }

    const guildSettings = (await hubClient.getGuild(guild.id)) as GuildSettingsLike;

    if (guildSettings?.settings?.counting) {
      const countingData = guildSettings.settings.counting;

      if (countingData && channel.id === countingData.channel_id) {
        const lastNumber = parseInt(countingData.message || "0");
        const currentNumber = parseInt(message.content);

        if (currentNumber === lastNumber) {
          if (countingData.no_same_user && message.author.id === countingData.lastwritter) {
            await message.delete();
            return;
          }

          if (countingData.only_numbers && isNaN(Number(message.content))) {
            await message.delete();
            return;
          }

          await hubClient.updateGuild(guild.id, {
            settings: {
              ...guildSettings.settings,
              counting: {
                ...countingData,
                message: currentNumber + 1,
                lastwritter: message.author.id,
              },
            },
          });

          if (
            (countingData.pinoneach || 0) > 0 &&
            currentNumber % (countingData.pinoneach || 1) === 0
          ) {
            if (countingData.pinnedrole !== "0") {
              if (countingData.lastpinnedmember !== "0" && !countingData.no_unique_role) {
                const role = guild.roles.cache.get(countingData.pinnedrole || "");
                let previousMember = guild.members.cache.get(countingData.lastpinnedmember || "");
                if (!previousMember && countingData.lastpinnedmember) {
                  previousMember = await guild.members.fetch(countingData.lastpinnedmember);
                }
                if (role && previousMember) {
                  await previousMember.roles.remove(role);
                }
              }

              const role = guild.roles.cache.get(countingData.pinnedrole || "");
              if (role && message.member) {
                await message.member.roles.add(role);
              }

              await hubClient.updateGuild(guild.id, {
                settings: {
                  ...guildSettings.settings,
                  counting: {
                    ...countingData,
                    lastpinnedmember: message.author.id,
                  },
                },
              });
            }

            await message.pin();
          }
        } else {
          await message.delete();
        }
      }
    }

    try {
      const cooldownTime = await hubClient.getCooldown(author.id, guild.id, "message");

      if (cooldownTime === 0) {
        const xpPerMessage = guildSettings?.settings?.xp_per_message || 15;

        const stats = (await hubClient.getStatistics(author.id, guild.id)) as StatisticsLike;

        let xpStats: XpStatsLike = (stats?.xpStats || {}) as XpStatsLike;
        if (typeof xpStats === "string") {
          xpStats = JSON.parse(xpStats) as XpStatsLike;
        }

        if (!xpStats.channels) {
          xpStats.channels = {};
        }
        if (!xpStats.channels[channel.id]) {
          xpStats.channels[channel.id] = {
            name: channel.name,
            chat: 0,
            voice: 0,
          };
        }

        const channelStats = xpStats.channels[channel.id];
        if (!channelStats) {
          return;
        }

        channelStats.chat += xpPerMessage;
        xpStats.chat = (xpStats.chat || 0) + xpPerMessage;

        await hubClient.updateStats(author.id, guild.id, "messageCount", 1);

        const xpResult = (await hubClient.addXP(
          author.id,
          guild.id,
          xpPerMessage
        )) as XpResultLike;

        if (xpResult.levelUp && xpResult.assignedRole) {
          try {
            const member = message.member;
            if (!member) {
              console.warn(
                `Could not find member ${author.id} in guild ${guild.id} for role assignment.`
              );
            } else {
              const botMember = await guild.members.fetchMe();
              if (!botMember.permissions.has("ManageRoles")) {
                console.warn(
                  `Bot lacks ManageRoles permission in guild ${guild.id} to assign level roles.`
                );
              } else {
                const roleToAdd = await guild.roles.fetch(xpResult.assignedRole).catch(() => null);
                if (roleToAdd) {
                  if (botMember.roles.highest.comparePositionTo(roleToAdd) > 0) {
                    await member.roles.add(roleToAdd, "Level up reward");
                    console.log(
                      `Assigned level role ${roleToAdd.name} (${roleToAdd.id}) to ${author.tag}`
                    );
                  } else {
                    console.warn(
                      `Cannot assign role ${roleToAdd.name} (${roleToAdd.id}) to ${author.tag} due to role hierarchy.`
                    );
                  }
                } else {
                  console.warn(
                    `Level role ID ${xpResult.assignedRole} not found in guild ${guild.id}.`
                  );
                }

                if (xpResult.removedRoles && xpResult.removedRoles.length > 0) {
                  const rolesToRemove: RoleLike[] = [];
                  for (const roleIdToRemove of xpResult.removedRoles) {
                    if (roleIdToRemove === xpResult.assignedRole) continue;
                    const roleToRemove = await guild.roles.fetch(roleIdToRemove).catch(() => null);
                    if (roleToRemove && member.roles.cache.has(roleToRemove.id)) {
                      if (botMember.roles.highest.comparePositionTo(roleToRemove) > 0) {
                        rolesToRemove.push(roleToRemove);
                      } else {
                        console.warn(
                          `Cannot remove role ${roleToRemove.name} (${roleToRemove.id}) from ${author.tag} due to role hierarchy.`
                        );
                      }
                    }
                  }
                  if (rolesToRemove.length > 0) {
                    await member.roles.remove(rolesToRemove, "Level up role update");
                    console.log(
                      `Removed roles ${rolesToRemove
                        .map((r) => `${r.name} (${r.id})`)
                        .join(", ")} from ${author.tag}`
                    );
                  }
                }
              }
            }
          } catch (roleError) {
            console.error(
              `Error managing level roles for ${author.tag} in guild ${guild.id}:`,
              roleError
            );
          }
        }

        if (xpResult.levelUp) {
          await handleLevelUp(
            message.client as any,
            guild.id,
            author.id,
            xpResult.levelUp,
            xpResult.type || "chat",
            channel as any
          );
        }

        await hubClient.setCooldown(author.id, guild.id, "message", 60000);
      }
    } catch (error) {
      console.error("Error handling XP gain:", error);
    }
  },
};

export default event;
