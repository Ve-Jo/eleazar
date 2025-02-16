import { createOrUpdateMusicPlayerEmbed } from "../../utils/musicPlayerEmbed.js";
import { createMusicButtons } from "../../utils/musicButtons.js";

export default {
  name: "trackStart",
  async execute(client, player, track) {
    try {
      // Ensure voice connection is active
      if (!player.connected) {
        console.log(
          "Voice connection not found in trackStart, attempting to connect..."
        );
        try {
          await player.connect();
          // Wait for connection to stabilize
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch (error) {
          console.error("Failed to establish voice connection:", error);
          return;
        }
      }

      const { embed, attachment } = await createOrUpdateMusicPlayerEmbed(
        track,
        player
      );

      // Delete previous now playing message if it exists
      if (player.nowPlayingMessage) {
        try {
          await player.nowPlayingMessage.delete();
        } catch (error) {
          console.error(
            "Could not delete previous now playing message:",
            error
          );
        }
      }

      // Send new now playing message
      const textChannel = await client.channels
        .fetch(player.textChannelId)
        .catch(() => null);
      if (!textChannel) {
        console.error("Text channel not found");
        return;
      }

      const message = await textChannel.send({
        embeds: [embed],
        files: [attachment],
        components: [createMusicButtons(player)],
      });

      // Store the message reference
      player.nowPlayingMessage = message;

      // Verify message was stored
      console.log("Now playing message stored:", {
        messageId: message.id,
        channelId: message.channelId,
      });
    } catch (error) {
      console.error("Error in trackStart event:", error);
    }
  },
};
