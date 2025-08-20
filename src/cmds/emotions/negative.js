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
                    `commands.emotions.negative.${emotionType}.title`
                  ),
                  description: await i18n.__(
                    `commands.emotions.negative.${emotionType}.description`,
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
    }

    try {
      // Fetch image URL
      const emotionData = await getEmotionData();

      if (!emotionData || !emotionData.image) {
        const errorOptions = {
          content: await i18n.__("commands.emotions.negative.imageNotFound"),
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

      // Prepare reply options
      const replyOptions = emotionComponent.toReplyOptions();

      // Edit the deferred reply
      let message = await interaction.editReply(replyOptions);

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
        }
      });

      collector.on("end", async (collected, reason) => {
        if (reason !== "messageDelete" && message.editable) {
          try {
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
    } catch (error) {
      console.error("Error getting emotion data:", error);
      const errorOptions = {
        content: await i18n.__("commands.emotions.negative.imageNotFound"),
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
