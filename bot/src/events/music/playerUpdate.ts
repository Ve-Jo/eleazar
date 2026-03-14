import i18n from "../../utils/i18n.ts";
import { createOrUpdateMusicPlayerEmbed } from "../../utils/musicPlayerEmbed.ts";

const localization_strings = {
  music: {
    update: {
      noMessage: {
        en: "No now playing message found",
        ru: "Сообщение о проигрываемом треке не найдено",
        uk: "Повідомлення про трек, що програється, не знайдено",
      },
      trackInfoMissing: {
        en: "Missing track info, cannot update player message",
        ru: "Отсутствует информация о треке, невозможно обновить сообщение плеера",
        uk: "Відсутня інформація про трек, неможливо оновити повідомлення плеєра",
      },
      channelNotFound: {
        en: "Channel not found, cannot update now playing message",
        ru: "Канал не найден, невозможно обновить сообщение о проигрываемом треке",
        uk: "Канал не знайдено, неможливо оновити повідомлення про трек, що програється",
      },
      messageNotFound: {
        en: "Message not found, cannot update",
        ru: "Сообщение не найдено, невозможно обновить",
        uk: "Повідомлення не знайдено, неможливо оновити",
      },
      messageDeleted: {
        en: "Error fetching message, may be deleted",
        ru: "Ошибка при получении сообщения, возможно оно удалено",
        uk: "Помилка при отриманні повідомлення, можливо воно видалено",
      },
      updateError: {
        en: "Error updating now playing message",
        ru: "Ошибка при обновлении сообщения о проигрываемом треке",
        uk: "Помилка при оновленні повідомлення про трек, що програється",
      },
      errorInHandler: {
        en: "Error in playerUpdate handler",
        ru: "Ошибка в обработчике обновления плеера",
        uk: "Помилка в обробнику оновлення плеєра",
      },
      errorInEvent: {
        en: "Error in playerUpdate event",
        ru: "Ошибка в событии обновления плеера",
        uk: "Помилка в події оновлення плеєра",
      },
    },
  },
};

Object.keys(localization_strings).forEach((category) => {
  Object.keys(localization_strings[category as keyof typeof localization_strings]).forEach(
    (component) => {
      i18n.registerLocalizations(
        category,
        component,
        localization_strings[category as keyof typeof localization_strings][
          component as keyof (typeof localization_strings)[keyof typeof localization_strings]
        ] as Record<string, unknown>,
        true
      );
    }
  );
});

type UserLike = {
  avatarURL?: (() => string) | string;
  displayAvatarURL?: () => string;
};

type MessageLike = {
  id: string;
  channel?: {
    messages: {
      fetch: (id: string) => Promise<MessageLike | null>;
    };
  } | null;
  edit: (payload: unknown) => Promise<unknown>;
};

type TrackLike = {
  info?: Record<string, unknown>;
  requester?: { locale?: string };
};

type PlayerLike = {
  guildId: string;
  queue: {
    current?: TrackLike | null;
  };
  playing?: boolean;
  paused?: boolean;
  get: (key: string) => unknown;
  set: (key: string, value: unknown) => void;
};

type ClientLike = {
  musicMessageMap: Map<string, MessageLike>;
};

function getAvatarUrl(user: UserLike | null | undefined): string | null {
  if (!user) return null;

  try {
    if (typeof user.avatarURL === "function") {
      return user.avatarURL();
    }
    if (typeof user.avatarURL === "string") {
      return user.avatarURL;
    }
    if (typeof user.displayAvatarURL === "function") {
      return user.displayAvatarURL();
    }
    return `https://cdn.discordapp.com/embed/avatars/${Math.floor(Math.random() * 5)}.png`;
  } catch (error) {
    console.error("Error getting avatar URL:", error);
    return `https://cdn.discordapp.com/embed/avatars/${Math.floor(Math.random() * 5)}.png`;
  }
}

void getAvatarUrl;

const event = {
  name: "playerUpdate",
  localization_strings,
  async execute(client: ClientLike, player: PlayerLike): Promise<void> {
    try {
      const locale = player?.queue?.current?.requester?.locale || "en";
      i18n.setLocale(locale);

      if (!player || !player.queue?.current) {
        return;
      }

      const existingMessage = client.musicMessageMap.get(player.guildId);
      if (!existingMessage) {
        console.log(await i18n.__("music.update.noMessage"));
        return;
      }

      if (!player.playing && !player.paused) {
        return;
      }

      const now = Date.now();
      const lastUpdate = (player.get("lastMessageUpdate") as number) || 0;
      if (now - lastUpdate < 10000) {
        return;
      }

      if (player.get("isUpdatingMessage")) {
        return;
      }

      player.set("isUpdatingMessage", true);
      player.set("lastMessageUpdate", now);

      try {
        const track = player.queue.current;

        if (!track?.info) {
          console.log(await i18n.__("music.update.trackInfoMissing"));
          player.set("isUpdatingMessage", false);
          return;
        }

        const channel = existingMessage.channel;
        if (!channel) {
          console.log(await i18n.__("music.update.channelNotFound"));
          client.musicMessageMap.delete(player.guildId);
          player.set("isUpdatingMessage", false);
          return;
        }

        let message: MessageLike | null;
        try {
          message = await channel.messages.fetch(existingMessage.id).catch(() => null);
          if (!message) {
            console.log(await i18n.__("music.update.messageNotFound"));
            client.musicMessageMap.delete(player.guildId);
            player.set("isUpdatingMessage", false);
            return;
          }
        } catch (error) {
          const typedError = error as Error;
          console.log((await i18n.__("music.update.messageDeleted")) + ":", typedError.message);
          client.musicMessageMap.delete(player.guildId);
          player.set("isUpdatingMessage", false);
          return;
        }

        const updatedPlayerData = await createOrUpdateMusicPlayerEmbed(track as any, player as any);

        await message.edit(updatedPlayerData).catch(async (error: any) => {
          console.error((await i18n.__("music.update.updateError")) + ":", error);
          if (error.code === 10008) {
            client.musicMessageMap.delete(player.guildId);
          }
        });
      } catch (error) {
        console.error((await i18n.__("music.update.errorInHandler")) + ":", error);
      } finally {
        player.set("isUpdatingMessage", false);
      }
    } catch (error) {
      console.error((await i18n.__("music.update.errorInEvent")) + ":", error);
    }
  },
};

export default event;
