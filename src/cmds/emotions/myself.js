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

export default {
  data: () => {
    const i18nBuilder = new I18nCommandBuilder("emotions", "myself");

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
      choices: [
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
        { name: "gah", value: "gah" },
      ],
    });

    subcommand.addOption(emotionOption);

    return subcommand;
  },
  async execute(interaction, i18n) {
    const emotion = interaction.options.getString("emotion");

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
        .setTitle(i18n.__(`emotions.myself.${emotion}.title`))
        .setDescription(
          i18n.__(`emotions.myself.${emotion}.description`, {
            user: interaction.user.id,
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
      en: "myself",
      ru: "я",
      uk: "я",
    },
    description: {
      en: "Choose your own emotion or action",
      ru: "Выберите вашу эмоцию или действие",
      uk: "Виберіть вашу емоцію або дію",
    },
    options: {
      emotion: {
        name: {
          en: "emotion",
          ru: "эмоция",
          uk: "емоція",
        },
        description: {
          en: "Choose an emotion or action",
          ru: "Выберите эмоцию или действие",
          uk: "Виберіть емоцію або дію",
        },
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
  },
};
