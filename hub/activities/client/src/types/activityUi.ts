import type { Board } from "../lib/game2048.ts";
import type { MoneyMoveDirection } from "../lib/activityMath.ts";
import type { ActivitySection } from "../lib/activityConstants.ts";

export type ActivityScene = "launcher" | "2048";
export type LauncherMotionPhase = "idle" | "wheelActive" | "dragActive" | "settling" | "blocked";
export type LauncherPagingZone = "chrome" | "content" | "interactive" | "blocked" | "unknown";
export type LauncherSnapDecisionReason = "threshold" | "velocity" | "return" | "edge" | "nav";

export type LauncherSnapDecision = {
  fromSection: ActivitySection;
  toSection: ActivitySection;
  direction: -1 | 0 | 1;
  progress: number;
  reason: LauncherSnapDecisionReason;
};

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
  multiplayerStatus?: "disabled" | "ready" | "error";
  colyseusUrl?: string;
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

export type LayoutDebugSnapshot = {
  windowWidth: number;
  windowHeight: number;
  visualViewportWidth: number;
  visualViewportHeight: number;
  devicePixelRatio: number;
  baselineWidthDelta: number;
  baselineHeightDelta: number;
  launcherHeightScale: number;
  sectionScale: number;
  sectionScaleBase: number;
  launcherBottomClearance: number;
  sectionCardPaddingBottom: number;
  carouselGap: number;
  carouselPeek: number;
  carouselWidth: number;
  carouselScrollWidth: number;
  carouselMaxScrollLeft: number;
  screenHeight: number;
  carouselHeight: number;
  navHeight: number;
  navBottom: number;
  navReservedHeight: number;
  contentHeightBudget: number;
  activeCardClientHeight: number;
  activeCardScrollHeight: number;
  activeCardOverflow: number;
  motionPhase: LauncherMotionPhase;
  motionTargetSection: ActivitySection | null;
  motionProgress: number;
  motionReleaseVelocity: number;
  motionPagingZone: LauncherPagingZone;
  motionScrollLeft: number;
};

export type ViewportTier = "regular" | "compact" | "dense" | "micro";
