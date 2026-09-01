# Phase 29 Report — Ash King Vertical Slice Contract Layer (machine milestone)

Status date: 2026-08-20 — branch `feat/09-content-schemas-sourceformat-und-compilerg`.
Gate: **G29 BLOCKED on operator evidence only** — all 8 machine items satisfied;
the 6 blockers are operator-side (upstream G28 proof, device renders, a11y
protocols, device visual goldens, full-app browser E2E, performance). Per the
handbook stop rule, no PASS is claimed on machine items alone.

## Scope (kit authority)

Per `docs/reports/phase29-input-contract.md` and the Phase 29 handbook, the
real E2E, asset/audio, device, accessibility and performance evidence stays
operator-side behind the G28 gate. This milestone implements the pure slice
tooling — authoritative implementation design, exactly as Phases 25–28 were
prepared.

## Production layer (`src/game/slice/`, 6 modules)

| Module | Lines | Contract |
| --- | --- | --- |
| `types.ts` | 63 | Closed slice kinds, revision-bound entries, 12-route closed order, commit kinds, hash samples |
| `slice-error.ts` | 30 | Closed `SliceErrorCode` union (5 codes) |
| `route-machine.ts` | 55 | Closed ordered route machine; guarded `advanceTo` (no jumps), `allowedTails`, `nextRoute` |
| `slice-validator.ts` | 77 | Exactly 4 heroes / 6 troops, unique revision-bound ids, boss present, referential closure, no repair/substitution, closed violation codes |
| `commit-ledger.ts` | 68 | Exactly-once commits per transaction id (repeat returns the prior receipt, kind conflict is hard), `resumeFromKinds` (resume at last confirmed boundary), commit counts |
| `hash-matrix.ts` | 55 | Speed×quality end-hash invariance per canonical seed, closed quality set, sample-count contract |

No new runtime dependency; no wallclock/Math.random as authority.

## Contracts + fixtures (`contracts/phase29/`)

Ported byte-identical from the kit: `phase29-constants.json` and five
fixtures (e2e-route, golden-seeds, kill-point, device, accessibility
matrices). All 48 kit files verify against the pinned manifest — the first
fully clean kit since Phase 26.

## Tests (`tests/sim/phase29-*.test.ts`, 2 suites / 22 tests)

- `phase29-contracts.test.ts` (12) — constants, 12-route order + guarded
  transitions, eight E2E cases, golden seeds (3×4×4), eight kill points with
  10 repetitions, device tiers, accessibility requirements.
- `phase29-slice-ledger-matrix.test.ts` (10) — manifest validation (counts,
  duplicates, revisions, boss, unresolved revision, dedupe/sort, closed
  codes), exactly-once ledger (idempotent repeats, kind conflicts, exactly
  one reward across a run), hash-matrix invariance (divergences reported with
  speed/quality, closed quality set).

## Real-Chromium E2E (extended `tests/e2e/battle/context-loss-harness.spec.ts`)

New P29 scenario drives the slice E2E + reliability kill matrix in real
Chromium: the closed route flow walks TITLE → … → MISSION_END in order; all
eight kill points resume at the last confirmed commit (battle-internal points
→ BATTLE, result → RESULT, reward → REWARD_OR_ANCHOR); the double-tapped
reward commit stays exactly-once with a 3-entry ledger. `pnpm test:e2e:harness`:
16/16 pass (2 context-loss, battle-start, slice E2E, 12 map visuals).

## Android toolchain (device evidence is operator-side)

No device/emulator attached, so real-device evidence remains operator work.
Machine-verified: plugin contracts 0 findings, config PASS, debug APK builds
(`pnpm android:debug` → BUILD SUCCESSFUL). A Windows tooling bug in
`tools/native/run-gradle.mjs` (`.bat` spawn EINVAL) was fixed in this session
(commit `ad5a650`). The operator checklist
(`docs/reports/android-expedition-run-checklist.md`) documents install →
S40/S41/S49 flow → logcat/dumpsys capture.

## Gate evidence

`pnpm phase29:gate` → **BLOCKED** with exactly the six operator codes:
`P29_G29_G28_NOT_PROVEN`, `P29_G29_UI_DEVICE_RENDER_NOT_RUN`,
`P29_G29_A11Y_SCREENREADER_EVIDENCE_MISSING`,
`P29_G29_VISUAL_GOLDENS_DEVICE_MISSING`, `P29_G29_E2E_BROWSER_EVIDENCE_MISSING`,
`P29_G29_PERFORMANCE_DEVICE_MEASURE_MISSING`. Machine items satisfied:
constants, routes, goldenSeeds, killPoints, matrices, modules, tests, e2eSpec.

All gates re-run clean on this revision: typecheck, lint, format, file-length,
`npx vitest run --project phase29` (22/22), full vitest, node tests, kernel
import audit, source policy, release build (artifact reverted).

## Handoff to Phase 30

The slice manifest schema, closed route machine, commit ledger and hash
matrix are now the authoritative reference in `src/game/slice/`. Phase 30 may
start only against an explicit architecture GO and real G29 evidence.
