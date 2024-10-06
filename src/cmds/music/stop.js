import { SlashCommandSubcommandBuilder } from "discord.js";
import i18n from "../../utils/i18n.js";

export default {
  data: new SlashCommandSubcommandBuilder()
    .setName("stop")
    .setDescription("Stop the music")
    .setDescriptionLocalizations({
      ru: "Остановить музыку",
      uk: "Зупинити музику",
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

    await player.destroy(`${interaction.user.username} stopped the music`);
    await interaction.editReply(i18n.__("music.musicStopped"));
  },
};
