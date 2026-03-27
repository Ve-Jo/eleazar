import type express from "express";

import { completeActivity2048Session } from "../services/game2048Completion.ts";
import type { AuthenticatedRequest } from "../types/activityServer.ts";
import { clamp, toNumber } from "../lib/primitives.ts";

export function registerGameRoutes(
  app: express.Express,
  requireActivityAuth: express.RequestHandler
) {
  app.post(
    ["/api/games/2048/complete", "/.proxy/api/games/2048/complete"],
    requireActivityAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const authUser = req.authUser;
        if (!authUser?.id) {
          return res.status(401).json({ error: "Unauthorized: missing resolved user" });
        }

        const submissionId = String(req.body?.submissionId || "").trim();
        const guildId = String(req.body?.guildId || req.headers["x-guild-id"] || "").trim();
        const requestedScore = toNumber(req.body?.score, 0);
        const requestedMoves = toNumber(req.body?.moves, 0);
        const requestedDurationMs = toNumber(req.body?.durationMs, 0);

        if (!submissionId) {
          return res.status(400).json({ error: "submissionId is required" });
        }

        if (!guildId) {
          return res.status(400).json({
            error: "guildId is required for rewarded gameplay",
          });
        }

        const responsePayload = await completeActivity2048Session({
          guildId,
          requestedDurationMs: clamp(0, requestedDurationMs, 12 * 60 * 60 * 1000),
          requestedMoves: clamp(0, requestedMoves, 200_000),
          requestedScore: clamp(0, requestedScore, 2_000_000),
          submissionId,
          userId: authUser.id,
        });

        return res.json(responsePayload);
      } catch (error: any) {
        console.error("[activities] 2048 completion failed", error);
        return res.status(500).json({
          error: "Failed to finalize 2048 session",
          message: error?.message || "Unknown error",
        });
      }
    }
  );
}
