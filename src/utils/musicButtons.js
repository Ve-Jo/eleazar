import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import i18n from "./newI18n.js";

// Define localization strings
const localization_strings = {
  music: {
    buttons: {
      previous: {
        en: "Previous",
        ru: "Предыдущий",
        uk: "Попередній"
      },
      loop: {
        en: "Loop",
        ru: "Повтор",
        uk: "Повтор"
      },
      pause: {
        en: "Pause",
        ru: "Пауза",
        uk: "Пауза"
      },
      play: {
        en: "Play",
        ru: "Воспроизвести",
        uk: "Відтворити"
      },
      autoplay: {
        en: "Autoplay",
        ru: "Автовоспроизведение",
        uk: "Автовідтворення"
      },
      on: {
        en: "ON",
        ru: "ВКЛ",
        uk: "УВІМК"
      },
      off: {
        en: "OFF",
        ru: "ВЫКЛ",
        uk: "ВИМК"
      },
      skip: {
        en: "Skip",
        ru: "Пропустить",
        uk: "Пропустити"
      }
    }
  }
};

// Register translations with i18n system
Object.keys(localization_strings).forEach(category => {
  Object.keys(localization_strings[category]).forEach(component => {
    i18n.registerLocalizations(category, component, localization_strings[category][component], true);
  });
});

export function createMusicButtons(player) {
  const locale = player.queue.current?.userData?.requester?.locale || "en";

  i18n.setLocale(i18n.getLocales().includes(locale) ? locale : "en");

  let autoplay = false;
  try {
    if (typeof player?.get === "function") {
      autoplay = player.get("autoplay_enabled");
      if (autoplay !== undefined) {
        if (player.queue?.current) {
          player.queue.current.autoplay_enabled = autoplay;
        }
      } else {
        autoplay = player.queue?.current?.autoplay_enabled || false;
      }
    } else {
      autoplay = player.queue?.current?.autoplay_enabled || false;
    }

    console.log("Final autoplay status:", autoplay);
  } catch (error) {
    console.warn("Error accessing autoplay status:", error);
    autoplay = false;
  }

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
      .setLabel(autoplay ? i18n.__("music.buttons.on") : i18n.__("music.buttons.off"))
      .setStyle(autoplay ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("music_skip")
      .setEmoji("⏭️")
      .setStyle(ButtonStyle.Secondary)
  );
}
