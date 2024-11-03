import {
  SlashCommandSubcommand,
  I18nCommandBuilder,
} from "../../utils/builders/index.js";
import i18n from "../../utils/i18n.js";

export default {
  data: () => {
    const i18nBuilder = new I18nCommandBuilder("music", "previous");

    const subcommand = new SlashCommandSubcommand({
      name: i18nBuilder.getSimpleName(i18nBuilder.translate("name")),
      description: i18nBuilder.translate("description"),
      name_localizations: i18nBuilder.getLocalizations("name"),
      description_localizations: i18nBuilder.getLocalizations("description"),
    });

    return subcommand;
  },
  async execute(interaction) {
    await interaction.deferReply();
    const player = await interaction.client.lavalink.getPlayer(
      interaction.guild.id
    );

    if (!player) {
      return interaction.editReply({
        content: i18n.__("music.noMusicPlaying"),
      });
    }

    if (interaction.member.voice.channelId !== player.voiceChannelId) {
      return interaction.editReply({
        content: i18n.__("music.notInVoiceChannel"),
        ephemeral: true,
      });
    }

    if (player.queue.previous.length === 0) {
      return interaction.editReply({
        content: i18n.__("music.previous.noPreviousSongs"),
      });
    }

    const previousTrack =
      player.queue.previous[player.queue.previous.length - 1];
    await player.queue.add(previousTrack, 0);

    await interaction.editReply({
      content: i18n.__("music.previous.addedPreviousToQueue", {
        title: previousTrack.info.title,
      }),
    });

    if (!player.playing && !player.paused) {
      await player.play();
    }
  },
  localization_strings: {
    name: {
      en: "previous",
      ru: "предыдущая",
      uk: "попередня",
    },
    description: {
      en: "Play the previous song",
      ru: "Воспроизвести предыдущую песню",
      uk: "Відтворити попередню пісню",
    },
    noPreviousSongs: {
      en: "There are no previous songs in the queue",
      ru: "В очереди нет предыдущих песен",
      uk: "В черзі немає попередніх пісень",
    },
    addedPreviousToQueue: {
      en: "Added previous song to queue: {{title}}",
      ru: "Добавлена предыдущая песня в очередь: {{title}}",
      uk: "Додано попередню пісню в чергу: {{title}}",
    },
  },
};
