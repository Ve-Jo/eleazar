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

    const embed = createOrUpdateMusicPlayerEmbed(track, player);

    const updatedButtons = createMusicButtons(player);
    const message = await channel.send({
      embeds: [embed],
      components: [updatedButtons],
    });

    // Store the message ID in the player object for later updates
    player.nowPlayingMessage = message;
  },
};
