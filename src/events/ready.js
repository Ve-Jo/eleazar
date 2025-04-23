import { Events } from "discord.js";
import { SlashCommandsHandler } from "../handlers/SlashCommandsHandler.js";
import init from "../utils/music.js";
import Database from "../database/client.js";
// import PingService from "../services/PingService.js";
import StatusService from "../services/StatusService.js";
import { getTickers } from "../utils/cryptoApi.js";
import { PrismaClient, Prisma } from "@prisma/client";
import i18n from "../utils/newI18n.js";

// --- Start Localization Definitions ---
const localization_strings = {
  crypto: {
    notifications: {
      liquidation: {
        en: "⚠️ Liquidation Alert! Your {direction} position for {symbol} was automatically closed due to reaching -100% PnL.",
        ru: "⚠️ Предупреждение о ликвидации! Ваша {direction} позиция по {symbol} была автоматически закрыта из-за достижения -100% PnL.",
        uk: "⚠️ Попередження про ліквідацію! Ваша {direction} позиція по {symbol} була автоматично закрита через досягнення -100% PnL.",
      },
      takeProfit: {
        en: "✅ Take Profit Triggered! Your {direction} position for {symbol} was closed at {price} with a profit of {profit} 💵",
        ru: "✅ Сработал Take Profit! Ваша {direction} позиция по {symbol} была закрыта по цене {price} с прибылью {profit} 💵",
        uk: "✅ Спрацював Take Profit! Ваша {direction} позиція по {symbol} була закрита за ціною {price} з прибутком {profit} 💵",
      },
      stopLoss: {
        en: "🛑 Stop Loss Triggered! Your {direction} position for {symbol} was closed at {price} with a loss of {loss} 💵",
        ru: "🛑 Сработал Stop Loss! Ваша {direction} позиция по {symbol} была закрыта по цене {price} с убытком {loss} 💵",
        uk: "🛑 Спрацював Stop Loss! Ваша {direction} позиція по {symbol} була закрита за ціною {price} з втратою {loss} 💵",
      },
      direction: {
        long: {
          en: "LONG",
          ru: "ЛОНГ",
          uk: "ЛОНГ",
        },
        short: {
          en: "SHORT",
          ru: "ШОРТ",
          uk: "ШОРТ",
        },
      },
      monitorStarted: {
        en: "Crypto position monitoring service started",
        ru: "Служба мониторинга криптопозиций запущена",
        uk: "Служба моніторингу криптопозицій запущена",
      },
    },
  },
};
// --- End Localization Definitions ---

export default {
  name: Events.ClientReady,
  once: true,
  localization_strings: localization_strings,
  async execute(client) {
    console.log(`Ready! Logged in as ${client.user.tag}`);

    try {
      await init(client);
    } catch (error) {
      console.error("Failed to initialize music:", error);
    }

    await SlashCommandsHandler(client, client.commands);

    // Start ping service
    //PingService.start(client);

    // Start status service
    StatusService.start(client);

    // Start crypto position monitoring service
    startCryptoPositionMonitor(client);
  },
};

/**
 * Monitors crypto positions for take profit, stop loss, and liquidation conditions
 * @param {Client} client Discord client
 */
