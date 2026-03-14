import express from "express";
import { Prisma } from "@prisma/client";
import CryptoWalletService from "../services/cryptoWalletService.ts";
import { serializeBigInt } from "../utils/serialization.ts";
import type { RequestLike, ResponseLike } from "../types/http.ts";

const router = express.Router();

type CryptoWalletRouteRequest = RequestLike & {
  params: Record<string, string>;
  body: Record<string, unknown>;
  query: Record<string, string | undefined>;
};

type WalletRecord = {
  id: string;
  address?: string;
  depositMemo?: string | null;
  currency?: string;
};

type HistoryRecord = {
  createdAt?: string | Date;
};

router.get("/wallets/:guildId/:userId", async (req: CryptoWalletRouteRequest, res: ResponseLike) => {
  try {
    const guildId = req.params.guildId ?? "";
    const userId = req.params.userId ?? "";

    if (!guildId || !userId) {
      return res.status(400).json({ error: "guildId and userId are required" });
    }

    const wallets = await CryptoWalletService.getUserWallets(guildId, userId);
    res.json(serializeBigInt(wallets));
  } catch (error) {
    console.error("Error getting crypto wallets:", error);
    res.status(500).json({ error: "Failed to get crypto wallets" });
  }
});

router.get(
  "/wallets/:guildId/:userId/:currency",
  async (req: CryptoWalletRouteRequest, res: ResponseLike) => {
    try {
      const guildId = req.params.guildId ?? "";
      const userId = req.params.userId ?? "";
      const currency = req.params.currency ?? "";

      if (!guildId || !userId || !currency) {
        return res.status(400).json({ error: "guildId, userId, and currency are required" });
      }

      const wallet = await CryptoWalletService.getOrCreateWallet(guildId, userId, currency);
      res.json(serializeBigInt(wallet));
    } catch (error) {
      console.error("Error getting crypto wallet:", error);
      res.status(500).json({ error: "Failed to get crypto wallet" });
    }
  }
);

