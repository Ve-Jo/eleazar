import type express from "express";

import { buildLauncherResponse } from "../services/launcherBuilder.ts";
import type { AuthenticatedRequest } from "../types/activityServer.ts";

export function registerLauncherRoutes(
  app: express.Express,
  optionalActivityAuth: express.RequestHandler
) {
  app.get(
    ["/api/launcher-data", "/.proxy/api/launcher-data"],
    optionalActivityAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const guildId = String(req.query.guildId || req.headers["x-guild-id"] || "").trim();
        const launcher = await buildLauncherResponse(guildId, req.authUser);
        return res.json(launcher);
      } catch (error: any) {
        console.error("[activities] launcher-data failed", error);
        return res.status(500).json({
          error: "Failed to load launcher data",
          message: error?.message || "Unknown error",
        });
      }
    }
  );
}
