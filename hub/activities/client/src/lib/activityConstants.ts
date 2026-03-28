export const TUNNEL_BYPASS_HEADER = "bypass-tunnel-reminder";
export const LAUNCHER_DATA_TIMEOUT_MS = 5000;
export const NAV_DOCK_IDLE_MS = 1800;

export const SECTIONS = ["balance", "level", "cases", "upgrades", "games"] as const;

export type ActivitySection = (typeof SECTIONS)[number];
