# Phase 21 content-schema contract

This is the contract every author follows when a content field (encounter
mission objectives, modifier hooks, reinforcement waves, boss phases) flows
from content JSON into the sim. The phase-21 content round added the encounter
schema (`EncounterSourceSchema`), its two mirrors, and the adapter seams. Read
this before adding a content field.

## The data path

```
content/source/world/*.json         raw content (encounters, modifiers, units)
        │  parsed by
content/schemas/world.ts            TS author schema (zod)   ── single writer
        │  mirrored in
tools/content/lib/entity-schemas.mjs  mjs content builder (kept in sync)
        │  read + validated by
tools/content/lib/ids.mjs           id/namespace rules
        │  mapped by (pure, no fs)
src/game/sim/boss/encounter-adapter.ts        objectives + boss objects +
                                             modifier + wave + boss-phase maps
src/game/sim/boss/boss-phase-content-adapter.ts  PhaseDefinition[] derivation
        │  consumed by
tools/sim/run-content-encounters.mjs           the content-driven launcher
src/game/sim/core/phase21-systems.ts          the runtime A–M composition
```

## The rules

1. **Both schema mirrors must stay in sync.** Every field on
   `EncounterSourceSchema` in `content/schemas/world.ts` must exist on the
   matching builder in `tools/content/lib/entity-schemas.mjs`. A content
   field only ships when both accept it; the content build/`typecheck` trip on
   drift.
2. **Pure, total mapping.** The adapters in `src/game/sim` map content to sim
   surfaces 1:1. Invalid entries are **content errors** (a `KernelInvariantError`
   with a `P21_*` code and a reason), never silently dropped. Every returned
   value is `Object.freeze`d — content-derived configs are immutable.
3. **Sim data stays frozen and budget-capped.** Every object the adapter hands
   the kernel is frozen. Files under `src/game/sim/**` are hard-capped at
   **≤ 300 physical lines** under the strict `split(/\r?\n/).length` count used
   by `tests/sim/source-policy.test.mjs` (a file with 300 physical lines scores
   301 and fails). Returned names count, so split large derivations into their
   own module (see `boss-phase-content-adapter.ts`).
4. **Use `numberSecondsToTicks`, never hardcoded durations.** Time-based fields
   (`survivalDurationSeconds`, `atSeconds` on waves) convert through the
   canonical seconds→ticks helper. There is no other tick constant.
5. **Mission kinds close the end themselves.** `survive_until` forces
   `survive_complete`, `complete_waves` forces `waves_complete` (the waves
   window drives resolution — a waves battle never drifts into a
   late elimination/time-limit end), and `protect_object` forces DEFEAT on
   destruction. `defeat_all`/`defeat_boss` resolve through the generic
   end resolver. Boss phases commit in stage L (`boss.l1`) before the
   objective resolver (`objective.l1`); a same-tick race between a phase commit
   and an objective-gated end must not desync the persisted
   `bossPhase.phaseId` from the emitted `BossPhaseStarted`/`Completed` events
   (asserted by the phase-objective status-gate fuzz).
6. **The launcher is the end-to-end proof.** `run-content-encounters.mjs` turns
   every content encounter into a real battle through the adapters and asserts
   zero drift, zero invariant errors, committed invariants, spawned waves,
   completed objectives, and the boss-phase descent; it also surfaces the
   modifier hook log and the terminal boss phase (plus the teeth `phaseTrace`)
   for hook-driven telegraphs.

## Where each contract is verified

| Concern | File |
| --- | --- |
| Schema (TS writer) | `content/schemas/world.ts` |
| Schema mirror (mjs builder) | `tools/content/lib/entity-schemas.mjs` |
| Adapter seams | `src/game/sim/boss/encounter-adapter.ts`, `src/game/sim/boss/boss-phase-content-adapter.ts` |
| 300-line budget + no wallclock/UI/random | `tests/sim/source-policy.test.mjs` |
| Adapter derivation tests | `tests/sim/phase21-content-adapter.test.ts` |
| Launcher report + outbound surface | `tests/sim/tooling.test.mjs` |
| Composite objective timing (incl. waves) | `tests/sim/phase21-composite-timing-fuzz.test.ts` |
| Rift-collapse / no-progress race | `tests/sim/phase21-rift-collapse-fuzz.test.ts` |
| Boss-phase × objective status gate | `tests/sim/phase21-boss-phase-objective-fuzz.test.ts` |
| Modifier hook execution | `tests/sim/phase21-runtime-kernel.test.ts`, `tests/sim/phase21-content-adapter.test.ts` |
