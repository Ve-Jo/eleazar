import express from "express";

import { createActivityAuthHandlers } from "../auth/activityAuth.ts";
import { registerCompatibilityRoutes } from "../routes/compatibilityRoutes.ts";
import { registerConfigRoutes } from "../routes/configRoutes.ts";
import { registerCrateRoutes } from "../routes/crateRoutes.ts";
import { registerEconomyRoutes } from "../routes/economyRoutes.ts";
import { registerGameRoutes } from "../routes/gameRoutes.ts";
import { registerLauncherRoutes } from "../routes/launcherRoutes.ts";
import { registerStaticRoutes } from "../routes/staticRoutes.ts";
import { registerUpgradeRoutes } from "../routes/upgradeRoutes.ts";

export function createActivitiesApp() {
  const app = express();
  const { optionalActivityAuth, requireActivityAuth } = createActivityAuthHandlers();

  app.use(express.json({ limit: "2mb" }));

  registerConfigRoutes(app);
  registerLauncherRoutes(app, optionalActivityAuth);
  registerEconomyRoutes(app, requireActivityAuth);
  registerCrateRoutes(app, requireActivityAuth);
  registerUpgradeRoutes(app, requireActivityAuth);
  registerGameRoutes(app, requireActivityAuth);
  registerCompatibilityRoutes(app, requireActivityAuth);
  registerStaticRoutes(app);

  app.use(
    (
      error: Error,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      console.error("[activities] unhandled error", error);
      res.status(500).json({ error: "Internal server error" });
    }
  );

  return app;
}
