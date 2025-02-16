import { createOrUpdateMusicPlayerEmbed } from "../../utils/musicPlayerEmbed.js";
import { createMusicButtons } from "../../utils/musicButtons.js";

export default {
  name: "playerUpdate",
  async execute(client, player) {
    console.log("PlayerUpdate execute called");

    // Check voice connection status
    if (!player.connected) {
      console.log("Player not connected to voice, attempting to reconnect...");
      try {
        await player.connect();
        console.log("Successfully reconnected to voice channel");
      } catch (error) {
        console.error("Failed to reconnect to voice channel:", error);
      }
    }

    if (!player?.playing || player?.paused) {
      console.log("Player not playing or is paused");
      return;
    }

    try {
      if (!player.options?.textChannelId) {
        console.log("No text channel ID found");
        return;
      }

      // Just use the direct property
      if (!player.nowPlayingMessage) {
        console.log("No now playing message found");
        return;
      }

      if (!player.queue?.current) {
        console.log("No current track in queue");
        return;
      }

      const now = Date.now();
      const lastUpdate = player.lastPlayerUpdate || 0;
      if (now - lastUpdate < 15000) {
        console.log("Update skipped due to rate limiting");
        return;
      }
      player.lastPlayerUpdate = now;

      const channel = await client.channels.cache.get(
        player.options.textChannelId
      );
      if (!channel) {
        console.log("Could not find channel");
        return;
      }

      try {
        player.nowPlayingMessage = await player.nowPlayingMessage.fetch();
      } catch (error) {
        console.log("Could not fetch message, it might have been deleted");
        player.nowPlayingMessage = null;
        return;
      }

      console.log("Creating new embed and buttons");
      const { embed, attachment } = await createOrUpdateMusicPlayerEmbed(
        player.queue.current,
        player
      );

      const updatedButtons = createMusicButtons(player);

      await player.nowPlayingMessage.edit({
        embeds: [embed],
        files: [attachment],
        components: [updatedButtons],
      });
      console.log("Successfully updated player message");
    } catch (error) {
      console.error("Error in playerUpdate:", error);
      player.nowPlayingMessage = null;
    }
  },
};
