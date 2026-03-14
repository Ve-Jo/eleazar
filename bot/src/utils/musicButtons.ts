import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import hubClient from "../api/hubClient.ts";

// Define localization strings
const localization_strings = {
  music: {
    buttons: {
      previous: {
        en: "Previous",
        ru: "Предыдущий",
        uk: "Попередній",
      },
      loop: {
        en: "Loop",
        ru: "Повтор",
        uk: "Повтор",
      },
      pause: {
        en: "Pause",
        ru: "Пауза",
        uk: "Пауза",
      },
      play: {
        en: "Play",
        ru: "Воспроизвести",
        uk: "Відтворити",
      },
      autoplay: {
        en: "Autoplay",
        ru: "Автовоспроизведение",
        uk: "Автовідтворення",
      },
      on: {
        en: "ON",
        ru: "ВКЛ",
        uk: "УВІМК",
      },
      off: {
        en: "OFF",
        ru: "ВЫКЛ",
        uk: "ВИМК",
      },
      skip: {
        en: "Skip",
        ru: "Пропустить",
        uk: "Пропустити",
      },
    },
  },
} as const;

type LocalizationCategory = keyof typeof localization_strings;
type LocalizationComponent<C extends LocalizationCategory> =
  keyof (typeof localization_strings)[C];

type TrackRequesterLike = {
  locale?: string;
};

type TrackLike = {
  autoplay_enabled?: boolean;
  userData?: {
    requester?: TrackRequesterLike;
  };
};

type QueueLike = {
  current?: TrackLike;
};

type PlayerLike = {
  queue?: QueueLike;
  repeatMode?: string;
  paused?: boolean;
  get?: (key: string) => unknown;
};

// Register translations with hubClient asynchronously
(async () => {
  (Object.keys(localization_strings) as LocalizationCategory[]).forEach(
    (category) => {
      (
        Object.keys(
          localization_strings[category]
        ) as LocalizationComponent<typeof category>[]
      ).forEach((component) => {
        hubClient.registerLocalizations(
          category,
          component as string,
          localization_strings[category][
            component as LocalizationComponent<typeof category>
          ],
          true
        );
      });
    }
  );
})();

export async function createMusicButtons(player: PlayerLike) {
  const locale = player.queue?.current?.userData?.requester?.locale || "en";

  let autoplay = false;
  try {
    if (typeof player?.get === "function") {
      autoplay = Boolean(player.get("autoplay_enabled"));
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
      .setLabel(
        autoplay
          ? (await hubClient.getTranslation("music.buttons.on", {}, locale))
              .translation
          : (await hubClient.getTranslation("music.buttons.off", {}, locale))
              .translation
      )
      .setStyle(autoplay ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("music_skip")
      .setEmoji("⏭️")
      .setStyle(ButtonStyle.Secondary)
  );
}
