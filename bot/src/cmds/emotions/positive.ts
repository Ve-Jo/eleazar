import { ButtonBuilder, ButtonStyle, SlashCommandSubcommandBuilder } from "discord.js";
import HMFull from "hmfull";
import { ComponentBuilder } from "../../utils/componentConverter.ts";
import type { TranslatorLike, InteractionLike, ImageData, ExtendedMessageLike } from "../../types/index.ts";

const positiveEmotionChoices = [
  { name: "wave", value: "wave" },
  { name: "wink", value: "wink" },
  { name: "pat", value: "pat" },
  { name: "kiss", value: "kiss" },
  { name: "feed", value: "feed" },
  { name: "hug", value: "hug" },
  { name: "cuddle", value: "cuddle" },
  { name: "five", value: "five" },
  { name: "glomp", value: "glomp" },
  { name: "hold", value: "hold" },
  { name: "boop", value: "boop" },
] as const;

const command = {
  data: (): SlashCommandSubcommandBuilder => {
    return new SlashCommandSubcommandBuilder()
      .setName("positive")
      .setDescription("Choose a positive emotion with a user")
      .addStringOption((option) =>
        option
          .setName("emotion")
          .setDescription("Choose an emotion")
          .setRequired(true)
          .addChoices(...positiveEmotionChoices)
      )
      .addUserOption((option) =>
        option.setName("user").setDescription("Choose a user").setRequired(true)
      );
  },

  localization_strings: {
    command: {
      name: {
        ru: "позитивные",
        uk: "позитивні",
      },
      description: {
        ru: "Выберите позитивную эмоцию с пользователем",
        uk: "Виберіть позитивну емоцію з користувачем",
      },
    },
    wave: {
      title: { en: "Wave", ru: "Приветствие", uk: "Привітання" },
      description: {
        en: "<@{{user}}> waves at <@{{targetUser}}>!",
        ru: "<@{{user}}> машет <@{{targetUser}}>!",
        uk: "<@{{user}}> махає <@{{targetUser}}>!",
      },
    },
    wink: {
      title: { en: "Wink", ru: "Подмигивание", uk: "Підморгування" },
      description: {
        en: "<@{{user}}> winks at <@{{targetUser}}>!",
        ru: "<@{{user}}> подмигивает <@{{targetUser}}>!",
        uk: "<@{{user}}> підморгує <@{{targetUser}}>!",
      },
    },
    pat: {
      title: { en: "Pat", ru: "Поглаживание", uk: "Погладжування" },
      description: {
        en: "<@{{user}}> pats <@{{targetUser}}>!",
        ru: "<@{{user}}> гладит <@{{targetUser}}>!",
        uk: "<@{{user}}> гладить <@{{targetUser}}>!",
      },
    },
    kiss: {
      title: { en: "Kiss", ru: "Поцелуй", uk: "Поцілунок" },
      description: {
        en: "<@{{user}}> kisses <@{{targetUser}}>!",
        ru: "<@{{user}}> целует <@{{targetUser}}>!",
        uk: "<@{{user}}> цілує <@{{targetUser}}>!",
      },
    },
    feed: {
      title: { en: "Feed", ru: "Кормление", uk: "Годування" },
      description: {
        en: "<@{{user}}> feeds <@{{targetUser}}>!",
        ru: "<@{{user}}> кормит <@{{targetUser}}>!",
        uk: "<@{{user}}> годує <@{{targetUser}}>!",
      },
    },
    hug: {
      title: { en: "Hug", ru: "Объятие", uk: "Обійми" },
      description: {
        en: "<@{{user}}> hugs <@{{targetUser}}>!",
        ru: "<@{{user}}> обнимает <@{{targetUser}}>!",
        uk: "<@{{user}}> обіймає <@{{targetUser}}>!",
      },
    },
    cuddle: {
      title: { en: "Cuddle", ru: "Прижимание", uk: "Притискання" },
      description: {
        en: "<@{{user}}> cuddles with <@{{targetUser}}>!",
        ru: "<@{{user}}> прижимается к <@{{targetUser}}>!",
        uk: "<@{{user}}> притискається до <@{{targetUser}}>!",
      },
    },
    five: {
      title: { en: "High Five", ru: "Дать пять", uk: "Дати п'ять" },
      description: {
        en: "<@{{user}}> high fives <@{{targetUser}}>!",
        ru: "<@{{user}}> дает пять <@{{targetUser}}>!",
        uk: "<@{{user}}> дає п'ять <@{{targetUser}}>!",
      },
    },
    glomp: {
      title: { en: "Glomp", ru: "Тискание", uk: "Стискання" },
      description: {
        en: "<@{{user}}> glomps <@{{targetUser}}>!",
        ru: "<@{{user}}> тискает <@{{targetUser}}>!",
        uk: "<@{{user}}> стискає <@{{targetUser}}>!",
      },
    },
    hold: {
      title: { en: "Hold", ru: "Держание за руку", uk: "Тримання за руку" },
      description: {
        en: "<@{{user}}> holds hands with <@{{targetUser}}>!",
        ru: "<@{{user}}> держит за руку <@{{targetUser}}>!",
        uk: "<@{{user}}> тримає за руку <@{{targetUser}}>!",
      },
    },
    boop: {
      title: { en: "Boop", ru: "Тык в нос", uk: "Тик у ніс" },
      description: {
        en: "<@{{user}}> boops <@{{targetUser}}>!",
        ru: "<@{{user}}> тыкает в нос <@{{targetUser}}>!",
        uk: "<@{{user}}> тикає в ніс <@{{targetUser}}>!",
      },
    },
    imageNotFound: {
      en: "Image not found",
      ru: "Изображение не найдено",
      uk: "Зображення не знайдено",
    },
    cannotSelectSelf: {
      en: "You cannot select yourself",
      ru: "Вы не можете выбрать себя",
      uk: "Ви не можете вибрати себе",
    },
    cannotSelectBot: {
      en: "You cannot select a bot",
      ru: "Вы не можете выбрать бота",
      uk: "Ви не можете вибрати бота",
    },
    returnEmotion: {
      en: "Return the emotion",
      ru: "Вернуть эмоцию",
      uk: "Повернути емоцію",
    },
    onlyTargetUserCanRespond: {
      en: "Only the target user can respond",
      ru: "Только пользователь может ответить",
      uk: "Тільки користувач може відповісти",
    },
    next: {
      en: "Next",
      ru: "Следующая",
      uk: "Наступна",
    },
  },

  async execute(interaction: InteractionLike, i18n: TranslatorLike): Promise<void> {
    await executePositiveEmotion(interaction, i18n);
  },
};

