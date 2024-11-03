import {
  SlashCommandSubcommand,
  SlashCommandOption,
  OptionType,
  I18nCommandBuilder,
} from "../../utils/builders/index.js";
import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from "discord.js";
import HMFull from "hmfull";
import i18n from "../../utils/i18n.js";

const positiveEmotions = Object.fromEntries(
  [
    "wave",
    "wink",
    "pat",
    "kiss",
    "feed",
    "hug",
    "cuddle",
    "five",
    "glomp",
    "hold",
    "boop",
  ].map((key) => [key, key])
);

export default {
  data: () => {
    const i18nBuilder = new I18nCommandBuilder("emotions", "positive");

    const subcommand = new SlashCommandSubcommand({
      name: i18nBuilder.getSimpleName(i18nBuilder.translate("name")),
      description: i18nBuilder.translate("description"),
      name_localizations: i18nBuilder.getLocalizations("name"),
      description_localizations: i18nBuilder.getLocalizations("description"),
    });

    // Add emotion option
    const emotionOption = new SlashCommandOption({
      type: OptionType.STRING,
      name: "emotion",
      description: i18nBuilder.translateOption("emotion", "description"),
      required: true,
      name_localizations: i18nBuilder.getOptionLocalizations("emotion", "name"),
      description_localizations: i18nBuilder.getOptionLocalizations(
        "emotion",
        "description"
      ),
      choices: Object.entries(positiveEmotions).map(([name]) => ({
        name,
        value: name,
      })),
    });

    // Add user option
    const userOption = new SlashCommandOption({
      type: OptionType.USER,
      name: "user",
      description: i18nBuilder.translateOption("user", "description"),
      required: true,
      name_localizations: i18nBuilder.getOptionLocalizations("user", "name"),
      description_localizations: i18nBuilder.getOptionLocalizations(
        "user",
        "description"
      ),
    });

    subcommand.addOption(emotionOption);
    subcommand.addOption(userOption);

    return subcommand;
  },
  async execute(interaction) {
    const emotion = interaction.options.getString("emotion");
    const targetUser = interaction.options.getUser("user");

    if (targetUser.id === interaction.user.id) {
      return interaction.reply({
        content: i18n.__("cannotSelectSelf"),
        ephemeral: true,
      });
    }

    if (targetUser.bot) {
      return interaction.reply({
        content: i18n.__("cannotSelectBot"),
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
        .setTitle(i18n.__(`emotions.positive.${emotion}.title`))
        .setDescription(
          i18n.__(`emotions.positive.${emotion}.description`, {
            user: interaction.user,
            targetUser: targetUser,
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
        content: i18n.__("imageNotFound"),
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
            content: i18n.__("imageNotFound"),
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
  localization_strings: {
    name: {
      en: "positive",
      ru: "позитивные",
      uk: "позитивні",
    },
    description: {
      en: "Choose a positive emotion with a user",
      ru: "Выберите позитивную эмоцию с пользователем",
      uk: "Виберіть позитивну емоцію з користувачем",
    },
    options: {
      emotion: {
        name: {
          en: "emotion",
          ru: "эмоция",
          uk: "емоція",
        },
        description: {
          en: "Choose an emotion",
          ru: "Выберите эмоцию",
          uk: "Виберіть емоцію",
        },
      },
      user: {
        name: {
          en: "user",
          ru: "пользователь",
          uk: "користувач",
        },
        description: {
          en: "Choose a user",
          ru: "Выберите пользователя",
          uk: "Виберіть користувача",
        },
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
  },
};
