# Phase 20 — Synergies, Summons, Constructs and Temporary Entities

**Phase:** PHASE-20 — synergy/summon/construct/temporary-entity kernel
**Gate:** G20 (assessment below)
**Branch:** `feat/09-content-schemas-sourceformat-und-compilerg`
**Status:** IMPLEMENTED (repository evidence); G20 `BLOCKED` pending operator device evidence + desktop browser re-run

## A. Entry gate

- G19 remains `BLOCKED` on operator evidence only (device WebView/perf +
  desktop browser re-run) — verified by
  `node tools/sim/validate-phase19-readiness.mjs`. Machine-computable G19
  evidence (mass-sim, reference trace, coverage) is satisfied.
- Implementation proceeded without touching any Phase 14–19 pinned
  trace/checksum: `temporaryEntities`/`synergyTiers` are additive and gated on
  `!== undefined`, so pre-Phase-20 fixtures and the operator's browser columns
  are byte-stable.

## B. Tickets

| Ticket | Deliverable | Status |
|---|---|---|
| T01 | `synergy-counter.ts` (8 closed ids, tiers 0/2/3, unique deployed regular units) | ✅ |
| T02 | `synergy-runtime.ts` (canonical activations, `sourceKind/sourceId/tier/side`, stable command ids) | ✅ |
| T03 | `temporary-entity.ts` (closed kinds, cap policies, validation) + `temporary-registry.ts` (counter, category/owner/slot indices, restore) | ✅ |
| T04 | `summon-manager.ts` (canonical batch order, cap-6 BLOCK/REPLACE_OLDEST/BUFF_OLDEST, id-before-commit) | ✅ |
| T05 | `summon-lifecycle.ts` (expiry != defeat, owner binding, removal cleanup) | ✅ |
| T06 | `construct-manager.ts` (FAIL/REPLACE slots, 90-tick repair, first-destroy once-key) | ✅ |
| Kernel | `temporaryEntities`/`synergyTiers` fields, `set_temporary_entities`/`set_synergy_tiers` commands, `phase20-systems.ts` (synergy commit D, summon commit + expiry K), snapshot projection, migration | ✅ |

## C. Evidence

| Artifact | Path | Result |
|---|---|---|
| Contract tests | `tests/sim/phase20-synergy.test.ts`, `phase20-summon.test.ts`, `phase20-construct-lifecycle.test.ts` | green (38 tests) |
| Property tests | `phase20-summon.test.ts` (1000 seeds, cap ≤ 6, restore parity) | green |
| Persistence tests | `tests/sim/phase20-collection-snapshot.test.ts` (collection, snapshot, migration) | green |
| Kernel integration tests | `tests/sim/phase20-runtime-kernel.test.ts` (synergy commit, summon, cap, expiry, determinism) | green |
| Golden reference trace | `tests/sim/fixtures/reference-traces-phase20.json` | byte-identical, pinned |
| Cross-runtime matrix | `docs/reports/phase14-crossruntime.json` (phase20 section) | Node REFERENCE; desktop/device NOT_RUN |
| Mass-sim (spawn/synergy active) | `docs/reports/phase20-mass-sim.json` | PASS, 2000 battles, 120000 ticks, 0 drift, 0 invariant errors |
| Source policy | `tests/sim/source-policy.test.mjs` + `tools/sim/audit-kernel-imports.mjs` | clean (P20 §10 budgets added) |
| G20 gate validator | `tools/sim/validate-phase20-readiness.mjs` | BLOCKED (device + desktop browsers) |

## D. Revisions and commands

- `ea037bb` pure modules T01–T06 · `a4a2ec5` persistence (fields, snapshot, migration) ·
  `55e818c` kernel runtime systems + reducer surface
- Commands: `node tools/sim/run-mass-sim.mjs --phase20 --battles 2000` ·
  `node tools/sim/generate-crossruntime-matrix.mjs` ·
  `node tools/sim/validate-phase20-readiness.mjs`

## E. Defects and risks

- Fixed in-phase: the reducer drifting past its 300-line budget (mechanically
  compressed, no behavior change); `kernel-loader.mjs` crossed the 501-line
  file-length gate in Phase 19 and is now back under it (499).
- Boundary (documented, not a defect): a summon's combat body (stats +
  placement) is a Phase 15/17/18 content port (§9 steps 4–6) and is deferred;
  the registry — the cap/counter/index authority — is fully wired. The
  mass-sim is pinned at 2000 battles for a bounded tool run (hash-drift 0 over
  120000 ticks).
- No open P0/P1.

## F. Gate G20

`node tools/sim/validate-phase20-readiness.mjs` → **BLOCKED**:

- `P20_G20_CROSSRUNTIME_MISSING` — desktop chromium/firefox/webkit re-run for
  the phase20 section (operator).
- `P20_G20_WEBVIEWS_NOT_RUN` — Android WebView / iOS WKWebView device evidence.
- `P20_G20_G19_NOT_PROVEN` — G19 not fully proven upstream.
- `P20_G20_DEVICE_PERF_MISSING` — device performance evidence.

Machine-computable evidence (mass-sim, reference trace, modules) is satisfied.
