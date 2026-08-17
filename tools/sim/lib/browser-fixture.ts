// Browser cross-runtime oracle for Phase 14. This runs the exact same 60-tick
// reference trace as `generate-crossruntime-matrix.mjs` (Node) inside a browser
// and publishes the result on `globalThis.__P14_CROSSRUNTIME__`. It is built
// with Vite into a self-contained IIFE and executed via Playwright; the runner
// asserts the produced hashes against the pinned reference trace, so any
// platform divergence is a real cross-runtime finding, not a self-consistency
// check.
import { stepBattle } from '../../../src/game/sim/core/battle-kernel.js';
import { migrateEntity } from '../../../src/game/sim/core/migrate.js';
import { createNoopSystems } from '../../../src/game/sim/core/noop-systems.js';
import { createPhase15Systems } from '../../../src/game/sim/core/phase15-systems.js';
import { sequence, tick } from '../../../src/game/sim/core/primitives.js';
import { RngStreamMap } from '../../../src/game/sim/random/rng-stream-map.js';
import { RandomSession } from '../../../src/game/sim/random/random-session.js';
import { RollSlotRegistry } from '../../../src/game/sim/random/roll-slot-registry.js';
import { parseRunSeed } from '../../../src/game/sim/random/run-seed.js';
import { createSnapshot } from '../../../src/game/sim/snapshot/snapshot.js';

const SEED = ['00000001', '00000002', '00000003', '00000004'] as const;

function buildRandom(): RandomSession {
  const streams = RngStreamMap.fromRunSeed(parseRunSeed([...SEED]));
  return new RandomSession(streams, new RollSlotRegistry([]), false);
}

function buildReferenceBattle() {
  const rnd = buildRandom();
  const entity = Object.freeze({
    id: 'entity_alpha',
    side: 'player',
    phase: Object.freeze({ phase: 'ACTIVE', enteredTick: tick(0), controlledReturn: null }),
    maxLp: 1000,
    lp: 1000,
    shield: 0,
    lane: 'middle',
    x100: 1800,
    targetId: null,
    timers: Object.freeze({}),
  });
  return Object.freeze({
    schemaVersion: 1,
    simulationVersion: 'phase14-fixture-v1',
    battleId: 'battle_fixture',
    tick: tick(0),
    nextSequence: sequence(0),
    emittedEventCount: 0,
    phase: Object.freeze({ phase: 'ACTIVE', enteredTick: tick(0), resolvingEndTicks: 0 }),
    entities: Object.freeze([entity]),
    scheduledEvents: Object.freeze([]),
    authoritativeStreams: rnd.streams.snapshotAuthoritative(),
    endReason: null,
  });
}

const input = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });

const state0 = buildReferenceBattle();
const random = buildRandom();
const startHash = createSnapshot(state0).checksum;
const checkpoints: { tick: number; checksum: string }[] = [];

let state = state0;
let callOrder: readonly string[] = [];
for (let i = 0; i < 60; i++) {
  const r = stepBattle({ state, input, random, rules: {}, content: {}, systems: createNoopSystems() });
  state = r.state;
  if (i === 0) callOrder = r.callOrder;
  if (r.checkpoint) checkpoints.push({ tick: state.tick, checksum: r.checkpoint.checksum });
}

const result = Object.freeze({
  startHash,
  tick30: checkpoints.find((c) => c.tick === 30)?.checksum ?? null,
  tick60: checkpoints.find((c) => c.tick === 60)?.checksum ?? null,
  endHash: createSnapshot(state).checksum,
  endTick: state.tick,
  endReason: state.endReason,
  eventCount: state.emittedEventCount,
  callOrder,
});

(globalThis as unknown as { __P14_CROSSRUNTIME__: unknown }).__P14_CROSSRUNTIME__ = result;

// ---------------------------------------------------------------------------
// Phase 15 oracle: the same trace as tests/sim/fixtures/reference-traces-phase15.json
// (migrated entities, active movement/lane-change/anti-stuck systems).
// ---------------------------------------------------------------------------
function buildPhase15Entity(id: string, side: 'player' | 'enemy', x100: number, lane: 'top' | 'middle' | 'bottom', radiusX100: number) {
  return migrateEntity({
    entity: Object.freeze({
      id,
      side,
      phase: Object.freeze({ phase: 'ACTIVE', enteredTick: tick(0), controlledReturn: null }),
      maxLp: 1000,
      lp: 1000,
      shield: 0,
      lane,
      x100,
      targetId: null,
      timers: Object.freeze({}),
    }),
    radiusX100,
  });
}

function buildPhase15Battle() {
  const rnd = buildRandom();
  const entities = Object.freeze([
    buildPhase15Entity('unit_player_a', 'player', 1800, 'top', 100),
    buildPhase15Entity('unit_player_b', 'player', 2400, 'middle', 120),
    buildPhase15Entity('unit_enemy_a', 'enemy', 6200, 'middle', 140),
    buildPhase15Entity('unit_enemy_b', 'enemy', 7600, 'bottom', 150),
  ]);
  return Object.freeze({
    schemaVersion: 1,
    simulationVersion: 'phase15-fixture-v1',
    battleId: 'battle_fixture',
    tick: tick(0),
    nextSequence: sequence(0),
    emittedEventCount: 0,
    phase: Object.freeze({ phase: 'ACTIVE', enteredTick: tick(0), resolvingEndTicks: 0 }),
    entities,
    scheduledEvents: Object.freeze([]),
    authoritativeStreams: rnd.streams.snapshotAuthoritative(),
    endReason: null,
  });
}

const p15State0 = buildPhase15Battle();
const p15Random = buildRandom();
const p15StartHash = createSnapshot(p15State0).checksum;
const p15Checkpoints: { tick: number; checksum: string }[] = [];

let p15State = p15State0;
let p15CallOrder: readonly string[] = [];
for (let i = 0; i < 60; i++) {
  const r = stepBattle({
    state: p15State,
    input,
    random: p15Random,
    rules: {},
    content: {},
    systems: createPhase15Systems({ speedsX100PerSecond: { unit_player_a: 305, unit_player_b: 300 } }),
  });
  p15State = r.state;
  if (i === 0) p15CallOrder = r.callOrder;
  if (r.checkpoint) p15Checkpoints.push({ tick: p15State.tick, checksum: r.checkpoint.checksum });
}

const p15Result = Object.freeze({
  startHash: p15StartHash,
  tick30: p15Checkpoints.find((c) => c.tick === 30)?.checksum ?? null,
  tick60: p15Checkpoints.find((c) => c.tick === 60)?.checksum ?? null,
  endHash: createSnapshot(p15State).checksum,
  endTick: p15State.tick,
  endReason: p15State.endReason,
  eventCount: p15State.emittedEventCount,
  callOrder: p15CallOrder,
});

(globalThis as unknown as { __P15_CROSSRUNTIME__: unknown }).__P15_CROSSRUNTIME__ = p15Result;
