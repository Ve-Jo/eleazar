import { Events } from "discord.js";
import Database from "../database/client.js";
import { transcribeAudio } from "../cmds/ai/transcribe_audio.js";

export default {
  name: Events.MessageCreate,
  essential: true,
  async execute(message) {
    if (message.author.bot) return;

    const { guild, channel, author } = message;

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

          if (transcription.length > 2000) {
            const chunks = transcription.match(/.{1,2000}/g);
            for (const chunk of chunks) {
              await message.reply(chunk);
            }
          } else {
            await message.reply(
              `Transcription of voice message:\n\n${transcription.text}\n\n[DEBUG: ${transcription.provider}, ${transcription.language}]`
            );
          }
        } catch (error) {
          console.error("Error transcribing voice message:", error);
          await message.reply(
            "Sorry, I couldn't transcribe that voice message."
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

        const xpPerMessage = guildSettings?.settings?.xp_per_message || 15; // Default XP per message

        // Add XP
        await Database.addXP(guild.id, author.id, xpPerMessage);

        // Update message cooldown
        await Database.updateCooldown(guild.id, author.id, "message");

        // Increment message count in statistics
        await Database.incrementMessageCount(guild.id, author.id);
      }
    } catch (error) {
      console.error("Error handling XP gain:", error);
      // Don't throw the error to prevent the bot from crashing
      // Just log it and continue
    }
  },
};
