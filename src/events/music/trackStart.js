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

    // Clear components from the previous music player message
    if (player.nowPlayingMessage) {
      try {
        await player.nowPlayingMessage.edit({ components: [] });
      } catch (error) {
        console.error(
          "Error clearing components from previous message:",
          error
        );
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

    // Store the new message in the player object
    player.nowPlayingMessage = message;
  },
};
