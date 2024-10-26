import { Events } from "discord.js";
import i18n from "../utils/i18n.js";
import { createMusicButtons } from "../utils/musicButtons.js";

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
            await player.setRepeatMode(newMode);
            break;
          }
          case "pause": {
            player.paused ? await player.resume() : await player.pause();
            break;
          }
          case "skip": {
            try {
              await player.skip();
            } catch (error) {
              let autoplay = player.get("autoplay_enabled");
              if (autoplay) {
                if (player.queue.current) {
                  await player.seek(player.queue.current.info.duration);
                } else {
                  return interaction.reply({
                    content: i18n.__("music.skippingSongError"),
                    ephemeral: true,
                  });
                }
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
                content: i18n.__("music.noPreviousSongs"),
                ephemeral: true,
              });
            }
            const previousTrack =
              player.queue.previous[player.queue.previous.length - 1];
            await player.queue.add(previousTrack, 0);

            await interaction.reply(
              `<@${interaction.user.id}> ` +
                i18n.__("music.addedPreviousToQueue", {
                  title: previousTrack.info.title,
                })
            );

            if (!player.playing) {
              await player.play();
            }
            break;
          }
          case "autoplay": {
            await player.set(
              "autoplay_enabled",
              !player.get("autoplay_enabled")
            );
            interaction
              .reply({
                content:
                  `<@${interaction.user.id}> ` +
                  i18n.__("music.autoplayApplied", {
                    enabled: player.get("autoplay_enabled") ? "ON" : "OFF",
                  }),
              })
              .then((int) => setTimeout(() => int.delete(), 5000));
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
