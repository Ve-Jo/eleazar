import { SlashCommandSubcommandBuilder } from "discord.js";
import i18n from "../../utils/i18n.js";

export default {
  data: new SlashCommandSubcommandBuilder()
    .setName("previous")
    .setDescription("Play the previous song")
    .setDescriptionLocalizations({
      ru: "Воспроизвести предыдущую песню",
      uk: "Відтворити попередню пісню",
    }),

  async execute(interaction) {
    const player = await interaction.client.lavalink.getPlayer(
      interaction.guild.id
    );

    if (!player) {
      return interaction.editReply(i18n.__("music.noMusicPlaying"));
    }

    if (interaction.member.voice.channelId !== player.voiceChannelId) {
      return interaction.editReply({
        content: i18n.__("music.notInVoiceChannel"),
        ephemeral: true,
      });
    }

    if (player.queue.previous.length === 0) {
      return interaction.editReply(i18n.__("music.noPreviousSongs"));
    }

    const previousTrack =
      player.queue.previous[player.queue.previous.length - 1];
    await player.queue.add(previousTrack, 0);

    await interaction.editReply(
      i18n.__("music.addedPreviousToQueue", { title: previousTrack.info.title })
    );

    if (!player.playing && !player.paused) {
      await player.play();
    }
  },
};
