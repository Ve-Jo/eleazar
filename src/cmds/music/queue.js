import { SlashCommandSubcommandBuilder } from "discord.js";
import i18n from "../../utils/i18n.js";

export default {
  data: new SlashCommandSubcommandBuilder()
    .setName("queue")
    .setDescription("Show the music queue")
    .setDescriptionLocalizations({
      ru: "Показать очередь музыки",
      uk: "Показати чергу музики",
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

    const current = player.queue.current;
    const nextTrack = player.queue.tracks;

    const queueString = `${i18n.__("music.currentPlaying", {
      title: current.info.title,
    })}\n${i18n.__("music.nextInQueue", {
      tracks: nextTrack.map((t) => t.info.title).join(", "),
    })}`;

    await interaction.editReply(
      `${i18n.__("music.currentQueue")}\n${queueString}`
    );
  },
};
