import express from "express";
import { Prisma } from "@prisma/client";
import Database from "../client.js";
import { serializeBigInt } from "../utils/serialization.js";

const router = express.Router();

// Add balance
router.post("/balance/add", async (req, res) => {
  try {
    const { userId, guildId, amount } = req.body;

    if (!userId || !guildId || amount === undefined) {
      return res
        .status(400)
        .json({ error: "userId, guildId, and amount are required" });
    }

    const result = await Database.addBalance(guildId, userId, amount);
    res.json(serializeBigInt(result));
  } catch (error) {
    console.error("Error adding balance:", error);
    res.status(500).json({ error: "Failed to add balance" });
  }
});

// Get balance and bank information
router.get("/balance/:guildId/:userId", async (req, res) => {
  try {
    const { userId, guildId } = req.params;

    // Get user with economy data
    const user = await Database.getUser(guildId, userId);
    if (!user || !user.economy) {
      return res.status(404).json({ error: "User or economy data not found" });
    }

    // Calculate total bank balance (bankBalance + bankDistributed)
    const bankBalance = user.economy.bankBalance || new Prisma.Decimal(0);
    const bankDistributed =
      user.economy.bankDistributed || new Prisma.Decimal(0);
    const totalBankBalance = bankBalance.plus(bankDistributed);

    // Return detailed balance information
    res.json(
      serializeBigInt({
        balance: user.economy.balance || new Prisma.Decimal(0),
        bankBalance: bankBalance,
        bankDistributed: bankDistributed,
        totalBankBalance: totalBankBalance,
        bankRate: user.economy.bankRate || new Prisma.Decimal(0),
        bankStartTime: user.economy.bankStartTime || 0,
      })
    );
  } catch (error) {
    console.error("Error getting balance:", error);
    res.status(500).json({ error: "Failed to get balance" });
  }
});

// Purchase upgrade
router.post("/upgrades/purchase", async (req, res) => {
  try {
    const { userId, guildId, upgradeType } = req.body;

    if (!userId || !guildId || !upgradeType) {
      return res
        .status(400)
        .json({ error: "userId, guildId, and upgradeType are required" });
    }

    const result = await Database.purchaseUpgrade(guildId, userId, upgradeType);
    res.json(serializeBigInt(result));
  } catch (error) {
    console.error("Error purchasing upgrade:", error);
    res.status(500).json({ error: "Failed to purchase upgrade" });
  }
});

// Calculate bank balance
router.post("/bank/calculate", async (req, res) => {
  try {
    const { user, tx } = req.body;

    if (!user) {
      return res.status(400).json({ error: "user is required" });
    }

    const result = await Database.calculateBankBalance(user, tx);
    res.json(serializeBigInt(result));
  } catch (error) {
    console.error("Error calculating bank balance:", error);
    res.status(500).json({ error: "Failed to calculate bank balance" });
  }
});

// Deposit money
router.post("/deposit", async (req, res) => {
  try {
    const { guildId, userId, amount } = req.body;

    if (!userId || !guildId || amount === undefined) {
      return res
        .status(400)
        .json({ error: "userId, guildId, and amount are required" });
    }

    const result = await Database.deposit(guildId, userId, amount); // already correct
    res.json(serializeBigInt(result));
  } catch (error) {
    console.error("Error depositing money:", error);
    res.status(500).json({ error: "Failed to deposit money" });
  }
});

// Withdraw money
router.post("/withdraw", async (req, res) => {
  try {
    const { guildId, userId, amount } = req.body;

    if (!userId || !guildId || amount === undefined) {
      return res
        .status(400)
        .json({ error: "userId, guildId, and amount are required" });
    }

    const result = await Database.withdraw(guildId, userId, amount); // already correct
    res.json(serializeBigInt(result));
  } catch (error) {
    console.error("Error withdrawing money:", error);
    res.status(500).json({ error: "Failed to withdraw money" });
  }
});

// Transfer balance between users
router.post("/transfer", async (req, res) => {
  try {
    const { fromUserId, toUserId, guildId, amount } = req.body;

    if (!fromUserId || !toUserId || !guildId || amount === undefined) {
      return res.status(400).json({
        error: "fromUserId, toUserId, guildId, and amount are required",
      });
    }

    const result = await Database.transferBalance(
      guildId,
      fromUserId,
      toUserId,
      amount
    ); // already correct
    res.json(serializeBigInt(result));
  } catch (error) {
    console.error("Error transferring balance:", error);
    res.status(500).json({ error: "Failed to transfer balance" });
  }
});

// Update bank balance with interest
router.post("/bank/update", async (req, res) => {
  try {
    const { userId, guildId, tx } = req.body;

    if (!userId || !guildId) {
      return res.status(400).json({ error: "userId and guildId are required" });
    }

    const result = await Database.updateBankBalance(guildId, userId, tx);
    res.json(serializeBigInt(result));
  } catch (error) {
    console.error("Error updating bank balance:", error);
    res.status(500).json({ error: "Failed to update bank balance" });
  }
});

// Calculate interest
router.post("/bank/interest", async (req, res) => {
  try {
    const { bankBalance, lastBankUpdate, interestRate } = req.body;

    if (
      bankBalance === undefined ||
      !lastBankUpdate ||
      interestRate === undefined
    ) {
      return res.status(400).json({
        error: "bankBalance, lastBankUpdate, and interestRate are required",
      });
    }

    const result = await Database.calculateInterest(
      bankBalance,
      lastBankUpdate,
      interestRate
    );
    res.json(serializeBigInt(result));
  } catch (error) {
    console.error("Error calculating interest:", error);
    res.status(500).json({ error: "Failed to calculate interest" });
  }
});

// Get user upgrades
router.get("/upgrades/:guildId/:userId", async (req, res) => {
  try {
    const { userId, guildId } = req.params;

    const upgrades = await Database.getUserUpgrades(guildId, userId);
    res.json(serializeBigInt(upgrades));
  } catch (error) {
    console.error("Error getting user upgrades:", error);
    res.status(500).json({ error: "Failed to get user upgrades" });
  }
});

// Revert upgrade
router.post("/upgrades/revert", async (req, res) => {
  try {
    const { userId, guildId, upgradeType } = req.body;

    if (!userId || !guildId || !upgradeType) {
      return res
        .status(400)
        .json({ error: "userId, guildId, and upgradeType are required" });
    }

    const result = await Database.revertUpgrade(guildId, userId, upgradeType);
    res.json(serializeBigInt(result));
  } catch (error) {
    console.error("Error reverting upgrade:", error);
    res.status(500).json({ error: "Failed to revert upgrade" });
  }
});

// Get upgrade information
router.get("/upgrades/info/:upgradeType/:level", async (req, res) => {
  try {
    const { upgradeType, level } = req.params;

    const levelNum = parseInt(level);
    if (isNaN(levelNum)) {
      return res.status(400).json({ error: "Invalid level number" });
    }

    const info = await Database.getUpgradeInfo(upgradeType, levelNum);
    res.json(serializeBigInt(info));
  } catch (error) {
    console.error("Error getting upgrade info:", error);
    res.status(500).json({ error: "Failed to get upgrade info" });
  }
});

export default router;
