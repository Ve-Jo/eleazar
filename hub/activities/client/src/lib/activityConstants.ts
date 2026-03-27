export const TUNNEL_BYPASS_HEADER = "bypass-tunnel-reminder";
export const LAUNCHER_DATA_TIMEOUT_MS = 5000;
export const NAV_DOCK_IDLE_MS = 1800;
export const CAROUSEL_SETTLE_DELAY_MS = 180;
export const CAROUSEL_WHEEL_LINE_HEIGHT_PX = 16;
export const CAROUSEL_WHEEL_FLOAT_SENSITIVITY = 0.22;
export const CAROUSEL_WHEEL_MAX_VELOCITY_RATIO = 0.12;
export const CAROUSEL_FLOAT_FRICTION = 0.95;
export const CAROUSEL_FLOAT_MIN_VELOCITY = 0.2;

export const SECTIONS = ["balance", "cases", "upgrades", "games"] as const;

export type ActivitySection = (typeof SECTIONS)[number];
