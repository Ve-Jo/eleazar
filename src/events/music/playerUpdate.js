import { createMusicButtons } from "../../utils/musicButtons.js";
import i18n from "../../utils/i18n.js";
import { createOrUpdateMusicPlayerEmbed } from "../../utils/musicPlayerEmbed.js";

// Define localization strings
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

// Register translations with i18n system
Object.keys(localization_strings).forEach((category) => {
  Object.keys(localization_strings[category]).forEach((component) => {
    i18n.registerLocalizations(
      category,
      component,
      localization_strings[category][component],
      true
    );
  });
});

// Helper function to safely get avatar URL
function getAvatarUrl(user) {
  if (!user) return null;

  try {
    // If avatarURL is a function, call it
    if (typeof user.avatarURL === "function") {
      return user.avatarURL();
    }
    // If it's a string, use it directly
    if (typeof user.avatarURL === "string") {
      return user.avatarURL;
    }
    // Try displayAvatarURL next
    if (typeof user.displayAvatarURL === "function") {
      return user.displayAvatarURL();
    }
    // Last resort - default avatar
    return `https://cdn.discordapp.com/embed/avatars/${Math.floor(
      Math.random() * 5
    )}.png`;
  } catch (error) {
    console.error("Error getting avatar URL:", error);
    return `https://cdn.discordapp.com/embed/avatars/${Math.floor(
      Math.random() * 5
    )}.png`;
  }
}

export default {
  name: "playerUpdate",
  async execute(client, player) {
    try {
      const locale = player?.queue?.current?.requester?.locale || "en";
      i18n.setLocale(locale);

      if (!player || !player.queue?.current) {
        return;
      }

      // Get the message reference from the map instead of player.nowPlayingMessage
      const existingMessage = client.musicMessageMap.get(player.guildId);
      if (!existingMessage) {
        console.log(await i18n.__("music.update.noMessage"));
        return;
      }

      // Check if player is active
      if (!player.playing && !player.paused) {
        return;
      }

      // Debounce update message (don't update more than once every 10 seconds)
      const now = Date.now();
      const lastUpdate = player.get("lastMessageUpdate") || 0;
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

        // Fetch the channel from the existing message
        const channel = existingMessage.channel;
        if (!channel) {
          console.log(await i18n.__("music.update.channelNotFound"));
          client.musicMessageMap.delete(player.guildId); // Clean up map if channel is gone
          player.set("isUpdatingMessage", false);
          return;
        }

        // Fetch the message to ensure it still exists
        let message;
        try {
          message = await channel.messages
            .fetch(existingMessage.id)
            .catch(() => null);
          if (!message) {
            console.log(await i18n.__("music.update.messageNotFound"));
            client.musicMessageMap.delete(player.guildId); // Clean up map
            player.set("isUpdatingMessage", false);
            return;
          }
        } catch (error) {
          console.log(
            (await i18n.__("music.update.messageDeleted")) + ":",
            error.message
          );
          client.musicMessageMap.delete(player.guildId); // Clean up map
          player.set("isUpdatingMessage", false);
          return;
        }

        // Generate the updated message data using the ComponentBuilder function
        const updatedPlayerData = await createOrUpdateMusicPlayerEmbed(
          track,
          player
        );

        // Edit the message with the new component data
        await message.edit(updatedPlayerData).catch(async (error) => {
          console.error(
            (await i18n.__("music.update.updateError")) + ":",
            error
          );
          // If editing fails (e.g., message deleted), remove from map
          if (error.code === 10008) {
            // Unknown Message
            client.musicMessageMap.delete(player.guildId);
          }
        });
      } catch (error) {
        console.error(
          (await i18n.__("music.update.errorInHandler")) + ":",
          error
        );
      } finally {
        player.set("isUpdatingMessage", false);
      }
    } catch (error) {
      console.error((await i18n.__("music.update.errorInEvent")) + ":", error);
    }
  },
};
