import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandSubcommandBuilder,
  MessageFlags,
} from "discord.js";
import HMFull from "hmfull";
import { ComponentBuilder } from "../../utils/componentConverter.js";

export default {
  data: () => {
    const builder = new SlashCommandSubcommandBuilder()
      .setName("myself")
      .setDescription("Choose your own emotion or action")
      .addStringOption((option) =>
        option
          .setName("emotion")
          .setDescription("Choose an emotion or action")
          .setRequired(true)
          .addChoices(
            { name: "blush", value: "blush" },
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
            { name: "gah", value: "gah" }
          )
      );

    return builder;
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
      title: {
        en: "Blush",
        ru: "Смущение",
        uk: "Зніяковіння",
      },
      description: {
        en: "<@{{user}}> is blushing!",
        ru: "<@{{user}}> смущается!",
        uk: "<@{{user}}> ніяковіє!",
      },
    },
    smug: {
      title: {
        en: "Smug",
        ru: "Самодовольство",
        uk: "Самовдоволення",
      },
      description: {
        en: "<@{{user}}> looks smug!",
        ru: "<@{{user}}> выглядит самодовольно!",
        uk: "<@{{user}}> виглядає самовдоволено!",
      },
    },
    happy: {
      title: {
        en: "Happy",
        ru: "Радость",
        uk: "Радість",
      },
      description: {
        en: "<@{{user}}> is happy!",
        ru: "<@{{user}}> радуется!",
        uk: "<@{{user}}> радіє!",
      },
    },
    smile: {
      title: {
        en: "Smile",
        ru: "Улыбка",
        uk: "Посмішка",
      },
      description: {
        en: "<@{{user}}> smiles!",
        ru: "<@{{user}}> улыбается!",
        uk: "<@{{user}}> посміхається!",
      },
    },
    dance: {
      title: {
        en: "Dance",
        ru: "Танец",
        uk: "Танець",
      },
      description: {
        en: "<@{{user}}> is dancing!",
        ru: "<@{{user}}> танцует!",
        uk: "<@{{user}}> танцює!",
      },
    },
    like: {
      title: {
        en: "Like",
        ru: "Нравится",
        uk: "Подобається",
      },
      description: {
        en: "<@{{user}}> likes this!",
        ru: "<@{{user}}> это нравится!",
        uk: "<@{{user}}> це подобається!",
      },
    },
    cry: {
      title: {
        en: "Cry",
        ru: "Плач",
        uk: "Плач",
      },
      description: {
        en: "<@{{user}}> is crying!",
        ru: "<@{{user}}> плачет!",
        uk: "<@{{user}}> плаче!",
      },
    },
    nosebleed: {
      title: {
        en: "Nosebleed",
        ru: "Кровь из носа",
        uk: "Кров з носа",
      },
      description: {
        en: "<@{{user}}> has a nosebleed!",
        ru: "У <@{{user}}> идет кровь из носа!",
        uk: "У <@{{user}}> йде кров з носа!",
      },
    },
    depression: {
      title: {
        en: "Depression",
        ru: "Депрессия",
        uk: "Депресія",
      },
      description: {
        en: "<@{{user}}> is depressed!",
        ru: "<@{{user}}> в депрессии!",
        uk: "<@{{user}}> у депресії!",
      },
    },
    tea: {
      title: {
        en: "Tea",
        ru: "Чай",
        uk: "Чай",
      },
      description: {
        en: "<@{{user}}> drinks tea!",
        ru: "<@{{user}}> пьет чай!",
        uk: "<@{{user}}> п'є чай!",
      },
    },
    nom: {
      title: {
        en: "Nom",
        ru: "Ням",
        uk: "Ням",
      },
      description: {
        en: "<@{{user}}> is eating!",
        ru: "<@{{user}}> кушает!",
        uk: "<@{{user}}> їсть!",
      },
    },
    lick: {
      title: {
        en: "Lick",
        ru: "Облизывание",
        uk: "Облизування",
      },
      description: {
        en: "<@{{user}}> licks their lips!",
        ru: "<@{{user}}> облизывается!",
        uk: "<@{{user}}> облизується!",
      },
    },
    sleep: {
      title: {
        en: "Sleep",
        ru: "Сон",
        uk: "Сон",
      },
      description: {
        en: "<@{{user}}> is sleeping!",
        ru: "<@{{user}}> спит!",
        uk: "<@{{user}}> спить!",
      },
    },
    coffee: {
      title: {
        en: "Coffee",
        ru: "Кофе",
        uk: "Кава",
      },
      description: {
        en: "<@{{user}}> drinks coffee!",
        ru: "<@{{user}}> пьет кофе!",
        uk: "<@{{user}}> п'є каву!",
      },
    },
    gah: {
      title: {
        en: "Gah",
        ru: "Гах",
        uk: "Гах",
      },
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

  async execute(interaction, i18n) {
    await interaction.deferReply();
    const { guild, user } = interaction;
    const emotionType = interaction.options.getString("emotion"); // Get the specified emotion

    // Restore original image fetching logic
    async function getEmotionData() {
      try {
        const sources = [
          HMFull.HMtai.sfw, // Assuming sfw source is appropriate
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
                    `commands.emotions.myself.${emotionType}.title`
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

      // Validate fetched data
      if (!emotionData || !emotionData.image) {
        console.warn("Invalid or missing image URL for emotion:", emotionType);
        emotionData = await getEmotionData(); // Retry fetch
        if (!emotionData || !emotionData.image) {
          return {
            content: i18n.__("commands.emotions.myself.imageNotFound"),
            components: [],
            ephemeral: true,
          };
        }
      }

      // Use ComponentBuilder directly with the fetched image URL
      const emotionComponent = new ComponentBuilder()
        .setColor(process.env.EMBED_COLOR ?? 0x0099ff)
        .addText(
          i18n.__(
            `commands.emotions.myself.${emotionData.category}.description`,
            {
              user: user.id,
            }
          ) ||
            i18n.__(`commands.emotions.myself.${emotionData.category}.title`),
          "header3"
        )
        .addImage(emotionData.image)
        .addTimestamp(interaction.locale);

      // Define action row (button) but don't add it yet
      const nextButton = new ButtonBuilder()
        .setCustomId("next_emotion")
        .setEmoji("🔄")
        .setStyle(ButtonStyle.Primary);

      const buttonRow = new ActionRowBuilder().addComponents(nextButton);

      // Conditionally add the button row
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
      time: 60000, // 1 minute
    });

    collector.on("collect", async (i) => {
      if (i.customId === "next_emotion") {
        await i.deferUpdate();
        // Fetch new emotion data for the SAME type initially requested
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
