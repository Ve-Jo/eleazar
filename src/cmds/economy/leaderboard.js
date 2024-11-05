import {
  SlashCommandSubcommand,
  I18nCommandBuilder,
} from "../../utils/builders/index.js";
import {
  EmbedBuilder,
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} from "discord.js";
import EconomyEZ from "../../utils/economy.js";
import { generateRemoteImage } from "../../utils/remoteImageGenerator.js";
import i18n from "../../utils/i18n.js";

export default {
  data: () => {
    const i18nBuilder = new I18nCommandBuilder("economy", "leaderboard");

    const subcommand = new SlashCommandSubcommand({
      name: i18nBuilder.getSimpleName(i18nBuilder.translate("name")),
      description: i18nBuilder.translate("description"),
      name_localizations: i18nBuilder.getLocalizations("name"),
      description_localizations: i18nBuilder.getLocalizations("description"),
    });

    return subcommand;
  },
  async execute(interaction) {
    await interaction.deferReply();
    const usersPerPage = 10;

    const guildEconomy = await EconomyEZ.get(`economy.${interaction.guild.id}`);

    console.log("Guild Economy Data:", JSON.stringify(guildEconomy, null, 2));

    let allUsersPromises = guildEconomy.map(async (userData) => {
      let username;
      let member;
      try {
        member = await interaction.guild.members.fetch(userData.user_id);
        username = member.user.username;
      } catch (error) {
        console.error(`Failed to fetch user ${userData.user_id}:`, error);
        username = "Unknown User";
      }

      return {
        id: userData.user_id,
        name: username,
        totalBalance: (userData.balance || 0) + (userData.bank || 0),
        balance: userData.balance || 0,
        avatar: member?.user?.avatarURL({ extension: "png", size: 128 }),
        bank: userData.bank || 0,
      };
    });

    let allUsers = await Promise.all(allUsersPromises);
    allUsers.sort((a, b) => b.totalBalance - a.totalBalance);

    console.log("Processed Users:", JSON.stringify(allUsers, null, 2));

    if (allUsers.length === 0) {
      return interaction.editReply({
        content: i18n.__("economy.leaderboard.noUsersFound"),
        ephemeral: true,
      });
    }

    const totalPages = Math.ceil(allUsers.length / usersPerPage);

    const userPosition =
      allUsers.findIndex((user) => user.id === interaction.user.id) + 1;
    let currentPage = Math.ceil(userPosition / usersPerPage) || 1;
    let highlightedPosition = userPosition || 1;

    const generateLeaderboardMessage = async () => {
      const startIndex = (currentPage - 1) * usersPerPage;
      const endIndex = startIndex + usersPerPage;
      const usersToDisplay = allUsers.slice(startIndex, endIndex);

      const pngBuffer = await generateRemoteImage(
        "Leaderboard",
        {
          interaction: {
            user: {
              id: interaction.user.id,
              username: interaction.user.username,
              displayName: interaction.user.displayName,
              avatarURL: interaction.user.displayAvatarURL({
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
          users: usersToDisplay.map((user) => ({
            ...user,
            avatarURL: interaction.guild.members.cache
              .get(user.id)
              ?.user.displayAvatarURL({ extension: "png", size: 128 }),
          })),
          currentPage,
          totalPages,
          highlightedPosition,
        },
        { width: 400, height: 755 }
      );

      const attachment = new AttachmentBuilder(pngBuffer, {
        name: "leaderboard.png",
      });

      const embed = new EmbedBuilder()
        .setColor(process.env.EMBED_COLOR)
        .setTitle(i18n.__("economy.leaderboard.title"))
        .setImage("attachment://leaderboard.png")
        .setFooter({
          text: i18n.__("economy.leaderboard.footer", {
            page: currentPage,
            totalPages,
          }),
        })
        .setTimestamp();

      const upButton = new ButtonBuilder()
        .setCustomId("up")
        .setLabel("▲")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(highlightedPosition <= 1);

      const downButton = new ButtonBuilder()
        .setCustomId("down")
        .setLabel("▼")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(highlightedPosition >= allUsers.length);

      const prevButton = new ButtonBuilder()
        .setCustomId("prev")
        .setLabel("◀")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(currentPage <= 1);

      const nextButton = new ButtonBuilder()
        .setCustomId("next")
        .setLabel("▶")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(currentPage >= totalPages);

      const buttonRow = new ActionRowBuilder().addComponents(
        upButton,
        downButton,
        prevButton,
        nextButton
      );

      let components = [buttonRow];

      if (usersToDisplay.length > 0) {
        const selectOptions = usersToDisplay.map((user, index) => ({
          label: `${startIndex + index + 1}. ${user.name.slice(0, 20)}`,
          value: (startIndex + index + 1).toString(),
          description: `Total: ${user.totalBalance.toFixed(0)}`.slice(0, 50),
        }));

        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId("select_user")
          .setPlaceholder(i18n.__("economy.leaderboard.selectUser"))
          .addOptions(selectOptions);

        const selectRow = new ActionRowBuilder().addComponents(selectMenu);
        components.push(selectRow);
      }

      console.log(JSON.stringify(components, null, 2));

      return {
        embeds: [embed],
        files: [attachment],
        components,
      };
    };

    const message = await interaction.editReply(
      await generateLeaderboardMessage()
    );

    const collector = message.createMessageComponentCollector({
      idle: 60000,
      filter: (i) => i.user.id === interaction.user.id,
    });

    collector.on("collect", async (i) => {
      if (i.user.id !== interaction.user.id) {
        return i.reply({
          content: i18n.__("economy.leaderboard.cantUseInteraction"),
          ephemeral: true,
        });
      }

      switch (i.customId) {
        case "up":
          highlightedPosition = Math.max(1, highlightedPosition - 1);
          break;
        case "down":
          highlightedPosition = Math.min(
            allUsers.length,
            highlightedPosition + 1
          );
          break;
        case "prev":
          currentPage = Math.max(1, currentPage - 1);
          break;
        case "next":
          currentPage = Math.min(totalPages, currentPage + 1);
          break;
        case "select_user":
          highlightedPosition = parseInt(i.values[0]);
          currentPage = Math.ceil(highlightedPosition / usersPerPage);
          break;
      }

      await i.update(await generateLeaderboardMessage());
    });

    collector.on("end", () => {
      interaction.editReply({ components: [] });
    });
  },
  localization_strings: {
    name: {
      en: "leaderboard",
      ru: "лидерборд",
      uk: "лідерборд",
    },
    description: {
      en: "Display top users by total balance",
      ru: "Показать топ пользователей по общему балансу",
      uk: "Показати топ користувачів за загальним балансом",
    },
    noUsersFound: {
      en: "No users found",
      ru: "Не найдено пользователей",
      uk: "Не знайдено користувачів",
    },
    cantUseInteraction: {
      en: "You can't use this interaction.",
      ru: "Вы не можете использовать это взаимодействие.",
      uk: "Ви не можете використовувати це взаємодію.",
    },
    selectUser: {
      en: "Select a user",
      ru: "Выберите пользователя",
      uk: "Виберіть користувача",
    },
    footer: {
      en: "Page {{page}} of {{totalPages}}",
      ru: "Страница {{page}} из {{totalPages}}",
      uk: "Сторінка {{page}} з {{totalPages}}",
    },
    title: {
      en: "Leaderboard",
      ru: "Лидерборд",
      uk: "Лідерборд",
    },
  },
};
