# Phase 28 Report — Expedition Minimum Contract Layer (S40/S41/S49 machine milestone)

Status date: 2026-08-20 — branch `feat/09-content-schemas-sourceformat-und-compilerg`.
Gate: **G28 BLOCKED on operator evidence only** — all 9 machine items satisfied;
the 6 blockers are operator-side (upstream G27 proof, device renders, a11y
protocols, visual goldens, full-app browser E2E, performance). No PASS is
claimed on machine items alone.

## Scope (kit authority)

Per `docs/reports/phase28-input-contract.md` and the Phase 28 handbook, the
S40/S41/S49 screens and device integration stay behind the G27 stop-gate. This
milestone implements the pure, machine-provable expedition contract layer —
authoritative implementation design, exactly as Phases 25/26/27 were prepared.

## Production layer (`src/game/expedition/`, 9 modules)

| Module | Lines | Contract |
| --- | --- | --- |
| `types.ts` | 96 | Closed map/run/preview types, six-level map profile, 8-stage node machine |
| `stable.ts` | 26 | Kit-pinned `compareCodeUnit`/`fnv1a`/`nextU32` — all randomness from the persisted seed |
| `expedition-error.ts` | 35 | Closed `ExpeditionErrorCode` union (12 codes) |
| `map-generator.ts` | 139 | Deterministic 6-level generator: stable ids, side branches, mandatory roles on a reachable route, attempt cap 50 + versioned fallback (rules never relaxed), canonical structural hash (sha256) |
| `reachability.ts` | 79 | `reachableFrom` from saved graph only, closed `MapViolationCode` structural validation (11 codes), `mainPathLength` |
| `node-flow.ts` | 64 | Closed 8-stage machine with command mapping; completed nodes reject all input |
| `node-registry.ts` | 37 | Closed battle/anchor registry; unsupported types rejected; Phase 32 families are a code change, never runtime improvisation |
| `run-state.ts` | 76 | Immutable saveable `RunState` factory; invalid maps/negative resources rejected before persistence |
| `run-reducer.ts` | 106 | Revision-validated pure reducers: transactions (pending lock, idempotent duplicate commits), visits (reachable-only), resources/instability never negative, loot secure/drop with closed `LOOT_NOT_AVAILABLE` |

No new runtime dependency; `game/sim` untouched; no wallclock/Math.random as
authority; structural hashing reuses the browser-safe `sha256Hex`.

## Contracts + fixtures (`contracts/phase28/`)

Ported byte-identical from the kit: `phase28-constants.json` and seven
fixtures (golden seeds, profiles, node-transition, invalid-map corpus,
kill-point, anchor, route-preview matrices). All 49 of 50 kit files verify
against the pinned manifest; `starter-kit/src/tests/contract-tests.ts` differs
in formatting only (single-line content, no tampering) — same benign pattern
as Phase 27.

## Golden harness + 10k gate (`tools/sim/phase28-golden-harness.mjs`)

- Bundles generator + reachability through Vite SSR and replays the twelve
  pinned golden seeds; every map is structurally valid, boss reachable,
  mandatory roles present, path length 6 ∈ [5,8].
- Runs the 10,000-map deterministic PR gate (seeds 100000..109999): **zero
  structural violations, zero fallbacks**.
- Registry `contracts/phase28/golden-registry.json` (12 entries, kernel source
  hash pinned); `phase28:golden:write/check` + CI wrapper
  `tests/sim/phase28-golden.test.mjs`.

## Tests (`tests/sim/phase28-*.test.ts`, 4 suites / 44 tests + 1 mjs gate)

- `phase28-contracts.test.ts` (15) — constants, profile fixture, golden seeds,
  node-transition matrix, route-preview/anchor/kill-point/corpus pins.
- `phase28-map-generator.test.ts` (9) — same-seed determinism, revision
  sensitivity, structural validity over 500 seeds, mandatory roles,
  visit-length bounds, stable ids, attempt-cap/fallback boundary (fault
  injection), presentation-order-independent hash, twelve golden seeds.
- `phase28-run-reducer.test.ts` (11) — run-state guards, pending lock,
  transaction identity, idempotent duplicate commits, unreachable rejection,
  revision enforcement, resource/instability clamps, loot secure/drop.
- `phase28-node-flow-registry.test.ts` (9) — full happy-path walk, completed
  rejection, invalid jumps, resolving branch, closed registry faults.

## Real-Chromium E2E (extended `tests/e2e/battle/context-loss-harness.spec.ts`)

New P28 scenario drives the battle-start exactly-once contract in real
Chromium: the browser bundle generates the golden-00 map and **reproduces the
pinned registry mapHash exactly** (cross-runtime determinism proof), the
double-tap start commits once and navigates once, the initial run snapshot is
a single immutable revision-0 state, and the closed node flow walks
previewed → … → completed in order. `pnpm test:e2e:harness`: 2/2 pass.

## Gate evidence

`pnpm phase28:gate` → **BLOCKED** with exactly the six operator codes:
`P28_G28_G27_NOT_PROVEN`, `P28_G28_UI_DEVICE_RENDER_NOT_RUN`,
`P28_G28_A11Y_SCREENREADER_EVIDENCE_MISSING`,
`P28_G28_VISUAL_GOLDENS_DEVICE_MISSING`, `P28_G28_E2E_BROWSER_EVIDENCE_MISSING`,
`P28_G28_PERFORMANCE_DEVICE_MEASURE_MISSING`. Machine items satisfied:
constants, profiles, generator, reachability, nodeFlow, runDomain,
goldenRegistry, modules, tests.

All gates re-run clean on this revision: typecheck, lint, format, file-length,
`npx vitest run --project phase28` (44/44), full vitest, node tests (incl. the
golden gate), kernel import audit, source policy, release build (artifact
reverted).

## Handoff to Phase 29

The map/run/node schemas, structural hash algorithm, golden seeds, generator
reports, pending-transaction recovery semantics and the exactly-once
battle-start contract are now the authoritative reference in
`src/game/expedition/`. Phase 29 may build the production-near Ash King
vertical slice only against the committed expedition and exactly-once
battle-start contracts, gated on real G28 evidence.
