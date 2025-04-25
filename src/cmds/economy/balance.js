import { SlashCommandSubcommandBuilder } from "discord.js";
import { EmbedBuilder, AttachmentBuilder } from "discord.js";
import Database from "../../database/client.js";
import { generateImage } from "../../utils/imageGenerator.js";
import { getTickers } from "../../utils/cryptoApi.js"; // Import for getting current prices
import { Prisma } from "@prisma/client"; // Import Prisma for Decimal

// PnL Calculation Helper from crypto2.js
function calculatePnlPercent(entryPrice, currentPrice, direction, leverage) {
  entryPrice = parseFloat(entryPrice);
  currentPrice = parseFloat(currentPrice);
  leverage = parseInt(leverage);

  if (
    !entryPrice ||
    !currentPrice ||
    !leverage ||
    isNaN(entryPrice) ||
    isNaN(currentPrice) ||
    isNaN(leverage)
  ) {
    return 0;
  }

  let pnlRatio = 0;
  if (direction === "LONG") {
    pnlRatio = (currentPrice - entryPrice) / entryPrice;
  } else if (direction === "SHORT") {
    pnlRatio = (entryPrice - currentPrice) / entryPrice;
  }

  // Clamp loss at -100% (liquidation)
  const pnlPercent = Math.max(-100, pnlRatio * leverage * 100);
  return pnlPercent;
}

// PnL Calculation Helper (Amount) from crypto2.js
function calculatePnlAmount(entryPrice, currentPrice, quantity, direction) {
  // Ensure inputs are Prisma Decimal or convert strings/numbers
  const entry = new Prisma.Decimal(entryPrice);
  const current = new Prisma.Decimal(currentPrice);
  const qty = new Prisma.Decimal(quantity);

  if (direction === "LONG") {
    // PnL = (Current Price - Entry Price) * Quantity
    return current.minus(entry).times(qty);
  } else if (direction === "SHORT") {
    // PnL = (Entry Price - Current Price) * Quantity
    return entry.minus(current).times(qty);
  }
  return new Prisma.Decimal(0); // Should not happen
}

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
        content: i18n.__("commands.economy.userNotFound"),
        ephemeral: true,
      });
    }

    if (userData.economy) {
      userData.economy.bankBalance = await Database.calculateBankBalance(
        userData
      );
    }

    // Fetch crypto positions if they exist
    if (!userData.crypto2) {
      userData.crypto2 = { openPositions: [] };
    }

    try {
      // Get positions from the database
      const positions = await Database.getUserCryptoPositions(
        interaction.guild.id,
        user.id
      );

      if (positions && positions.length > 0) {
        // Get current prices for all position symbols
        const symbols = [...new Set(positions.map((p) => p.symbol))];
        const currentPrices = await getTickers(symbols);

        if (currentPrices) {
          // Save timestamp metadata for the UI
          userData.crypto2.timestamp = currentPrices.timestamp;
          userData.crypto2.fromCache = currentPrices.fromCache;
          userData.crypto2.stale = currentPrices.stale;

          // Format positions with calculated PnL values
          userData.crypto2.openPositions = positions
            .map((pos) => {
              const currentPrice =
                currentPrices[pos.symbol]?.markPrice ||
                currentPrices[pos.symbol]?.lastPrice;

              if (!currentPrice) return null; // Skip if no price available

              const pnlPercent = calculatePnlPercent(
                pos.entryPrice,
                currentPrice,
                pos.direction,
                pos.leverage
              );

              // Calculate PnL amount
              const pnlAmount = calculatePnlAmount(
                pos.entryPrice,
                currentPrice,
                pos.quantity,
                pos.direction
              );

              // Calculate stake value
              const stakeValue = new Prisma.Decimal(pos.entryPrice)
                .times(new Prisma.Decimal(pos.quantity))
                .dividedBy(pos.leverage);

              return {
                id: pos.id,
                symbol: pos.symbol,
                direction: pos.direction,
                entryPrice: pos.entryPrice.toString(),
                quantity: pos.quantity.toString(),
                leverage: pos.leverage,
                pnlPercent: pnlPercent.toFixed(2),
                pnlAmount: pnlAmount.toFixed(2),
                stakeValue: stakeValue.toFixed(2),
              };
            })
            .filter(Boolean); // Remove any null entries
        }
      }
    } catch (error) {
      console.error("Failed to load crypto positions:", error);
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
      { image: 2, emoji: 1 },
      i18n
    );

    if (!buffer) {
      console.error("Buffer is undefined or null");
      return interaction.editReply({
        content: i18n.__("commands.economy.imageError"),
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
        name: i18n.__("commands.economy.balance.title"),
        iconURL: user.avatarURL(),
      });

    await interaction.editReply({
      embeds: [balance_embed],
      files: [attachment],
    });
  },
};
