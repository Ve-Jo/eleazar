import { SlashCommandSubcommandBuilder } from "discord.js";
import i18n from "../../utils/i18n";

export default {
  data: new SlashCommandSubcommandBuilder()
    .setName("autoplay")
    .setDescription("Toggle autoplay mode")
    .setDescriptionLocalizations({
      ru: "Переключить режим автопроигрывания",
      uk: "Перемикати режим автопрогравання",
    }),
  async execute(interaction) {
    const player = await interaction.client.lavalink.getPlayer(
      interaction.guild.id
    );
    if (!player)
      return interaction.editReply({
        content: i18n.__("music.noMusicPlaying"),
        ephemeral: true,
      });
    if (interaction.member.voice.channelId !== player.voiceChannelId)
      return interaction.editReply({
        content: i18n.__("music.notInVoiceChannel"),
        ephemeral: true,
      });

    let autoplay = player.get("autoplay_enabled");
    if (autoplay === undefined || autoplay === false) {
      player.set("autoplay_enabled", true);

      return interaction.editReply({
        content: i18n.__("music.autoplayToggled", {
          enabled: !autoplay,
        }),
        ephemeral: true,
      });
    } else {
      player.set("autoplay_enabled", false);

      return interaction.editReply({
        content: i18n.__("music.autoplayToggled", {
          enabled: !autoplay,
        }),
        ephemeral: true,
      });
    }
  },
};
