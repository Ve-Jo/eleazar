import { SlashCommandSubcommandBuilder } from "discord.js";
import HMFull from "hmfull";
import { ComponentBuilder } from "../../utils/componentConverter.ts";
import type { TranslatorLike, InteractionLike, ImageData, ExtendedMessageLike } from "../../types/index.ts";

const selfEmotions = [
  { name: "smug", value: "smug" },
  { name: "happy", value: "happy" },
  { name: "smile", value: "smile" },
  { name: "dance", value: "dance" },
  { name: "like", value: "like" },
  { name: "cry", value: "cry" },
  { name: "nosebleed", value: "nosebleed" },
  { name: "depression", value: "depression" },
  { name: "tea", value: "tea" },
  { name: "nom", value: "nom" },
  { name: "lick", value: "lick" },
  { name: "sleep", value: "sleep" },
  { name: "coffee", value: "coffee" },
  { name: "gah", value: "gah" },
] as const;

const command = {
  data: (): SlashCommandSubcommandBuilder => {
    return new SlashCommandSubcommandBuilder()
      .setName("myself")
      .setDescription("Choose your own emotion or action")
      .addStringOption((option) =>
        option
          .setName("emotion")
          .setDescription("Choose an emotion or action")
          .setRequired(true)
          .addChoices(...selfEmotions)
      );
  },

  localization_strings: {
    command: {
      name: {
        ru: "я",
        uk: "я",
      },
      description: {
        ru: "Выберите вашу эмоцию или действие",
        uk: "Виберіть вашу емоцію або дію",
      },
    },
    blush: {
      title: { en: "Blush", ru: "Смущение", uk: "Зніяковіння" },
      description: {
        en: "<@{{user}}> is blushing!",
        ru: "<@{{user}}> смущается!",
        uk: "<@{{user}}> ніяковіє!",
      },
    },
    smug: {
      title: { en: "Smug", ru: "Самодовольство", uk: "Самовдоволення" },
      description: {
        en: "<@{{user}}> looks smug!",
        ru: "<@{{user}}> выглядит самодовольно!",
        uk: "<@{{user}}> виглядає самовдоволено!",
      },
    },
    happy: {
      title: { en: "Happy", ru: "Радость", uk: "Радість" },
      description: {
        en: "<@{{user}}> is happy!",
        ru: "<@{{user}}> радуется!",
        uk: "<@{{user}}> радіє!",
      },
    },
    smile: {
      title: { en: "Smile", ru: "Улыбка", uk: "Посмішка" },
      description: {
        en: "<@{{user}}> smiles!",
        ru: "<@{{user}}> улыбается!",
        uk: "<@{{user}}> посміхається!",
      },
    },
    dance: {
      title: { en: "Dance", ru: "Танец", uk: "Танець" },
      description: {
        en: "<@{{user}}> is dancing!",
        ru: "<@{{user}}> танцует!",
        uk: "<@{{user}}> танцює!",
      },
    },
    like: {
      title: { en: "Like", ru: "Нравится", uk: "Подобається" },
      description: {
        en: "<@{{user}}> likes this!",
        ru: "<@{{user}}> это нравится!",
        uk: "<@{{user}}> це подобається!",
      },
    },
    cry: {
      title: { en: "Cry", ru: "Плач", uk: "Плач" },
      description: {
        en: "<@{{user}}> is crying!",
        ru: "<@{{user}}> плачет!",
        uk: "<@{{user}}> плаче!",
      },
    },
    nosebleed: {
      title: { en: "Nosebleed", ru: "Кровь из носа", uk: "Кров з носа" },
      description: {
        en: "<@{{user}}> has a nosebleed!",
        ru: "У <@{{user}}> идет кровь из носа!",
        uk: "У <@{{user}}> йде кров з носа!",
      },
    },
    depression: {
      title: { en: "Depression", ru: "Депрессия", uk: "Депресія" },
      description: {
        en: "<@{{user}}> is depressed!",
        ru: "<@{{user}}> в депрессии!",
        uk: "<@{{user}}> у депресії!",
      },
    },
    tea: {
      title: { en: "Tea", ru: "Чай", uk: "Чай" },
      description: {
        en: "<@{{user}}> drinks tea!",
        ru: "<@{{user}}> пьет чай!",
        uk: "<@{{user}}> п'є чай!",
      },
    },
    nom: {
      title: { en: "Nom", ru: "Ням", uk: "Ням" },
      description: {
        en: "<@{{user}}> is eating!",
        ru: "<@{{user}}> кушает!",
        uk: "<@{{user}}> їсть!",
      },
    },
    lick: {
      title: { en: "Lick", ru: "Облизывание", uk: "Облизування" },
      description: {
        en: "<@{{user}}> licks their lips!",
        ru: "<@{{user}}> облизывается!",
        uk: "<@{{user}}> облизується!",
      },
    },
    sleep: {
      title: { en: "Sleep", ru: "Сон", uk: "Сон" },
      description: {
        en: "<@{{user}}> is sleeping!",
        ru: "<@{{user}}> спит!",
        uk: "<@{{user}}> спить!",
      },
    },
    coffee: {
      title: { en: "Coffee", ru: "Кофе", uk: "Кава" },
      description: {
        en: "<@{{user}}> drinks coffee!",
        ru: "<@{{user}}> пьет кофе!",
        uk: "<@{{user}}> п'є каву!",
      },
    },
    gah: {
      title: { en: "Gah", ru: "Гах", uk: "Гах" },
      description: {
        en: "<@{{user}}> is surprised!",
        ru: "<@{{user}}> удивлен!",
        uk: "<@{{user}}> здивований!",
      },
    },
    imageNotFound: {
      en: "Image not found",
      ru: "Изображение не найдено",
      uk: "Зображення не знайдено",
    },
  },

  async execute(interaction: InteractionLike, i18n: TranslatorLike): Promise<void> {
    const builderMode = "v2";
    await interaction.deferReply();

    const user = interaction.user;
    const emotionType = interaction.options.getString!("emotion");

    const getEmotionData = async (): Promise<ImageData | null> => {
      try {
        const sources = [HMFull.HMtai.sfw, HMFull.Nekos.sfw, HMFull.NekoBot.sfw, HMFull.NekoLove.sfw];

        for (let attempts = 0; attempts < 3; attempts += 1) {
          for (const source of sources) {
            if (emotionType && Object.keys(source).includes(emotionType)) {
              const fetcher = source[emotionType];
              if (!fetcher) {
                continue;
              }
              let imageUrl = await fetcher();
              if (typeof imageUrl === "object" && imageUrl?.url) {
                imageUrl = imageUrl.url;
              }
              if (imageUrl && typeof imageUrl === "string" && imageUrl.startsWith("http")) {
                return {
                  image: imageUrl,
                  category: emotionType,
                  emotion: await i18n.__(`commands.emotions.myself.${emotionType}.title`),
                };
              }
            }
          }
        }
        return null;
      } catch (error) {
        console.error(`Error fetching ${emotionType} image:`, error);
        return null;
      }
    };

    try {
      const emotionData = await getEmotionData();

      if (!emotionData) {
        await interaction.editReply({
          content: await i18n.__("commands.emotions.imageNotFound"),
          ephemeral: true,
        });
        return;
      }

      const emotionComponent = new ComponentBuilder({
        color: process.env.EMBED_COLOR,
        mode: builderMode,
      })
        .addText(String(await i18n.__(`commands.emotions.myself.${emotionType}.title`)), "header3")
        .addText(
          String(
            await i18n.__(`commands.emotions.myself.${emotionType}.description`, {
              user: user.id,
            })
          )
        )
        .addImage(emotionData.image)
        .addTimestamp(interaction.locale);

      const replyOptions = emotionComponent.toReplyOptions();
      const message = await interaction.editReply(replyOptions) as ExtendedMessageLike;

      const collector = message.createMessageComponentCollector({
        filter: (componentInteraction: any) => componentInteraction.user.id === user.id,
        time: 60000,
      });

      collector.on("collect", async (componentInteraction: any) => {
        if (componentInteraction.customId === "next_emotion") {
          await componentInteraction.deferUpdate();
          await getEmotionData();
        }
      });

      collector.on("end", async (_collected: unknown, reason: string) => {
        if (reason !== "messageDelete" && message.editable && message.id && message.channel) {
          try {
            const latestMessage = await message.channel.messages.fetch(message.id);
            if (latestMessage.components.length > 0) {
              await latestMessage.edit({ components: [] });
            }
          } catch (error) {
            console.error("Failed to remove components on collector end:", error);
          }
        }
      });
    } catch (error) {
      console.error("Error getting emotion data:", error);
      const errorOptions = {
        content: await i18n.__("commands.emotions.myself.imageNotFound"),
        ephemeral: true,
        components: [],
        embeds: [],
        files: [],
      };
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply(errorOptions).catch(() => {});
      } else {
        await interaction.reply(errorOptions).catch(() => {});
      }
    }
  },
};

export default command;
