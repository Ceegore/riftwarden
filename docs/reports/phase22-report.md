# Phase 22 Report — Headless Runner, Invariant Monitor, Golden Replays, Property Tests, Mass Simulation

**Gate: G22 — BLOCKED on operator evidence (machine evidence complete)**

Phase 22 makes the combat kernel reproducible and measurable *outside the app*:
a canonical headless runner, a read-only invariant monitor, the twelve-seed
golden replay registry, deterministic property families, and a partition/merge
mass simulation.

## What landed

### P22-T01 — Headless Battle Runner (`tools/sim/headless-runner.mjs`)
- Canonical JSON input (contentVersion, simulationVersion, 128-bit seed,
  scenario, endTickCap, optional startSnapshot) and canonical JSON output.
- Exit codes per contract: `0` success, `2` schema, `3` version/content,
  `4` invariant, `5` replay divergence, `6` safety cap/deadlock,
  `70` tool error.
- Same input → byte-identical output (verified 10× in the contract tests).
- `--baseline` compares against a golden file and reports the first divergence.

### P22-T02 — Invariant Monitor (`src/game/sim/monitor/invariant-monitor.ts`)
- Pure, read-only: 9 mandatory checks with stable `P22_INV_*` codes, first-tick
  diagnostics, bounded canonical excerpts. Verified by 16 unit tests.
- Negative-case runner tests: duplicate entity id, negative hp, event cap
  exceeded, battle limit exceeded all map to the correct exit codes.

### P22-T03 — Golden Replay Harness (`tools/sim/golden-harness.mjs`)
- Registry `contracts/phase22/golden-registry.json`: exactly the twelve
  canonical seeds (GDD 85.3), each with versions, seed, start hash, 30-tick
  checkpoint hashes, end hash, event count, outcome.
- `--write` is the explicit local review tool; `--check`/CI verify
  byte-for-byte and report the first divergence. Silent baseline writes are
  refused (asserted in tests).
- Cross-checked in the cross-runtime generator: Node can never drift from the
  pinned baselines.

### P22-T04 — Property Families (`tests/sim/phase22-property-families.test.ts`)
- 7 families × ≥1000 deterministic cases: formation/order permutation,
  status combinations, target ties, movement/collision, summon sequences,
  trigger recursion, timeout/endcap — all asserting against the real kernel
  modules with a seeded splitmix32 PRNG (no `Math.random`, no wallclock).
- Any violation persists `{family, seed, generatorVersion, reproCommand}`.

### P22-T05 — Mass Simulation Partition/Merge
- `tools/sim/lib/mass-partition.mjs`: case `i` assigned by the stable formula
  `i % workerCount`; merge strictly ascending by `caseIndex`, rejecting
  duplicates. `aggregateHash` is canonical SHA-256 over merged cases.
- `tools/sim/run-mass-sim-partitioned.mjs`: per-case seed derivation (case `i`
  depends only on `i` + scenario). Verified: single-worker run and 2-worker
  merged run produce byte-identical case lists and aggregate hash.

### P22-T06 — Cross-Runtime
- `generate-crossruntime-matrix.mjs` now authors the **phase22** section:
  Node reference columns for all twelve golden vectors, verified against the
  golden registry. All browser/device rows preserved byte-for-byte (asserted
  additive-only diff).

### Contracts & fixtures (`contracts/phase22/`)
- `phase22-constants.json` (30 TPS, 5400 hard limit, 10k event cap,
  1000 property cases, 100k RC fights, 95% branch coverage, 12 goldens).
- `negative-cases.json` (all ten cases exercised by tests).
- `property-families.json` (seven families).

## Gates
- 16 runner/harness node tests + 24 vitest (monitor + properties + partition)
  green; full suite re-run green; typecheck/lint/format clean.
- `validate-phase22-readiness.mjs` → **BLOCKED** only on operator-side items:
  upstream G21 proof, desktop browser re-run of the phase22 vectors, and
  Android WebView / iOS WKWebView device evidence — none tool-self-certifiable.

## Handoff to Phase 23
Confirmed: canonical snapshot/numeric contracts, the twelve golden baselines,
the checkpoint hash matrix, the partition/merge mass-sim report, source
revision, and the real G22 report. Phase 23 must not build atomic persistence
on unproven helper data.
