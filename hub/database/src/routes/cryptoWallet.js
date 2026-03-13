import express from "express";
import CryptoWalletService from "../services/cryptoWalletService.js";
import { serializeBigInt } from "../utils/serialization.js";

const router = express.Router();

// Get all wallets for a user
router.get("/wallets/:guildId/:userId", async (req, res) => {
  try {
    const { guildId, userId } = req.params;
    const wallets = await CryptoWalletService.getUserWallets(guildId, userId);
    res.json(serializeBigInt(wallets));
  } catch (error) {
    console.error("Error getting crypto wallets:", error);
    res.status(500).json({ error: "Failed to get crypto wallets" });
  }
});

// Get or create a wallet for a specific currency
router.get("/wallets/:guildId/:userId/:currency", async (req, res) => {
  try {
    const { guildId, userId, currency } = req.params;
    const wallet = await CryptoWalletService.getOrCreateWallet(
      guildId,
      userId,
      currency
    );
    res.json(serializeBigInt(wallet));
  } catch (error) {
    console.error("Error getting crypto wallet:", error);
    res.status(500).json({ error: "Failed to get crypto wallet" });
  }
});

// Get deposit address for a specific currency (creates wallet if needed)
router.get("/deposit-address/:guildId/:userId/:currency", async (req, res) => {
  try {
    const { guildId, userId, currency } = req.params;
    const wallet = await CryptoWalletService.getOrCreateWallet(
      guildId,
      userId,
      currency
    );
    res.json(
      serializeBigInt({
        address: wallet.address,
        memo: wallet.depositMemo || null,
        currency: wallet.currency,
      })
    );
  } catch (error) {
    console.error("Error getting deposit address:", error);
    res.status(500).json({ error: "Failed to get deposit address" });
  }
});

// Get deposit history
router.get("/deposits/:guildId/:userId", async (req, res) => {
  try {
    const { guildId, userId } = req.params;
    const { currency, limit = "50", offset = "0" } = req.query;
    const parsedLimit = Number(limit) || 50;
    const parsedOffset = Number(offset) || 0;

    if (currency) {
      const wallet = await CryptoWalletService.getOrCreateWallet(
        guildId,
        userId,
        currency
      );
      const deposits = await CryptoWalletService.getDepositHistory(
        wallet.id,
        parsedLimit,
        parsedOffset
      );
      return res.json(serializeBigInt(deposits));
    }

    const wallets = await CryptoWalletService.getUserWallets(guildId, userId);
    const depositLists = await Promise.all(
      wallets.map((wallet) =>
        CryptoWalletService.getDepositHistory(wallet.id, parsedLimit, 0)
      )
    );
    const combined = depositLists
      .flat()
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(parsedOffset, parsedOffset + parsedLimit);

    res.json(serializeBigInt(combined));
  } catch (error) {
    console.error("Error getting deposit history:", error);
    res.status(500).json({ error: "Failed to get deposit history" });
  }
});

// Get withdrawal history
router.get("/withdrawals/:guildId/:userId", async (req, res) => {
  try {
    const { guildId, userId } = req.params;
    const { currency, limit = "50", offset = "0" } = req.query;
    const parsedLimit = Number(limit) || 50;
    const parsedOffset = Number(offset) || 0;

    if (currency) {
      const wallet = await CryptoWalletService.getOrCreateWallet(
        guildId,
        userId,
        currency
      );
      const withdrawals = await CryptoWalletService.getWithdrawalHistory(
        wallet.id,
        parsedLimit,
        parsedOffset
      );
      return res.json(serializeBigInt(withdrawals));
    }

    const wallets = await CryptoWalletService.getUserWallets(guildId, userId);
    const withdrawalLists = await Promise.all(
      wallets.map((wallet) =>
        CryptoWalletService.getWithdrawalHistory(wallet.id, parsedLimit, 0)
      )
    );
    const combined = withdrawalLists
      .flat()
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(parsedOffset, parsedOffset + parsedLimit);

    res.json(serializeBigInt(combined));
  } catch (error) {
    console.error("Error getting withdrawal history:", error);
    res.status(500).json({ error: "Failed to get withdrawal history" });
  }
});

// Request withdrawal
router.post("/withdrawals", async (req, res) => {
  try {
    const { guildId, userId, currency, amount, toAddress, memo = null } =
      req.body;

    if (!guildId || !userId || !currency || !amount || !toAddress) {
      return res.status(400).json({
        error: "guildId, userId, currency, amount, and toAddress are required",
      });
    }

    const withdrawal = await CryptoWalletService.requestWithdrawal(
      guildId,
      userId,
      currency,
      amount,
      toAddress,
      memo
    );
    res.json(serializeBigInt(withdrawal));
  } catch (error) {
    console.error("Error requesting withdrawal:", error);
    res.status(500).json({ error: "Failed to request withdrawal" });
  }
});

// Get total portfolio value
router.get("/portfolio/:guildId/:userId", async (req, res) => {
  try {
    const { guildId, userId } = req.params;
    const portfolio = await CryptoWalletService.getPortfolioValue(
      guildId,
      userId
    );
    res.json(serializeBigInt(portfolio));
  } catch (error) {
    console.error("Error getting portfolio value:", error);
    res.status(500).json({ error: "Failed to get portfolio value" });
  }
});

// Start listening for deposits
router.post("/listen-deposits/:guildId/:userId", async (req, res) => {
  try {
    const { guildId, userId } = req.params;
    await CryptoWalletService.startDepositListening(guildId, userId, () => null);
    res.json({ status: "listening" });
  } catch (error) {
    console.error("Error starting deposit listening:", error);
    res.status(500).json({ error: "Failed to start deposit listening" });
  }
});

// Stop listening for deposits
router.delete("/listen-deposits/:guildId/:userId", async (req, res) => {
  try {
    const { guildId, userId } = req.params;
    await CryptoWalletService.stopDepositListening(guildId, userId);
    res.json({ status: "stopped" });
  } catch (error) {
    console.error("Error stopping deposit listening:", error);
    res.status(500).json({ error: "Failed to stop deposit listening" });
  }
});

// Get available chains for a currency
router.get("/chains/:currency", async (req, res) => {
  try {
    const { currency } = req.params;
    const chains = await CryptoWalletService.getAvailableChains(currency);
    res.json(serializeBigInt(chains));
  } catch (error) {
    console.error("Error getting available chains:", error);
    res.status(500).json({ error: "Failed to get available chains" });
  }
});

export default router;
