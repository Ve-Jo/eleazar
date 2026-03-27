import type { ActivityLauncherPayload } from "../../../../../../shared/src/contracts/hub.ts";

export function createSectionColoring(launcherData: ActivityLauncherPayload) {
  return {
    textColor: launcherData.palette.textColor,
    secondaryTextColor: launcherData.palette.secondaryTextColor,
    tertiaryTextColor: launcherData.palette.tertiaryTextColor,
    overlayBackground: launcherData.palette.overlayBackground,
    accentColor: launcherData.palette.accentColor,
    dominantColor:
      launcherData.palette.dominantColor || launcherData.palette.accentColor,
  };
}
