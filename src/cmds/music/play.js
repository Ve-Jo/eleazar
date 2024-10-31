import { SlashCommandSubcommandBuilder } from "discord.js";
import i18n from "../../utils/i18n.js";
import { createOrUpdateMusicPlayerEmbed } from "../../utils/musicPlayerEmbed.js";
import { createMusicButtons } from "../../utils/musicButtons.js";

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

    if (
      !interaction.client.lavalink ||
      !interaction.client.lavalink.nodeManager.nodes.size
    ) {
      return interaction.editReply(i18n.__("music.noLavalinkNode"));
    }

    try {
      let player = await interaction.client.lavalink.createPlayer({
        guildId: interaction.guild.id,
        voiceChannelId: interaction.member.voice.channelId,
        textChannelId: interaction.channelId,
      });

      await player.connect();

      interaction.user.locale = interaction.locale;

      let res = await Promise.race([
        player.search({ query: query }, interaction.user),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Search timeout")), 12000)
        ),
      ]);

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
        const maxPlaylistSize = player.options.maxPlaylistSize || 1024;
        const tracksToAdd = res.tracks.slice(0, maxPlaylistSize);
        player.queue.add(tracksToAdd);
        await interaction.editReply(
          i18n.__("music.addedPlaylist", {
            name: res.playlist.name,
            count: tracksToAdd.length,
            total: res.tracks.length,
            max: maxPlaylistSize,
          })
        );
      } else {
        const track = res.tracks[0];
        player.queue.add(track);
        await interaction.editReply(
          i18n.__("music.addedToQueue", { title: track.info.title })
        );
      }

      /*if (player.nowPlayingMessage && player.queue.current) {
        const { embed, attachment } = await createOrUpdateMusicPlayerEmbed(
          player.queue.current,
          player
        );
        const updatedButtons = createMusicButtons(player);

        try {
          await player.nowPlayingMessage.edit({
            embeds: [embed],
            files: [attachment],
            components: [updatedButtons],
          });
        } catch (error) {
          console.error("Error updating player message:", error);
        }
      }*/

      if (!player.playing) await player.play();
    } catch (error) {
      console.error("Error in play command:", error);

      if (
        error.name === "TimeoutError" ||
        error.message.includes("timed out") ||
        error.message === "Search timeout"
      ) {
        return interaction.editReply(i18n.__("music.connectionTimeout"));
      } else if (error.message.includes("No available Node was found")) {
        return interaction.editReply(i18n.__("music.noAvailableNode"));
      } else if (error.message === "No Lavalink Node was provided") {
        return interaction.editReply(i18n.__("music.noLavalinkNode"));
      } else {
        return interaction.editReply(
          i18n.__("music.errorOccurred", { error: error.message })
        );
      }
    }
  },
};
