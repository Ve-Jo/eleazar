export {
  COOLDOWNS,
  CRATE_TYPES,
  UPGRADES,
  DEFAULT_VALUES,
} from "../../../shared/src/domain.ts";

export const COLLECTION_INTERVAL = 60000;
export const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000;
export const DEFAULT_RETENTION_DAYS = 1;

export const BANK_MAX_INACTIVE_DAYS = 2;
export const BANK_MAX_INACTIVE_MS = BANK_MAX_INACTIVE_DAYS * 24 * 60 * 60 * 1000;

export const MAX_RETRIES = 5;
export const INITIAL_DELAY_MS = 1000;
export const MAX_DELAY_MS = 10000;

export const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));
