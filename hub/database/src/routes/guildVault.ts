import express from "express";
import { Prisma } from "@prisma/client";
import Database from "../client.ts";
import { serializeWithBigInt } from "../utils/serialization.ts";
import type { RequestLike, ResponseLike } from "../types/http.ts";

const router = express.Router();

type GuildVaultRouteRequest = RequestLike & {
  params: Record<string, string>;
  body: Record<string, unknown>;
  query: Record<string, string | undefined>;
};

type GuildVaultRecord = {
  balance?: unknown;
  totalFees?: unknown;
  lastDistribution?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  id?: unknown;
  guildId?: unknown;
};

router.get("/vault/:guildId", async (req: GuildVaultRouteRequest, res: ResponseLike) => {
  try {
    const guildId = req.params.guildId ?? "";

    if (!guildId) {
      return res.status(400).json({ error: "guildId is required" });
    }

    const vault = (await Database.getOrCreateGuildVault(guildId)) as GuildVaultRecord;
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

router.get(
  "/vault/:guildId/distributions",
  async (req: GuildVaultRouteRequest, res: ResponseLike) => {
    try {
      const guildId = req.params.guildId ?? "";
      const limitValue = req.query.limit ?? "10";

      if (!guildId) {
        return res.status(400).json({ error: "guildId is required" });
      }

      const limit = parseInt(limitValue, 10);
      if (Number.isNaN(limit)) {
        return res.status(400).json({ error: "Invalid limit" });
      }

      const distributions = await Database.getGuildVaultDistributions(guildId, limit);
      res.json(serializeWithBigInt(distributions));
    } catch (error) {
      console.error("Error getting guild vault distributions:", error);
      res.status(500).json({ error: "Failed to get guild vault distributions" });
    }
  }
);

router.get(
  "/vault/:guildId/user/:userId/distributions",
  async (req: GuildVaultRouteRequest, res: ResponseLike) => {
    try {
      const guildId = req.params.guildId ?? "";
      const userId = req.params.userId ?? "";
      const limitValue = req.query.limit ?? "10";

      if (!guildId || !userId) {
        return res.status(400).json({ error: "guildId and userId are required" });
      }

      const limit = parseInt(limitValue, 10);
      if (Number.isNaN(limit)) {
        return res.status(400).json({ error: "Invalid limit" });
      }

      const distributions = await Database.getUserVaultDistributions(guildId, userId, limit);
      res.json(serializeWithBigInt(distributions));
    } catch (error) {
      console.error("Error getting user vault distributions:", error);
      res.status(500).json({ error: "Failed to get user vault distributions" });
    }
  }
);

router.post(
  "/vault/:guildId/distribute",
  async (req: GuildVaultRouteRequest, res: ResponseLike) => {
    try {
      const guildId = req.params.guildId ?? "";
      const userId = typeof req.body.userId === "string" ? req.body.userId : "";
      const amountValue = req.body.amount;
      const amount =
        typeof amountValue === "number" || typeof amountValue === "string"
          ? new Prisma.Decimal(amountValue)
          : amountValue instanceof Prisma.Decimal
            ? amountValue
            : undefined;

      if (!guildId) {
        return res.status(400).json({ error: "guildId is required" });
      }

      if (!userId || amount === undefined) {
        return res.status(400).json({
          error: "userId and amount are required for manual distribution",
        });
      }

      const vault = await Database.addToGuildVault(guildId, amount, userId, "manual");

      res.json({
        success: true,
        message: "Manual distribution triggered successfully",
        vault: serializeWithBigInt(vault ?? {}),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to trigger manual distribution";
      console.error("Error triggering manual distribution:", error);
      res.status(500).json({ error: message });
    }
  }
);

export default router;
