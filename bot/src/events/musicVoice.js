import { Events } from "discord.js";
import hubClient from "../api/hubClient.js";

export default {
  name: Events.VoiceStateUpdate,
  async execute(oldState, newState) {
    try {
      // Ensure we have valid states and guild
      if (!oldState?.guild || !newState?.guild) return;

      // Get client from state objects
      const client = oldState.client || newState.client;
      if (!client?.user) {
        console.log("No valid client found in voice state update");
        return;
      }

      // Wait for Lavalink to be initialized
      if (!client.lavalink?.isInitialized) {
        console.log(
          "Lavalink not initialized yet, skipping voice state update",
        );
        return;
      }

      const guildId = oldState.guild?.id || newState.guild?.id;
      if (!guildId) return;

      const player = client.lavalink.getPlayer(guildId);
      if (!player || !hubClient) return;

      // If this is the bot's voice state
      if (oldState.member?.id === client.user?.id) {
        // Wait for voice state to stabilize
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Bot disconnected from a channel
        if (oldState.channel && !newState.channel) {
          console.log(
            "Bot disconnected from voice channel, checking channel state...",
          );
          try {
            const channel = oldState.channel;
            if (!channel) return;

            const nonBotMembers = channel.members.filter((m) => !m.user.bot);
            if (nonBotMembers.size > 0) {
              console.log("Users still in channel, attempting to reconnect...");
              try {
                if (!player.connected) {
                  await player.connect();
                }
                console.log("Successfully reconnected to voice channel");
              } catch (error) {
                console.error("Failed to reconnect:", error);
                await hubClient.savePlayer(player).catch(console.error);
              }
            } else {
              console.log("No users in channel, saving state...");
              await hubClient.savePlayer(player).catch(console.error);
            }
          } catch (error) {
            console.error("Error handling voice disconnection:", error);
          }
        }

        // Bot moved to a different channel
        else if (
          oldState.channel &&
          newState.channel &&
          oldState.channelId !== newState.channelId
        ) {
          console.log("Bot moved to different voice channel");
          try {
            const newChannel = newState.channel;
            const oldChannel = oldState.channel;

            const newChannelMembers = newChannel.members.filter(
              (m) => !m.user.bot,
            );
            const oldChannelMembers = oldChannel.members.filter(
              (m) => !m.user.bot,
            );

            if (newChannelMembers.size > 0) {
              console.log("Found users in new channel, updating player...");
              player.voiceChannelId = newState.channelId;
              if (!player.connected) {
                await player.connect();
              }
            } else if (oldChannelMembers.size > 0) {
              console.log(
                "No users in new channel, returning to old channel...",
              );
              player.voiceChannelId = oldState.channelId;
              await player.connect();
            } else {
              console.log(
                "No users in either channel, saving and disconnecting...",
              );
              await hubClient.savePlayer(player).catch(console.error);
              await player.disconnect().catch(console.error);
            }
          } catch (error) {
            console.error("Error handling channel move:", error);
          }
        }
      }
    } catch (error) {
      console.error("Error in voice state update handler:", error);
    }
  },
};
