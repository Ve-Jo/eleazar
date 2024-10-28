import { createOrUpdateMusicPlayerEmbed } from "../../utils/musicPlayerEmbed.js";
import { createMusicButtons } from "../../utils/musicButtons.js";
import ms from "ms";

export default {
  name: "playerUpdate",
  timestamps: new WeakMap(), // Use WeakMap for player-specific timestamps
  async execute(client, player) {
    if (!player.playing || player.paused) return;

    const currentTime = Date.now();
    const lastUpdate = this.timestamps.get(player) || 0;

    if (currentTime - lastUpdate < ms("15s")) return;
    this.timestamps.set(player, currentTime);

    try {
      if (!player.options.textChannelId) return;

      // Only update if we have a stored message reference
      if (!player.nowPlayingMessage) return;

      try {
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
      } catch (error) {
        // If the message no longer exists or can't be edited, delete the reference
        player.nowPlayingMessage = null;
        console.error("Error updating player message:", error);
      }
    } catch (error) {
      console.error("Error in playerUpdate:", error);
    }
  },
};
