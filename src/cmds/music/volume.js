import { SlashCommandSubcommandBuilder } from "discord.js";
import i18n from "../../utils/i18n.js";

export default {
  data: new SlashCommandSubcommandBuilder()
    .setName("volume")
    .setDescription("Set the volume of the music")
    .setDescriptionLocalizations({
      ru: "Установить громкость музыки",
      uk: "Встановити гучність музики",
    })
    .addIntegerOption((option) =>
      option
        .setName("number")
        .setDescription("The number of volume to set")
        .setDescriptionLocalizations({
          ru: "Число громкости для установки",
          uk: "Число гучності для встановлення",
        })
        .setRequired(true)
    ),

  async execute(interaction) {
    const volume = interaction.options.getInteger("number");
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

    await player.setVolume(volume, true);
    await interaction.editReply(i18n.__("music.volumeSet", { volume }));
  },
};
