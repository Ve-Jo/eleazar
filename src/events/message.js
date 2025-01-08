import { Events } from "discord.js";
import EconomyEZ from "../utils/economy.js";
import { transcribeAudio } from "../cmds/ai/transcribe.js";

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
    const guildData = await EconomyEZ.get(`${guild.id}.${guild.id}.settings`);
    if (guildData && guildData.counting) {
      const countingData = guildData.counting;

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
          await EconomyEZ.set(`${guild.id}.${guild.id}.counting`, {
            ...countingData,
            message: currentNumber + 1,
            lastwritter: message.author.id,
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
              await EconomyEZ.set(`${guild.id}.${guild.id}.counting`, {
                ...countingData,
                lastpinnedmember: message.author.id,
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
    const userData = await EconomyEZ.get(`${guild.id}.${author.id}`);
    const guildSettings = await EconomyEZ.get(
      `${guild.id}.${guild.id}.settings`
    );
    const now = Date.now();

    // Check if enough time has passed since last XP gain
    if (
      !userData?.message ||
      now - userData.message >= guildSettings.message_cooldown * 1000
    ) {
      // Add XP and update message timestamp
      await EconomyEZ.addXP(guild.id, author.id, guildSettings.xp_per_message);

      // Update last message timestamp
      await EconomyEZ.set(`${guild.id}.${author.id}.message`, now);
    }
  },
};
