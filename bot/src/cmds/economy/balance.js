import {
  SlashCommandSubcommandBuilder,
  AttachmentBuilder,
  MessageFlags,
  EmbedBuilder,
} from "discord.js";
import hubClient from "../../api/hubClient.js";
import { generateImage } from "../../utils/imageGenerator.js";
// import { getTickers } from "../../utils/cryptoApi.js"; // Import for getting current prices
import { ComponentBuilder } from "../../utils/componentConverter.js";

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
          .setRequired(false),
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
  },

  async execute(interaction, i18n) {
    // Always use v2 builder mode
    const builderMode = "v2";

    // Always defer reply
    await interaction.deferReply();

    const user = interaction.options.getMember("user") || interaction.member;

    // --- Marriage Check ---
    // Marriage functionality will need to be implemented in hub services
    const marriageStatus = await hubClient.getMarriageStatus(
      interaction.guild.id,
      user.id,
    );

    let partnerData = null;
    let combinedBankBalance = 0;
    // --- End Marriage Check ---

    // Ensure user exists in database before fetching data
    await hubClient.ensureGuildUser(interaction.guild.id, user.id);
    const userData = await hubClient.getUser(interaction.guild.id, user.id);

    if (!userData) {
      return interaction.editReply({
        content: await i18n.__("commands.economy.userNotFound"),
        ephemeral: true,
      });
    }

    // Calculate user's bank balance (including interest)
    let individualBankBalance = 0; // Initialize
    if (userData.economy) {
      // Calculate current bank balance with interest
      individualBankBalance = await hubClient.calculateBankBalance(userData);

      userData.economy.bankBalance = individualBankBalance; // Update with calculated balance
      combinedBankBalance =
        Number(combinedBankBalance) + Number(individualBankBalance);
    }

    // --- Fetch Partner Data if Married ---
    let partnerDiscordUser = null; // Variable to store fetched Discord user
    if (marriageStatus && marriageStatus.status === "MARRIED") {
      // Ensure partner exists in database before fetching data
      await hubClient.ensureGuildUser(
        interaction.guild.id,
        marriageStatus.partnerId,
      );
      partnerData = await hubClient.getUser(
        interaction.guild.id,
        marriageStatus.partnerId,
      );
      if (partnerData && partnerData.economy) {
        const partnerBankBalance =
          await hubClient.calculateBankBalance(partnerData);
        partnerData.economy.bankBalance = partnerBankBalance;
        combinedBankBalance =
          Number(combinedBankBalance) + Number(partnerBankBalance);
      }
      // Store the combined balance for the image generator
      userData.combinedBankBalance = Number(combinedBankBalance).toFixed(5); // Ensure 5 decimals
      userData.individualBankBalance = Number(individualBankBalance).toFixed(5); // Pass individual balance too
      userData.marriageStatus = marriageStatus; // Pass status to image generator
      // userData.partnerData = partnerData; // Pass partner DB data if needed for other things

      // --- Fetch Partner's Discord User for Avatar ---
      try {
        partnerDiscordUser = await interaction.client.users.fetch(
          marriageStatus.partnerId,
        );
        // Add avatar URL to the data passed to the image generator
        userData.partnerAvatarUrl = partnerDiscordUser?.displayAvatarURL({
          extension: "png",
          size: 64,
        }); // Smaller size for the component
        userData.partnerUsername =
          partnerDiscordUser?.username || partnerData?.username || "Partner"; // Use Discord username if available
      } catch (fetchError) {
        console.error(
          `Failed to fetch partner Discord user (${marriageStatus.partnerId}):`,
          fetchError,
        );
        userData.partnerAvatarUrl =
          "https://cdn.discordapp.com/embed/avatars/0.png"; // Fallback avatar
        userData.partnerUsername = partnerData?.username || "Partner";
      }
      // --- End Fetch Partner's Discord User ---
    }
    // --- End Fetch Partner Data ---

    // --- Calculate Level Progress for XP Bars ---
    let chatLevelData = null;
    let gameLevelData = null;

    if (userData.Level) {
      // Calculate level progress using the same method as level.js
      const chatXP = Number(userData.Level.xp || 0);
      chatLevelData = hubClient.calculateLevel(chatXP);

      const gameXP = Number(userData.Level.gameXp || 0);
      gameLevelData = hubClient.calculateLevel(gameXP);
    }
    // --- End Calculate Level Progress ---

    console.log(userData);

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
          // Add XP data for level bars
          levelProgress: {
            chat: chatLevelData,
            game: gameLevelData,
          },
          // partnerData: partnerData // Pass partner data if needed by image gen
        },
      },
      { image: 2, emoji: 2 },
      i18n,
    );

    if (!buffer) {
      console.error("Error in balance command: Buffer is undefined or null");
      const errorOptions = {
        content: await i18n.__("commands.economy.balance.error"),
        ephemeral: true,
      };

      if (interaction.replied || interaction.deferred) {
        return interaction.editReply(errorOptions).catch(() => {});
      } else {
        return interaction.reply(errorOptions).catch(() => {});
      }
    }

    const attachment = new AttachmentBuilder(buffer, {
      name: `balance.avif`,
    });

    // Use the new ComponentBuilder
    const balanceComponent = new ComponentBuilder({
      dominantColor,
      mode: builderMode, // Pass the determined mode
    })
      .addText(await i18n.__("commands.economy.balance.title"), "header3")
      .addImage("attachment://balance.avif")
      .addTimestamp(interaction.locale);

    // Prepare reply options using the builder
    const replyOptions = balanceComponent.toReplyOptions({
      files: [attachment],
    });

    // Always edit reply
    await interaction.editReply(replyOptions);
  },
};
