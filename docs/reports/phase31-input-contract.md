# Phase 31 Input Contract Assessment — Permanent Management & Economy Flows (S15–S24)

**Status: BLOCKED on operator evidence (G30 not proven). Machine-design inputs are ready.**

Source: `Phasen/Phase_31/` kit (handbook, source map, input audit, blocker
register, contracts, fixtures, evidence templates) and the Phase 30→31
handoff (`handoff/PHASE31_TO_PHASE32_HANDOFF.md`). This assessment audits the
Phase 31 entry conditions in the real repository; it claims no gate result.

## 1. Phase 31 scope (kit authority)

- Phase 31 delivers the **permanent management and economy flows S15–S24**:
  S15 Hero Hall, S16 Hero Detail, S17 Equipment Picker, S18 Mastery safe
  handoff, S19 Barracks, S20 Troop Detail, S21 Kit Picker, S22 Workshop,
  S23 Item Detail, S24 Banner Picker.
- Plus the pure domain: **Profile Progression Model** (`owned`/`unlocked`/
  `discovered` are separate states), **Derived Stats**, **Compatibility**,
  **Compare/Sort/Restore**, and **atomic idempotent transactions** for buy,
  contract, copy, equip, remove, kit, banner and polish.
- **Release counts are target contracts, not claims of shipped content**:
  exactly 10 heroes, 18 troop types, 42 permanent items, 6 banners. Validator,
  ContentIndex and UI must read the same revision.
- Not in scope: new currencies, affixes, inventory limits, full mastery
  details (Phase 35 — S18 gets only a safe non-dead handoff), online
  features, telemetry, new dependencies.
- Constants: hero level 1–3, contract level I–III, max 3 copies per troop
  type, exactly 1 active banner, non-negative currencies, mastery detail
  phase 35.

## 2. Hard input gate: G30

The Phase 30 kit requires a real G30 proof before Phase 31 production code.
Real-repository G30 audit (from `docs/reports/phase30-report.md` +
`pnpm phase30:gate`):

| Evidence item | Status |
|---|---|
| Constants, route/continue/settings/link/HQ/kill-point matrices, 9 modules, 38 tests (10 machine items) | **Complete (machine)** |
| Real G29 proof upstream + architecture GO | OPEN (operator) |
| S02–S10/S60–S65 UI device render | OPEN (operator) |
| TalkBack/VoiceOver screenreader protocols | OPEN (operator) |
| Device visual goldens | OPEN (operator) |
| Full-app browser E2E | OPEN (operator) |
| Device performance measurements | OPEN (operator) |
| Legal texts + release URL allowlist validation | OPEN (operator) |

Consequence (kit `03_PHASE30_INPUT_AUDIT.md` + handbook stop rule): without a
real G30 proof an implementation agent may prepare contracts, tests and
artifacts but must never report G31 as passed.

## 3. Machine-proven inputs available in the repository

- **Phase 30 app-shell layer** (`src/game/app-shell/`): route resolver
  (versioned serializable routes), settings domain (persisted/draft/
  effective + atomic monotonic commit), `ActionLedger` (exactly-once action
  tokens), first-run kill points — the navigation/commit/dispatch backbone
  the S15–S24 screens consume.
- **Phase 27 formation layer** (`src/game/formation/`): preset handling with
  deterministic dedupe and skip-and-report restore, atomic start guard — the
  kit/banner/preset-adjacent flows (SET_KIT, SET_BANNER) build on the same
  exactly-once commit discipline.
- **Phase 23/24 save layer**: SaveService transactions, canonical JSON,
  schema migrations with forward/backward strategy, recovery — the profile
  save/migration contract (SAVE_MIGRATION_CONTRACT) ports these directly.
- **Phase 28/29 transaction precedents**: `node-flow.ts` exactly-once
  commits with idempotent duplicate receipts, `commit-ledger.ts` with
  `resumeFromKinds` — the Phase 31 `transactionId` ledger (same ID never
  re-charges or re-mutates) is the same pattern in the profile domain.
- **Harness infrastructure**: the context-loss + visual golden browser
  harnesses and the golden-harness pattern (Vite SSR + pinned registries)
  are reusable for profile-transaction fault injection and the S15–S24
  visual evidence.

## 4. Design rules captured from the handbook

- **Domain model**: `owned`/`unlocked`/`discovered` separate; heroes use
  stable content IDs, troop copies add stable instance IDs; every reference
  to equipment, kit, banner, formation or preset is validated; currency,
  fame, level, contract level, copies and stats are non-negative safe
  integers — no floats in saved state.
- **Derivation order** (DERIVED_STATS_CONTRACT): baseline → level modifier →
  equipment/talisman or kit → other explicitly released modifiers; each
  rounding happens exactly once at the fixed stage; UI shows source and
  delta, never computes.
- **Transaction protocol** (TRANSACTION_FRAMEWORK_CONTRACT): preview (cost,
  old/new stock, effect) → explicit confirm → validation against current
  profile → atomic persist commit → idempotency ledger entry → success
  message/navigation. `transactionId` is stable across retry, resume and
  duplicate callback; commit failure leaves the old complete state; crash
  after commit before feedback must be recognized as already done on
  restart.
- **No dead buttons**: S18 opens a safe Phase-35 preview instead of a dead
  target; incompatible picker targets show a visible reason
  (`ui.compatibility.*` keys), never a silent void.
- **Compare/Sort/Restore**: deltas shown with symbol and number (never color
  alone); canonical sort keys (not localized strings); filter, scroll anchor
  and return state serializable; virtual lists need an accessible
  alternative.
- **File budgets** (§11): `profile-progression.ts`, `derived-stats.ts` and
  `profile-transaction-service.ts` each ≤300 lines; UI files ≤300; >500 is
  NO-GO.
- **No hardcodes**: names/values/rules never in UI components; content names
  and descriptions only through localization keys; missing content yields a
  diagnostic safe state, not an exception message in the UI.

## 5. Kit integrity

The Phase 31 kit zip itself hash-mismatches its pinned `.sha256` (the zip was
replaced after authoring), but the **extracted tree verifies 56/57** against
the in-package manifest. The single mismatch is `starter-kit/tests/run-tests.ts`
(pinned 1825 bytes vs 1822 on disk, no CRLF) — the same benign single-line
formatting pattern as Phases 27/28/30. Recorded as a minor kit-integrity
note; all contracts, fixtures and starter-kit sources verify clean.

## 6. Recommended machine milestone (per the stop-gate pattern)

The pure contract layer under `src/game/profile/` (types, integer guards,
profile validator, derived stats, transaction service with exactly-once
ledger, collection-state, compatibility) with fixture-driven tests — exactly
as Phases 25–30 were prepared. S15–S24 React screens, real content data
(10/18/42/6), device/a11y/performance evidence and save migrations stay
behind the G30 stop-gate.

## 7. Reusable fixtures

`transaction-cases.json` (4: buy-ok, insufficient, duplicate-callback,
commit-failure), `kill-point-matrix.json` (5 points incl. old_or_new_never_partial
and committed_once), `derived-stat-cases.json` (2 pinned derivations),
`compatibility-cases.json` (3), `collection-state-cases.json` (2),
`profile-minimal.json`, `profile-full-shape.json`, `screen-matrix.json`
(10 screens S15–S24).
