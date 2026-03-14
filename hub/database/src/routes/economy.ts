import express from "express";
import { Prisma } from "@prisma/client";
import Database from "../client.js";
import { serializeBigInt } from "../utils/serialization.ts";
import type { RequestLike, ResponseLike } from "../types/http.ts";

const router = express.Router();

type EconomyRouteRequest = RequestLike & {
  params: Record<string, string>;
  body: Record<string, unknown>;
};

type EconomyShape = {
  balance?: Prisma.Decimal;
  bankBalance?: Prisma.Decimal;
  bankDistributed?: Prisma.Decimal;
  bankRate?: Prisma.Decimal;
  bankStartTime?: unknown;
};

type UserWithEconomy = {
  economy?: EconomyShape | null;
};

router.post("/balance/add", async (req: EconomyRouteRequest, res: ResponseLike) => {
  try {
    const userId = typeof req.body.userId === "string" ? req.body.userId : "";
    const guildId = typeof req.body.guildId === "string" ? req.body.guildId : "";
    const amount = req.body.amount;

    if (!userId || !guildId || amount === undefined) {
      return res.status(400).json({ error: "userId, guildId, and amount are required" });
    }

    const result = await Database.addBalance(guildId, userId, amount);
    res.json(serializeBigInt(result));
  } catch (error) {
    console.error("Error adding balance:", error);
    res.status(500).json({ error: "Failed to add balance" });
  }
});

router.get("/balance/:guildId/:userId", async (req: EconomyRouteRequest, res: ResponseLike) => {
  try {
    const userId = req.params.userId ?? "";
    const guildId = req.params.guildId ?? "";

    if (!userId || !guildId) {
      return res.status(400).json({ error: "userId and guildId are required" });
    }

    const user = (await Database.getUser(guildId, userId)) as UserWithEconomy | null;
    if (!user || !user.economy) {
      return res.status(404).json({ error: "User or economy data not found" });
    }

    const bankBalance = user.economy.bankBalance || new Prisma.Decimal(0);
    const bankDistributed = user.economy.bankDistributed || new Prisma.Decimal(0);
    const totalBankBalance = bankBalance.plus(bankDistributed);

    res.json(
      serializeBigInt({
        balance: user.economy.balance || new Prisma.Decimal(0),
        bankBalance,
        bankDistributed,
        totalBankBalance,
        bankRate: user.economy.bankRate || new Prisma.Decimal(0),
        bankStartTime: user.economy.bankStartTime || 0,
      })
    );
  } catch (error) {
    console.error("Error getting balance:", error);
    res.status(500).json({ error: "Failed to get balance" });
  }
});

router.post("/upgrades/purchase", async (req: EconomyRouteRequest, res: ResponseLike) => {
  try {
    const userId = typeof req.body.userId === "string" ? req.body.userId : "";
    const guildId = typeof req.body.guildId === "string" ? req.body.guildId : "";
    const upgradeType = typeof req.body.upgradeType === "string" ? req.body.upgradeType : "";

    if (!userId || !guildId || !upgradeType) {
      return res.status(400).json({ error: "userId, guildId, and upgradeType are required" });
    }

    const result = await Database.purchaseUpgrade(guildId, userId, upgradeType);
    res.json(serializeBigInt(result));
  } catch (error) {
    console.error("Error purchasing upgrade:", error);
    res.status(500).json({ error: "Failed to purchase upgrade" });
  }
});