async function startCryptoPositionMonitor(client) {
  console.log("[Crypto] Starting position monitoring service...");

  // Run every 2 minutes (avoid API rate limits but still be reasonably responsive)
  const MONITOR_INTERVAL = 2 * 60 * 1000;

  // Function to check all positions
  async function checkAllPositions() {
    try {
      console.log("[Crypto] Running position check...");

      // Get all active positions
      const positions = await Database.getAllActiveCryptoPositions();
      if (positions.length === 0) return;

      console.log(`[Crypto] Checking ${positions.length} active positions`);

      // Group positions by symbol to minimize API calls
      const symbolToPositions = {};
      const uniqueSymbols = new Set();

      positions.forEach((position) => {
        uniqueSymbols.add(position.symbol);
        if (!symbolToPositions[position.symbol]) {
          symbolToPositions[position.symbol] = [];
        }
        symbolToPositions[position.symbol].push(position);
      });

      // Fetch current prices for all symbols at once
      const tickers = await getTickers([...uniqueSymbols]);
      if (!tickers) {
        console.error("[Crypto] Failed to fetch ticker data");
        return;
      }

      // Process each position
      for (const symbol in symbolToPositions) {
        const currentPrice =
          tickers[symbol]?.markPrice || tickers[symbol]?.lastPrice;
        if (!currentPrice) continue;

        for (const position of symbolToPositions[symbol]) {
          await processPosition(position, currentPrice, client);
        }
      }
    } catch (error) {
      console.error("[Crypto] Error in position monitor:", error);
    }
  }

  // Process individual position
  async function processPosition(position, currentPrice, client) {
    try {
      const { id, userId, guildId, direction, entryPrice, quantity, leverage } =
        position;
      const currentPriceDecimal = new Prisma.Decimal(currentPrice);

      // Calculate PnL
      let pnlPercent = 0;
      if (direction === "LONG") {
        pnlPercent = currentPriceDecimal
          .minus(entryPrice)
          .dividedBy(entryPrice)
          .times(leverage)
          .times(100);
      } else {
        pnlPercent = entryPrice
          .minus(currentPriceDecimal)
          .dividedBy(entryPrice)
          .times(leverage)
          .times(100);
      }

      // Check for liquidation (-100% or worse)
      if (pnlPercent.lte(-100)) {
        console.log(
          `[Crypto] Liquidating position ${id} for user ${userId} in guild ${guildId}`
        );
        await Database.deleteCryptoPosition(id);
        notifyUser(client, guildId, userId, position, "liquidation", {
          currentPrice,
        });
        return;
      }

      // Check take profit condition
      if (
        position.takeProfitPrice &&
        ((direction === "LONG" &&
          currentPriceDecimal.gte(position.takeProfitPrice)) ||
          (direction === "SHORT" &&
            currentPriceDecimal.lte(position.takeProfitPrice)))
      ) {
        console.log(`[Crypto] Take profit triggered for position ${id}`);

        // Calculate profit based on TP price
        const pnlAmount = calculatePnlAmount(
          position.entryPrice,
          position.takeProfitPrice,
          position.quantity,
          position.direction
        );

        // Close position and return funds with profit
        const originalStake = position.quantity
          .times(position.entryPrice)
          .dividedBy(position.leverage);

        const amountToAddBack = originalStake.plus(pnlAmount);

        await Database.client.$transaction(async (tx) => {
          await tx.economy.update({
            where: {
              userId_guildId: {
                userId: position.userId,
                guildId: position.guildId,
              },
            },
            data: { balance: { increment: amountToAddBack } },
          });
          await tx.cryptoPosition.delete({
            where: { id: position.id },
          });
        });

        notifyUser(client, guildId, userId, position, "takeProfit", {
          price: position.takeProfitPrice,
          profit: pnlAmount,
        });
        return;
      }

      // Check stop loss condition
      if (
        position.stopLossPrice &&
        ((direction === "LONG" &&
          currentPriceDecimal.lte(position.stopLossPrice)) ||
          (direction === "SHORT" &&
            currentPriceDecimal.gte(position.stopLossPrice)))
      ) {
        console.log(`[Crypto] Stop loss triggered for position ${id}`);

        // Calculate loss based on SL price
        const pnlAmount = calculatePnlAmount(
          position.entryPrice,
          position.stopLossPrice,
          position.quantity,
          position.direction
        );

        // Close position and return remaining funds
        const originalStake = position.quantity
          .times(position.entryPrice)
          .dividedBy(position.leverage);

        const amountToAddBack = originalStake.plus(pnlAmount);

        await Database.client.$transaction(async (tx) => {
          await tx.economy.update({
            where: {
              userId_guildId: {
                userId: position.userId,
                guildId: position.guildId,
              },
            },
            data: { balance: { increment: amountToAddBack } },
          });
          await tx.cryptoPosition.delete({
            where: { id: position.id },
          });
        });

        notifyUser(client, guildId, userId, position, "stopLoss", {
          price: position.stopLossPrice,
          loss: pnlAmount,
        });
      }
    } catch (error) {
      console.error(
        `[Crypto] Error processing position ${position.id}:`,
        error
      );
    }
  }

  // Helper for PnL calculation
  function calculatePnlAmount(entryPrice, currentPrice, quantity, direction) {
    if (direction === "LONG") {
      return currentPrice.minus(entryPrice).times(quantity);
    } else {
      return entryPrice.minus(currentPrice).times(quantity);
    }
  }

  // Notify user about their position
  async function notifyUser(client, guildId, userId, position, event, data) {
    try {
      const guild = client.guilds.cache.get(guildId);
      if (!guild) return;

      // Try to get user
      const user = await client.users.fetch(userId).catch(() => null);
      if (!user) return;

      // Get user locale
      let locale = "en";
      try {
        const userLocale = await Database.getUserLocale(guildId, userId);
        if (userLocale && ["en", "ru", "uk"].includes(userLocale)) {
          locale = userLocale;
        }
      } catch (error) {
        console.warn(`[Crypto] Error getting user locale: ${error.message}`);
      }

      // Prepare localized message
      let translatedDirection = i18n.__(
        `events.ready.crypto.notifications.direction.${position.direction.toLowerCase()}`,
        locale
      );
      if (!translatedDirection) {
        translatedDirection = position.direction;
      }

      let message = "";

      switch (event) {
        case "liquidation":
          message = i18n.__(
            "events.ready.crypto.notifications.liquidation",
            {
              direction: translatedDirection,
              symbol: position.symbol,
            },
            locale
          );
          break;
        case "takeProfit":
          message = i18n.__(
            "events.ready.crypto.notifications.takeProfit",
            {
              direction: translatedDirection,
              symbol: position.symbol,
              price: data.price.toString(),
              profit: data.profit.toFixed(2),
            },
            locale
          );
          break;
        case "stopLoss":
          message = i18n.__(
            "events.ready.crypto.notifications.stopLoss",
            {
              direction: translatedDirection,
              symbol: position.symbol,
              price: data.price.toString(),
              loss: Math.abs(data.loss).toFixed(2),
            },
            locale
          );
          break;
      }

      // Send DM to user
      if (message) {
        await user.send(message).catch((err) => {
          console.warn(
            `[Crypto] Could not DM user ${userId} about position ${position.id}: ${err.message}`
          );
        });
      }
    } catch (error) {
      console.error(`[Crypto] Error notifying user:`, error);
    }
  }

  // Log startup in all supported languages
  ["en", "ru", "uk"].forEach((locale) => {
    console.log(
      i18n.__("events.ready.crypto.notifications.monitorStarted", locale)
    );
  });

  // Start the interval
  setInterval(checkAllPositions, MONITOR_INTERVAL);

  // Also run immediately
  checkAllPositions();
}
