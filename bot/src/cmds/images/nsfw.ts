import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandSubcommandBuilder,
} from "discord.js";
import HMFull from "hmfull";
import { ComponentBuilder } from "../../utils/componentConverter.ts";
import type { TranslatorLike, InteractionLike, ImageData, ExtendedMessageLike } from "../../types/index.ts";

const nsfwImages = [
  { name: "Ass", value: "ass" },
  { name: "BDSM", value: "bdsm" },
  { name: "Cum", value: "cum" },
  { name: "Creampie", value: "creampie" },
  { name: "Manga", value: "manga" },
  { name: "Femdom", value: "femdom" },
  { name: "Hentai", value: "hentai" },
  { name: "Masturbation", value: "masturbation" },
  { name: "Public", value: "public" },
  { name: "Orgy", value: "orgy" },
  { name: "Yuri", value: "yuri" },
  { name: "Pantsu", value: "pantsu" },
  { name: "Glasses", value: "glasses" },
  { name: "Blowjob", value: "blowjob" },
  { name: "Boobjob", value: "boobjob" },
  { name: "Footjob", value: "footjob" },
  { name: "Handjob", value: "handjob" },
  { name: "Boobs", value: "boobs" },
  { name: "Thighs", value: "thighs" },
  { name: "Pussy", value: "pussy" },
  { name: "Ahegao", value: "ahegao" },
  { name: "Uniform", value: "uniform" },
  { name: "GIF", value: "gif" },
] as const;

const command = {
  data: (): SlashCommandSubcommandBuilder => {
    return new SlashCommandSubcommandBuilder()
      .setName("nsfw")
      .setDescription("Choose a NSFW image")
      .addStringOption((option) =>
        option
          .setName("image")
          .setDescription("Choose an image")
          .setRequired(true)
          .addChoices(...nsfwImages)
      );
  },

  localization_strings: {
    command: {
      name: {
        ru: "nsfw",
        uk: "nsfw",
      },
      description: {
        ru: "Выберите NSFW изображение",
        uk: "Виберіть NSFW зображення",
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
    nsfwChannelOnly: {
      en: "This command can only be used in NSFW channels",
      ru: "Эта команда может быть использована только в NSFW каналах",
      uk: "Ця команда може бути використана тільки в NSFW каналах",
    },
  },

  async execute(interaction: InteractionLike, i18n: TranslatorLike): Promise<void> {
    const isAiContext = false;
    const builderMode = isAiContext ? "v1" : "v2";

    if (!(interaction.channel as any)?.nsfw) {
      await interaction.reply({
        content: await i18n.__("commands.images.nsfw.nsfwChannelOnly"),
        ephemeral: true,
      });
      return;
    }

    if (!isAiContext) {
      await interaction.deferReply();
    }

    const imageType = interaction.options.getString!("image");
    const user = interaction.user;
    const hmFull = HMFull as any;

    const getImageData = async (): Promise<ImageData | null> => {
      try {
        const sources: Record<string, (() => Promise<string | { url?: string }>) | undefined>[] = [
          hmFull?.HMtai?.nsfw ?? {},
          hmFull?.Nekos?.nsfw ?? {},
          hmFull?.NekoBot?.nsfw ?? {},
          hmFull?.NekoLove?.nsfw ?? {},
        ];

        for (let attempts = 0; attempts < 3; attempts += 1) {
          for (const source of sources) {
            if (imageType && Object.keys(source).includes(imageType)) {
              const fetcher = source[imageType];
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
                  image: imageUrl,
                  category: imageType,
                } as ImageData;
              }
            }
          }
        }
        return null;
      } catch (error) {
        console.error(`Error fetching ${imageType} NSFW image:`, error);
        return null;
      }
    };

    let imageData = await getImageData();

    const generateImageMessage = async (
      options: { disableInteractions?: boolean } = {}
    ): Promise<Record<string, unknown>> => {
      const { disableInteractions = false } = options;

      if (!imageData?.image) {
        console.warn("Invalid or missing image URL for nsfw image:", imageType);
        imageData = await getImageData();
        if (!imageData?.image) {
          return {
            content: await i18n.__("commands.images.nsfw.notFound"),
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
          imageData.category || String(await i18n.__("commands.images.nsfw.title")),
          "header3"
        )
        .addImage(imageData.image)
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
        ephemeral: !isAiContext ? true : undefined,
      }) as Record<string, unknown>;
    };

    const initialMessageData = await generateImageMessage();
    if (initialMessageData.content && !imageData?.image) {
      if (isAiContext) {
        throw new Error(String(initialMessageData.content));
      }
      await interaction.editReply(initialMessageData);
      return;
    }

    let message: ExtendedMessageLike;
    if (isAiContext) {
      message = await interaction.reply(initialMessageData) as ExtendedMessageLike;
      return;
    }

    message = await interaction.editReply(initialMessageData) as ExtendedMessageLike;

    const collector = message.createMessageComponentCollector({
      filter: (componentInteraction: any) => componentInteraction.user.id === user.id,
      time: 60000,
    });

    collector.on("collect", async (componentInteraction: any) => {
      if (componentInteraction.customId === "next_image") {
        await componentInteraction.deferUpdate();
        imageData = await getImageData();
        const newMessageData = await generateImageMessage();
        if (newMessageData.content && !imageData?.image) {
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
