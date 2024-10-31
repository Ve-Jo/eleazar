import { Events } from "discord.js";
import EconomyEZ from "../utils/economy.js";
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
    const countingData = (await EconomyEZ.get(`counting.${guild.id}`))[0];

    console.log(JSON.stringify(countingData, null, 2));

    if (countingData && channel.id === countingData.channel_id) {
      const lastNumber = parseInt(countingData.message);

      const currentNumber = parseInt(message.content);

      if (currentNumber === lastNumber) {
        if (countingData.no_same_user) {
          if (message.author.id === countingData.lastwritter) {
            await message.delete();
            return;
          }
        }

        if (countingData.only_numbers) {
          if (isNaN(message.content)) {
            await message.delete();
            return;
          }
        }

        await EconomyEZ.set(`counting.${guild.id}.message`, currentNumber + 1);

        if (
          countingData.pinoneach > 0 &&
          currentNumber % countingData.pinoneach === 0
        ) {
          if (countingData.pinnedrole !== "0") {
            if (
              countingData.lastpinnedmember !== "0" &&
              !countingData.no_unique_role
            ) {
              console.log(`STILL WORKS`);

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
            await EconomyEZ.set(
              `counting.${guild.id}.lastpinnedmember`,
              message.author.id
            );
          }

          await message.pin();
        }

        await EconomyEZ.set(
          `counting.${guild.id}.lastwritter`,
          message.author.id
        );
      } else {
        await message.delete();
      }
    }

    let config = (await EconomyEZ.get(`economy_config.${guild.id}`))[0];
    if (!config) {
      console.log("No economy config found for this guild");
      await EconomyEZ.ensure(`economy_config.${guild.id}`);
      config = (await EconomyEZ.get(`economy_config.${guild.id}`))[0];
    }
    console.log("Economy config:", config);

    const now = Date.now();
    console.log("Current time:", now);

    // Fetch user data and timestamps in a single operation
    const [userData, timestampsUser] = await Promise.all([
      EconomyEZ.get(`economy.${guild.id}.${author.id}`),
      EconomyEZ.get(`timestamps.${guild.id}.${author.id}`),
    ]);

    console.log("User data:", userData);
    console.log("Last message time:", timestampsUser);

    if (
      !timestampsUser.message ||
      now - timestampsUser.message >= config.xp_per_message_cooldown * 1000
    ) {
      console.log("XP cooldown passed or first message, adding XP");

      const xpToAdd = config.xp_per_message;
      const newXP = (userData.xp || 0) + xpToAdd;
      const newTotalXP = (userData.total_xp || 0) + xpToAdd;
      const currentLevel = userData.level || 1;
      const nextLevelXP = currentLevel * config.level_xp_multiplier;

      let updates = {
        xp: newXP,
        total_xp: newTotalXP,
      };

      if (newXP >= nextLevelXP) {
        console.log("Level up!");
        updates.level = currentLevel + 1;
        updates.xp = 0;
      }

      // Perform all updates in a single operation
      await Promise.all([
        EconomyEZ.batchOperation([
          {
            type: "set",
            path: `economy.${guild.id}.${author.id}`,
            value: updates,
          },
          {
            type: "set",
            path: `timestamps.${guild.id}.${author.id}.message`,
            value: now,
          },
        ]),
      ]);

      console.log("Added XP:", xpToAdd);
      console.log("New XP:", updates.xp);
      console.log("New total XP:", newTotalXP);
      if (updates.level) {
        console.log("New level:", updates.level);
        // You can add level up message here if needed
      }
    } else {
      console.log("XP cooldown not passed, skipping XP addition");
      console.log("now:", now);
      console.log("lastMessageTime:", timestampsUser.message);
      console.log("XP cooldown:", config.xp_per_message_cooldown * 1000);
      console.log(
        "XP cooldown passed:",
        now - timestampsUser.message >= config.xp_per_message_cooldown * 1000
      );
    }
  },
};
