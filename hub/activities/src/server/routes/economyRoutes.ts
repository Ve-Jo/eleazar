import type express from "express";

import type { ActivityMutationEnvelope } from "../../../../shared/src/contracts/hub.ts";
import { buildActivityLauncherPayload, resolveMoveAmount } from "../services/launcherBuilder.ts";
import type { AuthenticatedRequest } from "../types/activityServer.ts";
import { fetchDatabase } from "../services/databaseGateway.ts";

export function registerEconomyRoutes(
  app: express.Express,
  requireActivityAuth: express.RequestHandler
) {
  app.post(
    ["/api/economy/move", "/.proxy/api/economy/move"],
    requireActivityAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const authUser = req.authUser;
        if (!authUser?.id) {
          return res.status(401).json({ error: "Unauthorized: missing resolved user" });
        }

        const guildId = String(req.body?.guildId || req.headers["x-guild-id"] || "").trim();
        const direction =
          String(req.body?.direction || "").trim().toLowerCase() === "withdraw"
            ? "withdraw"
            : String(req.body?.direction || "").trim().toLowerCase() === "deposit"
            ? "deposit"
            : "";
        const amountMode =
          String(req.body?.amountMode || "").trim().toLowerCase() === "percent"
            ? "percent"
            : "fixed";

        if (!guildId) {
          return res.status(400).json({ error: "guildId is required" });
        }

        if (direction !== "deposit" && direction !== "withdraw") {
          return res.status(400).json({ error: "direction must be deposit or withdraw" });
        }

        const currentLauncher = await buildActivityLauncherPayload(guildId, authUser);
        const amount = resolveMoveAmount(currentLauncher.balance, direction, amountMode, req.body?.amount);

        if (amount <= 0) {
          return res.status(400).json({ error: "Amount must be greater than zero" });
        }

        const result = await fetchDatabase(`/economy/${direction}`, {
          method: "POST",
          body: JSON.stringify({
            guildId,
            userId: authUser.id,
            amount,
          }),
        });

        if (!result.ok) {
          const resultData = result.data as { error?: string };
          return res.status(result.status).json({
            error: typeof resultData.error === "string" ? resultData.error : `Failed to ${direction} funds`,
          });
        }

        const launcher = await buildActivityLauncherPayload(guildId, authUser);
        const response: ActivityMutationEnvelope<{
          direction: "deposit" | "withdraw";
          amount: number;
          amountMode: "fixed" | "percent";
        }> = {
          success: true,
          action: {
            direction,
            amount,
            amountMode,
          },
          launcher,
        };

        return res.json(response);
      } catch (error: any) {
        console.error("[activities] economy move failed", error);
        return res.status(500).json({
          error: "Failed to move funds",
          message: error?.message || "Unknown error",
        });
      }
    }
  );
}
