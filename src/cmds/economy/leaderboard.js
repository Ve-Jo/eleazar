import {
  SlashCommandSubcommandBuilder,
  EmbedBuilder,
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} from "discord.js";
import EconomyEZ from "../../utils/economy.js";
import i18n from "../../utils/i18n.js";
import Leaderboard from "../../components/Leaderboard.jsx";
import { generateImage } from "../../utils/imageGenerator.js";

export default {
  data: new SlashCommandSubcommandBuilder()
    .setName("leaderboard")
    .setDescription("Display top users by total balance")
    .setDescriptionLocalizations({
      ru: "Показать топ пользователей по общему балансу",
      uk: "Показати топ користувачів за загальним балансом",
    }),
  async execute(interaction) {
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
        content: i18n.__("economy.noUsersFound"),
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

      const pngBuffer = await generateImage(
        Leaderboard,
        {
          interaction,
          users: usersToDisplay,
          currentPage,
          totalPages,
          highlightedPosition: highlightedPosition,
        },
        { width: 400, height: 755 }
      );

      const attachment = new AttachmentBuilder(pngBuffer, {
        name: "leaderboard.png",
      });

      const embed = new EmbedBuilder()
        .setColor(process.env.EMBED_COLOR)
        .setTitle(i18n.__("economy.leaderboardTitle"))
        .setImage("attachment://leaderboard.png")
        .setFooter({
          text: i18n.__("economy.leaderboardFooter", {
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
          .setPlaceholder("Select a user")
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
          content: "You can't use this interaction.",
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
};
