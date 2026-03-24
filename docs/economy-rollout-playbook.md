# Economy Rollout Playbook

Created: 2026-03-23  
Purpose: Operational reference for the single, stable economy tuning profile.

## Tuning Source Of Truth
- File: `hub/shared/src/economyTuning.ts`
- Mode: one static profile (no phase switches)
- Active version: `stable-2026-03-24-r6`

## Target Earning Bands
- Early activity:
coins/day `90..320`, target `180`
xp/hour `35..120`, target `70`
- Mid activity:
coins/day `220..900`, target `480`
xp/hour `70..210`, target `130`
- High activity:
coins/day `500..1700`, target `900`
xp/hour `120..340`, target `220`

## Per-Game Envelopes
- `2048`: coins/hour `45..160` (target `90`), xp/hour `70..220` (target `120`), max coin award `80`, max xp award `140`
- `snake`: coins/hour `55..190` (target `105`), xp/hour `80..230` (target `130`), max coin award `85`, max xp award `150`
- `coinflip`: coins/hour `60..210` (target `120`), xp/hour `60..190` (target `100`), max coin award `90`, max xp award `100`
- `tower`: coins/hour `65..230` (target `130`), xp/hour `65..200` (target `115`), max coin award `100`, max xp award `120`
- `rpg_clicker2`: coins/hour `40..140` (target `80`), xp/hour `55..180` (target `95`), max coin award `75`, max xp award `100`

## Stable Multipliers
- Faucets:
`crateCoinMultiplier=1`
`gameCoinMultiplier=0.9`
`gameDailyCapMultiplier=0.5`
`gameXpMultiplier=1`
`crimeStealMultiplier=0.83`
`bankInterestRateMultiplier=1`
- Sinks:
`upgradePriceMultiplier=2.8`
`bankFeeMultiplier=0.35`
`riskyLossMultiplier=1`
`crimeFineMultiplier=1.22`
`optionalPrestigeSinkRate=0.1`
`seasonXpPerSunkCoin=1`
- Bank guardrails:
`maxAnnualRatePercent=40`
`maxCycleDurationMs=259200000` (72h)
- Enforcement:
`awardEnvelopeClamps=true`
`longTermSinks=true`
- Guardrails:
`maxTimeWizardReductionPercent=0.45`
`minCrimeCooldownMs=3600000` (60m)
`maxCrimeSuccessChance=0.49`
`maxCrimeStealPercent=0.11`
`maxCrimeFineReduction=0.22`
`towerVaultRefundPerLevel=0.04`
`towerMaxVaultRefundReduction=0.2`

## Post-Deploy Validation Checklist
- [ ] Run local simulator snapshot before deploy:
`bun scripts/economy-simulator.ts`
- [ ] Run risky-game Monte Carlo checks:
`bun scripts/economy-simulator.ts --coinflip-bet=50 --coinflip-prob=0.5 --tower-difficulty=easy --tower-cashout-floor=1`
- [ ] Confirm stable config version in logs/metadata (`tuningVersion`).
- [ ] Validate concentration:
`GET /economy/wealth/metrics/:guildId` and check top-share trend
- [ ] Spot-check game clamps:
confirm clamp warnings only appear on envelope edge cases
- [ ] Spot-check bank pacing:
confirm bank growth does not outpace core faucets over the same window
- [ ] If regression detected:
adjust values in `hub/shared/src/economyTuning.ts`, bump `version`, redeploy
