# Phase 21 — Data-Driven Boss Phases, Boss Objects, Modifiers, Hazards, Objectives and Reinforcements

**Phase:** PHASE-21 — boss/mission battle layer
**Gate:** G21 (assessment below)
**Branch:** `feat/09-content-schemas-sourceformat-und-compilerg`
**Status:** IMPLEMENTED (repository evidence); G21 `BLOCKED` pending operator device evidence + desktop browser re-run

## A. Entry gate

- G20 remains `BLOCKED` on operator evidence only (device WebView/perf +
  desktop browser re-run) — verified by
  `node tools/sim/validate-phase20-readiness.mjs`. Machine-computable G20
  evidence (mass-sim, reference trace, coverage) is satisfied.
- Implementation proceeded without touching any Phase 14–20 pinned
  trace/checksum: `bossPhase`/`modifiers`/`hazards`/`objectives`/`spawnedWaves`
  are additive and gated on `!== undefined`, so pre-Phase-21 fixtures and the
  operator's browser columns are byte-stable. Event-history tracking was
  extended to boss-aware states only (`bossPhase !== undefined`).

## B. Tickets

| Ticket | Deliverable | Status |
|---|---|---|
| T01 | `boss-phase-system.ts` — coverage validator (gaps, overlaps, ambiguity, unreachable, missing preview, invulnerability > 45) + transition detect/commit runtime | ✅ |
| T02 | Transition runtime wired into the pipeline: detect in D, atomic commit in L, 45-tick default, once per source phase, `PhaseTransitionPlanned`/`BossTelegraphStarted`/`BossPhaseStarted`/`BossPhaseCompleted` | ✅ |
| T03 | `boss-object-manager.ts` — four stable slots, spec validation, FAIL/DEFER blocked placement with `P21_OBJECT_SLOT_BLOCKED` | ✅ |
| T04 | `modifier-system.ts` (18-modifier preview gate, encounter validator) + `hazard-system.ts` (scheduled→telegraph→resolve→expire, content-stable warning info) | ✅ |
| T05 | `combat-objective.ts` (six closed kinds, event-driven progress, survival, impossibility guard, composite) + `reinforcement-system.ts` (validated waves, BLOCK/FAIL cap policy) | ✅ |
| T06 | Golden replay authority — pinned `reference-traces-phase21.json`, checkpoint-stable every 30 ticks, 2000-battle mass-sim with 0 hash drift | ✅ (Node reference; device evidence pending) |
| Kernel | `bossPhase`/`modifiers`/`hazards`/`objectives`/`spawnedWaves` fields, five validated reducer commands, `phase21-systems.ts` (modifier D, boss detect D, hazard C, wave K, boss commit L, objective L), snapshot projection | ✅ |

## C. Evidence

| Artifact | Path | Result |
|---|---|---|
| Contract/property/fault tests | `tests/sim/phase21-boss-phase.test.ts`, `phase21-boss-object.test.ts`, `phase21-modifier-hazard.test.ts`, `phase21-objective-reinforcement.test.ts` | green (62 tests) |
| Persistence tests | `tests/sim/phase21-collection-snapshot.test.ts` (collections, snapshot, migration) | green |
| Kernel integration tests | `tests/sim/phase21-runtime-kernel.test.ts` (detect/commit, invulnerability, objectives, waves, hazards, modifiers, determinism, L-ordering) | green |
| Golden reference trace | `tests/sim/fixtures/reference-traces-phase21.json` | byte-identical, pinned |
| Cross-runtime matrix | `docs/reports/phase14-crossruntime.json` (phase21 section) | Node REFERENCE; desktop/device NOT_RUN |
| Mass-sim (boss/objective/wave/hazard active) | `docs/reports/phase21-mass-sim.json` | PASS, 2000 battles, 120000 ticks, 0 drift, 0 invariant errors |
| Source policy | `tests/sim/source-policy.test.mjs` + `tools/sim/audit-kernel-imports.mjs` | clean (P21 §13 budgets added) |
| G21 gate validator | `tools/sim/validate-phase21-readiness.mjs` | BLOCKED (device + desktop browsers) |

## D. Revisions and commands

- `a31a392` pure modules T01–T05 · `e6db5a6` persistence + boss events ·
  `1216f62` kernel runtime systems + reducer surface
- Commands: `node tools/sim/run-mass-sim.mjs --phase21 --battles 2000` ·
  `node tools/sim/generate-crossruntime-matrix.mjs` ·
  `node tools/sim/validate-phase21-readiness.mjs`

## E. Defects and risks

- Fixed in-phase: the reducer drifting past its 300-line budget (mechanically
  compressed, no behavior change); stage-L ordering — the boss commit and
  objective-resolution systems use functional ids (`boss.l1.*`,
  `objective.l1.*`) so they sort BEFORE `phase17.l1.battle_end`, satisfying §8's
  "objective evaluation before the generic end resolver".
- Boundary (documented, not a defect): reinforcement spawn bodies and
  boss-object combat bodies remain content ports (§9 steps 4–6 deferral, same
  as Phase 20 summons); the wave cursor and boss-object registry — the §8/§6
  authorities — are fully wired. `kill_regulars` progress derives from the
  canonical event log with a one-tick lag (defeats register the tick after),
  matching the Phase 19 trigger-history pattern.
- No open P0/P1.

## F. Gate G21

`node tools/sim/validate-phase21-readiness.mjs` → **BLOCKED**:

- `P21_G21_G20_NOT_PROVEN` — upstream G20 gate is not proven (operator device
  evidence).
- `P21_G21_BROWSER_RERUN_MISSING` — desktop chromium/firefox/webkit re-run for
  the phase21 section (operator).
- `P21_G21_DEVICE_EVIDENCE_MISSING` — Android WebView / iOS WKWebView device
  evidence (operator).

Machine-computable G21 evidence (mass-sim PASS, pinned reference trace,
all seven modules present, Node cross-runtime column) is satisfied.
