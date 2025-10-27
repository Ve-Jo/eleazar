import express from "express";
import Database from "../client.js";
import { serializeWithBigInt } from "../client.js";

const router = express.Router();

// Get guild vault information
router.get("/vault/:guildId", async (req, res) => {
  try {
    const { guildId } = req.params;

    if (!guildId) {
      return res.status(400).json({ error: "guildId is required" });
    }

    const vault = await Database.getOrCreateGuildVault(guildId);
    res.json(
      serializeWithBigInt({
        balance: vault.balance,
        totalFees: vault.totalFees,
        lastDistribution: vault.lastDistribution,
        createdAt: vault.createdAt,
        updatedAt: vault.updatedAt,
        id: vault.id,
        guildId: vault.guildId,
      })
    );
  } catch (error) {
    console.error("Error getting guild vault:", error);
    res.status(500).json({ error: "Failed to get guild vault" });
  }
});

// Get guild vault distribution history
router.get("/vault/:guildId/distributions", async (req, res) => {
  try {
    const { guildId } = req.params;
    const { limit = 10 } = req.query;

    if (!guildId) {
      return res.status(400).json({ error: "guildId is required" });
    }

    const distributions = await Database.getGuildVaultDistributions(
      guildId,
      parseInt(limit) || 10
    );
    res.json(serializeWithBigInt(distributions));
  } catch (error) {
    console.error("Error getting guild vault distributions:", error);
    res.status(500).json({ error: "Failed to get guild vault distributions" });
  }
});

// Get user's personal vault distributions
router.get("/vault/:guildId/user/:userId/distributions", async (req, res) => {
  try {
    const { guildId, userId } = req.params;
    const { limit = 10 } = req.query;

    if (!guildId || !userId) {
      return res.status(400).json({ error: "guildId and userId are required" });
    }

    const distributions = await Database.getUserVaultDistributions(
      guildId,
      userId,
      parseInt(limit) || 10
    );
    res.json(serializeWithBigInt(distributions));
  } catch (error) {
    console.error("Error getting user vault distributions:", error);
    res.status(500).json({ error: "Failed to get user vault distributions" });
  }
});

// Force guild vault distribution (admin function)
router.post("/vault/:guildId/distribute", async (req, res) => {
  try {
    const { guildId } = req.params;
    const { userId, amount } = req.body;

    if (!guildId) {
      return res.status(400).json({ error: "guildId is required" });
    }

    if (!userId || !amount) {
      return res.status(400).json({
        error: "userId and amount are required for manual distribution",
      });
    }

    // Add amount to guild vault and trigger distribution
    const vault = await Database.addToGuildVault(
      guildId,
      amount,
      userId,
      "manual"
    );

    res.json({
      success: true,
      message: "Manual distribution triggered successfully",
      vault: serializeWithBigInt(vault),
    });
  } catch (error) {
    console.error("Error triggering manual distribution:", error);
    res.status(500).json({
      error: error.message || "Failed to trigger manual distribution",
    });
  }
});

export default router;
