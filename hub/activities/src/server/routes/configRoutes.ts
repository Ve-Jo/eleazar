import type express from "express";

import { createHealthResponse } from "../../../../shared/src/utils.ts";
import { ACTIVITY_GAME_CATALOG } from "../../lib/gameCatalog.ts";
import { MAX_2048_SESSION_EARNING } from "../../lib/rewardCalculator.ts";
import {
  ACTIVITY_CLIENT_ID,
  ACTIVITY_CLIENT_SECRET,
  ACTIVITY_PUBLIC_BASE_URL,
  ACTIVITY_REDIRECT_URI,
} from "../config.ts";
import { parseJsonResponse } from "../lib/http.ts";
import { asObject, getDiscordOAuthErrorMessage } from "../lib/primitives.ts";

export function registerConfigRoutes(app: express.Express) {
  app.get("/health", (_req, res) => {
    res.json(createHealthResponse("activities", "1.0.0"));
  });

  app.get(["/api/config", "/.proxy/api/config"], (_req, res) => {
    res.json({
      clientId: ACTIVITY_CLIENT_ID,
      redirectUri: ACTIVITY_REDIRECT_URI,
      publicBaseUrl: ACTIVITY_PUBLIC_BASE_URL || null,
      max2048SessionEarning: MAX_2048_SESSION_EARNING,
      entryPointOnly: true,
      games: ACTIVITY_GAME_CATALOG,
    });
  });

  app.get(["/api/auth/discord/callback", "/.proxy/api/auth/discord/callback"], (req, res) => {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(req.query || {})) {
      if (value == null) {
        continue;
      }

      if (Array.isArray(value)) {
        for (const entry of value) {
          params.append(key, String(entry));
        }
        continue;
      }

      params.set(key, String(value));
    }

    res.setHeader("Cache-Control", "no-store");
    res.type("html").send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Discord Activity OAuth</title>
  </head>
  <body>
    <script>
      (function () {
        var payload = {
          type: "discord-activity-oauth-callback",
          query: Object.fromEntries(new URLSearchParams(${JSON.stringify(params.toString())}))
        };

        try {
          if (window.opener && window.opener !== window) {
            window.opener.postMessage(payload, window.location.origin);
          }
        } catch (_error) {}

        try {
          if (window.parent && window.parent !== window) {
            window.parent.postMessage(payload, window.location.origin);
          }
        } catch (_error) {}

        window.location.replace("/");
      })();
    </script>
    <p>Discord authorization completed. Return to your Activity if this page stays open.</p>
  </body>
</html>`);
  });

  app.post(["/api/token", "/.proxy/api/token"], async (req, res) => {
    try {
      if (!ACTIVITY_CLIENT_ID || !ACTIVITY_CLIENT_SECRET) {
        return res.status(500).json({
          error: "Missing Activity OAuth env vars",
          required: ["ACTIVITY_CLIENT_ID", "ACTIVITY_CLIENT_SECRET"],
        });
      }

      const code = typeof req.body?.code === "string" ? req.body.code : "";
      if (!code) {
        return res.status(400).json({ error: "OAuth code is required" });
      }

      const body = new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: ACTIVITY_CLIENT_ID,
        client_secret: ACTIVITY_CLIENT_SECRET,
      });

      const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      });

      const parsed = await parseJsonResponse(tokenResponse);
      if (!parsed.ok) {
        const parsedData = asObject(parsed.data);
        return res.status(parsed.status).json({
          ...parsedData,
          error:
            typeof parsedData.error === "string"
              ? parsedData.error
              : "oauth_token_exchange_failed",
          message: getDiscordOAuthErrorMessage(parsed.data),
        });
      }

      return res.status(parsed.status).json(parsed.data);
    } catch (error: any) {
      console.error("[activities] token exchange failed", error);
      return res.status(500).json({
        error: "Token exchange failed",
        message: error?.message || "Unknown error",
      });
    }
  });
}
