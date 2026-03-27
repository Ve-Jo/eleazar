import {
  ACTIVITIES_SERVICE_PORT,
  ACTIVITY_CLIENT_ID,
  ACTIVITY_CLIENT_SECRET,
  ACTIVITY_PUBLIC_BASE_URL,
  ACTIVITY_REDIRECT_URI,
} from "./src/server/config.ts";
import { createActivitiesApp } from "./src/server/app/createActivitiesApp.ts";

export { createActivitiesApp } from "./src/server/app/createActivitiesApp.ts";

if (import.meta.main) {
  if (!ACTIVITY_CLIENT_ID || !ACTIVITY_CLIENT_SECRET) {
    console.warn(
      "[activities] WARNING: ACTIVITY_CLIENT_ID / ACTIVITY_CLIENT_SECRET are not configured. OAuth token exchange will fail until configured."
    );
  }
  if (!ACTIVITY_PUBLIC_BASE_URL && !process.env.ACTIVITY_REDIRECT_URI) {
    console.warn(
      `[activities] WARNING: ACTIVITY_PUBLIC_BASE_URL is not set. Redirect URI falls back to Discord's recommended placeholder (${ACTIVITY_REDIRECT_URI}).`
    );
  }

  const app = createActivitiesApp();
  app.listen(ACTIVITIES_SERVICE_PORT, () => {
    console.log(`Activities service running on http://localhost:${ACTIVITIES_SERVICE_PORT}`);
    console.log(`Health check: http://localhost:${ACTIVITIES_SERVICE_PORT}/health`);
  });
}
