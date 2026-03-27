import { useEffect, useState } from "react";
import { z } from "zod";

import type { ActivityLauncherPayload } from "../../../../../../shared/src/contracts/hub.ts";
import type { CrateRevealState, NoticeState } from "../../../types/activityUi.ts";

type MutationRunner = <TAction extends Record<string, unknown>>(
  path: string,
  body: Record<string, unknown>,
  actionSchema: z.ZodType<TAction>
) => Promise<{ action?: TAction }>;

type UseLauncherActionsOptions = {
  launcherData: ActivityLauncherPayload | null;
  performMutation: MutationRunner;
};

export function useLauncherActions({
  launcherData,
  performMutation,
}: UseLauncherActionsOptions) {
  const [notice, setNotice] = useState<NoticeState>(null);
  const [crateReveal, setCrateReveal] = useState<CrateRevealState>(null);
  const [pendingCrateType, setPendingCrateType] = useState<string | null>(null);
  const [pendingUpgradeType, setPendingUpgradeType] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timeoutId = window.setTimeout(() => setNotice(null), 2800);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [notice]);

  const openCrate = async (type: string) => {
    if (!launcherData || launcherData.readOnly) {
      return;
    }

    setPendingCrateType(type);

    try {
      const payload = await performMutation<{ type: string; reward: Record<string, unknown> }>(
        "/api/crates/open",
        {
          type,
        },
        z.object({
          type: z.string(),
          reward: z.record(z.string(), z.unknown()),
        })
      );

      setCrateReveal({
        type,
        reward:
          payload.action?.reward && typeof payload.action.reward === "object"
            ? payload.action.reward
            : {},
      });
      setNotice({
        kind: "success",
        message: launcherData.strings.cases.openSuccess || "Case opened",
      });
    } catch (error: any) {
      setNotice({
        kind: "error",
        message: error?.message || "Failed to open case.",
      });
    } finally {
      setPendingCrateType(null);
    }
  };

  const purchaseUpgrade = async (upgradeType: string) => {
    if (!launcherData || launcherData.readOnly) {
      return;
    }

    setPendingUpgradeType(upgradeType);

    try {
      await performMutation<{ upgradeType: string }>(
        "/api/upgrades/purchase",
        {
          upgradeType,
        },
        z.object({
          upgradeType: z.string(),
        })
      );
      setNotice({
        kind: "success",
        message: launcherData.strings.upgrades.boughtSuccess || "Upgrade purchased",
      });
    } catch (error: any) {
      setNotice({
        kind: "error",
        message: error?.message || "Failed to purchase upgrade.",
      });
    } finally {
      setPendingUpgradeType(null);
    }
  };

  return {
    crateReveal,
    notice,
    openCrate,
    pendingCrateType,
    pendingUpgradeType,
    purchaseUpgrade,
    setNotice,
  };
}
