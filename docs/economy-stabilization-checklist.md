# Economy Stabilization Checklist

Status legend:
- `[ ]` Not started
- `[-]` In progress
- `[x]` Complete

## Goals
- Stabilize economy inflation/deflation behavior
- Prevent exploit paths and race-condition losses
- Improve progression feel with clearer, fairer risk/reward
- Ship with tracked, testable implementation steps

## Tracking Summary
- Total tasks: 24
- Completed: 24
- In progress: 0
- Pending: 0

## Current Status (Implementation Pass)
- [x] E01 — Enforce non-negative wallet balance in mutations
- [x] E02 — Enforce non-negative bank and distributed balances
- [x] E03 — Cap and sanitize upgrade discount stacking
- [x] E04 — Fix server-side crate cooldown logic
- [x] E05 — Normalize cooldown timestamp semantics
- [x] E06 — Remove low-balance turbo-interest behavior
- [x] E07 — Add hard cap for effective annual bank rate
- [x] E08 — Preserve inactivity cap and reset behavior
- [x] E09 — Crime success chance and steal cap rebalance
- [x] E10 — Crime failure penalty rebalance
- [x] E11 — Tower payout sanity caps
- [x] E12 — Coinflip risk controls
- [x] E13 — Normalize game earnings/hour
- [x] E14 — Session payout caps for long sessions
- [x] E15 — Crate reward pressure tuning
- [x] E16 — Wire revert feature in shop command
- [x] E17 — Add new stability-focused upgrades in shared domain
- [x] E18 — Implement backend effects for new upgrades
- [x] E19 — Shop UI and localization updates for new upgrades
- [x] E20 — Verification pass and rollout notes
- [x] S01 — Consolidate shop upgrade view-model logic
- [x] S02 — Add clear selected-upgrade summary block
- [x] S03 — Improve select menu comparison semantics
- [x] S04 — Polish renderer cues and noise reduction

Notes:
- `bot` typecheck passes after this implementation set.
- `hub` typecheck still reports pre-existing errors in crypto wallet service/routes that are outside this economy pass.

---

## Phase A — Safety Invariants (Must-have)

### E01 — Enforce non-negative wallet balance in mutations
- [ ] Add guardrails in `hub/database/src/utils/economyMutations.ts` for all decrement paths
- [ ] Ensure `addBalance` does not allow balance below zero
- [ ] Ensure risky game and crime decrements fail safely
- [ ] Return explicit, user-facing-safe errors for insufficient funds
- **Acceptance checks**
  - [ ] Negative balance cannot be created via concurrent actions
  - [ ] Existing positive flows still work

### E02 — Enforce non-negative bank and distributed balances
- [ ] Add non-negative constraints for `bankBalance` and `bankDistributed` updates
- [ ] Ensure withdraw path cannot underflow with mixed distributed + active bank balances
- **Acceptance checks**
  - [ ] No bank field can become negative

### E03 — Cap and sanitize upgrade discount stacking
- [ ] Add a hard cap for `upgradeDiscount` (target cap: 30%)
- [ ] Ensure discount values cannot go negative
- [ ] Keep discount reset after purchase behavior
- **Acceptance checks**
  - [ ] Discount never exceeds cap

---

## Phase B — Cooldown and Crate Correctness

### E04 — Fix server-side crate cooldown logic
- [ ] Correct cooldown validation in `hub/database/src/utils/crateRewards.ts`
- [ ] Validate using `lastOpened + configuredCooldown > now`
- [ ] Ensure daily/weekly cooldown checks are authoritative server-side
- **Acceptance checks**
  - [ ] API cannot open daily/weekly crate before cooldown end

### E05 — Normalize cooldown timestamp semantics
- [ ] Keep one clear convention for cooldown storage (last-used timestamp)
- [ ] Ensure `getCrateCooldown` and client-side remaining-time calculation remain compatible
- [ ] Verify no mismatch between `cooldowns.ts` and crate route usage
- **Acceptance checks**
  - [ ] Cooldown UI and API behavior match exactly

---

## Phase C — Bank Model Rebalance

### E06 — Remove low-balance turbo-interest behavior
- [ ] Remove special `+300%` low-principal behavior in `hub/database/src/utils/economy.ts`
- [ ] Keep a single deterministic simple-interest formula
- **Acceptance checks**
  - [ ] Interest curve is smooth and predictable

### E07 — Add hard cap for effective annual bank rate
- [ ] Compute rate as before (level + upgrades), then clamp to max APR (target: 45%)
- [ ] Apply cap consistently in deposit and withdraw recalculation paths
- **Acceptance checks**
  - [ ] Effective APR never exceeds max cap

### E08 — Preserve inactivity cap and reset behavior
- [ ] Keep `BANK_MAX_INACTIVE_MS` limit behavior
- [ ] Confirm rate resets after inactivity threshold as intended
- **Acceptance checks**
  - [ ] Post-inactivity accrual is bounded and stable

---

## Phase D — Crime and Risk System Rebalance

