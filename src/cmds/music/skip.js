import { SlashCommandSubcommandBuilder } from "discord.js";
import i18n from "../../utils/i18n.js";

export default {
  data: new SlashCommandSubcommandBuilder()
    .setName("skip")
    .setDescription("Skip the current song")
    .setDescriptionLocalizations({
      ru: "Пропустить текущую песню",
      uk: "Пропустити поточну пісню",
    }),

  async execute(interaction) {
    const player = await interaction.client.lavalink.getPlayer(
      interaction.guild.id
    );

    if (!player) {
      return interaction.editReply(i18n.__("music.noMusicPlaying"));
    } else {
      if (interaction.member.voice.channelId !== player.voiceChannelId) {
        return interaction.editReply({
          content: i18n.__("music.notInVoiceChannel"),
          ephemeral: true,
        });
      }
    }

    try {
      await player.skip();
    } catch (error) {
      let autoplay = player.get("autoplay_enabled");
      if (autoplay) {
        await player.seek(player.queue.current.info.duration);
        return interaction.editReply(i18n.__("music.skippedSong"));
      }
      return interaction.editReply(i18n.__("music.skippingSongError"));
    }
    await interaction.editReply(i18n.__("music.skippedSong"));
  },
};