router.post("/bank/calculate", async (req: EconomyRouteRequest, res: ResponseLike) => {
  try {
    const user = req.body.user;
    const tx = req.body.tx === null ? null : undefined;

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

router.post("/deposit", async (req: EconomyRouteRequest, res: ResponseLike) => {
  try {
    const guildId = typeof req.body.guildId === "string" ? req.body.guildId : "";
    const userId = typeof req.body.userId === "string" ? req.body.userId : "";
    const amount = req.body.amount;

    if (!userId || !guildId || amount === undefined) {
      return res.status(400).json({ error: "userId, guildId, and amount are required" });
    }

    const result = await Database.deposit(guildId, userId, amount);
    res.json(serializeBigInt(result));
  } catch (error) {
    console.error("Error depositing money:", error);
    res.status(500).json({ error: "Failed to deposit money" });
  }
});

router.post("/withdraw", async (req: EconomyRouteRequest, res: ResponseLike) => {
  try {
    const guildId = typeof req.body.guildId === "string" ? req.body.guildId : "";
    const userId = typeof req.body.userId === "string" ? req.body.userId : "";
    const amount = req.body.amount;

    if (!userId || !guildId || amount === undefined) {
      return res.status(400).json({ error: "userId, guildId, and amount are required" });
    }

    const result = await Database.withdraw(guildId, userId, amount);
    res.json(serializeBigInt(result));
  } catch (error) {
    console.error("Error withdrawing money:", error);
    res.status(500).json({ error: "Failed to withdraw money" });
  }
});

router.post("/transfer", async (req: EconomyRouteRequest, res: ResponseLike) => {
  try {
    const fromUserId = typeof req.body.fromUserId === "string" ? req.body.fromUserId : "";
    const toUserId = typeof req.body.toUserId === "string" ? req.body.toUserId : "";
    const guildId = typeof req.body.guildId === "string" ? req.body.guildId : "";
    const amount = req.body.amount;

    if (!fromUserId || !toUserId || !guildId || amount === undefined) {
      return res.status(400).json({
        error: "fromUserId, toUserId, guildId, and amount are required",
      });
    }

    const result = await Database.transferBalance(guildId, fromUserId, toUserId, amount);
    res.json(serializeBigInt(result));
  } catch (error) {
    console.error("Error transferring balance:", error);
    res.status(500).json({ error: "Failed to transfer balance" });
  }
});

router.post("/bank/update", async (req: EconomyRouteRequest, res: ResponseLike) => {
  try {
    const userId = typeof req.body.userId === "string" ? req.body.userId : "";
    const guildId = typeof req.body.guildId === "string" ? req.body.guildId : "";
    const tx = req.body.tx === null ? null : undefined;

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

router.post("/bank/interest", async (req: EconomyRouteRequest, res: ResponseLike) => {
  try {
    const bankBalance = req.body.bankBalance;
    const lastBankUpdate = req.body.lastBankUpdate;
    const interestRate = req.body.interestRate;

    if (bankBalance === undefined || !lastBankUpdate || interestRate === undefined) {
      return res.status(400).json({
        error: "bankBalance, lastBankUpdate, and interestRate are required",
      });
    }

    const result = await Database.calculateInterest(bankBalance, lastBankUpdate, interestRate);
    res.json(serializeBigInt(result));
  } catch (error) {
    console.error("Error calculating interest:", error);
    res.status(500).json({ error: "Failed to calculate interest" });
  }
});

router.get("/upgrades/:guildId/:userId", async (req: EconomyRouteRequest, res: ResponseLike) => {
  try {
    const userId = req.params.userId ?? "";
    const guildId = req.params.guildId ?? "";

    if (!userId || !guildId) {
      return res.status(400).json({ error: "userId and guildId are required" });
    }

    const upgrades = await Database.getUserUpgrades(guildId, userId);
    res.json(serializeBigInt(upgrades));
  } catch (error) {
    console.error("Error getting user upgrades:", error);
    res.status(500).json({ error: "Failed to get user upgrades" });
  }
});

router.post("/upgrades/revert", async (req: EconomyRouteRequest, res: ResponseLike) => {
  try {
    const userId = typeof req.body.userId === "string" ? req.body.userId : "";
    const guildId = typeof req.body.guildId === "string" ? req.body.guildId : "";
    const upgradeType = typeof req.body.upgradeType === "string" ? req.body.upgradeType : "";

    if (!userId || !guildId || !upgradeType) {
      return res.status(400).json({ error: "userId, guildId, and upgradeType are required" });
    }

    const result = await Database.revertUpgrade(guildId, userId, upgradeType);
    res.json(serializeBigInt(result));
  } catch (error) {
    console.error("Error reverting upgrade:", error);
    res.status(500).json({ error: "Failed to revert upgrade" });
  }
});

router.get("/upgrades/info/:upgradeType/:level", async (req: EconomyRouteRequest, res: ResponseLike) => {
  try {
    const upgradeType = req.params.upgradeType ?? "";
    const level = req.params.level ?? "";

    if (!upgradeType) {
      return res.status(400).json({ error: "upgradeType is required" });
    }

    const levelNum = parseInt(level, 10);
    if (Number.isNaN(levelNum)) {
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
