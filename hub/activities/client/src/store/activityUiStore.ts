import { create } from "zustand";

import type { ActivitySection } from "../lib/activityConstants.ts";
import type { ActivityScene } from "../types/activityUi.ts";

type ActivityUiStore = {
  activeSection: ActivitySection;
  activeScene: ActivityScene;
  isNavExpanded: boolean;
  focusedCrateType: string;
  focusedUpgradeType: string;
  focusedGameId: string;
  setActiveSection: (section: ActivitySection) => void;
  setActiveScene: (scene: ActivityScene) => void;
  setIsNavExpanded: (expanded: boolean) => void;
  setFocusedCrateType: (type: string) => void;
  setFocusedUpgradeType: (type: string) => void;
  setFocusedGameId: (gameId: string) => void;
};

export const useActivityUiStore = create<ActivityUiStore>((set) => ({
  activeSection: "balance",
  activeScene: "launcher",
  isNavExpanded: false,
  focusedCrateType: "daily",
  focusedUpgradeType: "",
  focusedGameId: "2048",
  setActiveSection: (section) => set({ activeSection: section }),
  setActiveScene: (scene) => set({ activeScene: scene }),
  setIsNavExpanded: (expanded) => set({ isNavExpanded: expanded }),
  setFocusedCrateType: (type) => set({ focusedCrateType: type }),
  setFocusedUpgradeType: (type) => set({ focusedUpgradeType: type }),
  setFocusedGameId: (gameId) => set({ focusedGameId: gameId }),
}));
