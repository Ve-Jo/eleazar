import express from "express";
import Database from "../client.js";
import { serializeBigInt } from "../utils/serialization.ts";
import type { RequestLike, ResponseLike } from "../types/http.ts";

const router = express.Router();

type TransactionOperation = {
  method?: string;
  args?: unknown[];
};

type TransactionsRouteRequest = RequestLike & {
  body: Record<string, unknown>;
};

type DynamicDatabase = typeof Database & Record<string, (...args: unknown[]) => Promise<unknown>>;

router.post("/", async (req: TransactionsRouteRequest, res: ResponseLike) => {
  try {
    const operations = Array.isArray(req.body.operations)
      ? (req.body.operations as TransactionOperation[])
      : null;

    if (!operations) {
      return res.status(400).json({ error: "operations array is required" });
    }

    const result = await Database.transaction(async (tx: unknown) => {
      const results: unknown[] = [];
      const db = Database as DynamicDatabase;

      for (const operation of operations) {
        const method = typeof operation.method === "string" ? operation.method : "";
        const args = Array.isArray(operation.args) ? operation.args : null;

        if (!method || !args) {
          throw new Error("Each operation must have method and args");
        }

        const dbMethod = db[method];
        if (typeof dbMethod !== "function") {
          throw new Error(`Unknown database method: ${method}`);
        }

        const methodResult = await dbMethod(...args, tx);
        results.push(methodResult);
      }

      return results;
    });

    res.json(serializeBigInt({ results: result }));
  } catch (error) {
    console.error("Error executing transaction:", error);
    res.status(500).json({ error: "Failed to execute transaction" });
  }
});

router.post("/get", async (req: TransactionsRouteRequest, res: ResponseLike) => {
  try {
    const path = typeof req.body.path === "string" ? req.body.path : "";

    if (!path) {
      return res.status(400).json({ error: "path is required" });
    }

    const result = await Database.get(path);
    res.json(serializeBigInt(result));
  } catch (error) {
    console.error("Error getting data:", error);
    res.status(500).json({ error: "Failed to get data" });
  }
});

export default router;
