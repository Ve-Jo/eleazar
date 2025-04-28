import {
  SlashCommandSubcommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
} from "discord.js";
import HMFull from "hmfull";
import { ComponentBuilder } from "../../utils/componentConverter.js";

export default {
  data: () => {
    const builder = new SlashCommandSubcommandBuilder()
      .setName("positive")
      .setDescription("Choose a positive emotion with a user")
      .addStringOption((option) =>
        option
          .setName("emotion")
          .setDescription("Choose an emotion")
          .setRequired(true)
          .addChoices(
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
            { name: "boop", value: "boop" }
          )
      )
      .addUserOption((option) =>
        option.setName("user").setDescription("Choose a user").setRequired(true)
      );

    return builder;
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
      title: {
        en: "Wave",
        ru: "Приветствие",
        uk: "Привітання",
      },
      description: {
        en: "<@{{user}}> waves at <@{{targetUser}}>!",
        ru: "<@{{user}}> машет <@{{targetUser}}>!",
        uk: "<@{{user}}> махає <@{{targetUser}}>!",
      },
    },
    wink: {
      title: {
        en: "Wink",
        ru: "Подмигивание",
        uk: "Підморгування",
      },
      description: {
        en: "<@{{user}}> winks at <@{{targetUser}}>!",
        ru: "<@{{user}}> подмигивает <@{{targetUser}}>!",
        uk: "<@{{user}}> підморгує <@{{targetUser}}>!",
      },
    },
    pat: {
      title: {
        en: "Pat",
        ru: "Поглаживание",
        uk: "Погладжування",
      },
      description: {
        en: "<@{{user}}> pats <@{{targetUser}}>!",
        ru: "<@{{user}}> гладит <@{{targetUser}}>!",
        uk: "<@{{user}}> гладить <@{{targetUser}}>!",
      },
    },
    kiss: {
      title: {
        en: "Kiss",
        ru: "Поцелуй",
        uk: "Поцілунок",
      },
      description: {
        en: "<@{{user}}> kisses <@{{targetUser}}>!",
        ru: "<@{{user}}> целует <@{{targetUser}}>!",
        uk: "<@{{user}}> цілує <@{{targetUser}}>!",
      },
    },
    feed: {
      title: {
        en: "Feed",
        ru: "Кормление",
        uk: "Годування",
      },
      description: {
        en: "<@{{user}}> feeds <@{{targetUser}}>!",
        ru: "<@{{user}}> кормит <@{{targetUser}}>!",
        uk: "<@{{user}}> годує <@{{targetUser}}>!",
      },
    },
    hug: {
      title: {
        en: "Hug",
        ru: "Объятие",
        uk: "Обійми",
      },
      description: {
        en: "<@{{user}}> hugs <@{{targetUser}}>!",
        ru: "<@{{user}}> обнимает <@{{targetUser}}>!",
        uk: "<@{{user}}> обіймає <@{{targetUser}}>!",
      },
    },
    cuddle: {
      title: {
        en: "Cuddle",
        ru: "Прижимание",
        uk: "Притискання",
      },
      description: {
        en: "<@{{user}}> cuddles with <@{{targetUser}}>!",
        ru: "<@{{user}}> прижимается к <@{{targetUser}}>!",
        uk: "<@{{user}}> притискається до <@{{targetUser}}>!",
      },
    },
    five: {
      title: {
        en: "High Five",
        ru: "Дать пять",
        uk: "Дати п'ять",
      },
      description: {
        en: "<@{{user}}> high fives <@{{targetUser}}>!",
        ru: "<@{{user}}> дает пять <@{{targetUser}}>!",
        uk: "<@{{user}}> дає п'ять <@{{targetUser}}>!",
      },
    },
    glomp: {
      title: {
        en: "Glomp",
        ru: "Тискание",
        uk: "Стискання",
      },
      description: {
        en: "<@{{user}}> glomps <@{{targetUser}}>!",
        ru: "<@{{user}}> тискает <@{{targetUser}}>!",
        uk: "<@{{user}}> стискає <@{{targetUser}}>!",
      },
    },
    hold: {
      title: {
        en: "Hold",
        ru: "Держание за руку",
        uk: "Тримання за руку",
      },
      description: {
        en: "<@{{user}}> holds hands with <@{{targetUser}}>!",
        ru: "<@{{user}}> держит за руку <@{{targetUser}}>!",
        uk: "<@{{user}}> тримає за руку <@{{targetUser}}>!",
      },
    },
    boop: {
      title: {
        en: "Boop",
        ru: "Тык в нос",
        uk: "Тик у ніс",
      },
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

  async execute(interaction, i18n) {
    await interaction.deferReply();
    const { guild, user } = interaction;
    const targetUser = interaction.options.getUser("user") || user;
    const emotionType = interaction.options.getString("emotion");

    async function getEmotionData() {
      try {
        const sources = [
          HMFull.HMtai.sfw,
          HMFull.Nekos.sfw,
          HMFull.NekoBot.sfw,
          HMFull.NekoLove.sfw,
        ];

        for (let attempts = 0; attempts < 3; attempts++) {
          for (const source of sources) {
            if (Object.keys(source).includes(emotionType)) {
              let imageUrl = await source[emotionType]();
              if (typeof imageUrl === "object" && imageUrl.url) {
                imageUrl = imageUrl.url;
              }
              if (
                imageUrl &&
                typeof imageUrl === "string" &&
                imageUrl.startsWith("http")
              ) {
                return {
                  image: imageUrl,
                  category: emotionType,
                  emotion: i18n.__(
                    `commands.emotions.positive.${emotionType}.title`
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
    }

    let emotionData = await getEmotionData();

    const generateEmotionMessage = async (options = {}) => {
      const { disableInteractions = false } = options;

      if (!emotionData || !emotionData.image) {
        console.warn("Invalid or missing image URL for emotion:", emotionType);
        emotionData = await getEmotionData();
        if (!emotionData || !emotionData.image) {
          return {
            content: i18n.__("commands.emotions.positive.imageNotFound"),
            components: [],
            ephemeral: true,
          };
        }
      }

      const emotionComponent = new ComponentBuilder()
        .setColor(process.env.EMBED_COLOR ?? 0x0099ff)
        .addText(
          i18n.__(
            `commands.emotions.positive.${emotionData.category}.description`,
            {
              user: user.id,
              targetUser: targetUser.id,
            }
          ) ||
            i18n.__(`commands.emotions.positive.${emotionData.category}.title`),
          "header3"
        )
        .addImage(emotionData.image)
        .addTimestamp(interaction.locale);

      const nextButton = new ButtonBuilder()
        .setCustomId("next_emotion")
        .setEmoji("🔄")
        .setStyle(ButtonStyle.Primary);

      const buttonRow = new ActionRowBuilder().addComponents(nextButton);

      if (!disableInteractions) {
        emotionComponent.addActionRow(buttonRow);
      }

      return {
        components: [emotionComponent.build()],
        flags: MessageFlags.IsComponentsV2,
      };
    };

    let initialMessageData = await generateEmotionMessage();
    if (initialMessageData.content) {
      return interaction.editReply(initialMessageData);
    }
    const message = await interaction.editReply(initialMessageData);

    const collector = message.createMessageComponentCollector({
      filter: (i) => i.user.id === user.id,
      time: 60000,
    });

    collector.on("collect", async (i) => {
      if (i.customId === "next_emotion") {
        await i.deferUpdate();
        emotionData = await getEmotionData();
        const newMessageData = await generateEmotionMessage();
        if (newMessageData.content) {
          await i.followUp({ ...newMessageData, ephemeral: true });
        } else {
          await i.editReply(newMessageData);
        }
      }
    });

    collector.on("end", async () => {
      if (message.editable) {
        try {
          const finalMessageData = await generateEmotionMessage({
            disableInteractions: true,
          });
          if (!finalMessageData.content) {
            await message.edit(finalMessageData);
          }
        } catch (error) {
          console.error("Error updating components on end:", error);
          await message.edit({ components: [] }).catch(() => {});
        }
      }
    });
  },
};
