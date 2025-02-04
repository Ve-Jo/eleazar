import {
  SlashCommandSubcommand,
  I18nCommandBuilder,
} from "../../utils/builders/index.js";

export default {
  data: () => {
    const i18nBuilder = new I18nCommandBuilder("music", "queue");

    const subcommand = new SlashCommandSubcommand({
      name: i18nBuilder.getSimpleName(i18nBuilder.translate("name")),
      description: i18nBuilder.translate("description"),
      name_localizations: i18nBuilder.getLocalizations("name"),
      description_localizations: i18nBuilder.getLocalizations("description"),
    });

    return subcommand;
  },
  async execute(interaction, i18n) {
    await interaction.deferReply();
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

    const queueString = `${i18n.__("music.queue.currentPlaying", {
      title: current.info.title,
    })}\n${i18n.__("music.queue.nextInQueue", {
      tracks: nextTrack.map((t) => t.info.title).join(", "),
    })}`;

    await interaction.editReply(
      `${i18n.__("music.queue.currentQueue")}\n${queueString}`
    );
  },
  localization_strings: {
    name: {
      en: "queue",
      ru: "очередь",
      uk: "черга",
    },
    description: {
      en: "Show the music queue",
      ru: "Показать очередь музыки",
      uk: "Показати чергу музики",
    },
    currentPlaying: {
      en: "Currently playing: {{title}}",
      ru: "Текущая песня: {{title}}",
      uk: "Поточна пісня: {{title}}",
    },
    nextInQueue: {
      en: "Next in queue: {{tracks}}",
      ru: "Следующая в очереди: {{tracks}}",
      uk: "Наступна в черзі: {{tracks}}",
    },
    currentQueue: {
      en: "Current queue",
      ru: "Текущая очередь",
      uk: "Поточна черга",
    },
  },
};
