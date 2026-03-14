import { AttachmentBuilder } from "discord.js";
import { createOrUpdateMusicPlayerEmbed } from "../../utils/musicPlayerEmbed.ts";

const lastMessageTime = new Map<string, number>();
const DEBOUNCE_TIME = 5000;

type TrackInfoLike = {
  title?: string;
};

type TrackLike = {
  info?: TrackInfoLike;
};

type PlayerLike = {
  guildId: string;
  textChannelId?: string | null;
};

type MessageLike = {
  id: string;
  delete: () => Promise<unknown>;
};

type AttachmentLike = {
  attachment?: unknown;
  name?: string;
  description?: string;
};

type PlayerEmbedData = {
  components?: unknown[];
  files?: Array<AttachmentBuilder | AttachmentLike>;
  [key: string]: unknown;
};

type SendableChannelLike = {
  type?: unknown;
  send: (payload: unknown) => Promise<MessageLike>;
};

type ClientLike = {
  channels: {
    fetch: (channelId: string) => Promise<SendableChannelLike | null>;
  };
  musicMessageMap: Map<string, MessageLike>;
};

const event = {
  name: "trackStart",
  async execute(client: ClientLike, player: PlayerLike, track: TrackLike): Promise<void> {
    console.log("==============================================================");
    console.log("EXECUTING FIXED trackStart.js (with debounce)");
    console.log("GUILD ID:", player?.guildId);
    console.log("TRACK TITLE:", track?.info?.title);
    console.log("TEXT CHANNEL ID:", player?.textChannelId);
    console.log("==============================================================");

    if (!player.textChannelId) {
      console.log("No text channel ID provided, cannot send message");
      return;
    }

    const now = Date.now();
    const lastTime = lastMessageTime.get(player.guildId) || 0;
    const timeSinceLastMessage = now - lastTime;

    if (timeSinceLastMessage < DEBOUNCE_TIME) {
      console.log(
        `Debouncing trackStart event - last message was ${timeSinceLastMessage}ms ago`
      );
      return;
    }

    lastMessageTime.set(player.guildId, now);

    try {
      console.log("Fetching channel with ID:", player.textChannelId);
      const channel = await client.channels.fetch(player.textChannelId).catch((error: Error) => {
        console.error("Error fetching channel:", error.message);
        return null;
      });

      if (!channel) {
        console.error("Channel not found with ID:", player.textChannelId);
        return;
      }

      if (typeof channel.send !== "function") {
        console.error("Channel does not support sending messages:", channel.type);
        return;
      }

      console.log("Channel found, type:", channel.type);

      const existingMessage = client.musicMessageMap.get(player.guildId);
      if (existingMessage) {
        try {
          console.log("Deleting previous message:", existingMessage.id);
          await existingMessage.delete().catch((error: Error) => {
            console.error("Failed to delete previous message:", error.message);
          });
        } catch (error: any) {
          console.error("Error handling previous message deletion:", error.message);
        }
      }

      console.log("Sending simple text message first to test channel...");
      const testMessage = await channel
        .send(`Now playing: ${track.info?.title || "Unknown track"}`)
        .catch((error: Error) => {
          console.error("Error sending test message:", error.message);
          return null;
        });

      if (!testMessage) {
        console.error("Failed to send test message, aborting embed creation");
        return;
      }

      console.log("Test message sent successfully, ID:", testMessage.id);

      try {
        console.log("Generating player embed data...");
        const playerEmbedData = (await createOrUpdateMusicPlayerEmbed(
          track as any,
          player as any
        )) as PlayerEmbedData;
        console.log("Player embed data generated successfully");

        console.log(
          "playerEmbedData.components:",
          playerEmbedData.components ? "present" : "missing"
        );
        console.log(
          "playerEmbedData.files:",
          playerEmbedData.files ? `${playerEmbedData.files.length} files` : "missing"
        );

        if (playerEmbedData.files && playerEmbedData.files.length > 0) {
          console.log("Checking attachment validity...");

          const fixedFiles: AttachmentBuilder[] = [];
          for (let i = 0; i < playerEmbedData.files.length; i++) {
            const file = playerEmbedData.files[i];
            console.log(
              `File ${i}: type=${typeof file}, isAttachmentBuilder=${
                file instanceof AttachmentBuilder
              }`
            );

            if (file instanceof AttachmentBuilder) {
              fixedFiles.push(file);
              continue;
            }

            if (file && file.attachment && file.name) {
              console.log(`Converting file ${i} to AttachmentBuilder`);
              const newAttachment = new AttachmentBuilder(file.attachment as any, {
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
            console.error("Could not fix attachment files, sending without attachments");
            delete playerEmbedData.files;
          }
        }

        await testMessage.delete().catch((error: Error) => {
          console.error("Error deleting test message:", error.message);
        });

        console.log("Sending actual player message...");
        try {
          const newMessage = await channel.send(playerEmbedData);
          console.log("Player message sent successfully, ID:", newMessage.id);
          client.musicMessageMap.set(player.guildId, newMessage);
          console.log("Message reference stored in musicMessageMap");
        } catch (sendError: any) {
          console.error("Failed to send player message:", sendError);

          if (sendError.code === "ReqResourceType" && playerEmbedData.files) {
            console.log("Trying fallback: sending without attachments");
            const fallbackData = { ...playerEmbedData };
            delete fallbackData.files;

            const fallbackMessage = await channel.send(fallbackData).catch((err) => {
              console.error("Fallback also failed:", err);
              return null;
            });

            if (fallbackMessage) {
              console.log("Fallback message sent successfully", fallbackMessage.id);
              client.musicMessageMap.set(player.guildId, fallbackMessage);
            }
          }
        }
      } catch (embedError) {
        console.error("Error during embed creation or sending:", embedError);
      }
    } catch (error) {
      console.error("Main error in trackStart:", error);
    }
  },
};

export default event;
