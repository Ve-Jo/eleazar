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
            { name: "boop", value: "boop" },
          ),
      )
      .addUserOption((option) =>
        option
          .setName("user")
          .setDescription("Choose a user")
          .setRequired(true),
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
    // Determine builder mode based on execution context
    const builderMode = "v2";

    // Defer the reply
    await interaction.deferReply();

    const { guild, user } = interaction;
    const targetUser = interaction.options.getUser("user") || user;
    const emotionType = interaction.options.getString("emotion");

    // Prevent interaction with self or bots
    if (targetUser.id === user.id) {
      return interaction.editReply({
        content: await i18n.__("commands.emotions.cannotSelectSelf"),
        ephemeral: true,
      });
    }
    if (targetUser.bot) {
      return interaction.editReply({
        content: await i18n.__("commands.emotions.cannotSelectBot"),
        ephemeral: true,
      });
    }

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
                  emotion: await i18n.__(
                    `commands.emotions.positive.${emotionType}.title`,
                  ),
                  description: await i18n.__(
                    `commands.emotions.positive.${emotionType}.description`,
                    { user: interaction.user.id, targetUser: targetUser.id },
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
      // Fetch image URL
      const emotionData = await getEmotionData();

      if (!emotionData || !emotionData.image) {
        const errorOptions = {
          content: await i18n.__("commands.emotions.positive.imageNotFound"),
          ephemeral: true,
        };
        return interaction.editReply(errorOptions);
      }

      // Create component using ComponentBuilder
      const emotionComponent = new ComponentBuilder({
        color: process.env.EMBED_COLOR,
        mode: builderMode,
      })
        .addText(emotionData.emotion, "header3") // Use title from getEmotionData
        .addText(emotionData.description) // Use description from getEmotionData
        .addImage(emotionData.image)
        .addTimestamp(interaction.locale);

      // Add buttons
      const nextButton = new ButtonBuilder()
        .setCustomId("next_emotion")
        .setLabel(await i18n.__("commands.emotions.next"))
        .setStyle(ButtonStyle.Secondary);

      const returnButton = new ButtonBuilder()
        .setCustomId("return_emotion")
        .setLabel(await i18n.__("commands.emotions.returnEmotion"))
        .setStyle(ButtonStyle.Success);

      // Add buttons using the builder method
      emotionComponent.addButtons(nextButton, returnButton);

      // Prepare reply options
      const replyOptions = emotionComponent.toReplyOptions();

      // Edit the deferred reply
      let message;
      message = await interaction.editReply(replyOptions);

      // Add collector for buttons (only for normal context)
      const collector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 60000, // 60 seconds
      });

      collector.on("collect", async (i) => {
        if (i.customId === "next_emotion") {
          // Only the original user can get the next image
          if (i.user.id !== user.id) {
            await i.reply({
              content: "Only the command user can request the next image.",
              ephemeral: true,
            });
            return;
          }
          await i.deferUpdate();
          await getEmotionData(); // Fetch and display next image
        } else if (i.customId === "return_emotion") {
          // Only the TARGET user can return the emotion
          if (i.user.id !== targetUser.id) {
            await i.reply({
              content: await i18n.__(
                "commands.emotions.onlyTargetUserCanRespond",
              ),
              ephemeral: true,
            });
            return;
          }

          await i.deferUpdate(); // Acknowledge the button click

          // Create a new interaction-like object for the return action
          const returnInteraction = {
            ...interaction, // Copy original interaction context
            user: targetUser, // Set the user to the target user
            member: await interaction.guild.members.fetch(targetUser.id), // Fetch target member
            options: {
              // Mimic options for the return action
              getString: (name) => (name === "emotion" ? emotionType : null),
              getUser: (name) => (name === "user" ? user : null), // Target user is now the sender (user)
            },
            // Important: Do NOT copy _isAiProxy, this is a real user interaction
            _isAiProxy: false,
            // Provide fake reply/editReply functions that send a new message
            // or handle errors if needed, as we can't edit the original AI message directly
            // in a clean way from the target user's perspective.
            reply: async (options) =>
              i.followUp({ ...options, ephemeral: true }),
            editReply: async (options) =>
              i.followUp({ ...options, ephemeral: true }),
            deferReply: async () => {
              /* Do nothing, already handled */
            },
            followUp: async (options) => i.followUp(options),
            deleteReply: async () => {
              /* Cannot delete original */
            },
            fetchReply: async () => {
              /* Returns original message if needed */ return message;
            },
            channel: interaction.channel,
            client: interaction.client,
            guild: interaction.guild,
            locale: i.locale, // Use the locale of the user clicking the button
            isCommand: () => false,
            isChatInputCommand: () => false, // Not a command interaction
          };

          // Execute the command logic again with the swapped users
          try {
            await execute(returnInteraction, i18n);
            // Optionally disable the return button on the original message after success?
          } catch (returnError) {
            console.error("Error executing return emotion:", returnError);
            await i.followUp({
              content: "Failed to return the emotion.",
              ephemeral: true,
            });
          }
        }
      });

      collector.on("end", async (collected, reason) => {
        if (reason !== "messageDelete" && message.editable) {
          try {
            const latestMessage = await message.channel.messages.fetch(
              message.id,
            );
            if (latestMessage.components.length > 0) {
              await latestMessage.edit({ components: [] });
            }
          } catch (error) {
            console.error(
              "Failed to remove components on collector end:",
              error,
            );
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

    // Initial call to fetch and display
    await getEmotionData();
  },
};