async function executePositiveEmotion(
  interaction: InteractionLike,
  i18n: TranslatorLike
): Promise<void> {
  const builderMode = "v2";
  await interaction.deferReply();

  const user = interaction.user;
  const targetUser = interaction.options.getUser!("user") || user;
  const emotionType = interaction.options.getString!("emotion");

  if (targetUser.id === user.id) {
    await interaction.editReply({
      content: await i18n.__("commands.emotions.cannotSelectSelf"),
      ephemeral: true,
    });
    return;
  }

  if (targetUser.bot) {
    await interaction.editReply({
      content: await i18n.__("commands.emotions.cannotSelectBot"),
      ephemeral: true,
    });
    return;
  }

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
                emotion: await i18n.__(`commands.emotions.positive.${emotionType}.title`),
                description: await i18n.__(
                  `commands.emotions.positive.${emotionType}.description`,
                  { user: interaction.user.id, targetUser: targetUser.id }
                ),
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

    if (!emotionData?.image) {
      await interaction.editReply({
        content: await i18n.__("commands.emotions.positive.imageNotFound"),
        ephemeral: true,
      });
      return;
    }

    const emotionComponent = new ComponentBuilder({
      color: process.env.EMBED_COLOR,
      mode: builderMode,
    })
      .addText(String(emotionData.emotion), "header3")
      .addText(String(emotionData.description))
      .addImage(emotionData.image)
      .addTimestamp(interaction.locale);

    const nextLabel = String(await i18n.__("commands.emotions.next"));
    const returnLabel = String(await i18n.__("commands.emotions.returnEmotion"));

    const nextButton = new ButtonBuilder()
      .setCustomId("next_emotion")
      .setLabel(nextLabel)
      .setStyle(ButtonStyle.Secondary);

    const returnButton = new ButtonBuilder()
      .setCustomId("return_emotion")
      .setLabel(returnLabel)
      .setStyle(ButtonStyle.Success);

    emotionComponent.addButtons(nextButton, returnButton);

    const replyOptions = emotionComponent.toReplyOptions();
    const message = await interaction.editReply(replyOptions) as ExtendedMessageLike;

    const collector = message.createMessageComponentCollector({
      time: 60000,
    });

    collector.on("collect", async (componentInteraction: any) => {
      if (componentInteraction.customId === "next_emotion") {
        if (componentInteraction.user.id !== user.id) {
          await componentInteraction.reply({
            content: "Only the command user can request the next image.",
            ephemeral: true,
          });
          return;
        }
        await componentInteraction.deferUpdate();
        await getEmotionData();
        return;
      }

      if (componentInteraction.customId === "return_emotion") {
        if (componentInteraction.user.id !== targetUser.id) {
          await componentInteraction.reply({
            content: await i18n.__("commands.emotions.onlyTargetUserCanRespond"),
            ephemeral: true,
          });
          return;
        }

        await componentInteraction.deferUpdate();

        const targetMember = await interaction.guild?.members?.fetch(targetUser.id);
        const returnInteraction: InteractionLike = {
          ...interaction,
          user: targetUser,
          member: targetMember,
          options: {
            getString: (name: string) => (name === "emotion" ? emotionType : null),
            getUser: (name: string) => (name === "user" ? user : null),
          },
          reply: async (options: unknown) => componentInteraction.followUp({ ...options as Record<string, unknown>, ephemeral: true }),
          editReply: async (options: unknown) => componentInteraction.followUp({ ...options as Record<string, unknown>, ephemeral: true }),
          deferReply: async () => undefined,
          followUp: async (options: unknown) => componentInteraction.followUp(options),
          deleteReply: async () => undefined,
          fetchReply: async () => message,
          channel: interaction.channel,
          client: interaction.client,
          guild: interaction.guild,
          locale: componentInteraction.locale,
        };

        try {
          await executePositiveEmotion(returnInteraction, i18n);
        } catch (returnError) {
          console.error("Error executing return emotion:", returnError);
          await componentInteraction.followUp({
            content: "Failed to return the emotion.",
            ephemeral: true,
          });
        }
      }
    });

    collector.on("end", async (_collected: unknown, reason: string) => {
      if (reason !== "messageDelete" && message.editable && message.id && message.channel) {
        try {
          const latestMessage = await message.channel.messages?.fetch(message.id);
          if (latestMessage && latestMessage.components.length > 0) {
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
      content: await i18n.__("commands.emotions.positive.imageNotFound"),
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
}

export default command;
