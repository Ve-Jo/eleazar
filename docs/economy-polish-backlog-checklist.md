# Economy Polish Backlog Checklist

Created: 2026-03-23  
Purpose: Track the new economy audit findings so we do not lose critical fixes and tuning work.

Status legend:
- `[ ]` Not started
- `[-]` In progress
- `[x]` Complete

## Critical Integrity Fixes
- [x] Fix upgrade revert profit exploit (refund must never exceed paid progression cost).
- [x] Apply crate `seasonXp` rewards (currently rolled but not granted).
- [x] Make crate cooldown checks use upgrade-aware backend cooldown logic (`time_wizard` effective for `/economy cases`).
- [x] Wire daily streak reward multiplier into actual crate reward payout.
- [x] Ensure `daily_bonus` upgrade affects real payout path.
- [x] Enforce game daily cap atomically at DB write-time (race-safe cap guard).

## Economy Logic Consistency
- [x] Align `/economy continue` localization keys to correct command namespace.
- [x] Fix “shared bank” partner withdraw message to show real partner contribution instead of static `0.00`.
- [x] Ensure leaderboard total/bank ranking consistently includes distributed bank balance where intended.
- [x] Confirm manual guild vault distribution endpoint cannot be abused as a mint path.

## Upgrade & Reward Consistency
- [x] Ensure `games_earning` upgrade effect is applied consistently across all games (2048, snake, risky games) — intentionally excluded for legacy `crypto2.js` emulation flow.
- [x] Normalize game XP awarding policy across risky and non-risky games.
- [x] Reconcile shop upgrade descriptions with actual implemented behavior (`/daily` vs `/economy cases`).
- [x] Audit and cap upgrade effect displays so UI reflects true backend caps and formulas.

## Progression Balance Tuning
- [x] Set target earning bands for early, mid, and high-activity players.
- [x] Re-tune core reward faucets: crates, games, crime, and bank interest pacing.
- [x] Re-tune sinks: upgrades, bank fees, risk losses, and optional prestige sinks.
- [x] Define per-game expected coin/hour and XP/hour envelopes.
- [x] Rebalance bank progression so it is meaningful without dominating all other systems.

## Anti-Abuse Hardening
- [x] Add cooldown/throttling for command XP gain (prevent command spam leveling).
- [x] Require at least 2 non-bot members for voice XP session start (prevent solo voice farm).
- [x] Add abuse telemetry for suspicious balance deltas and high-frequency award calls.
- [x] Add safeguards around legacy `crypto2.js` reward interactions and balance mutation paths.

## Observability & Data
- [x] Economy ledger events were implemented and later removed to reduce operational overhead.
- [x] Daily faucet/sink source report was removed with the ledger retirement.
- [x] Track wealth concentration metrics (P50/P90/P99, top share) per guild.
- [ ] Reintroduce progression funnel metrics via a non-ledger approach (if needed).

## Rollout Plan
- [x] Consolidate tuning into one stable config profile (`hub/shared/src/economyTuning.ts`).
- [x] Remove phase-specific runtime behavior from economy award paths.
- [x] Keep envelope clamps + long-term sinks always managed by stable config values.
- [ ] Run post-deploy validation checklist for the stable profile.
