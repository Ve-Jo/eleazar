import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandSubcommandBuilder,
  MessageFlags,
  ComponentType,
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
    // Determine builder mode based on execution context
    const isAiContext = !!interaction._isAiProxy;
    const builderMode = isAiContext ? "v1" : "v2";

    // Defer only for normal context
    if (!isAiContext) {
      await interaction.deferReply();
    }

    const { guild, user } = interaction;
    const emotionType = interaction.options.getString("emotion");

    // Inner function to handle fetching and displaying
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

    try {
      const emotionUrl = await getEmotionData(); // Get the emotion image URL

      if (!emotionUrl) {
        const errorOptions = {
          content: i18n.__("commands.emotions.imageNotFound"),
          ephemeral: true,
        };
        if (isAiContext) {
          throw new Error(i18n.__("commands.emotions.imageNotFound"));
        } else {
          return interaction.editReply(errorOptions);
        }
      }

      // Create embed/component with emotion image and description
      const emotionComponent = new ComponentBuilder({
        color: process.env.EMBED_COLOR, // Or determine color based on emotion?
        mode: builderMode,
      })
        .addText(
          i18n.__(`commands.emotions.myself.${emotionType}.title`),
          "header3"
        )
        .addText(
          i18n.__(`commands.emotions.myself.${emotionType}.description`, {
            user: user.id,
          })
        )
        .addImage(emotionUrl.image)
        .addTimestamp(interaction.locale);

      // Prepare reply options
      const replyOptions = emotionComponent.toReplyOptions({
        // Add content only for V1 mode (AI context)
        content: isAiContext
          ? i18n.__(`commands.emotions.myself.${emotionType}.title`)
          : undefined,
      });

      // Handle initial reply/edit based on context
      let message;
      if (isAiContext) {
        message = await interaction.reply(replyOptions);
        // No collector needed for AI
      } else {
        message = await interaction.editReply(replyOptions);

        // Create collector for the button (only for normal context)
        const collector = message.createMessageComponentCollector({
          componentType: ComponentType.Button,
          filter: (i) => i.user.id === user.id, // Only the original user can click "Next"
          time: 60000, // 60 seconds
        });

        collector.on("collect", async (i) => {
          if (i.customId === "next_emotion") {
            await i.deferUpdate(); // Acknowledge the button click
            await getEmotionData(); // Fetch and display the next image
          }
        });

        collector.on("end", async (collected, reason) => {
          if (reason !== "messageDelete" && message.editable) {
            try {
              // Fetch the latest message state to remove components
              const latestMessage = await message.channel.messages.fetch(
                message.id
              );
              if (latestMessage.components.length > 0) {
                await latestMessage.edit({ components: [] });
              }
            } catch (error) {
              console.error(
                "Failed to remove components on collector end:",
                error
              );
            }
          }
        });
      }
    } catch (error) {
      console.error("Error getting emotion data:", error);
      const errorOptions = {
        content: i18n.__("commands.emotions.myself.imageNotFound"),
        ephemeral: true,
        components: [],
        embeds: [],
        files: [],
      };
      if (isAiContext) {
        throw new Error(i18n.__("commands.emotions.myself.imageNotFound"));
      } else {
        if (interaction.replied || interaction.deferred) {
          await interaction.editReply(errorOptions).catch(() => {});
        } else {
          await interaction.reply(errorOptions).catch(() => {});
        }
      }
    }
  },
};