router.get(
  "/deposit-address/:guildId/:userId/:currency",
  async (req: CryptoWalletRouteRequest, res: ResponseLike) => {
    try {
      const guildId = req.params.guildId ?? "";
      const userId = req.params.userId ?? "";
      const currency = req.params.currency ?? "";

      if (!guildId || !userId || !currency) {
        return res.status(400).json({ error: "guildId, userId, and currency are required" });
      }

      const wallet = (await CryptoWalletService.getOrCreateWallet(
        guildId,
        userId,
        currency
      )) as WalletRecord;
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
  }
);

router.get(
  "/deposits/:guildId/:userId",
  async (req: CryptoWalletRouteRequest, res: ResponseLike) => {
    try {
      const guildId = req.params.guildId ?? "";
      const userId = req.params.userId ?? "";
      const currency = req.query.currency;
      const limit = req.query.limit ?? "50";
      const offset = req.query.offset ?? "0";
      const parsedLimit = Number(limit) || 50;
      const parsedOffset = Number(offset) || 0;

      if (!guildId || !userId) {
        return res.status(400).json({ error: "guildId and userId are required" });
      }

      if (currency) {
        const wallet = (await CryptoWalletService.getOrCreateWallet(
          guildId,
          userId,
          currency
        )) as WalletRecord;
        const deposits = await CryptoWalletService.getDepositHistory(
          wallet.id,
          parsedLimit,
          parsedOffset
        );
        return res.json(serializeBigInt(deposits));
      }

      const wallets = (await CryptoWalletService.getUserWallets(guildId, userId)) as WalletRecord[];
      const depositLists = await Promise.all(
        wallets.map((wallet) => CryptoWalletService.getDepositHistory(wallet.id, parsedLimit, 0))
      );
      const combined = (depositLists.flat() as HistoryRecord[])
        .sort(
          (a, b) =>
            new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
        )
        .slice(parsedOffset, parsedOffset + parsedLimit);

      res.json(serializeBigInt(combined));
    } catch (error) {
      console.error("Error getting deposit history:", error);
      res.status(500).json({ error: "Failed to get deposit history" });
    }
  }
);

router.get(
  "/withdrawals/:guildId/:userId",
  async (req: CryptoWalletRouteRequest, res: ResponseLike) => {
    try {
      const guildId = req.params.guildId ?? "";
      const userId = req.params.userId ?? "";
      const currency = req.query.currency;
      const limit = req.query.limit ?? "50";
      const offset = req.query.offset ?? "0";
      const parsedLimit = Number(limit) || 50;
      const parsedOffset = Number(offset) || 0;

      if (!guildId || !userId) {
        return res.status(400).json({ error: "guildId and userId are required" });
      }

      if (currency) {
        const wallet = (await CryptoWalletService.getOrCreateWallet(
          guildId,
          userId,
          currency
        )) as WalletRecord;
        const withdrawals = await CryptoWalletService.getWithdrawalHistory(
          wallet.id,
          parsedLimit,
          parsedOffset
        );
        return res.json(serializeBigInt(withdrawals));
      }

      const wallets = (await CryptoWalletService.getUserWallets(guildId, userId)) as WalletRecord[];
      const withdrawalLists = await Promise.all(
        wallets.map((wallet) =>
          CryptoWalletService.getWithdrawalHistory(wallet.id, parsedLimit, 0)
        )
      );
      const combined = (withdrawalLists.flat() as HistoryRecord[])
        .sort(
          (a, b) =>
            new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
        )
        .slice(parsedOffset, parsedOffset + parsedLimit);

      res.json(serializeBigInt(combined));
    } catch (error) {
      console.error("Error getting withdrawal history:", error);
      res.status(500).json({ error: "Failed to get withdrawal history" });
    }
  }
);

router.post("/withdrawals", async (req: CryptoWalletRouteRequest, res: ResponseLike) => {
  try {
    const guildId = typeof req.body.guildId === "string" ? req.body.guildId : "";
    const userId = typeof req.body.userId === "string" ? req.body.userId : "";
    const currency = typeof req.body.currency === "string" ? req.body.currency : "";
    const amount =
      typeof req.body.amount === "string" ||
      typeof req.body.amount === "number" ||
      req.body.amount instanceof Prisma.Decimal
        ? req.body.amount
        : undefined;
    const toAddress = typeof req.body.toAddress === "string" ? req.body.toAddress : "";
    const memo = req.body.memo === null ? null : undefined;

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

router.get(
  "/portfolio/:guildId/:userId",
  async (req: CryptoWalletRouteRequest, res: ResponseLike) => {
    try {
      const guildId = req.params.guildId ?? "";
      const userId = req.params.userId ?? "";

      if (!guildId || !userId) {
        return res.status(400).json({ error: "guildId and userId are required" });
      }

      const portfolio = await CryptoWalletService.getPortfolioValue(guildId, userId);
      res.json(serializeBigInt(portfolio));
    } catch (error) {
      console.error("Error getting portfolio value:", error);
      res.status(500).json({ error: "Failed to get portfolio value" });
    }
  }
);

router.post(
  "/listen-deposits/:guildId/:userId",
  async (req: CryptoWalletRouteRequest, res: ResponseLike) => {
    try {
      const guildId = req.params.guildId ?? "";
      const userId = req.params.userId ?? "";

      if (!guildId || !userId) {
        return res.status(400).json({ error: "guildId and userId are required" });
      }

      await CryptoWalletService.startDepositListening(guildId, userId, () => null);
      res.json({ status: "listening" });
    } catch (error) {
      console.error("Error starting deposit listening:", error);
      res.status(500).json({ error: "Failed to start deposit listening" });
    }
  }
);

router.delete(
  "/listen-deposits/:guildId/:userId",
  async (req: CryptoWalletRouteRequest, res: ResponseLike) => {
    try {
      const guildId = req.params.guildId ?? "";
      const userId = req.params.userId ?? "";

      if (!guildId || !userId) {
        return res.status(400).json({ error: "guildId and userId are required" });
      }

      await CryptoWalletService.stopDepositListening(guildId, userId);
      res.json({ status: "stopped" });
    } catch (error) {
      console.error("Error stopping deposit listening:", error);
      res.status(500).json({ error: "Failed to stop deposit listening" });
    }
  }
);

router.get("/chains/:currency", async (req: CryptoWalletRouteRequest, res: ResponseLike) => {
  try {
    const currency = req.params.currency ?? "";

    if (!currency) {
      return res.status(400).json({ error: "currency is required" });
    }

    const chains = await CryptoWalletService.getAvailableChains(currency);
    res.json(serializeBigInt(chains));
  } catch (error) {
    console.error("Error getting available chains:", error);
    res.status(500).json({ error: "Failed to get available chains" });
  }
});

export default router;
