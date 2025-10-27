import { Events } from "discord.js";
import { hubClient } from "../api/hubClient.js";
import { createOrUpdateMusicPlayerEmbed } from "../utils/musicPlayerEmbed.js";

// Use the centralized music localization strings from the hub system
// The strings are already registered in bot/src/cmds/music/index.js

// No need to register translations here - they're already registered in the music command

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
        const locale = interaction.user.locale || "en";
        return interaction.reply({
          content: (
            await hubClient.getTranslation(
              "commands.music.notInVoiceChannel",
              {},
              locale
            )
          ).translation,
          ephemeral: true,
        });
      }

      // Get user locale for translations
      const locale = interaction.user.locale || "en";

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
            interactionResponseContent = (
              await hubClient.getTranslation(
                "commands.music.loopApplied",
                { type: newMode },
                locale
              )
            ).translation;
            break;
          }
          case "pause": {
            if (player.paused) {
              await player.resume();
              interactionResponseContent = (
                await hubClient.getTranslation(
                  "commands.music.pauseResumed",
                  {},
                  locale
                )
              ).translation;
            } else {
              await player.pause();
              interactionResponseContent = (
                await hubClient.getTranslation(
                  "commands.music.pauseApplied",
                  {},
                  locale
                )
              ).translation;
            }
            break;
          }
          case "skip": {
            try {
              await player.skip();
              interactionResponseContent = (
                await hubClient.getTranslation(
                  "commands.music.skipApplied",
                  {},
                  locale
                )
              ).translation;
            } catch (error) {
              console.error("Skip error:", error);
              interactionResponseContent = (
                await hubClient.getTranslation(
                  "commands.music.skippingSongError",
                  { error: error.message },
                  locale
                )
              ).translation;
            }
            break;
          }
          case "previous": {
            if (!player.queue.previous || player.queue.previous.length === 0) {
              interactionResponseContent = (
                await hubClient.getTranslation(
                  "commands.music.noPreviousSongs",
                  {},
                  locale
                )
              ).translation;
            } else {
              const previousTrack = player.queue.previous[0];
              player.queue.tracks.unshift(previousTrack);
              player.queue.previous.shift();
              await player.skip();
              interactionResponseContent = (
                await hubClient.getTranslation(
                  "commands.music.addedPreviousToQueue",
                  { title: previousTrack.info.title },
                  locale
                )
              ).translation;
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
            interactionResponseContent = (
              await hubClient.getTranslation(
                "commands.music.autoplay.autoplayApplied",
                {
                  enabled: newState
                    ? (
                        await hubClient.getTranslation(
                          "commands.music.buttons.on",
                          {},
                          locale
                        )
                      ).translation
                    : (
                        await hubClient.getTranslation(
                          "commands.music.buttons.off",
                          {},
                          locale
                        )
                      ).translation,
                },
                locale
              )
            ).translation;
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
          const errorLocale = interaction.user.locale || "en";
          await interaction.followUp({
            content: (
              await hubClient.getTranslation(
                "commands.music.errorOccurred",
                { error: error.message },
                errorLocale
              )
            ).translation,
            ephemeral: true,
          });
        } catch (replyError) {
          console.error("Failed to send error follow-up:", replyError);
        }
      }
    }
  },
};
