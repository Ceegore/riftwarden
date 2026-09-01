# Phase 18 — Status, Control, Periodic, Cleanse und Dispel

**Phase:** PHASE-18 — status subsystem (T01–T06) + kernel integration
**Gate:** G18 (assessment below)
**Branch:** `feat/09-content-schemas-sourceformat-und-compilerg`
**Status:** IMPLEMENTED (repository evidence); G18 `BLOCKED` pending operator device evidence

## A. Entry gate

- G17 remains `BLOCKED` on operator evidence only: `P18_G17_WEBVIEWS_NOT_RUN`,
  `P18_G17_NOT_REPRODUCED`, `P18_G17_DEVICE_PERF_MISSING` — verified by
  `node tools/sim/validate-phase17-readiness.mjs` (mass-sim + desktop
  cross-runtime evidence **satisfied**; device WebView/perf evidence cannot be
  self-certified by tooling).
- Implementation proceeded per the Phase-18 handbook §15 order without
  touching any Phase-17 pinned trace/checksum.

## B. Tickets

| Ticket | Deliverable | Status |
|---|---|---|
| T01 | `status-instance.ts` — closed `StatusKind` (13 kinds, shield excluded), DTO, validation, reason codes, control categories | ✅ |
| T02 | `status-collection.ts` (five §5.3 indices, canonical sort, duplicate-hard-errors) + `status-stacking.ts` (five §6 policies, strength-only replace, stable tie-break) | ✅ |
| T03 | `periodic-status-system.ts` (first-tick, due, immutable advance, §7.3 endTick-exclusive anchor) + stage-I kernel system | ✅ |
| T04 | `control-resolver.ts` (boss tiers 70/80/85%, round-half-away duration, 0.65 s hard-CC cap, confusion conversion, anti-permalock gate) | ✅ |
| T05 | `cleanse-dispel.ts` (categorical §9.1 priority, dispel §9.2 ordering, `unremovable` skip, 35% shield cap) + stage-H/K kernel systems | ✅ |
| T06 | `status-events.ts` (six closed `Effect*` types, integer/ID payloads) + `selectors.ts` | ✅ |
| Kernel | `statuses`/`pendingCleanses` battle fields, `set_statuses` (I/K), `queue_cleanse_dispel` (H) + `clear_pending_cleanses` (K), `createPhase18Systems` composition, snapshot projection, migration | ✅ |

## C. Evidence

| Artifact | Path | Result |
|---|---|---|
| Status pure core tests | `tests/sim/phase18-status-core.test.ts` (+ periodic/control/cleanse/events) | 60+ tests green |
| Kernel integration tests | `tests/sim/phase18-kernel.test.ts`, `phase18-cleansedispel-kernel.test.ts` | green |
| §13.2 determinism matrix | `tests/sim/phase18-dense-fault.test.ts` | dense/permutation/mirror/resume/fault green |
| Golden reference trace | `tests/sim/fixtures/reference-traces-phase18.json` | byte-identical, pinned |
| Cross-runtime matrix | `docs/reports/phase14-crossruntime.json` (phase18 section) | Node + chromium/firefox/webkit hash-identical |
| Mass-sim (status active) | `docs/reports/phase18-mass-sim.json` | PASS, 10000 battles, 600000 ticks, 0 drift |
| Source policy (§12) | `tests/sim/source-policy.test.mjs` + `tools/sim/audit-kernel-imports.mjs` | whole `src/game/sim` tree clean |
| §14 budgets | status modules ≤ 240–300 per handbook | all under budget |

## D. Revisions and commands

- `850182b` T01/T02 core · `3689318` T03 periodic · `94c3252` T04 control ·
  `c5d6745` T05 cleanse/dispel · `caefaa1` T06 events/selectors ·
  `60c2658` kernel wiring + cross-runtime/mass-sim ·
  `8113a16` §13.2 hardening (canonical snapshot projection, content validation) ·
  `66189cf` §12 enforcement (whole-tree scan, two `localeCompare` fixes)
- Commands: `node tools/sim/run-mass-sim.mjs --phase18 --battles 10000` ·
  `node tools/sim/generate-crossruntime-matrix.mjs` ·
  `node tools/sim/run-crossruntime-browsers.mjs` ·
  `node tools/sim/validate-phase17-readiness.mjs`

## E. Defects and risks

- Fixed in-phase: seed-order hash leakage (snapshot now projects canonical
  statuses from tick 0); unvalidated periodic content coefficients; two §12
  `localeCompare` hits in diagnostics sorters; `verifySnapshot`/`createSnapshot`
  asymmetry.
- Boundary (documented, not a defect): shield dispel (§9.2) runs through the
  Phase-17 shield ledger with individual removal/reduction events — this is
  content-owned and lands with Phase-19 abilities; the 35% cap helper is
  pinned. Status application itself is likewise content-driven (Phase 19).
- No open P0/P1.

## F. Gate G18

G18 is `BLOCKED`, not `FAIL`: every repository-verifiable item is green
(closed types, stack matrix, periodic/control/cleanse/dispel goldens,
save/resume, cross-runtime, mass-sim, typecheck/lint/unit/integration,
source-policy, budgets). The remaining requirements are operator-side
(G17 device WebView + perf evidence) and content-side (Phase-19 ability
framework driving status application and shield-dispel ledger events).
`phase18:validate-readiness` must be green before Phase 19 starts.
