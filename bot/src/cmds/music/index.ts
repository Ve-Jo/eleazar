import { SlashCommandBuilder } from "discord.js";
import filters from "./filters.ts";

type TranslatorLike = {
  __: (key: string) => Promise<string>;
};

type MusicInteractionLike = {
  member: {
    voice: {
      channel?: unknown;
    };
  };
  reply: (payload: { content: string; ephemeral?: boolean }) => Promise<unknown>;
};

type AutocompleteInteractionLike = Parameters<typeof filters.autocomplete>[0];

const command = {
  data: (): SlashCommandBuilder => {
    return new SlashCommandBuilder()
      .setName("music")
      .setDescription("Music control command");
  },

  localization_strings: {
    name: {
      ru: "музыка",
      uk: "музика",
    },
    description: {
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
    autoplay: {
      autoplayApplied: {
        en: "Autoplay state was set to {{enabled}}",
        ru: "Состояние автопроигрывания было установлено на {{enabled}}",
        uk: "Стан автопрогравання було встановлено на {{enabled}}",
      },
    },
    pauseApplied: {
      en: "Music has been paused",
      ru: "Музыка поставлена на паузу",
      uk: "Музика поставлена на паузу",
    },
    pauseResumed: {
      en: "Music has been resumed",
      ru: "Воспроизведение музыки возобновлено",
      uk: "Відтворення музики відновлено",
    },
    loopApplied: {
      en: "Loop mode has been set to {{type}}",
      ru: "Режим повтора установлен на {{type}}",
      uk: "Режим повтору встановлено на {{type}}",
    },
    skipApplied: {
      en: "Skipped to the next track",
      ru: "Переход к следующему треку",
      uk: "Перехід до наступного треку",
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

  async preExecute(interaction: MusicInteractionLike, i18n: TranslatorLike): Promise<void> {
    if (!interaction.member.voice.channel) {
      await interaction.reply({
        content: await i18n.__("commands.music.notInVoiceChannel"),
        ephemeral: true,
      });
    }
  },

  async autocomplete(interaction: AutocompleteInteractionLike): Promise<void> {
    await filters.autocomplete(interaction);
  },
};

export default command;
