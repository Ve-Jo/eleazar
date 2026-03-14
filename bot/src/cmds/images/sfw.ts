import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandSubcommandBuilder,
} from "discord.js";
import HMFull from "hmfull";
import { ComponentBuilder } from "../../utils/componentConverter.ts";

const sfwImages = [
  "neko",
  "waifu",
  "foxgirl",
  "kanna",
  "holo",
  "kemonomimi",
  "kitsune",
  "wallpaper",
  "mobileWallpaper",
  "coffee_arts",
  "neko_arts",
  "jahy_arts",
  "wolf_arts",
] as const;

type TranslatorLike = {
  __: (key: string, vars?: Record<string, unknown>) => Promise<string | unknown>;
};

type SourceCollection = Record<string, (() => Promise<string | { url?: string }>) | undefined>;

type ImageData = {
  url: string;
  category: string;
};

type CollectorLike = {
  on: (event: string, callback: (...args: any[]) => Promise<void> | void) => void;
};

type MessageLike = {
  editable?: boolean;
  edit: (payload: unknown) => Promise<unknown>;
  createMessageComponentCollector: (options: Record<string, unknown>) => CollectorLike;
};

type InteractionLike = {
  _isAiProxy?: boolean;
  locale: string;
  guild: unknown;
  user: { id: string };
  options: {
    getString: (name: string) => string | null;
  };
  deferReply: () => Promise<unknown>;
  editReply: (payload: unknown) => Promise<MessageLike>;
  reply: (payload: unknown) => Promise<MessageLike>;
};

const command = {
  data: (): SlashCommandSubcommandBuilder => {
    return new SlashCommandSubcommandBuilder()
      .setName("sfw")
      .setDescription("Choose a SFW image")
      .addStringOption((option) =>
        option
          .setName("image")
          .setDescription("Choose an image")
          .setRequired(true)
          .addChoices(
            ...sfwImages.map((key) => ({
              name: key,
              value: key,
            }))
          )
      );
  },

  localization_strings: {
    command: {
      name: {
        ru: "sfw",
        uk: "sfw",
      },
      description: {
        ru: "Выберите безопасное изображение",
        uk: "Виберіть безпечне зображення",
      },
    },
    options: {
      image: {
        name: {
          ru: "изображение",
          uk: "зображення",
        },
        description: {
          ru: "Выберите изображение",
          uk: "Виберіть зображення",
        },
      },
    },
    notFound: {
      en: "Image not found",
      ru: "Изображение не найдено",
      uk: "Зображення не знайдено",
    },
  },

  async execute(interaction: InteractionLike, i18n: TranslatorLike): Promise<void> {
    const isAiContext = !!interaction._isAiProxy;
    const builderMode = isAiContext ? "v1" : "v2";

    if (!isAiContext) {
      await interaction.deferReply();
    }

    const category = interaction.options.getString("image");
    const user = interaction.user;
    const hmFull = HMFull as any;

    const getImageData = async (): Promise<ImageData | null> => {
      try {
        const sources: SourceCollection[] = [
          hmFull?.HMtai?.sfw ?? {},
          hmFull?.Nekos?.sfw ?? {},
          hmFull?.NekoBot?.sfw ?? {},
          hmFull?.NekoLove?.sfw ?? {},
        ];

        for (let attempts = 0; attempts < 3; attempts += 1) {
          for (const source of sources) {
            if (category && Object.keys(source).includes(category)) {
              const fetcher = source[category];
              if (!fetcher) {
                continue;
              }
              let imageUrl = await fetcher();
              if (
                typeof imageUrl === "object" &&
                imageUrl !== null &&
                "url" in imageUrl &&
                typeof imageUrl.url === "string"
              ) {
                imageUrl = imageUrl.url;
              }
              if (
                imageUrl &&
                typeof imageUrl === "string" &&
                imageUrl.startsWith("http")
              ) {
                return {
                  url: imageUrl,
                  category,
                };
              }
            }
          }
        }
        return null;
      } catch (error) {
        console.error(`Error fetching ${category} image:`, error);
        return null;
      }
    };

    let imageData = await getImageData();

    const generateImageMessage = async (
      options: { disableInteractions?: boolean } = {}
    ): Promise<Record<string, unknown>> => {
      const { disableInteractions = false } = options;

      if (!imageData?.url) {
        console.warn("Invalid or missing image URL for sfw image:", category);
        imageData = await getImageData();
        if (!imageData?.url) {
          return {
            content: await i18n.__("commands.images.sfw.notFound"),
            components: [],
            embeds: [],
            ephemeral: true,
          };
        }
      }

      const imageComponent = new ComponentBuilder({
        mode: builderMode,
      })
        .addText(
          imageData.category || String(await i18n.__("commands.images.sfw.title")),
          "header3"
        )
        .addImage(imageData.url)
        .addTimestamp(interaction.locale);

      const nextButton = new ButtonBuilder()
        .setCustomId("next_image")
        .setEmoji("🔄")
        .setStyle(ButtonStyle.Primary);

      const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(nextButton);

      if (!disableInteractions) {
        imageComponent.addActionRow(buttonRow);
      }

      return imageComponent.toReplyOptions({
        content: isAiContext ? imageData.category : undefined,
      }) as Record<string, unknown>;
    };

    const initialMessageData = await generateImageMessage();
    if (initialMessageData.content && !imageData?.url) {
      if (isAiContext) {
        throw new Error(String(initialMessageData.content));
      }
      await interaction.editReply(initialMessageData);
      return;
    }

    let message: MessageLike;
    if (isAiContext) {
      message = await interaction.reply(initialMessageData);
      return;
    }

    message = await interaction.editReply(initialMessageData);

    const collector = message.createMessageComponentCollector({
      filter: (componentInteraction: any) => componentInteraction.user.id === user.id,
      time: 60000,
    });

    collector.on("collect", async (componentInteraction: any) => {
      if (componentInteraction.customId === "next_image") {
        await componentInteraction.deferUpdate();
        imageData = await getImageData();
        const newMessageData = await generateImageMessage();
        if (newMessageData.content && !imageData?.url) {
          await componentInteraction.followUp({
            ...newMessageData,
            ephemeral: true,
          });
        } else {
          await componentInteraction.editReply(newMessageData);
        }
      }
    });

    collector.on("end", async (_collected: unknown, reason: string) => {
      if (reason !== "messageDelete" && message.editable) {
        try {
          const finalMessageData = await generateImageMessage({
            disableInteractions: true,
          });
          if (!finalMessageData.content) {
            await message.edit(finalMessageData);
          }
        } catch (error) {
          console.error("Error removing components on end:", error);
          await message.edit({ components: [] }).catch(() => {});
        }
      }
    });
  },
};

export default command;
