import { useEffect } from "react";

import type { ActivityLauncherPayload } from "../../../../../../shared/src/contracts/hub.ts";
import { useActivityUiStore } from "../../../store/activityUiStore.ts";

export function useLauncherSelections(launcherData: ActivityLauncherPayload | null) {
  const focusedCrateType = useActivityUiStore((state) => state.focusedCrateType);
  const setFocusedCrateType = useActivityUiStore((state) => state.setFocusedCrateType);
  const focusedUpgradeType = useActivityUiStore((state) => state.focusedUpgradeType);
  const setFocusedUpgradeType = useActivityUiStore((state) => state.setFocusedUpgradeType);
  const focusedGameId = useActivityUiStore((state) => state.focusedGameId);
  const setFocusedGameId = useActivityUiStore((state) => state.setFocusedGameId);

  useEffect(() => {
    const availableGames = launcherData?.games.items || [];
    if (availableGames.length === 0) {
      return;
    }

    if (!availableGames.some((game) => game.id === focusedGameId)) {
      setFocusedGameId(availableGames[0]?.id || "2048");
    }
  }, [focusedGameId, launcherData, setFocusedGameId]);

  useEffect(() => {
    const availableCrates = launcherData?.cases.cards || [];
    if (availableCrates.length === 0) {
      return;
    }

    if (!availableCrates.some((crate) => crate.type === focusedCrateType)) {
      const preferredCrate = availableCrates.find((crate) => crate.available) || availableCrates[0];
      setFocusedCrateType(preferredCrate?.type || "daily");
    }
  }, [focusedCrateType, launcherData, setFocusedCrateType]);

  useEffect(() => {
    const availableUpgrades = launcherData?.upgrades.groups.flatMap((group) => group.items) || [];
    if (availableUpgrades.length === 0) {
      return;
    }

    if (!availableUpgrades.some((upgrade) => upgrade.type === focusedUpgradeType)) {
      setFocusedUpgradeType(availableUpgrades[0]?.type || "");
    }
  }, [focusedUpgradeType, launcherData, setFocusedUpgradeType]);

  return {
    focusedCrateType,
    focusedGameId,
    focusedUpgradeType,
    setFocusedCrateType,
    setFocusedGameId,
    setFocusedUpgradeType,
  };
}
