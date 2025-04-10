import { createMusicButtons } from "../../utils/musicButtons.js";
import i18n from "../../utils/newI18n.js";

// Define localization strings
const localization_strings = {
  music: {
    events: {
      trackStart: {
        en: "Started playing",
        ru: "Начал играть",
        uk: "Почав грати",
      },
      channelNotFound: {
        en: "Text channel not found, cannot send now playing message",
        ru: "Текстовый канал не найден, невозможно отправить сообщение о проигрываемом треке",
        uk: "Текстовий канал не знайдено, неможливо надіслати повідомлення про трек, що програється",
      },
      trackIncomplete: {
        en: "Track info incomplete, cannot create now playing message",
        ru: "Информация о треке неполная, невозможно создать сообщение о проигрываемом треке",
        uk: "Інформація про трек неповна, неможливо створити повідомлення про трек, що програється",
      },
      creatingMessage: {
        en: "Already creating now playing message, skipping duplicate",
        ru: "Уже создается сообщение о проигрываемом треке, пропуск дубликата",
        uk: "Вже створюється повідомлення про трек, що програється, пропуск дубліката",
      },
      messageStored: {
        en: "Now playing message stored",
        ru: "Сообщение о проигрываемом треке сохранено",
        uk: "Повідомлення про трек, що програється, збережено",
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
  name: "trackStart",
  async execute(client, player, track) {
    try {
      // Set appropriate locale based on requester
      const locale = track.requester?.locale || "en";
      i18n.setLocale(locale);

      // Delete previous now playing message if it exists
      if (player.nowPlayingMessage) {
        try {
          const channel = await client.channels
            .fetch(player.nowPlayingMessage.channelId)
            .catch(() => null);
          if (channel) {
            await channel.messages
              .delete(player.nowPlayingMessage.messageId)
              .catch(() => null);
          }
        } catch (error) {
          console.error("Error deleting previous now playing message:", error);
        }
      }

      // Store last track for autoplay
      player.set("lastPlayedTrack", track);

      // Set a flag to indicate we're already sending a message
      if (player.get("isCreatingNowPlayingMessage")) {
        console.log(i18n.__("music.events.creatingMessage"));
        return;
      }

      player.set("isCreatingNowPlayingMessage", true);

      try {
        // Get the text channel
        const channel = await client.channels
          .fetch(player.textChannelId)
          .catch(() => null);
        if (!channel) {
          console.log(i18n.__("music.events.channelNotFound"));
          player.set("isCreatingNowPlayingMessage", false);
          return;
        }

        // Get any missing track information if needed
        if (!track.info?.title) {
          console.log(i18n.__("music.events.trackIncomplete"));
          player.set("isCreatingNowPlayingMessage", false);
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
          player
        );

        // Send embed with attachment
        const message = await channel
          .send({
            embeds: [embed],
            files: [attachment],
          })
          .catch((error) => {
            console.error("Error sending now playing message:", error);
            return null;
          });

        if (message) {
          // Store reference to the message for later updates
          player.nowPlayingMessage = {
            messageId: message.id,
            channelId: channel.id,
          };

          console.log(i18n.__("music.events.messageStored") + ":", {
            messageId: message.id,
            channelId: channel.id,
          });
        }
      } catch (error) {
        console.error("Error creating now playing message:", error);
      } finally {
        // Clear the flag when done
        player.set("isCreatingNowPlayingMessage", false);
      }
    } catch (error) {
      console.error("Error in trackStart event:", error);
    }
  },
};
