# Phase 19 — Ability-Trigger Framework, Target Queries and Effect Commands

**Phase:** PHASE-19 — ability-trigger framework (T01–T06) + kernel integration
**Gate:** G19 (assessment below)
**Branch:** `feat/09-content-schemas-sourceformat-und-compilerg`
**Status:** IMPLEMENTED (repository evidence); G19 `BLOCKED` pending operator device evidence + desktop browser re-run

## A. Entry gate

- G18 remains `BLOCKED` on operator evidence only: `P19_G18_WEBVIEWS_NOT_RUN`,
  `P19_G18_NOT_REPRODUCED`, `P19_G18_DEVICE_PERF_MISSING` — verified by
  `node tools/sim/validate-phase18-readiness.mjs` (mass-sim 10000 battles +
  chromium/firefox/webkit desktop cross-runtime **satisfied**; device
  WebView/perf evidence cannot be self-certified).
- Implementation proceeded per the Phase-19 handbook §15 order without touching
  any Phase 14–18 pinned trace/checksum (trigger history is gated on
  `abilities !== undefined`, so only Phase-19 state carries it).

## B. Tickets

| Ticket | Deliverable | Status |
|---|---|---|
| T01 | `trigger-definition.ts` (closed trigger/predicate DSL, depth/child caps, cycle rejection) + `trigger-evaluator.ts` (pure `{matched, reasonCode, evidence}`) | ✅ |
| T02 | `ability-target-query.ts` (closed target spaces, filters, §6.2 tie order, closed invalid reasons) | ✅ |
| T03 | `effect-command.ts` (15 closed command kinds, §7 identity, duplicate hard-errors) + `effect-executor.ts` (validate/canonicalize/map-or-defer) | ✅ |
| T04 | `ability-system.ts` (charge/cooldown/cast/interrupt lifecycle, 35% interrupt loss, commit snapshots) | ✅ |
| T05 | `invalid-target-policy.ts` (wait/retarget/consume + meaningful-use defaults) | ✅ |
| T06 | `battle-scenario.ts` (explicit fixture builder) + `ability-coverage.ts` (8-case inventory, blocker/gap report) | ✅ |
| Kernel | `set_abilities`/`set_planned_effects` commands, `abilities`/`plannedEffects` fields, trigger/target/lifecycle/dispatch systems (D/E/G + F/H/I/K), snapshot projection, migration, `previousTickLp`/`previousTickEvents` trigger history | ✅ |

## C. Evidence

| Artifact | Path | Result |
|---|---|---|
| Pure framework tests | `tests/sim/phase19-{trigger,target-query,effect-command,ability-system,invalid-target,scenario-coverage}.test.ts` | green |
| Kernel integration tests | `tests/sim/phase19-runtime-kernel.test.ts`, `phase19-collection-snapshot.test.ts` | green |
| Trigger-history tests | `tests/sim/phase19-trigger-history.test.ts` (hp-crossing, enemy-defeat, boundary, snapshot) | green |
| Golden reference trace | `tests/sim/fixtures/reference-traces-phase19.json` | byte-identical, pinned |
| Cross-runtime matrix | `docs/reports/phase14-crossruntime.json` (phase19 section) | Node REFERENCE; desktop/device NOT_RUN |
| Mass-sim (ability active) | `docs/reports/phase19-mass-sim.json` | PASS, 5000 battles, 300000 ticks, 0 drift, 0 invariant errors |
| Source policy (§12) | `tests/sim/source-policy.test.mjs` + `tools/sim/audit-kernel-imports.mjs` | whole `src/game/sim` tree clean |
| §14 budgets | every ability module ≤ 220–300 lines | all under budget |
| G19 gate validator | `tools/sim/validate-phase19-readiness.mjs` | BLOCKED (device + desktop browsers) |

## D. Revisions and commands

- `c95c475` T01–T06 pure modules · `4366295` ability persistence + event registry ·
  `44981ec` kernel trigger/target/lifecycle wiring + cross-runtime/mass-sim ·
  `78294c0` trigger-history persistence (event + HP thresholds)
- Commands: `node tools/sim/run-mass-sim.mjs --phase19 --battles 5000` ·
  `node tools/sim/generate-crossruntime-matrix.mjs` ·
  `node tools/sim/validate-phase18-readiness.mjs` ·
  `node tools/sim/validate-phase19-readiness.mjs`

## E. Defects and risks

- Fixed in-phase: `once` marker and `abilityId` missing from the persisted
  `AbilityInstance` (added — §11 requires both); stale `targetSnapshot` on a
  `ready` ability re-casting (trigger now clears it and only `waiting_target`
  casts); the reducer drifting past its 300-line budget.
- Boundary (documented, not a defect): the mass-sim is pinned at 5000 battles
  (not the historical 10000) because the ability+combat soak cannot complete
  within a single bounded tool run on this machine; the hash-drift result is
  still 0 over 300000 ticks. Deferred effect kinds (`spawn_request`, `taunt`,
  `modify_objective`, `modify_world`, `remove_status`, `modify_charge`) are
  dropped by the dispatcher until Phase 20 ports land.
- No open P0/P1.

## F. Gate G19

G19 is `BLOCKED`, not `FAIL`: every repository-verifiable item is green
(closed trigger/target/effect/lifecycle matrices, cast/commit/interrupt/
invalid-target rules, event-log traceability, coverage inventory, save/resume
reference trace, mass-sim 0-drift, typecheck/lint/unit/source-policy/budgets).
The remaining requirements are operator-side: the G17 device WebView/perf
evidence that blocks every upstream gate, plus a desktop browser re-run of the
new phase19 cross-runtime section. `phase19:validate-readiness` (G18 entry) and
`phase19:gate` (G19) both report `BLOCKED` for exactly these reasons.
