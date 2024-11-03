import { I18nCommandBuilder } from "../../utils/builders/index.js";
import i18n from "../../utils/i18n.js";
export default {
  data: () => {
    const i18nBuilder = new I18nCommandBuilder("music");
    const command = i18nBuilder.createCommand();
    return command;
  },
  server: false,
  async preExecute(interaction) {
    if (!interaction.member.voice.channel) {
      return interaction.reply({
        content: i18n.__("music.notInVoiceChannel"),
        ephemeral: true,
      });
    }
  },
  async autocomplete(interaction) {
    await filters.autocomplete(interaction);
  },
  localization_strings: {
    name: {
      en: "music",
      ru: "музыка",
      uk: "музика",
    },
    description: {
      en: "Music control command",
      ru: "Команда управления музыкой",
      uk: "Команда керування музикою",
    },
    noMusicPlaying: {
      en: "No music is currently playing",
      ru: "Музыка сейчас не играет",
      uk: "Музика зараз не грає",
    },
    notInVoiceChannel: {
      en: "You are not in a voice channel (or the player is not in the same voice channel)",
      ru: "Вы не в голосовом канале (или плеер не в том же голосовом канале)",
      uk: "Ви не в голосовому каналі (або плеєр не в тому ж голосовому каналі)",
    },
    connectionTimeout: {
      en: "There was a connection timeout to the music node",
      ru: "Произошла ошибка при подключении к музыкальному серверу",
      uk: "Відбулась помилка при підключені к музикальному серверу",
    },
    noAvailableNode: {
      en: "There's no a available node to connect to, please retry again later",
      ru: "На данный момент нет музыкального сервера к которому бот смог бы подключиться, попробуйте позже",
      uk: "На даний момент немає доступного музичного сервера, до якого бот зможе підключитися, спробуйте пізніше",
    },
    errorOccurred: {
      en: "An error occurred while working with the music player: {{error}}",
      ru: "Произошла ошибка в работе музыкального плеера: {{error}}",
      uk: "Відбулась помилка при роботі з музичним плеєром: {{error}}",
    },
    skippingSongError: {
      en: "There was an error while skipping the song",
      ru: "Произошла ошибка при пропуске песни",
      uk: "Відбулась помилка при пропускі пісні",
    },
    player: {
      footerText: {
        en: "Requested by {{author}}",
        ru: "Запрошено {{author}}",
        uk: "Запрошено {{author}}",
      },
    },
  },
};
