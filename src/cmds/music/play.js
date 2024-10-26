import { SlashCommandSubcommandBuilder } from "discord.js";
import i18n from "../../utils/i18n.js";

export default {
  data: new SlashCommandSubcommandBuilder()
    .setName("play")
    .setDescription("Play a song")
    .setDescriptionLocalizations({
      ru: "Воспроизвести песню",
      uk: "Відтворити пісню",
    })
    .addStringOption((option) =>
      option
        .setName("song")
        .setDescription("The song to play (URL or search term)")
        .setDescriptionLocalizations({
          ru: "Песня для воспроизведения (URL или поисковый запрос)",
          uk: "Пісня для відтворення (URL або пошуковий запит)",
        })
        .setRequired(true)
    ),

  async execute(interaction) {
    let query = interaction.options.getString("song");

    let player = await interaction.client.lavalink.createPlayer({
      guildId: interaction.guild.id,
      voiceChannelId: interaction.member.voice.channelId,
      textChannelId: interaction.channelId,
    });

    await player.connect();

    interaction.user.locale = interaction.locale;

    let res = await player.search({ query: query }, interaction.user);

    if (res.loadType === "error") {
      return interaction.editReply(
        i18n.__("music.errorLoadingTrack", {
          message: res.exception?.message,
        })
      );
    }

    if (res.loadType === "empty") {
      return interaction.editReply(i18n.__("music.noMatchesFound"));
    }

    if (res.loadType === "playlist") {
      player.queue.add(res.tracks);
      await interaction.editReply(
        i18n.__("music.addedPlaylist", {
          name: res.playlist.name,
          count: res.tracks.length,
        })
      );
    } else {
      const track = res.tracks[0];
      player.queue.add(track);
      await interaction.editReply(
        i18n.__("music.addedToQueue", { title: track.info.title })
      );
    }

    if (!player.playing) await player.play();
  },
};
