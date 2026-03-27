import type { Board } from "../lib/game2048.ts";
import type { MoneyMoveDirection } from "../lib/activityMath.ts";

export type AuthState = {
  accessToken: string;
  userId?: string;
  guildId?: string;
};

export type CompletionResponse = {
  success?: boolean;
  idempotent?: boolean;
  reward?: {
    awardedAmount?: number;
    visualAwardedAmount?: number;
    blockedAmount?: number;
    gameXp?: number;
    requestedEarning?: number;
  };
  progression?: {
    highScore?: number;
    isNewRecord?: boolean;
  };
  dailyStatus?: {
    cap?: number;
    earnedToday?: number;
    remainingToday?: number;
  };
};

export type GameState = {
  board: Board;
  score: number;
  moves: number;
  startedAt: number;
  gameOver: boolean;
  submission?: CompletionResponse | null;
  submitting: boolean;
};

export type SetupDiagnostics = {
  clientId?: string;
  origin: string;
  href: string;
  guildId?: string;
  channelId?: string;
  errorStep?: string;
  currentStep: string;
  lastError?: string;
};

export type SetupState = {
  loading: boolean;
  error: string | null;
  auth: AuthState | null;
  sdkReady: boolean;
  diagnostics: SetupDiagnostics | null;
};

export type MoneyModalState = {
  open: boolean;
  direction: MoneyMoveDirection;
  input: string;
  selectedPreset: number | null;
  submitting: boolean;
  error: string | null;
};

export type NoticeState = {
  kind: "success" | "error" | "warning";
  message: string;
} | null;

export type CrateRevealState = {
  type: string;
  reward: Record<string, unknown>;
} | null;

export type ViewportState = {
  width: number;
  height: number;
};

export type ViewportTier = "regular" | "compact" | "dense" | "micro";
