# Phase 27 Report — Formation Domain Contract Layer (S13/S14/S50 machine milestone)

Status date: 2026-08-20 — branch `feat/09-content-schemas-sourceformat-und-compilerg`.
Gate: **G27 BLOCKED on operator evidence only** — all 9 machine items satisfied;
the 6 blockers are operator-side (upstream G26 proof, device renders, a11y
protocols, visual goldens, browser E2E, performance). No PASS is claimed on
machine items alone.

## Scope (kit authority)

Per `docs/reports/phase27-input-contract.md` and the Phase 27 handbook, the
React screens and device integration for S13/S14/S50 stay behind the G26
stop-gate. This milestone implements the pure, machine-provable formation
domain contract layer — authoritative implementation design, exactly as
Phases 25/26 were prepared.

## Production layer (`src/game/formation/`, 8 modules)

| Module | Lines | Contract |
| --- | --- | --- |
| `types.ts` | 88 | Nine stable slots (`lane_0..2 × front/middle/back`), `UnitRef` (concrete instance/content ids, never display strings), `Finding`, preset kinds, disclosure items — all closed |
| `formation-error.ts` | 27 | Closed `FormationErrorCode` union for guard misuse (domain findings are not errors) |
| `model.ts` | 55 | `SLOT_IDS` canonical order, `compareCodeUnits`, `canonicalizeFormation`, stable `serializeFormation`, `sameFormation`, slot assertions |
| `validator.ts` | 133 | Pure validation: 10 hard codes + 3 warning codes, hard-first then code-unit ordering, `canStart` = no hard findings, no auto-repair/substitution |
| `presets.ts` | 83 | Exactly four kinds, custom-name validation, deterministic dedupe, `restorePreset` skip-and-report in stable order |
| `draft-store.ts` | 92 | Committed-vs-draft state machine: dirty tracking, atomic apply (failure leaves commit + draft intact), discard, revalidation pruning, route/resize/locale restore, pending guards |
| `start-guard.ts` | 51 | Atomic start: shared pending promise, exactly-once commit+navigate, unlock on failure (fixed a sync-throw race: pending is registered before the async work runs) |
| `disclosure.ts` | 35 | Required disclosure items, deterministic `missingDisclosure`, missing blocks start, closed item guard |

No new runtime dependency; `game/sim` and `game/save` untouched; no wallclock/
Math.random as authority.

## Contracts + fixtures (`contracts/phase27/`)

Ported byte-identical from the kit: `phase27-constants.json` and the six
fixtures (formation-rule, warning, preset-roundtrip, prebattle-disclosure,
atomic-start, focus-input matrices). All 47 of 48 kit files verify against the
pinned manifest; `starter-kit/src/model.ts` differs from its pinned hash but
its content matches the documented semantics — recorded as a minor
kit-integrity note (LF, no line-ending artifact).

## Tests (`tests/sim/phase27-*.test.ts`, 4 suites / 40 tests)

- `phase27-contracts.test.ts` (12) — constants, formation-rule matrix
  (empty/max-ok/regular-over/hero-over), warning matrix (exactly the pinned
  code per case), preset roundtrip, disclosure completeness, atomic-start
  matrix (double-start = one commit/one battle; save failure = zero commits,
  stays on screen), code-unit ordering.
- `phase27-validator.test.ts` (11) — every hard finding code, deterministic
  hard-first ordering, closed-code coverage on an adversarial formation, no
  mutation of the input.
- `phase27-draft-store.test.ts` (9) — dirty tracking, atomic apply
  success/failure, no-op apply, discard, revalidation pruning with draft
  persistence, restore, pending-transaction guards.
- `phase27-presets-guard.test.ts` (8) — preset kinds/names/dedupe/restore,
  disclosure item guard, start-guard concurrency (max 1 running commit) and
  unlock-after-failure.

## Gate evidence

`pnpm phase27:gate` → **BLOCKED** with exactly the six operator codes:
`P27_G27_G26_NOT_PROVEN`, `P27_G27_UI_DEVICE_RENDER_NOT_RUN`,
`P27_G27_A11Y_SCREENREADER_EVIDENCE_MISSING`,
`P27_G27_VISUAL_GOLDENS_DEVICE_MISSING`, `P27_G27_E2E_BROWSER_EVIDENCE_MISSING`,
`P27_G27_PERFORMANCE_DEVICE_MEASURE_MISSING`. Machine items satisfied:
constants, rules, warnings, presets, disclosure, atomicStart, inputA11y,
modules, tests.

All gates re-run clean on this revision: typecheck, lint, format, file-length,
`npx vitest run --project phase27` (40/40), full vitest, node tests, kernel
import audit, source policy, release build (artifact reverted).

## Handoff to Phase 28

The pure formation schemas, validation codes, disclosure selectors, preset
kinds and atomic-start semantics are now the authoritative reference in
`src/game/formation/`. Phase 28 may build the dungeon map/node/expedition
minimum only against the committed loadout and the exactly-once initial
Run/Battle snapshot contract, gated on real G27 evidence.
