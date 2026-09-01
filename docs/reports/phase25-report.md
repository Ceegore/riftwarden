# Phase 25 Report — Render/Context-Loss Contract Layer (read-only presentation adapter)

**Gate: G25 — BLOCKED on operator evidence (machine evidence complete)**

Phase 25 builds the production battle renderer as a **purely read-only
adapter** over authoritative simulation snapshots and committed events. The
kit ships Pixi-independent pure contracts; this milestone ports that contract
layer into `src/game/render/` — capability/lifecycle, the fixed 8-layer graph,
snapshot interpolation, the presentation clock, entity/event mapping,
pool/quality pressure, and context recovery. No Pixi/DOM/React/Capacitor
dependency was added and `game/sim` remains untouched by the renderer.

## What landed

### Read-only types and mutation guards
- `types.ts`: `StableId`, lane ordinals, `LayerId`, the closed 10-state
  `VisualState` set, `EntityFrame`, `BattlePresentationFrame`,
  `PresentationEvent` (6 closed kinds), the 7-state `RendererLifecycle`,
  capability/quality/failure enums and the 4 back-channel ports.
- `render-error.ts`: closed `RenderErrorCode` union (13 codes) with
  diagnostic details, mirroring the save layer convention.
- `mutation-guard.ts`: recursive `deepFreeze`; every accepted frame is frozen
  so accidental mutation fails loudly (proven in tests under strict mode).
- `interpolation.ts`: `clampAlpha1000` (integer 0..1000 only; non-integer is
  a contract violation) and `interpolateInt` with half-away-from-zero
  rounding, endpoint clamping and `-0` normalization. No extrapolation.

### Capability + lifecycle state machine
- `capability.ts`: `resolveCapability` over an injected probe — WebGL2 is
  preferred (high tier), WebGL1 only after real-device validation (medium),
  otherwise a closed `failureReason` (`webgl1_unvalidated` /
  `webgl_unavailable`) with the compatible-screen tier. Reports max
  resolution, DPR cap, texture/renderbuffer limits; no free-form UI text.
- `lifecycle.ts`:
  `uninitialized → initializing → ready → context_lost → rebuilding → ready`,
  `failed_safe` after **two** failed restores, terminal `disposed`. All
  invalid transitions throw closed codes.

### Layer graph and stable sort
- `layer-graph.ts`: fixed layers 0–7 (background, ground, back_units,
  main_units, projectiles, effects, readability, debug); readability (6)
  always above effects (5); debug (7) excluded from release bundles.
  Lane→layer mapping is presentation-only.
- `stable-sort.ts`: canonical `(laneOrdinal, logicalX100, stableEntityId)`
  ordering via code-unit comparison — never `localeCompare`, never array
  index. Permuted input yields identical output (proven).

### Snapshot presenter + presentation clock
- `snapshot-presenter.ts`: holds at most the previous and next **confirmed**
  snapshots; validates every frame (unique ids, closed lanes/states, 64-hex
  hash, clip progress 0..1000); interpolates only visual values (X, clip
  progress); existence/lane/HP/defeat always come from the newest confirmed
  snapshot; stale frames rejected; same-tick re-confirmation idempotent;
  pause freezes the presentation.
- `presentation-clock.ts`: deterministic (wallclock-free) scheduler across
  0.5×/1×/2×/3× × 15/30/60/120 fps. Integer-thousandth budget accounting;
  alpha ramp between confirmed snapshots; at most `maxCatchUpTicks = 8`
  catch-up ticks per render frame; beyond that pressure is reported so
  quality degrades — sim ticks are **never dropped**, every pushed frame is
  presented in order (proven across the full speed×fps matrix).

### Entity/event mapping, pools and quality
- `event-mapping.ts`: closed visual-state table — hurt only after a committed
  damage event, defeat terminal/sticky, victory on battle_end for survivors,
  heal clears hurt; projectile/spawn never mutate existing entities.
- `pool-policy.ts`: cosmetic vs. critical kinds; `mayDropOnPressure` covers
  exactly the 4 cosmetic kinds; a pool ledger with full `reset()` on scene
  teardown and underflow rejection.
- `quality.ts`: fixed degradation order (decorative particles → damage
  numbers → trails → screen effects → render resolution); per-tier baselines
  (high/medium/low/reduced); telegraphs, warnings, accessibility signals and
  entity readability are never degraded.

### Context recovery
- `context-recovery.ts`: loss → `prevent_default`, `freeze`,
  `snapshot_request`, `teardown` (step trace + hooks); restore rebuilds the
  scene graph from the frozen authoritative snapshot, requires an identical
  gameplay hash, then gates on an explicit ready signal — **no auto-resume**.
  Two failed rebuilds → `failed_safe` (safe compatibility/recovery screen).

## Tests (99 vitest tests, `--project phase25`)
- `phase25-contracts.test.ts` (17): pinned constants, layer golden,
  interpolation boundaries, quality pressure matrix, capability/context-loss
  matrix cases.
- `phase25-interpolation.test.ts` (13): boundaries, midpoint, descending
  ranges, half-away-from-zero, large integers, determinism/monotonicity
  sweeps, rounding-formula property sweep.
- `phase25-lifecycle-capability.test.ts` (15): full lifecycle incl.
  `restore_once`/`restore_twice_fail`, WebGL2/validated-WebGL1/no-context,
  limit reporting, invalid probes.
- `phase25-presenter.test.ts` (14): two-frame buffer, interpolation of visual
  values only, no extrapolation, existence from newest snapshot, stale
  rejection, pause freeze, mutation guard, malformed frames, canonical order,
  permutation invariance.
- `phase25-clock.test.ts` (10): config/order guards, full speed×fps hash
  invariance, catch-up cap, burst no-drop, alpha ramp, quality-tier
  invariance.
- `phase25-context-recovery.test.ts` (21): the four loss scenarios
  (during_cast/projectile/spawn/battle_end) with required steps, same-end-hash
  rebuild, double-failure safe recovery, hash-divergent rebuild rejection,
  state guards.
- `phase25-pool-quality-release.test.ts` (9): pool ledger, teardown release,
  exhaustion degrades only cosmetics, fixed drop order, protected kinds,
  release source-policy scan (no CanvasRenderer/webgpu/Math.random/
  Date.now/fetch/localeCompare/pixi imports in `src/game/render`).

typecheck/lint/format/file-length clean.

## Gate G25
- **Satisfied (machine):** constants, interpolation boundaries, lifecycle +
  capability matrix, layer golden + stable sort, presenter + clock (4 speeds
  × 4 fps × 4 tiers hash-invariant), event mapping, pool/quality matrix,
  context-loss matrix, 7 test suites, render-source policy scan.
- **BLOCKED (operator):** real G24 proof upstream, real Pixi device render,
  browser context-loss injection, visual goldens on device, pool/leak device
  stress (20-battle leak test / 30-min stress), and an operator-run release
  bundle scan. None are tool-self-certifiable.

## Handoff to Phase 26
Phase 26 may build UI/HUD integration only on these read-only render ports.
The pinned contracts to extend: capability/lifecycle enums, layer and
interpolation goldens, presentation hash invariance, pool/quality reports,
context-recovery matrix and the G25 evidence checklist
(`Phasen/Phase_25/.../evidence/GATE_G25_CHECKLIST.md`).
