import { createOrUpdateMusicPlayerEmbed } from "../../utils/musicPlayerEmbed.js";
import ms from "ms";

export default {
  name: "playerUpdate",
  async execute(client, player) {
    if (!player.playing || player.paused) return;

    if (player.createdTimestamp < Date.now() - ms("10s")) return;

    try {
      const guild = client.guilds.cache.get(player.guildId);
      const channel = guild?.channels.cache.get(player.textChannelId);
      if (!channel) return;

      const messages = await channel.messages.fetch({ limit: 20 });

      const botMessages = messages.filter(
        (msg) =>
          msg.author.id === client.user.id &&
          msg.embeds.length > 0 &&
          msg.embeds[0].title ===
            `"${player.queue.current.info.title}" ${player.queue.current.info.author}`
      );
      let lastBotMessage = botMessages.first();
      if (!lastBotMessage || !lastBotMessage.embeds[0]) return;

      const updatedEmbed = createOrUpdateMusicPlayerEmbed(
        player.queue.current,
        player,
        lastBotMessage.embeds[0]
      );

      await lastBotMessage.edit({
        embeds: [updatedEmbed],
      });
    } catch (error) {
      console.error("Error updating music player embed:", error);
    }
  },
};
