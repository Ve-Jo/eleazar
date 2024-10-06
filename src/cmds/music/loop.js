import { SlashCommandSubcommandBuilder } from "discord.js";
import i18n from "../../utils/i18n.js";

export default {
  data: new SlashCommandSubcommandBuilder()
    .setName("loop")
    .setDescription("Loop the current song/queue")
    .setDescriptionLocalizations({
      ru: "Повторить текущую песню/очередь",
      uk: "Зациклити пісню/чергу",
    })
    .addStringOption((option) =>
      option
        .setName("type")
        .setDescription("The type of loop to set")
        .setDescriptionLocalizations({
          ru: "Тип повтора",
          uk: "Тип повтору",
        })
        .setRequired(true)
        .addChoices(
          { name: "Track", value: "track" },
          { name: "Queue", value: "queue" },
          { name: "Off", value: "off" }
        )
    ),

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

    const loopType = interaction.options.getString("type");
    await player.setRepeatMode(loopType);
    await interaction.editReply(
      i18n.__("music.loopApplied", { type: loopType })
    );
  },
};
