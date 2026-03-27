import type express from "express";

import type { ActivityMutationEnvelope } from "../../../../shared/src/contracts/hub.ts";
import { asObject } from "../lib/primitives.ts";
import { fetchDatabase } from "../services/databaseGateway.ts";
import { buildActivityLauncherPayload } from "../services/launcherBuilder.ts";
import type { AuthenticatedRequest } from "../types/activityServer.ts";

export function registerUpgradeRoutes(
  app: express.Express,
  requireActivityAuth: express.RequestHandler
) {
  app.post(
    ["/api/upgrades/purchase", "/.proxy/api/upgrades/purchase"],
    requireActivityAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const authUser = req.authUser;
        if (!authUser?.id) {
          return res.status(401).json({ error: "Unauthorized: missing resolved user" });
        }

        const guildId = String(req.body?.guildId || req.headers["x-guild-id"] || "").trim();
        const upgradeType = String(req.body?.upgradeType || "").trim();

        if (!guildId || !upgradeType) {
          return res.status(400).json({ error: "guildId and upgradeType are required" });
        }

        const result = await fetchDatabase("/economy/upgrades/purchase", {
          method: "POST",
          body: JSON.stringify({
            guildId,
            userId: authUser.id,
            upgradeType,
          }),
        });

        if (!result.ok) {
          return res.status(result.status).json({
            error:
              typeof asObject(result.data).error === "string"
                ? asObject(result.data).error
                : "Failed to purchase upgrade",
          });
        }

        const launcher = await buildActivityLauncherPayload(guildId, authUser);
        const response: ActivityMutationEnvelope<{ upgradeType: string }> = {
          success: true,
          action: {
            upgradeType,
          },
          launcher,
        };

        return res.json(response);
      } catch (error: any) {
        console.error("[activities] upgrade purchase failed", error);
        return res.status(500).json({
          error: "Failed to purchase upgrade",
          message: error?.message || "Unknown error",
        });
      }
    }
  );
}
