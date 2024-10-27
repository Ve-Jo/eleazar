import { createOrUpdateMusicPlayerEmbed } from "../../utils/musicPlayerEmbed.js";
import ms from "ms";

export default {
  name: "playerUpdate",
  lastUpdateTimestamp: 0,
  async execute(client, player) {
    if (!player.playing || player.paused) return;

    const currentTime = Date.now();
    if (this.lastUpdateTimestamp === 0) {
      this.lastUpdateTimestamp = currentTime;
      return;
    }
    if (currentTime - this.lastUpdateTimestamp < ms("15s")) return;
    this.lastUpdateTimestamp = currentTime;

    try {
      const guild = client.guilds.cache.get(player.guildId);
      const channel = guild?.channels.cache.get(player.textChannelId);
      if (!channel) return;

      const messages = await channel.messages.fetch({ limit: 20 });

      const botMessages = messages.filter(
        (msg) =>
          msg.author.id === client.user.id &&
          msg.embeds.length > 0 &&
          msg.embeds[0].image?.url.includes("musicplayer.png")
      );
      let lastBotMessage = botMessages.first();
      if (!lastBotMessage || !lastBotMessage.embeds[0]) return;

      const { embed, attachment } = await createOrUpdateMusicPlayerEmbed(
        player.queue.current,
        player,
        lastBotMessage.embeds[0]
      );

      // Only update the message if the embed or attachment has changed
      if (
        JSON.stringify(lastBotMessage.embeds[0]) !== JSON.stringify(embed) ||
        lastBotMessage.attachments.first()?.url !== attachment.attachment
      ) {
        await lastBotMessage.edit({
          embeds: [embed],
          files: [attachment],
        });
      }

      // Update the last update timestamp
    } catch (error) {
      console.error("Error updating music player embed:", error);
    }
  },
};
