import { createMusicButtons } from "../../utils/musicButtons.js";
import i18n from "../../utils/newI18n.js";

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
      // Set locale based on player's current track requester
      const locale = player?.queue?.current?.requester?.locale || "en";
      i18n.setLocale(locale);

      // Skip if player is not valid or has no current track
      if (!player || !player.queue?.current) {
        return;
      }

      // Skip if no message exists to update
      if (!player.nowPlayingMessage) {
        console.log(i18n.__("music.update.noMessage"));
        return;
      }

      // Skip if player is not playing and not paused (inactive)
      if (!player.playing && !player.paused) {
        return;
      }

      // Debounce update message (don't update more than once every 10 seconds)
      const now = Date.now();
      const lastUpdate = player.get("lastMessageUpdate") || 0;
      if (now - lastUpdate < 10000) {
        // Skip if less than 10 seconds since last update
        return;
      }

      // If we're already updating, don't start another update
      if (player.get("isUpdatingMessage")) {
        return;
      }

      player.set("isUpdatingMessage", true);
      player.set("lastMessageUpdate", now);

      try {
        const track = player.queue.current;

        // Skip update if track info is missing
        if (!track?.info) {
          console.log(i18n.__("music.update.trackInfoMissing"));
          player.set("isUpdatingMessage", false);
          return;
        }

        // Get the message channel
        const channel = await client.channels
          .fetch(player.nowPlayingMessage.channelId)
          .catch(() => null);
        if (!channel) {
          console.log(i18n.__("music.update.channelNotFound"));
          player.set("isUpdatingMessage", false);
          return;
        }

        // Try to fetch the message to verify it exists
        let message;
        try {
          message = await channel.messages
            .fetch(player.nowPlayingMessage.messageId)
            .catch(() => null);
          if (!message) {
            console.log(i18n.__("music.update.messageNotFound"));
            player.nowPlayingMessage = null;
            player.set("isUpdatingMessage", false);
            return;
          }
        } catch (error) {
          console.log(
            i18n.__("music.update.messageDeleted") + ":",
            error.message
          );
          player.nowPlayingMessage = null;
          player.set("isUpdatingMessage", false);
          return;
        }

        // Import necessary modules
        const { createOrUpdateMusicPlayerEmbed } = await import(
          "../../utils/musicPlayerEmbed.js"
        );

        // Create the requester object
        const requester = track.requester || {
          id: client.user.id,
          username: client.user.username,
          displayName: client.user.username,
          avatarURL: client.user.displayAvatarURL(),
        };

        // Get avatar URL safely
        const avatarURL = getAvatarUrl(requester);

        // Use createOrUpdateMusicPlayerEmbed instead of generating the image directly
        const { embed, attachment } = await createOrUpdateMusicPlayerEmbed(
          track,
          player,
          null
        );

        // Create updated buttons
        const updatedButtons = createMusicButtons
          ? createMusicButtons(player)
          : null;

        // Update the message
        await message
          .edit({
            embeds: [embed],
            files: [attachment],
            ...(updatedButtons ? { components: [updatedButtons] } : {}),
          })
          .catch((error) => {
            console.error(i18n.__("music.update.updateError") + ":", error);
            player.nowPlayingMessage = null;
          });
      } catch (error) {
        console.error(i18n.__("music.update.errorInHandler") + ":", error);
      } finally {
        player.set("isUpdatingMessage", false);
      }
    } catch (error) {
      console.error(i18n.__("music.update.errorInEvent") + ":", error);
    }
  },
};
