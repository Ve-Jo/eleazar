import {
  SlashCommandSubcommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from "discord.js";
import HMFull from "hmfull";

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
  },

  async execute(interaction, i18n) {
    const emotion = interaction.options.getString("emotion");
    const targetUser = interaction.options.getUser("user");

    // Handle invalid user selections
    if (targetUser.id === interaction.user.id) {
      return interaction.reply({
        content: i18n.__("commands.emotions.positive.cannotSelectSelf"),
        ephemeral: true,
      });
    }

    if (targetUser.bot) {
      return interaction.reply({
        content: i18n.__("commands.emotions.positive.cannotSelectBot"),
        ephemeral: true,
      });
    }

    await interaction.deferReply();

    async function getValidImageUrl() {
      try {
        const sources = [
          HMFull.HMtai.sfw,
          HMFull.Nekos.sfw,
          HMFull.NekoBot.sfw,
          HMFull.NekoLove.sfw,
        ];

        for (let attempts = 0; attempts < 3; attempts++) {
          for (const source of sources) {
            if (Object.keys(source).includes(emotion)) {
              let imageUrl = await source[emotion]();
              if (typeof imageUrl === "object" && imageUrl.url) {
                imageUrl = imageUrl.url;
              }
              if (
                imageUrl &&
                typeof imageUrl === "string" &&
                imageUrl.startsWith("http")
              ) {
                return imageUrl;
              }
            }
          }
        }
        return null;
      } catch (error) {
        console.error(`Error fetching ${emotion} image:`, error);
        return null;
      }
    }

    async function createEmbed() {
      const imageUrl = await getValidImageUrl();

      if (!imageUrl) {
        return null;
      }

      // Use translations with variable replacements
      return new EmbedBuilder()
        .setColor(process.env.EMBED_COLOR || "#2B2D31")
        .setTitle(i18n.__(`commands.emotions.positive.${emotion}.title`))
        .setDescription(
          i18n.__(`commands.emotions.positive.${emotion}.description`, {
            user: interaction.user.id,
            targetUser: targetUser.id,
          })
        )
        .setImage(imageUrl)
        .setTimestamp();
    }

    const embed = await createEmbed();

    if (!embed) {
      return interaction.editReply({
        content: i18n.__("commands.emotions.positive.imageNotFound"),
      });
    }

    // Create a button for the targetUser to respond
    const buttonRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("retry")
        .setEmoji("🔄")
        .setStyle(ButtonStyle.Primary)
    );

    const message = await interaction.editReply({
      embeds: [embed],
      components: [buttonRow],
    });

    // Set up collector for button interaction
    const collector = message.createMessageComponentCollector({
      filter: (i) => i.user.id === interaction.user.id,
      componentType: ComponentType.Button,
      time: 60000,
    });

    collector.on("collect", async (i) => {
      // If the target user clicks the button
      if (i.customId === `retry`) {
        await i.deferUpdate();

        const newEmbed = await createEmbed();
        if (newEmbed) {
          await i.update({ embeds: [newEmbed], components: [buttonRow] });
        } else {
          await i.reply({
            content: i18n.__("commands.emotions.positive.imageNotFound"),
            ephemeral: true,
          });
        }
      }
    });

    collector.on("end", () => {
      // Remove the button when the collector ends
      if (message.editable) {
        interaction.editReply({ components: [] }).catch(() => {});
      }
    });
  },
};
