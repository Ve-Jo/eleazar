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

const negativeEmotions = Object.fromEntries(
  [
    "bonk",
    "punch",
    "poke",
    "bully",
    "kick",
    "slap",
    "throw",
    "bite",
    "kill",
    "threaten",
    "tickle",
  ].map((key) => [key, key])
);

export default {
  data: () => {
    const builder = new SlashCommandSubcommandBuilder()
      .setName("negative")
      .setDescription("Choose a negative emotion with a user")
      .addStringOption((option) =>
        option
          .setName("emotion")
          .setDescription("Choose an emotion")
          .setRequired(true)
          .addChoices(
            { name: "bonk", value: "bonk" },
            { name: "punch", value: "punch" },
            { name: "poke", value: "poke" },
            { name: "bully", value: "bully" },
            { name: "kick", value: "kick" },
            { name: "slap", value: "slap" },
            { name: "throw", value: "throw" },
            { name: "bite", value: "bite" },
            { name: "kill", value: "kill" },
            { name: "threaten", value: "threaten" },
            { name: "tickle", value: "tickle" }
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
        ru: "негативные",
        uk: "негативні",
      },
      description: {
        ru: "Выберите негативную эмоцию с пользователем",
        uk: "Виберіть негативну емоцію з користувачем",
      },
    },
    bonk: {
      title: {
        en: "Bonk",
        ru: "Стук",
        uk: "Стук",
      },
      description: {
        en: "<@{{user}}> bonks <@{{targetUser}}>!",
        ru: "<@{{user}}> стукает <@{{targetUser}}>!",
        uk: "<@{{user}}> стукає <@{{targetUser}}>!",
      },
    },
    punch: {
      title: {
        en: "Punch",
        ru: "Удар",
        uk: "Удар",
      },
      description: {
        en: "<@{{user}}> punches <@{{targetUser}}>!",
        ru: "<@{{user}}> бьет <@{{targetUser}}>!",
        uk: "<@{{user}}> б'є <@{{targetUser}}>!",
      },
    },
    poke: {
      title: {
        en: "Poke",
        ru: "Тык",
        uk: "Тык",
      },
      description: {
        en: "<@{{user}}> pokes <@{{targetUser}}>!",
        ru: "<@{{user}}> тыкает <@{{targetUser}}>!",
        uk: "<@{{user}}> тикає <@{{targetUser}}>!",
      },
    },
    bully: {
      title: {
        en: "Bully",
        ru: "Издевание",
        uk: "Знущання",
      },
      description: {
        en: "<@{{user}}> bullies <@{{targetUser}}>!",
        ru: "<@{{user}}> издевается над <@{{targetUser}}>!",
        uk: "<@{{user}}> знущається з <@{{targetUser}}>!",
      },
    },
    kick: {
      title: {
        en: "Kick",
        ru: "Пинание",
        uk: "Пинає",
      },
      description: {
        en: "<@{{user}}> kicks <@{{targetUser}}>!",
        ru: "<@{{user}}> пинает <@{{targetUser}}>!",
        uk: "<@{{user}}> б'є ногою <@{{targetUser}}>!",
      },
    },
    slap: {
      title: {
        en: "Slap",
        ru: "Шлеп",
        uk: "Шлеп",
      },
      description: {
        en: "<@{{user}}> slaps <@{{targetUser}}>!",
        ru: "<@{{user}}> шлепает <@{{targetUser}}>!",
        uk: "<@{{user}}> ляпає <@{{targetUser}}>!",
      },
    },
    throw: {
      title: {
        en: "Throw",
        ru: "Бросок",
        uk: "Кидок",
      },
      description: {
        en: "<@{{user}}> throws something at <@{{targetUser}}>!",
        ru: "<@{{user}}> бросает что-то в <@{{targetUser}}>!",
        uk: "<@{{user}}> кидає щось у <@{{targetUser}}>!",
      },
    },
    bite: {
      title: {
        en: "Bite",
        ru: "Кусание",
        uk: "Кусає",
      },
      description: {
        en: "<@{{user}}> bites <@{{targetUser}}>!",
        ru: "<@{{user}}> кусает <@{{targetUser}}>!",
        uk: "<@{{user}}> кусає <@{{targetUser}}>!",
      },
    },
    kill: {
      title: {
        en: "Kill",
        ru: "Убийство",
        uk: "Убивство",
      },
      description: {
        en: "<@{{user}}> kills <@{{targetUser}}>!",
        ru: "<@{{user}}> убивает <@{{targetUser}}>!",
        uk: "<@{{user}}> вбиває <@{{targetUser}}>!",
      },
    },
    threaten: {
      title: {
        en: "Threaten",
        ru: "Угроза",
        uk: "Погроза",
      },
      description: {
        en: "<@{{user}}> threatens <@{{targetUser}}>!",
        ru: "<@{{user}}> угрожает <@{{targetUser}}>!",
        uk: "<@{{user}}> погрожує <@{{targetUser}}>!",
      },
    },
    tickle: {
      title: {
        en: "Tickle",
        ru: "Щекотание",
        uk: "Лоскоче",
      },
      description: {
        en: "<@{{user}}> tickles <@{{targetUser}}>!",
        ru: "<@{{user}}> щекочет <@{{targetUser}}>!",
        uk: "<@{{user}}> лоскоче <@{{targetUser}}>!",
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
                    `commands.emotions.negative.${emotionType}.title`
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
            // Return error state object
            content: i18n.__("commands.emotions.negative.imageNotFound"),
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
            `commands.emotions.negative.${emotionData.category}.description`,
            {
              user: user.id,
              targetUser: targetUser.id,
            }
          ) ||
            i18n.__(`commands.emotions.negative.${emotionData.category}.title`),
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
        // Return success state object
        components: [emotionComponent.build()],
        flags: MessageFlags.IsComponentsV2,
      };
    };

    let initialMessageData = await generateEmotionMessage();
    if (initialMessageData.content) {
      // Check if generate returned an error state
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
        emotionData = await getEmotionData();
        const newMessageData = await generateEmotionMessage();
        if (newMessageData.content) {
          // Check for error on refetch
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
            // Check for error before final edit
            await message.edit(finalMessageData);
          }
        } catch (error) {
          console.error("Error updating components on end:", error);
          await message.edit({ components: [] }).catch(() => {}); // Fallback
        }
      }
    });
  },
};
