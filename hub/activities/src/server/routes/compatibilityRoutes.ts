import type express from "express";

import { fetchDatabase } from "../services/databaseGateway.ts";

export function registerCompatibilityRoutes(
  app: express.Express,
  requireActivityAuth: express.RequestHandler
) {
  app.post(
    ["/api/games/updateRecord", "/.proxy/api/games/updateRecord"],
    requireActivityAuth,
    async (req, res) => {
      try {
        const result = await fetchDatabase(`/games/records/update`, {
          method: "POST",
          body: JSON.stringify(req.body || {}),
        });
        return res.status(result.status).json(result.data);
      } catch (error: any) {
        return res.status(500).json({
          error: error?.message || "Failed to update game record",
        });
      }
    }
  );

  app.get(
    ["/api/shop/upgrades/:guildId/:userId", "/.proxy/api/shop/upgrades/:guildId/:userId"],
    requireActivityAuth,
    async (req, res) => {
      try {
        const guildId = String(req.params.guildId || "");
        const userId = String(req.params.userId || "");
        const result = await fetchDatabase(`/economy/upgrades/${guildId}/${userId}`);
        return res.status(result.status).json(result.data);
      } catch (error: any) {
        return res.status(500).json({ error: error?.message || "Failed to load upgrades" });
      }
    }
  );
}
