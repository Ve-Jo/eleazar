# Web Implementation Checklist

This checklist tracks the approved implementation for Eleazar's `hub/web` app: landing + dashboard, Discord OAuth, per-guild controls, adaptive multilingual UI, and subscription scaffolding.

## Locked Scope

- [x] React + Vite + TypeScript workspace at `hub/web`.
- [x] Landing + dashboard routes from the first release.
- [x] Full Discord OAuth2 (no mock auth).
- [x] Guild edits restricted to users with required permissions.
- [x] User + guild stats overview in dashboard scope.
- [x] Initial settings: level roles + voice rooms + active guild keys.
- [x] Styling direction aligned with existing Eleazar rendering language.
- [x] Multilingual (`en`, `ru`, `uk`) and adaptive UX baseline.
- [x] Subscription is scaffold-only for this phase.

## Foundation

- [x] Create `hub/web` package and Vite config.
- [x] Add route skeleton and app shell.
- [x] Add shared styles/tokens and responsive layout primitives.
- [x] Add API helper and auth/i18n state skeleton.

## Next Build Steps

- [ ] Implement `hub/client` OAuth endpoints and session flow.
- [ ] Wire `/api/auth/me` + filtered guild list endpoint.
- [ ] Connect dashboard cards to live stats endpoints.
- [ ] Implement guild settings panels (level roles, voice rooms).
- [ ] Expand translation dictionaries and accessibility polish.
- [ ] Add pricing/subscription placeholders and capability flags.
- [ ] Add smoke checks and deployment checklist.
