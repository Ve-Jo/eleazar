import { createOrUpdateMusicPlayerEmbed } from "../../utils/musicPlayerEmbed.js";
import { createMusicButtons } from "../../utils/musicButtons.js";

export default {
  name: "trackStart",
  async execute(client, player, track) {
    console.log(`Track ${track.info.title} started`);

    let channel = client?.channels?.cache?.get(player.options.textChannelId);
    if (!channel) {
      channel = await client.channels.fetch(player.options.textChannelId);
    }
    if (!channel) return;

    // Find and delete any existing music player messages
    const messages = await channel.messages.fetch({ limit: 20 });
    const existingPlayerMessages = messages.filter(
      (msg) =>
        msg.author.id === client.user.id &&
        msg.embeds.length > 0 &&
        msg.embeds[0].image?.url.includes("musicplayer.png")
    );

    // Delete old player messages
    if (existingPlayerMessages.size > 0) {
      try {
        await channel.bulkDelete(existingPlayerMessages);
      } catch (error) {
        // If bulk delete fails (messages too old), delete individually
        for (const msg of existingPlayerMessages.values()) {
          try {
            await msg.delete();
          } catch (err) {
            console.error("Error deleting message:", err);
          }
        }
      }
    }

    const { embed, attachment } = await createOrUpdateMusicPlayerEmbed(
      track,
      player
    );

    const updatedButtons = createMusicButtons(player);
    const message = await channel.send({
      embeds: [embed],
      files: [attachment],
      components: [updatedButtons],
    });

    // Store the new message reference in the player
    player.nowPlayingMessage = message;
  },
};
