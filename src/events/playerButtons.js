import { Events } from "discord.js";
import i18n from "../utils/i18n.js";
import { createMusicButtons } from "../utils/musicButtons.js";

export default {
  name: Events.InteractionCreate,
  essential: true,
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
            // Force a player update event to save the state
            player.emit("playerUpdate", {
              guildId: player.guildId,
              state: player.state,
            });

            await interaction
              .reply({
                content:
                  `<@${interaction.user.id}> ` +
                  i18n.__("music.autoplay.autoplayApplied", {
                    enabled: newState ? "ON" : "OFF",
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
            content: i18n.__("music.errorOccured"),
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
          const replyContent = i18n.__(
            `music.${option}${
              option === "pause" ? (player.paused ? "d" : "Resumed") : "Applied"
            }`,
            {
              type: player.repeatMode,
            }
          );

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
            content: i18n.__("music.errorOccured"),
            ephemeral: true,
          });
        } catch (replyError) {
          console.error("Failed to send error message:", replyError);
        }
      }
    }
  },
};
