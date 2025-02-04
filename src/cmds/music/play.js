import {
  SlashCommandSubcommand,
  SlashCommandOption,
  OptionType,
  I18nCommandBuilder,
} from "../../utils/builders/index.js";

export default {
  data: () => {
    const i18nBuilder = new I18nCommandBuilder("music", "play");

    const subcommand = new SlashCommandSubcommand({
      name: i18nBuilder.getSimpleName(i18nBuilder.translate("name")),
      description: i18nBuilder.translate("description"),
      name_localizations: i18nBuilder.getLocalizations("name"),
      description_localizations: i18nBuilder.getLocalizations("description"),
    });

    // Add song option
    const songOption = new SlashCommandOption({
      type: OptionType.STRING,
      name: "song",
      description: i18nBuilder.translateOption("song", "description"),
      required: true,
      name_localizations: i18nBuilder.getOptionLocalizations("song", "name"),
      description_localizations: i18nBuilder.getOptionLocalizations(
        "song",
        "description"
      ),
    });

    subcommand.addOption(songOption);

    return subcommand;
  },
  async execute(interaction, i18n) {
    await interaction.deferReply();
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
        return interaction.editReply(i18n.__("music.play.noMatchesFound"));
      }

      if (res.loadType === "playlist") {
        const maxPlaylistSize = player.options.maxPlaylistSize || 1024;
        const tracksToAdd = res.tracks.slice(0, maxPlaylistSize);
        player.queue.add(tracksToAdd);
        await interaction.editReply({
          content: i18n.__("music.play.addedPlaylist", {
            name: res.playlist.name,
            count: tracksToAdd.length,
            total: res.tracks.length,
            max: maxPlaylistSize,
          }),
        });
      } else {
        const track = res.tracks[0];
        player.queue.add(track);
        await interaction.editReply({
          content: i18n.__("music.play.addedToQueue", {
            title: track.info.title,
          }),
        });
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
  localization_strings: {
    name: {
      en: "play",
      ru: "играть",
      uk: "грати",
    },
    description: {
      en: "Play a song",
      ru: "Воспроизвести песню",
      uk: "Відтворити пісню",
    },
    options: {
      song: {
        name: {
          en: "song",
          ru: "песня",
          uk: "пісня",
        },
        description: {
          en: "The song to play (URL or search term)",
          ru: "Песня для воспроизведения (URL или поисковый запрос)",
          uk: "Пісня для відтворення (URL або пошуковий запит)",
        },
      },
    },
    noMatchesFound: {
      en: "No matches found",
      ru: "Ничего не найдено",
      uk: "Нічого не знайдено",
    },
    addedToQueue: {
      en: "Added to queue: {{title}}",
      ru: "Добавлена в очередь: {{title}}",
      uk: "Додано в чергу: {{title}}",
    },
    addedPlaylist: {
      en: "Added playlist: {{name}} ({{count}} of {{total}}, max: {{max}})",
      ru: "Добавлена плейлист: {{name}} ({{count}} из {{total}}, max: {{max}})",
      uk: "Додано плейлист: {{name}} ({{count}} з {{total}}, max: {{max}})",
    },
  },
};
