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
import Database from "../../database/client.js";
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
    const { guild } = interaction;

    try {
      let page = 0;
      const pageSize = 10;
      let highlightedPosition = null;

      const generateLeaderboardMessage = async () => {
        // Get all users in the guild with their data
        const guildUsers = await Database.client.user.findMany({
          where: { guildId: guild.id },
          include: {
            economy: true,
            stats: true,
          },
        });

        // Sort users by total balance (balance + bank amount)
        const sortedUsers = guildUsers
          .map((userData) => ({
            ...userData,
            totalBalance:
              Number(userData.economy?.balance || 0) +
              Number(userData.economy?.bankBalance || 0),
          }))
          .sort((a, b) => b.totalBalance - a.totalBalance);

        // Find user's position in the leaderboard
        if (highlightedPosition === null) {
          const userIndex = sortedUsers.findIndex(
            (user) => user.id === interaction.user.id
          );
          if (userIndex !== -1) {
            highlightedPosition = userIndex + 1;
            // Adjust page to show the user's position
            page = Math.floor(userIndex / pageSize);
          }
        }

        const totalPages = Math.ceil(sortedUsers.length / pageSize);
        const startIndex = page * pageSize;
        const endIndex = startIndex + pageSize;
        const usersToDisplay = sortedUsers.slice(startIndex, endIndex);

        // Fetch member data for each user
        const usersWithNames = await Promise.all(
          usersToDisplay.map(async (userData) => {
            try {
              const member = await guild.members.fetch(userData.id);
              return {
                ...userData,
                name: member.displayName,
                avatarURL: member.displayAvatarURL({
                  extension: "png",
                  size: 1024,
                }),
              };
            } catch (error) {
              console.error(`Failed to fetch member ${userData.id}:`, error);
              return null;
            }
          })
        );

        const validUsers = usersWithNames.filter((user) => user !== null);

        // Generate leaderboard image
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
                id: guild.id,
                name: guild.name,
                iconURL: guild.iconURL({
                  extension: "png",
                  size: 1024,
                }),
              },
            },
            locale: interaction.locale,
            users: validUsers.map((user, index) => ({
              id: user.id,
              position: startIndex + index + 1,
              name: user.name,
              avatarURL: user.avatarURL,
              balance: Number(user.economy?.balance || 0),
              bank: Number(user.economy?.bankBalance || 0),
              totalBalance: user.totalBalance,
            })),
            currentPage: page + 1,
            totalPages,
            highlightedPosition,
          },
          { width: 400, height: 775 }
        );

        const attachment = new AttachmentBuilder(pngBuffer.buffer, {
          name: `leaderboard.${
            pngBuffer.contentType === "image/gif" ? "gif" : "png"
          }`,
        });

        const embed = new EmbedBuilder()
          .setColor(process.env.EMBED_COLOR)
          .setAuthor({
            name: i18n.__("economy.leaderboard.title"),
            iconURL: interaction.user.displayAvatarURL(),
          })
          .setImage(
            `attachment://leaderboard.${
              pngBuffer.contentType === "image/gif" ? "gif" : "png"
            }`
          )
          .setTimestamp();

        // Create navigation buttons
        const prevButton = new ButtonBuilder()
          .setCustomId("prev_page")
          .setLabel("◀")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(page === 0);

        const nextButton = new ButtonBuilder()
          .setCustomId("next_page")
          .setLabel("▶")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(page >= totalPages - 1);

        const buttonRow = new ActionRowBuilder().addComponents(
          prevButton,
          nextButton
        );

        let components = [buttonRow];

        if (validUsers.length > 0) {
          const selectOptions = validUsers.map((user, index) => ({
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

        return {
          embeds: [embed],
          files: [attachment],
          components,
        };
      };

      const message = await interaction.editReply(
        await generateLeaderboardMessage()
      );

      // Create collector for buttons and select menu
      const collector = message.createMessageComponentCollector({
        filter: (i) => i.user.id === interaction.user.id,
        time: 60000,
      });

      collector.on("collect", async (i) => {
        if (i.customId === "prev_page") {
          page = Math.max(0, page - 1);
          highlightedPosition = null;
          await i.update(await generateLeaderboardMessage());
        } else if (i.customId === "next_page") {
          page++;
          highlightedPosition = null;
          await i.update(await generateLeaderboardMessage());
        } else if (i.customId === "select_user") {
          highlightedPosition = parseInt(i.values[0]);
          await i.update(await generateLeaderboardMessage());
        }
      });

      collector.on("end", () => {
        if (message.editable) {
          message.edit({ components: [] }).catch(() => {});
        }
      });
    } catch (error) {
      console.error("Error in leaderboard command:", error);
      await interaction.editReply({
        content: i18n.__("economy.leaderboard.error"),
        ephemeral: true,
      });
    }
  },
  localization_strings: {
    name: {
      en: "leaderboard",
      ru: "лидерборд",
      uk: "лідерборд",
    },
    description: {
      en: "View server leaderboard",
      ru: "Посмотреть таблицу лидеров сервера",
      uk: "Переглянути таблицю лідерів сервера",
    },
    title: {
      en: "Server Leaderboard",
      ru: "Таблица лидеров сервера",
      uk: "Таблиця лідерів сервера",
    },
    selectUser: {
      en: "Select a user to view details",
      ru: "Выберите пользователя для просмотра деталей",
      uk: "Виберіть користувача для перегляду деталей",
    },
    selectedUser: {
      en: "Selected user at position {{position}}",
      ru: "Выбран пользователь на позиции {{position}}",
      uk: "Обрано користувача на позиції {{position}}",
    },
    error: {
      en: "An error occurred while processing your leaderboard request",
      ru: "Произошла ошибка при обработке запроса таблицы лидеров",
      uk: "Сталася помилка під час обробки запиту таблиці лідерів",
    },
  },
};
