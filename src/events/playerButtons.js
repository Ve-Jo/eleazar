import { Events } from "discord.js";
import i18n from "../utils/i18n.js";
import { createOrUpdateMusicPlayerEmbed } from "../utils/musicPlayerEmbed.js";

// Register required localizations for the button handler
const localization_strings = {
  music: {
    previous: {
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

    loopApplied: {
      en: "Loop is now {{type}}",
      ru: "Цикл теперь {{type}}",
      uk: "Цикл теперь {{type}}",
    },
    skipApplied: {
      en: "Skipped song",
      ru: "Песня пропущена",
      uk: "Пісня пропущена",
    },
    pauseApplied: {
      en: "Paused",
      ru: "Пауза",
      uk: "Пауза",
    },
    pauseResumed: {
      en: "Resumed",
      ru: "Продолжено",
      uk: "Продовжено",
    },
    buttons: {
      on: "On",
      off: "Off",
    },

    autoplay: {
      autoplayApplied: {
        en: "Autoplay is now {{state}}",
        ru: "Автоплей теперь {{state}}",
        uk: "Автоплей теперь {{state}}",
      },
    },

    errorOccurred: {
      en: "An error occurred while processing the interaction: {{error}}",
      ru: "Произошла ошибка при обработке взаимодействия: {{error}}",
      uk: "Виникла помилка при обробці взаємодії: {{error}}",
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

export default {
  name: Events.InteractionCreate,
  async execute(interaction) {
    if (!interaction.isButton()) return;

    if (interaction.customId.startsWith("music_")) {
      const option = interaction.customId.split("_")[1];
      const player = interaction.client.lavalink.getPlayer(
        interaction.guild.id
      );

      if (!player) {
        return;
      }

      if (interaction.member.voice.channelId !== player.voiceChannelId) {
        return interaction.reply({
          content: await i18n.__("music.notInVoiceChannel"),
          ephemeral: true,
        });
      }

      if (interaction.user.locale) {
        i18n.setLocale(interaction.user.locale);
      }

      await interaction.deferUpdate();

      try {
        let interactionResponseContent = null;

        switch (option) {
          case "loop": {
            const modes = ["off", "track", "queue"];
            const currentIndex = modes.indexOf(player.repeatMode);
            const newMode = modes[(currentIndex + 1) % modes.length];
            player.repeatMode = newMode;
            player.emit("playerRepeatModeUpdate", player, newMode);
            interactionResponseContent = await i18n.__("music.loopApplied", {
              type: newMode,
            });
            break;
          }
          case "pause": {
            if (player.paused) {
              await player.resume();
              interactionResponseContent = await i18n.__("music.pauseResumed");
            } else {
              await player.pause();
              interactionResponseContent = await i18n.__("music.pauseApplied");
            }
            break;
          }
          case "skip": {
            try {
              await player.skip();
              interactionResponseContent = await i18n.__("music.skipApplied");
            } catch (error) {
              console.error("Skip error:", error);
              interactionResponseContent = await hubClient.getTranslation(
                "music.skippingSongError",
                { error: error.message },
                locale
              );
            }
            break;
          }
          case "previous": {
            if (!player.queue.previous || player.queue.previous.length === 0) {
              interactionResponseContent = await hubClient.getTranslation(
                "music.previous.noPreviousSongs",
                {},
                locale
              );
            } else {
              const previousTrack = player.queue.previous[0];
              player.queue.tracks.unshift(previousTrack);
              player.queue.previous.shift();
              await player.skip();
              interactionResponseContent = await hubClient.getTranslation(
                "music.previous.addedPreviousToQueue",
                { title: previousTrack.info.title },
                locale
              );
            }
            break;
          }
          case "autoplay": {
            const newState = !player.get("autoplay_enabled");
            player.set("autoplay_enabled", newState);
            interaction.client.lavalink.emit("playerUpdate", {
              guildId: player.guildId,
              state: player.state,
            });
            interactionResponseContent = await hubClient.getTranslation(
              "music.autoplay.autoplayApplied",
              {
                state: newState
                  ? await hubClient.getTranslation(
                      "music.buttons.on",
                      {},
                      locale
                    )
                  : await hubClient.getTranslation(
                      "music.buttons.off",
                      {},
                      locale
                    ),
              },
              locale
            );
            break;
          }
        }

        if (player.queue.current) {
          const updatedPlayerData = await createOrUpdateMusicPlayerEmbed(
            player.queue.current,
            player
          );

          await interaction.message
            .edit(updatedPlayerData)
            .catch((editError) => {
              console.error(
                "Failed to edit music player message after button interaction:",
                editError
              );
              if (editError.code === 10008) {
                interaction.client.musicMessageMap?.delete(interaction.guildId);
              }
            });
        } else {
          try {
            await interaction.message.delete();
            interaction.client.musicMessageMap?.delete(interaction.guildId);
          } catch (deleteError) {
            console.error(
              "Failed to delete music message when queue became empty:",
              deleteError
            );
          }
        }

        if (interactionResponseContent) {
          await interaction.followUp({
            content: interactionResponseContent,
            ephemeral: true,
          });
        }
      } catch (error) {
        console.error("Error processing music button interaction:", error);
        try {
          await interaction.followUp({
            content: await hubClient.getTranslation(
              "music.errorOccurred",
              { error: error.message },
              locale
            ),
            ephemeral: true,
          });
        } catch (replyError) {
          console.error("Failed to send error follow-up:", replyError);
        }
      }
    }
  },
};
