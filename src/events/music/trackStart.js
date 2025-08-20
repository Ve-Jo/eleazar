import { createMusicButtons } from "../../utils/musicButtons.js";
import i18n from "../../utils/i18n.js";
import { createOrUpdateMusicPlayerEmbed } from "../../utils/musicPlayerEmbed.js";
import { AttachmentBuilder } from "discord.js";

// Track the last time we sent a message for each guild
const lastMessageTime = new Map();
const DEBOUNCE_TIME = 5000; // 5 seconds cooldown between messages for the same guild

// This is a completely rewritten version to test if our file edits work
export default {
  name: "trackStart",
  async execute(client, player, track) {
    console.log(
      "=============================================================="
    );
    console.log("EXECUTING FIXED trackStart.js (with debounce)");
    console.log("GUILD ID:", player?.guildId);
    console.log("TRACK TITLE:", track?.info?.title);
    console.log("TEXT CHANNEL ID:", player?.textChannelId);
    console.log(
      "=============================================================="
    );

    if (!player.textChannelId) {
      console.log("No text channel ID provided, cannot send message");
      return;
    }

    // Add debounce to prevent multiple messages for the same track
    const now = Date.now();
    const lastTime = lastMessageTime.get(player.guildId) || 0;
    const timeSinceLastMessage = now - lastTime;

    if (timeSinceLastMessage < DEBOUNCE_TIME) {
      console.log(
        `Debouncing trackStart event - last message was ${timeSinceLastMessage}ms ago`
      );
      return;
    }

    // Update the timestamp for this guild
    lastMessageTime.set(player.guildId, now);

    try {
      // Get the text channel
      console.log("Fetching channel with ID:", player.textChannelId);
      const channel = await client.channels
        .fetch(player.textChannelId)
        .catch((error) => {
          console.error("Error fetching channel:", error.message);
          return null;
        });

      if (!channel) {
        console.error("Channel not found with ID:", player.textChannelId);
        return;
      }

      // Instead of using isText, check if the channel has a send method
      if (typeof channel.send !== "function") {
        console.error(
          "Channel does not support sending messages:",
          channel.type
        );
        return;
      }

      console.log("Channel found, type:", channel.type);

      // Clear previous messages
      let existingMessage = client.musicMessageMap.get(player.guildId);
      if (existingMessage) {
        try {
          console.log("Deleting previous message:", existingMessage.id);
          await existingMessage.delete().catch((error) => {
            console.error("Failed to delete previous message:", error.message);
          });
        } catch (error) {
          console.error(
            "Error handling previous message deletion:",
            error.message
          );
        }
      }

      console.log("Sending simple text message first to test channel...");

      // Send a simple test message to check permissions and connectivity
      const testMessage = await channel
        .send(`Now playing: ${track.info.title || "Unknown track"}`)
        .catch((error) => {
          console.error("Error sending test message:", error.message);
          return null;
        });

      if (!testMessage) {
        console.error("Failed to send test message, aborting embed creation");
        return;
      }

      console.log("Test message sent successfully, ID:", testMessage.id);

      // Try sending actual player
      try {
        console.log("Generating player embed data...");
        const playerEmbedData = await createOrUpdateMusicPlayerEmbed(
          track,
          player
        );
        console.log("Player embed data generated successfully");

        // Inspect the playerEmbedData
        console.log(
          "playerEmbedData.components:",
          playerEmbedData.components ? "present" : "missing"
        );
        console.log(
          "playerEmbedData.files:",
          playerEmbedData.files
            ? `${playerEmbedData.files.length} files`
            : "missing"
        );

        // Fix attachment issues if needed
        if (playerEmbedData.files && playerEmbedData.files.length > 0) {
          console.log("Checking attachment validity...");

          let fixedFiles = [];
          for (let i = 0; i < playerEmbedData.files.length; i++) {
            const file = playerEmbedData.files[i];
            console.log(
              `File ${i}: type=${typeof file}, isAttachmentBuilder=${
                file instanceof AttachmentBuilder
              }`
            );

            // If it's already an AttachmentBuilder, use it
            if (file instanceof AttachmentBuilder) {
              fixedFiles.push(file);
              continue;
            }

            // If it's an object with attachment data, convert it
            if (file && file.attachment && file.name) {
              console.log(`Converting file ${i} to AttachmentBuilder`);
              const newAttachment = new AttachmentBuilder(file.attachment, {
                name: file.name,
                description: file.description,
              });
              fixedFiles.push(newAttachment);
            } else {
              console.error(`File ${i} has invalid format:`, file);
            }
          }

          if (fixedFiles.length > 0) {
            console.log(
              `Replaced ${playerEmbedData.files.length} files with ${fixedFiles.length} fixed files`
            );
            playerEmbedData.files = fixedFiles;
          } else {
            console.error(
              "Could not fix attachment files, sending without attachments"
            );
            delete playerEmbedData.files;
          }
        }

        // Delete the test message
        await testMessage.delete().catch((error) => {
          console.error("Error deleting test message:", error.message);
        });

        console.log("Sending actual player message...");
        try {
          const newMessage = await channel.send(playerEmbedData);
          console.log("Player message sent successfully, ID:", newMessage.id);

          // Store the message reference
          client.musicMessageMap.set(player.guildId, newMessage);
          console.log("Message reference stored in musicMessageMap");
        } catch (sendError) {
          console.error("Failed to send player message:", sendError);

          // Fallback: try sending without attachments if that's the issue
          if (sendError.code === "ReqResourceType" && playerEmbedData.files) {
            console.log("Trying fallback: sending without attachments");
            const fallbackData = { ...playerEmbedData };
            delete fallbackData.files;

            const fallbackMessage = await channel
              .send(fallbackData)
              .catch((err) => {
                console.error("Fallback also failed:", err);
                return null;
              });

            if (fallbackMessage) {
              console.log(
                "Fallback message sent successfully",
                fallbackMessage.id
              );
              client.musicMessageMap.set(player.guildId, fallbackMessage);
            }
          }
        }
      } catch (embedError) {
        console.error("Error during embed creation or sending:", embedError);
        // Keep the test message as a fallback if embed sending fails
      }
    } catch (error) {
      console.error("Main error in trackStart:", error);
    }
  },
};
