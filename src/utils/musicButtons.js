import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import i18n from "./i18n.js";

export function createMusicButtons(player) {
  i18n.setLocale(player.queue.current.userData.requester.locale);

  let autoplay = player.get("autoplay_enabled");

  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("music_previous")
      .setEmoji("⏮️")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("music_loop")
      .setEmoji(player.repeatMode !== "off" ? "🔁" : "🔂")
      .setStyle(
        player.repeatMode !== "off"
          ? ButtonStyle.Primary
          : ButtonStyle.Secondary
      ),
    new ButtonBuilder()
      .setCustomId("music_pause")
      .setEmoji(player.paused ? "▶️" : "⏸️")
      .setStyle(player.paused ? ButtonStyle.Secondary : ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("music_autoplay")
      .setEmoji("🎧")
      .setLabel(autoplay ? "ON" : "OFF")
      .setStyle(autoplay ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("music_skip")
      .setEmoji("⏭️")
      .setStyle(ButtonStyle.Secondary)
  );
}
