import { z } from "zod";

export const activityConfigSchema = z.object({
  clientId: z.string().min(1).optional(),
});

export const activityTokenExchangeSchema = z.object({
  access_token: z.string().min(1).optional(),
  error: z.string().optional(),
  message: z.string().optional(),
  error_description: z.string().optional(),
});

const activityLauncherStringsSchema = z.object({
  nav: z.record(z.string(), z.string()),
  common: z.record(z.string(), z.string()),
  balance: z.record(z.string(), z.string()),
  cases: z.record(z.string(), z.string()),
  upgrades: z.record(z.string(), z.string()),
  games: z.record(z.string(), z.string()),
  modal: z.record(z.string(), z.string()),
});

const activityPaletteSchema = z.object({
  textColor: z.string(),
  secondaryTextColor: z.string(),
  tertiaryTextColor: z.string(),
  overlayBackground: z.string(),
  backgroundGradient: z.string(),
  accentColor: z.string(),
  dominantColor: z.string().optional(),
  isDarkText: z.boolean(),
});

const activityUserSummarySchema = z.object({
  id: z.string().optional(),
  username: z.string().optional(),
  displayName: z.string().optional(),
  avatar: z.string().nullable().optional(),
  avatarUrl: z.string().nullable().optional(),
  locale: z.enum(["en", "ru", "uk"]).optional(),
});

const activityGuildSummarySchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
});

const activityBalanceSnapshotSchema = z.object({
  walletBalance: z.number(),
  bankBalance: z.number(),
  bankDistributed: z.number(),
  totalBankBalance: z.number(),
  projectedBankBalance: z.number(),
  projectedTotalBankBalance: z.number(),
  annualRate: z.number(),
  annualRatePercent: z.number(),
  cycleStartTime: z.number(),
  maxInactiveMs: z.number(),
  timeIntoCycleMs: z.number(),
  cycleProgress: z.number(),
  cycleComplete: z.boolean(),
  upgradeDiscount: z.number(),
  updatedAt: z.number(),
});

const activityCrateCardSchema = z.object({
  type: z.string(),
  name: z.string(),
  description: z.string(),
  emoji: z.string(),
  count: z.number(),
  available: z.boolean(),
  cooldownRemainingMs: z.number(),
  cooldownDurationMs: z.number(),
  nextAvailableAt: z.number().nullable(),
  statusLabel: z.string(),
  rewardPreview: z.record(z.string(), z.number()),
  dailyStatus: z.record(z.string(), z.unknown()).nullable().optional(),
});

const activityCasesStateSchema = z.object({
  totalCount: z.number(),
  availableCount: z.number(),
  dailyStatus: z.record(z.string(), z.unknown()).nullable().optional(),
  cards: z.array(activityCrateCardSchema),
});

const activityUpgradeCardSchema = z.object({
  type: z.string(),
  category: z.string(),
  emoji: z.string(),
  name: z.string(),
  description: z.string(),
  impactLabel: z.string(),
  currentLevel: z.number(),
  nextLevel: z.number(),
  currentEffect: z.number(),
  nextEffect: z.number(),
  deltaEffect: z.number(),
  effectUnit: z.string(),
  currentEffectLabel: z.string(),
  nextEffectLabel: z.string(),
  deltaEffectLabel: z.string(),
  price: z.number(),
  originalPrice: z.number(),
  discountPercent: z.number(),
  isAffordable: z.boolean(),
  coinsNeeded: z.number(),
});

const activityUpgradeGroupSchema = z.object({
  key: z.string(),
  title: z.string(),
  items: z.array(activityUpgradeCardSchema),
});

const activityUpgradesStateSchema = z.object({
  totalCount: z.number(),
  discountPercent: z.number(),
  groups: z.array(activityUpgradeGroupSchema),
});

const activityGameCardSchema = z.object({
  id: z.string(),
  title: z.string(),
  emoji: z.string(),
  status: z.enum(["playable", "coming_soon"]),
  playable: z.boolean(),
  highScore: z.number().optional(),
  dailyStatus: z.record(z.string(), z.unknown()).nullable().optional(),
});

const activityGamesStateSchema = z.object({
  items: z.array(activityGameCardSchema),
  playableGameId: z.string().nullable().optional(),
});

export const activityLauncherPayloadSchema = z.object({
  locale: z.enum(["en", "ru", "uk"]),
  strings: activityLauncherStringsSchema,
  palette: activityPaletteSchema,
  user: activityUserSummarySchema,
  guild: activityGuildSummarySchema.nullable(),
  readOnly: z.boolean(),
  unsupportedReason: z.string().optional(),
  balance: activityBalanceSnapshotSchema,
  cases: activityCasesStateSchema,
  upgrades: activityUpgradesStateSchema,
  games: activityGamesStateSchema,
  refreshedAt: z.number(),
});

export const activityCompletionResponseSchema = z.object({
  success: z.boolean().optional(),
  idempotent: z.boolean().optional(),
  reward: z
    .object({
      awardedAmount: z.number().optional(),
      visualAwardedAmount: z.number().optional(),
      blockedAmount: z.number().optional(),
      gameXp: z.number().optional(),
      requestedEarning: z.number().optional(),
    })
    .optional(),
  progression: z
    .object({
      highScore: z.number().optional(),
      isNewRecord: z.boolean().optional(),
    })
    .optional(),
  dailyStatus: z
    .object({
      cap: z.number().optional(),
      earnedToday: z.number().optional(),
      remainingToday: z.number().optional(),
    })
    .optional(),
  error: z.string().optional(),
  message: z.string().optional(),
});

export function activityMutationEnvelopeSchema<TAction extends z.ZodTypeAny>(
  actionSchema: TAction
) {
  return z.object({
    success: z.boolean(),
    action: actionSchema.optional(),
    launcher: activityLauncherPayloadSchema,
    error: z.string().optional(),
    message: z.string().optional(),
  });
}
