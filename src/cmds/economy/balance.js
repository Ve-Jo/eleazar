import { SlashCommandSubcommandBuilder } from "discord.js";
import { EmbedBuilder, AttachmentBuilder } from "discord.js";
import Database from "../../database/client.js";
import { generateImage } from "../../utils/imageGenerator.js";

export default {
  data: () => {
    // Create a standard subcommand with Discord.js builders
    const builder = new SlashCommandSubcommandBuilder()
      .setName("balance")
      .setDescription("Check balance")
      .addUserOption((option) =>
        option
          .setName("user")
          .setDescription("User to check")
          .setRequired(false)
      );

    return builder;
  },

  // Define localization strings directly in the command
  localization_strings: {
    command: {
      name: {
        ru: "баланс",
        uk: "рахунок",
      },
      description: {
        ru: "Посмотреть баланс",
        uk: "Переглянути баланс",
      },
    },
    options: {
      user: {
        name: {
          ru: "пользователь",
          uk: "користувач",
        },
        description: {
          ru: "Пользователь для проверки",
          uk: "Користувач для перевірки",
        },
      },
    },
    title: {
      en: "Balance",
      ru: "Баланс",
      uk: "Баланс",
    },
    userNotFound: {
      en: "User not found",
      ru: "Пользователь не найден",
      uk: "Користувач не знайдений",
    },
    imageError: {
      en: "Error generating balance image",
      ru: "Ошибка при создании изображения баланса",
      uk: "Помилка при створенні зображення балансу",
    },
  },

  async execute(interaction, i18n) {
    await interaction.deferReply();
    const user = interaction.options.getMember("user") || interaction.member;

    const userData = await Database.getUser(
      interaction.guild.id,
      user.id,
      true
    );

    if (!userData) {
      return interaction.editReply({
        content: i18n.__("userNotFound"),
        ephemeral: true,
      });
    }

    if (userData.economy) {
      userData.economy.bankBalance = await Database.calculateBankBalance(
        userData
      );
    }

    const [buffer, dominantColor] = await generateImage(
      "Balance",
      {
        interaction: {
          user: {
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            avatarURL: user.displayAvatarURL({
              extension: "png",
              size: 1024,
            }),
          },
          guild: {
            id: interaction.guild.id,
            name: interaction.guild.name,
            iconURL: interaction.guild.iconURL({
              extension: "png",
              size: 1024,
            }),
          },
        },
        locale: interaction.locale,
        returnDominant: true,
        database: {
          ...userData,
        },
      },
      { image: 2, emoji: 1 }
    );

    if (!buffer) {
      console.error("Buffer is undefined or null");
      return interaction.editReply({
        content: i18n.__("imageError"),
        ephemeral: true,
      });
    }

    const attachment = new AttachmentBuilder(buffer, {
      name: `balance.png`,
    });

    let balance_embed = new EmbedBuilder()
      .setTimestamp()
      .setColor(dominantColor?.embedColor ?? 0x0099ff) // Default color if dominantColor is undefined
      .setImage(`attachment://balance.png`)
      .setAuthor({
        name: i18n.__("title"),
        iconURL: user.avatarURL(),
      });

    await interaction.editReply({
      embeds: [balance_embed],
      files: [attachment],
    });
  },
};