### E09 — Crime success chance and steal cap rebalance
- [ ] Add hard cap to crime success chance (target: 55%)
- [ ] Add hard cap to max steal percentage (target: 15%)
- [ ] Clamp steal amount by target available wallet
- **Acceptance checks**
  - [ ] Crime cannot drain users excessively in one action

### E10 — Crime failure penalty rebalance
- [ ] Move failure fine to bounded range (target: 2–6% of robber wallet)
- [ ] Clamp by available robber wallet
- **Acceptance checks**
  - [ ] Failures are meaningful but not ruinous

### E11 — Tower payout sanity caps
- [ ] Apply max payout cap per run (target: configurable; initial fixed cap)
- [ ] Keep difficulty identity while preventing outlier jackpot spikes
- **Acceptance checks**
  - [ ] Tower cannot create extreme economy spikes in one run

### E12 — Coinflip risk controls
- [ ] Keep house edge behavior
- [ ] Add max bet guard relative to user wallet/progression tier
- **Acceptance checks**
  - [ ] Coinflip cannot be abused for volatility shocks

---

## Phase E — Reward/Source Normalization

### E13 — Normalize game earnings/hour
- [ ] Align Snake/2048 earning pacing to a target hourly envelope
- [ ] Keep game identity, reduce cross-game reward disparity
- **Acceptance checks**
  - [ ] Similar skill/time gives comparable rewards across core games

### E14 — Session payout caps for long sessions
- [ ] Add session max payout safeguards where needed
- [ ] Prevent indefinite farming through excessively long sessions
- **Acceptance checks**
  - [ ] Session rewards remain bounded

### E15 — Crate reward pressure tuning
- [ ] Revisit daily/weekly reward ranges and discount chances
- [ ] Tune to support progression without inflation surges
- **Acceptance checks**
  - [ ] Crates feel rewarding but not economy-dominant

---

## Phase F — Shop and Upgrade Productization

### E16 — Wire revert feature in shop command
- [x] Replace placeholder error path in `bot/src/cmds/economy/shop.ts`
- [x] Call backend revert API and show accurate refund/cooldown errors
- **Acceptance checks**
  - [x] Revert button fully functional in UI

### E17 — Add new stability-focused upgrades in shared domain
- [x] Add `fraud_protection`
- [x] Add `wallet_shield`
- [x] Add `vault_insurance`
- [x] Add `cooldown_mastery`
- [x] Add `tax_optimization`
- **Acceptance checks**
  - [x] New upgrades appear in config and are purchasable

### E18 — Implement backend effects for new upgrades
- [x] Apply effect hooks in relevant economy paths (crime/fees/cooldowns/risky losses)
- [x] Keep bounded effects and sensible caps
- **Acceptance checks**
  - [x] Upgrade effects are active and testable

### E19 — Shop UI and localization updates for new upgrades
- [x] Add labels/descriptions for EN/RU/UK command localization structures
- [x] Ensure rendering and formatting are correct
- **Acceptance checks**
  - [x] Shop display complete and consistent in supported locales

---

## Phase G — Verification and Rollout

### E20 — Verification pass and rollout notes
- [x] Run targeted typecheck/build for touched workspaces
- [x] Perform quick manual API sanity checks for core economy endpoints
- [x] Document final tuning constants and rollback strategy
- **Acceptance checks**
  - [x] No regressions in critical economy flows

---

## Phase H — Shop UX Clarity Polish

### S01 — Consolidate shop upgrade view-model logic
- [x] Replace duplicated per-upgrade formatting branches with a single normalized model in `bot/src/cmds/economy/shop.ts`
- [x] Keep one source of truth for level, effects, pricing, affordability, and progress fields
- **Acceptance checks**
  - [x] Image payload and select menu consume shared computed fields
  - [x] No duplicated effect-calculation switch blocks remain in shop command

### S02 — Add clear selected-upgrade summary block
- [x] Add compact summary text in shop response for selected upgrade
- [x] Include `Now`, `Next`, `Gain`, `Cost`, affordability status, and affected system
- **Acceptance checks**
  - [x] Players can evaluate one upgrade without reading full long-form description

### S03 — Improve select menu comparison semantics
- [x] Prefix options with category marker (`ECO`/`CD`)
- [x] Include concise comparison description (`Now / Next / +Gain`)
- [x] Preserve discount visibility in labels
- **Acceptance checks**
  - [x] Upgrade list becomes scan-friendly and supports quick comparison

### S04 — Polish renderer cues and noise reduction
- [x] Show discount badge only when active (`discount > 0`)
- [x] Strengthen selected-card cue with explicit selected marker
- [x] Remove misleading pointer cursor from non-interactive category chips
- **Acceptance checks**
  - [x] Visuals better match actual interaction model and reduce ambiguity

---

## Implementation Order
1. E01–E05 (correctness + exploit prevention)
2. E06–E10 (bank/crime stability)
3. E11–E15 (source normalization)
4. E16–E19 (shop + new upgrades)
5. E20 (verification)
6. S01–S04 (shop UX clarity polish)

## Change Log
- 2026-03-15: Checklist created.
- 2026-03-15: Added and completed shop UX clarity polish track (`S01`–`S04`).
