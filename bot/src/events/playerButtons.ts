import { Events } from "discord.js";
import { hubClient } from "../api/hubClient.ts";
import { createOrUpdateMusicPlayerEmbed } from "../utils/musicPlayerEmbed.ts";

type TranslationResult = {
  translation?: string;
};

type TrackLike = {
  info?: { title?: string };
};

type PlayerLike = {
  voiceChannelId?: string | null;
  repeatMode?: string;
  paused?: boolean;
  queue: {
    current?: TrackLike | null;
    previous?: TrackLike[];
    tracks: TrackLike[];
  };
  guildId?: string;
  state?: unknown;
  emit: (eventName: string, ...args: unknown[]) => void;
  get: (key: string) => unknown;
  set: (key: string, value: unknown) => void;
  resume: () => Promise<unknown>;
  pause: () => Promise<unknown>;
  skip: () => Promise<unknown>;
};

type ButtonInteractionLike = {
  isButton: () => boolean;
  customId: string;
  client: {
    lavalink: {
      getPlayer: (guildId: string) => PlayerLike | null | undefined;
      emit: (eventName: string, payload: unknown) => void;
    };
    musicMessageMap?: Map<string, unknown>;
  };
  guild: { id: string } | null;
  guildId?: string;
  member: { voice: { channelId?: string | null } };
  user: { locale?: string };
  message: {
    edit: (payload: unknown) => Promise<unknown>;
    delete: () => Promise<unknown>;
  };
  reply: (payload: unknown) => Promise<unknown>;
  deferUpdate: () => Promise<unknown>;
  followUp: (payload: unknown) => Promise<unknown>;
};

const event = {
  name: Events.InteractionCreate,
  async execute(interaction: ButtonInteractionLike): Promise<unknown> {
    if (!interaction.isButton()) return;

    if (interaction.customId.startsWith("music_")) {
      const option = interaction.customId.split("_")[1];
      const guildId = interaction.guild?.id;
      if (!guildId) {
        return;
      }

      const player = interaction.client.lavalink.getPlayer(guildId);

      if (!player) {
        return;
      }

      if (interaction.member.voice.channelId !== player.voiceChannelId) {
        const locale = interaction.user.locale || "en";
        const translation = (await hubClient.getTranslation(
          "commands.music.notInVoiceChannel",
          {},
          locale
        )) as TranslationResult;
        return interaction.reply({
          content: translation.translation,
          ephemeral: true,
        });
      }

      const locale = interaction.user.locale || "en";

      await interaction.deferUpdate();

      try {
        let interactionResponseContent: string | null = null;

        switch (option) {
          case "loop": {
            const modes = ["off", "track", "queue"];
            const currentIndex = modes.indexOf(player.repeatMode || "off");
            const newMode = modes[(currentIndex + 1) % modes.length];
            player.repeatMode = newMode;
            player.emit("playerRepeatModeUpdate", player, newMode);
            interactionResponseContent = (
              (await hubClient.getTranslation(
                "commands.music.loopApplied",
                { type: newMode },
                locale
              )) as TranslationResult
            ).translation || null;
            break;
          }
          case "pause": {
            if (player.paused) {
              await player.resume();
              interactionResponseContent = (
                (await hubClient.getTranslation(
                  "commands.music.pauseResumed",
                  {},
                  locale
                )) as TranslationResult
              ).translation || null;
            } else {
              await player.pause();
              interactionResponseContent = (
                (await hubClient.getTranslation(
                  "commands.music.pauseApplied",
                  {},
                  locale
                )) as TranslationResult
              ).translation || null;
            }
            break;
          }
          case "skip": {
            try {
              await player.skip();
              interactionResponseContent = (
                (await hubClient.getTranslation(
                  "commands.music.skipApplied",
                  {},
                  locale
                )) as TranslationResult
              ).translation || null;
            } catch (error) {
              const typedError = error as Error;
              console.error("Skip error:", error);
              interactionResponseContent = (
                (await hubClient.getTranslation(
                  "commands.music.skippingSongError",
                  { error: typedError.message },
                  locale
                )) as TranslationResult
              ).translation || null;
            }
            break;
          }
          case "previous": {
            if (!player.queue.previous || player.queue.previous.length === 0) {
              interactionResponseContent = (
                (await hubClient.getTranslation(
                  "commands.music.noPreviousSongs",
                  {},
                  locale
                )) as TranslationResult
              ).translation || null;
            } else {
              const previousTrack = player.queue.previous[0];
              if (!previousTrack) {
                break;
              }
              player.queue.tracks.unshift(previousTrack);
              player.queue.previous.shift();
              await player.skip();
              interactionResponseContent = (
                (await hubClient.getTranslation(
                  "commands.music.addedPreviousToQueue",
                  { title: previousTrack.info?.title },
                  locale
                )) as TranslationResult
              ).translation || null;
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
            const enabledLabel = (
              (await hubClient.getTranslation(
                newState ? "commands.music.buttons.on" : "commands.music.buttons.off",
                {},
                locale
              )) as TranslationResult
            ).translation;
            interactionResponseContent = (
              (await hubClient.getTranslation(
                "commands.music.autoplay.autoplayApplied",
                { enabled: enabledLabel },
                locale
              )) as TranslationResult
            ).translation || null;
            break;
          }
        }

        if (player.queue.current) {
          const updatedPlayerData = await createOrUpdateMusicPlayerEmbed(
            player.queue.current as any,
            player as any
          );

          await interaction.message.edit(updatedPlayerData).catch((editError: any) => {
            console.error(
              "Failed to edit music player message after button interaction:",
              editError
            );
            if (editError.code === 10008) {
              interaction.client.musicMessageMap?.delete(guildId);
            }
          });
        } else {
          try {
            await interaction.message.delete();
            interaction.client.musicMessageMap?.delete(guildId);
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
          const typedError = error as Error;
          await interaction.followUp({
            content: (
              (await hubClient.getTranslation(
                "commands.music.errorOccurred",
                { error: typedError.message },
                errorLocale
              )) as TranslationResult
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

export default event;
