import { Events } from "discord.js";
import Database from "../database/client.js";
import { transcribeAudio } from "../cmds/ai/transcribe_audio.js";
import { handleLevelUp } from "../utils/levelUpHandler.js";
import i18n from "../utils/newI18n.js";

// --- Start Localization Definitions ---
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
// --- End Localization Definitions ---

export default {
  name: Events.MessageCreate,
  localization_strings: localization_strings,
  async execute(message) {
    if (message.author.bot) return;

    const { guild, channel, author } = message;

    // Determine locale for message sender
    let effectiveLocale = "en";
    try {
      const userDbLocale = await Database.getUserLocale(guild?.id, author.id);
      if (userDbLocale && ["en", "ru", "uk"].includes(userDbLocale)) {
        effectiveLocale = userDbLocale;
      } else if (guild?.preferredLocale) {
        const normalizedGuildLocale = guild.preferredLocale
          .split("-")[0]
          .toLowerCase();
        if (["en", "ru", "uk"].includes(normalizedGuildLocale)) {
          effectiveLocale = normalizedGuildLocale;
        }
      }
    } catch (dbError) {
      console.error(
        `Error fetching user locale for ${author.id}, defaulting to 'en':`,
        dbError
      );
    }

    // Handle voice message transcription
    if (message.attachments.size > 0) {
      const audioAttachment = message.attachments.find((att) =>
        att.contentType?.startsWith("audio/")
      );
      if (audioAttachment) {
        try {
          await message.channel.sendTyping();
          const transcription = await transcribeAudio(
            message.client,
            audioAttachment.url
          );

          if (transcription && transcription.text) {
            const transcriptionText = transcription.text;

            if (transcriptionText.length > 2000) {
              const chunks = transcriptionText.match(/.{1,2000}/g);
              for (const chunk of chunks) {
                await message.reply(chunk);
              }
            } else {
              await message.reply(
                i18n.__(
                  "events.message.transcription.success",
                  { text: transcriptionText },
                  effectiveLocale
                )
              );
            }
          } else {
            await message.reply(
              i18n.__("events.message.transcription.failed", effectiveLocale)
            );
          }
        } catch (error) {
          console.error("Error transcribing voice message:", error);
          await message.reply(
            i18n.__("events.message.transcription.failed", effectiveLocale)
          );
        }
      }
    }

    // Handle counting
    const guildSettings = await Database.client.guild.findUnique({
      where: { id: guild.id },
      select: { settings: true },
    });

    if (guildSettings?.settings?.counting) {
      const countingData = guildSettings.settings.counting;

      if (countingData && channel.id === countingData.channel_id) {
        const lastNumber = parseInt(countingData.message);
        const currentNumber = parseInt(message.content);

        if (currentNumber === lastNumber) {
          if (
            countingData.no_same_user &&
            message.author.id === countingData.lastwritter
          ) {
            await message.delete();
            return;
          }

          if (countingData.only_numbers && isNaN(message.content)) {
            await message.delete();
            return;
          }

          // Update counting data
          await Database.client.guild.update({
            where: { id: guild.id },
            data: {
              settings: {
                ...guildSettings.settings,
                counting: {
                  ...countingData,
                  message: currentNumber + 1,
                  lastwritter: message.author.id,
                },
              },
            },
          });

          if (
            countingData.pinoneach > 0 &&
            currentNumber % countingData.pinoneach === 0
          ) {
            if (countingData.pinnedrole !== "0") {
              if (
                countingData.lastpinnedmember !== "0" &&
                !countingData.no_unique_role
              ) {
                const role = guild.roles.cache.get(countingData.pinnedrole);
                let member = guild.members.cache.get(
                  countingData.lastpinnedmember
                );
                if (!member) {
                  member = await guild.members.fetch(
                    countingData.lastpinnedmember
                  );
                }
                await member.roles.remove(role);
              }

              const role = guild.roles.cache.get(countingData.pinnedrole);
              await message.member.roles.add(role);

              // Update lastpinnedmember
              await Database.client.guild.update({
                where: { id: guild.id },
                data: {
                  settings: {
                    ...guildSettings.settings,
                    counting: {
                      ...countingData,
                      lastpinnedmember: message.author.id,
                    },
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

    // Handle XP gain
    try {
      // Check if enough time has passed since last XP gain
      const cooldownTime = await Database.getCooldown(
        guild.id,
        author.id,
        "message"
      );

      if (cooldownTime === 0) {
        // Get guild settings for XP amount
        const guildSettings = await Database.client.guild.findUnique({
          where: { id: guild.id },
          select: { settings: true },
        });

        const xpPerMessage = guildSettings?.settings?.xp_per_message || 15;

        // Get current XP stats
        const stats = await Database.client.statistics.findUnique({
          where: {
            userId_guildId: { userId: author.id, guildId: guild.id },
          },
          select: { xpStats: true },
        });

        let xpStats = stats?.xpStats || {};
        if (typeof xpStats === "string") {
          xpStats = JSON.parse(xpStats);
        }

        // Initialize or update channel XP tracking
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

        // Update XP stats
        xpStats.channels[channel.id].chat += xpPerMessage;
        xpStats.chat = (xpStats.chat || 0) + xpPerMessage;

        // Add XP with specific type for chat messages
        await Database.client.statistics.upsert({
          where: {
            userId_guildId: { userId: author.id, guildId: guild.id },
          },
          create: {
            user: {
              connectOrCreate: {
                where: {
                  guildId_id: { guildId: guild.id, id: author.id },
                },
                create: {
                  id: author.id,
                  guild: {
                    connectOrCreate: {
                      where: { id: guild.id },
                      create: { id: guild.id },
                    },
                  },
                  lastActivity: BigInt(Date.now()),
                },
              },
            },
            xpStats,
            messageCount: 1,
            lastUpdated: Date.now(),
          },
          update: {
            xpStats,
            messageCount: { increment: 1 },
            lastUpdated: Date.now(),
          },
        });

        // Add XP and check for level-up
        const xpResult = await Database.addXP(
          guild.id,
          author.id,
          xpPerMessage,
          "chat"
        );

        // Handle level-up notification if user leveled up
        if (xpResult.levelUp) {
          await handleLevelUp(
            message.client,
            guild.id,
            author.id,
            xpResult.levelUp,
            xpResult.type,
            channel
          );
        }

        await Database.updateCooldown(guild.id, author.id, "message");
        await Database.incrementMessageCount(guild.id, author.id);
      }
    } catch (error) {
      console.error("Error handling XP gain:", error);
    }
  },
};
