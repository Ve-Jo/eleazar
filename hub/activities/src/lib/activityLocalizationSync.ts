import { LOCALIZATION_SERVICE_URL } from "../server/config.ts";
import { getActivityLocalizationPayload } from "./activityI18n.ts";

type SyncResponse = {
  success?: boolean;
  error?: string;
};

export async function syncActivityLocalizations(): Promise<boolean> {
  const body = {
    category: "activities",
    name: "launcher",
    localizations: getActivityLocalizationPayload(),
    save: true,
  };

  try {
    const response = await fetch(`${LOCALIZATION_SERVICE_URL}/i18n/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status}: ${text}`);
    }

    const payload = (await response.json()) as SyncResponse;
    if (payload?.success !== true) {
      throw new Error(payload?.error || "Unknown localization sync error");
    }

    console.log("[activities] Localization sync complete: activities.launcher.*");
    return true;
  } catch (error) {
    console.warn("[activities] Localization sync failed (continuing without crash):", error);
    return false;
  }
}
