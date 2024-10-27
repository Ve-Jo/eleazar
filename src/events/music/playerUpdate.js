import { createOrUpdateMusicPlayerEmbed } from "../../utils/musicPlayerEmbed.js";
import { createMusicButtons } from "../../utils/musicButtons.js";
import ms from "ms";

export default {
  name: "playerUpdate",
  lastUpdateTimestamp: 0,
  async execute(client, player) {
    if (!player.playing || player.paused) return;

    const currentTime = Date.now();
    if (this.lastUpdateTimestamp === 0) {
      this.lastUpdateTimestamp = currentTime;
    } else if (currentTime - this.lastUpdateTimestamp < ms("15s")) return;
    this.lastUpdateTimestamp = currentTime;

    try {
      if (!player.options.textChannelId) return;

      const channel = await client.channels.fetch(player.options.textChannelId);
      if (!channel) return;

      const messages = await channel.messages.fetch({ limit: 20 });
      const lastBotMessage = messages.find(
        (msg) =>
          msg.author.id === client.user.id &&
          msg.embeds.length > 0 &&
          msg.embeds[0].image?.url.includes("musicplayer.png")
      );

      const { embed, attachment } = await createOrUpdateMusicPlayerEmbed(
        player.queue.current,
        player
      );

      const updatedButtons = createMusicButtons(player);

      if (lastBotMessage) {
        await lastBotMessage.edit({
          embeds: [embed],
          files: [attachment],
          components: [updatedButtons],
        });
      } else {
        await channel.send({
          embeds: [embed],
          files: [attachment],
          components: [updatedButtons],
        });
      }
    } catch (error) {
      console.error("Error updating music player embed:", error);
    }
  },
};
