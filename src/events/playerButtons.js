import { Events } from "discord.js";
import i18n from "../utils/newI18n.js";
import { createMusicButtons } from "../utils/musicButtons.js";

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
      let option = interaction.customId.split("_")[1];
      let player = interaction.client.lavalink.players.get(
        interaction.guild.id
      );
      if (!player) return;
      if (interaction.member.voice.channelId !== player.voiceChannelId) {
        return interaction.reply({
          content: i18n.__("music.notInVoiceChannel"),
          ephemeral: true,
        });
      }

      if (interaction.user.locale) {
        i18n.setLocale(interaction.user.locale);
      }

      try {
        switch (option) {
          case "loop": {
            const modes = ["off", "track", "queue"];
            const currentIndex = modes.indexOf(player.repeatMode);
            const newMode = modes[(currentIndex + 1) % modes.length];

            // Force trigger repeat mode update event
            player.repeatMode = newMode;
            // Explicitly emit the event
            player.emit("playerRepeatModeUpdate", player, newMode);

            break;
          }
          case "pause": {
            if (player.paused) {
              await player.resume();
              // Let playerResume event handle the state saving
            } else {
              await player.pause();
              // Let playerPause event handle the state saving
            }
            break;
          }
          case "skip": {
            try {
              await player.skip();
              // Let trackEnd event handle the state saving
            } catch (error) {
              let autoplay = player.get("autoplay_enabled");
              if (autoplay && player.queue.current) {
                await player.seek(player.queue.current.info.duration);
                // Let playerSeek event handle the state saving
              } else {
                return interaction.reply({
                  content: i18n.__("music.skippingSongError"),
                  ephemeral: true,
                });
              }
            }
            break;
          }
          case "previous": {
            if (player.queue.previous.length === 0) {
              return interaction.reply({
                content: i18n.__("music.previous.noPreviousSongs"),
                ephemeral: true,
              });
            }
            const previousTrack =
              player.queue.previous[player.queue.previous.length - 1];
            await player.queue.add(previousTrack, 0);
            // Let trackAdd event handle the state saving

            await interaction.reply(
              `<@${interaction.user.id}> ` +
                i18n.__("music.previous.addedPreviousToQueue", {
                  title: previousTrack.info.title,
                })
            );

            if (!player.playing) {
              await player.play();
              // Let trackStart event handle the state saving
            }
            break;
          }
          case "autoplay": {
            const newState = !player.get("autoplay_enabled");
            // Set the state
            player.set("autoplay_enabled", newState);
            // Trigger player update through Lavalink client
            interaction.client.lavalink.emit("playerUpdate", {
              guildId: player.guildId,
              state: player.state,
            });

            await interaction
              .reply({
                content:
                  `<@${interaction.user.id}> ` +
                  i18n.__("music.autoplay.autoplayApplied", {
                    state: newState
                      ? i18n.__("music.buttons.on")
                      : i18n.__("music.buttons.off"),
                  }),
              })
              .then((int) => setTimeout(() => int.delete(), 5000));
            break;
          }
        }

        let updatedButtons;
        try {
          updatedButtons = createMusicButtons(player);
        } catch (error) {
          console.error(error);
          return interaction.reply({
            content: i18n.__("music.errorOccurred", { error: error.message }),
            ephemeral: true,
          });
        }

        try {
          await interaction.message.edit({ components: [updatedButtons] });
        } catch (error) {
          console.error("Failed to update message:", error);
          // If we can't update the message, we'll try to send a new one
          try {
            await interaction.channel.send({ components: [updatedButtons] });
          } catch (sendError) {
            console.error("Failed to send new message:", sendError);
          }
        }

        if (option !== "autoplay" && option !== "previous") {
          const replyContent =
            option === "pause"
              ? i18n.__(
                  player.paused ? "music.pauseApplied" : "music.pauseResumed"
                )
              : option === "loop"
              ? i18n.__("music.loopApplied", { type: player.repeatMode })
              : option === "skip"
              ? i18n.__("music.skipApplied")
              : i18n.__(`music.${option}Applied`);

          try {
            await interaction.reply({
              content: `<@${interaction.user.id}> ${replyContent}`,
              ephemeral: true,
            });
          } catch (replyError) {
            console.error("Failed to reply to interaction:", replyError);
          }
        }
      } catch (error) {
        console.error(error);
        try {
          await interaction.reply({
            content: i18n.__("music.errorOccurred", { error: error.message }),
            ephemeral: true,
          });
        } catch (replyError) {
          console.error("Failed to send error message:", replyError);
        }
      }
    }
  },
};
