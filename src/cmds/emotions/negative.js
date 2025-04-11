import {
  SlashCommandSubcommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from "discord.js";
import HMFull from "hmfull";

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
    const emotion = interaction.options.getString("emotion");
    const targetUser = interaction.options.getUser("user");

    if (targetUser.id === interaction.user.id) {
      return interaction.reply({
        content: i18n.__("commands.emotions.negative.cannotSelectSelf"),
        ephemeral: true,
      });
    }

    if (targetUser.bot) {
      return interaction.reply({
        content: i18n.__("commands.emotions.negative.cannotSelectBot"),
        ephemeral: true,
      });
    }

    async function getValidImageUrl() {
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
    }

    async function createEmbed() {
      const imageUrl = await getValidImageUrl();

      if (!imageUrl) {
        return null;
      }

      return new EmbedBuilder()
        .setColor(process.env.EMBED_COLOR)
        .setTitle(i18n.__(`commands.emotions.negative.${emotion}.title`))
        .setDescription(
          i18n.__(`commands.emotions.negative.${emotion}.description`, {
            user: interaction.user.id,
            targetUser: targetUser.id,
          })
        )
        .setImage(imageUrl)
        .setFooter({
          text: interaction.user.displayName,
          iconURL: interaction.user.displayAvatarURL(),
        });
    }

    const initialEmbed = await createEmbed();

    if (!initialEmbed) {
      return interaction.reply({
        content: i18n.__("commands.emotions.negative.imageNotFound"),
        ephemeral: true,
      });
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("retry")
        .setEmoji("🔄")
        .setStyle(ButtonStyle.Primary)
    );

    const response = await interaction.reply({
      embeds: [initialEmbed],
      components: [row],
    });

    const collector = response.createMessageComponentCollector({
      filter: (i) => i.user.id === interaction.user.id,
      componentType: ComponentType.Button,
      idle: 60000,
    });

    collector.on("collect", async (i) => {
      if (i.customId === "retry") {
        const newEmbed = await createEmbed();
        if (newEmbed) {
          await i.update({ embeds: [newEmbed], components: [row] });
        } else {
          await i.reply({
            content: i18n.__("commands.emotions.negative.imageNotFound"),
            ephemeral: true,
          });
        }
      }
    });

    collector.on("end", () => {
      row.components[0].setDisabled(true);
      interaction.editReply({ components: [row] }).catch(console.error);
    });
  },
};
