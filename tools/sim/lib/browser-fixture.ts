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
import { createPhase16Systems } from '../../../src/game/sim/core/phase16-systems.js';
import { createPhase17Systems } from '../../../src/game/sim/core/phase17-systems.js';
import { asX100 } from '../../../src/game/sim/geometry/x100.js';
import './browser-fixture-phase18.js';
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

// ---------------------------------------------------------------------------
// Phase 16 oracle: the same trace as tests/sim/fixtures/reference-traces-phase16.json
// (targeting in stage E and attack-prep in stage G active on the P15 kernel).
// ---------------------------------------------------------------------------
function buildPhase16Battle() {
  const rnd = buildRandom();
  const entities = Object.freeze([
    buildPhase15Entity('unit_player_a', 'player', 1800, 'top', 100),
    buildPhase15Entity('unit_player_b', 'player', 2400, 'middle', 120),
    buildPhase15Entity('unit_enemy_a', 'enemy', 6200, 'middle', 140),
    buildPhase15Entity('unit_enemy_b', 'enemy', 7600, 'bottom', 150),
  ]);
  return Object.freeze({
    schemaVersion: 1,
    simulationVersion: 'phase16-fixture-v1',
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

const p16State0 = buildPhase16Battle();
const p16Random = buildRandom();
const p16StartHash = createSnapshot(p16State0).checksum;
const p16Checkpoints: { tick: number; checksum: string }[] = [];

let p16State = p16State0;
let p16CallOrder: readonly string[] = [];
for (let i = 0; i < 60; i++) {
  const r = stepBattle({
    state: p16State,
    input,
    random: p16Random,
    rules: {},
    content: {},
    systems: createPhase16Systems({
      speedsX100PerSecond: { unit_player_a: 305, unit_player_b: 300 },
      attackPrep: {
        preferredRangeX100: {
          unit_player_a: asX100(5000),
          unit_player_b: asX100(4000),
        },
      },
    }),
  });
  p16State = r.state;
  if (i === 0) p16CallOrder = r.callOrder;
  if (r.checkpoint) p16Checkpoints.push({ tick: p16State.tick, checksum: r.checkpoint.checksum });
}

const p16Result = Object.freeze({
  startHash: p16StartHash,
  tick30: p16Checkpoints.find((c) => c.tick === 30)?.checksum ?? null,
  tick60: p16Checkpoints.find((c) => c.tick === 60)?.checksum ?? null,
  endHash: createSnapshot(p16State).checksum,
  endTick: p16State.tick,
  endReason: p16State.endReason,
  eventCount: p16State.emittedEventCount,
  callOrder: p16CallOrder,
});

(globalThis as unknown as { __P16_CROSSRUNTIME__: unknown }).__P16_CROSSRUNTIME__ = p16Result;

// ---------------------------------------------------------------------------
// Phase 17 oracle: the same trace as tests/sim/fixtures/reference-traces-phase17.json
// (basic-attack lifecycle with projectile delivery on the P16 kernel).
// ---------------------------------------------------------------------------
function buildPhase17Battle() {
  const rnd = buildRandom();
  const entities = Object.freeze([
    buildPhase15Entity('unit_player_a', 'player', 1800, 'top', 100),
    buildPhase15Entity('unit_player_b', 'player', 2400, 'middle', 120),
    buildPhase15Entity('unit_enemy_a', 'enemy', 6200, 'middle', 140),
    buildPhase15Entity('unit_enemy_b', 'enemy', 7600, 'bottom', 150),
  ]);
  return Object.freeze({
    schemaVersion: 1,
    simulationVersion: 'phase17-fixture-v1',
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

const p17State0 = buildPhase17Battle();
const p17Random = buildRandom();
const p17StartHash = createSnapshot(p17State0).checksum;
const p17Checkpoints: { tick: number; checksum: string }[] = [];

let p17State = p17State0;
let p17CallOrder: readonly string[] = [];
for (let i = 0; i < 60; i++) {
  const r = stepBattle({
    state: p17State,
    input,
    random: p17Random,
    rules: {},
    content: {},
    systems: createPhase17Systems({
      speedsX100PerSecond: { unit_player_a: 305, unit_player_b: 300 },
      attackPrep: {
        preferredRangeX100: {
          unit_player_a: asX100(5000),
          unit_player_b: asX100(4000),
        },
      },
      basicAttack: {
        parameters: {
          unit_player_a: {
            attackIntervalTicks: 40,
            prepareTicks: 1,
            recoveryTicks: 3,
            preferredRangeX100: asX100(9000),
            delivery: {
              kind: 'projectile',
              speedX100PerSecond: 3000,
              homing: false,
              maxTurnX100PerTick: 0,
              expiryTicks: 60,
              lostTargetPolicy: 'impact_stored_position',
              coverIgnoring: true,
              piercing: false,
              rawAmount: 100,
              damageTypeOrdinal: 0,
              defense: 0,
              bossCapBps: null,
            },
          },
        },
      },
    }),
  });
  p17State = r.state;
  if (i === 0) p17CallOrder = r.callOrder;
  if (r.checkpoint) p17Checkpoints.push({ tick: p17State.tick, checksum: r.checkpoint.checksum });
}

const p17Result = Object.freeze({
  startHash: p17StartHash,
  tick30: p17Checkpoints.find((c) => c.tick === 30)?.checksum ?? null,
  tick60: p17Checkpoints.find((c) => c.tick === 60)?.checksum ?? null,
  endHash: createSnapshot(p17State).checksum,
  endTick: p17State.tick,
  endReason: p17State.endReason,
  eventCount: p17State.emittedEventCount,
  callOrder: p17CallOrder,
});

(globalThis as unknown as { __P17_CROSSRUNTIME__: unknown }).__P17_CROSSRUNTIME__ = p17Result;

// ---------------------------------------------------------------------------
// Phase 17 stage J/L oracle: the same trace as
// tests/sim/fixtures/reference-traces-phase17jl.json (battle seeded at tick
// 2680 with lethal direct combat, running through defeat resolution and the
// rift-collapse window to the terminal outcome).
// ---------------------------------------------------------------------------
function buildPhase17JLBattle() {
  const rnd = buildRandom();
  const mk = (id: string, side: 'player' | 'enemy', x100: number, lane: 'top' | 'middle' | 'bottom', lp: number) =>
    migrateEntity({
      entity: Object.freeze({
        id,
        side,
        phase: Object.freeze({ phase: 'ACTIVE', enteredTick: tick(0), controlledReturn: null }),
        maxLp: 1000,
        lp,
        shield: 0,
        lane,
        x100,
        targetId: null,
        timers: Object.freeze({}),
      }),
      radiusX100: 100,
    });
  const entities = Object.freeze([
    mk('unit_player_a', 'player', 1800, 'top', 1000),
    mk('unit_player_b', 'player', 2400, 'middle', 1000),
    mk('unit_enemy_a', 'enemy', 6200, 'middle', 500),
    mk('unit_enemy_b', 'enemy', 7600, 'bottom', 400),
  ]);
  return Object.freeze({
    schemaVersion: 1,
    simulationVersion: 'phase17jl-fixture-v1',
    battleId: 'battle_fixture',
    tick: tick(2680),
    nextSequence: sequence(0),
    emittedEventCount: 0,
    phase: Object.freeze({ phase: 'ACTIVE', enteredTick: tick(0), resolvingEndTicks: 0 }),
    entities,
    scheduledEvents: Object.freeze([]),
    authoritativeStreams: rnd.streams.snapshotAuthoritative(),
    endReason: null,
  });
}

const p17jlState0 = buildPhase17JLBattle();
const p17jlRandom = buildRandom();
const p17jlStartHash = createSnapshot(p17jlState0).checksum;
const p17jlCheckpoints: { tick: number; checksum: string }[] = [];

let p17jlState = p17jlState0;
let p17jlCallOrder: readonly string[] = [];
let p17jlTerminal = false;
for (let i = 0; i < 500; i++) {
  const r = stepBattle({
    state: p17jlState,
    input,
    random: p17jlRandom,
    rules: {},
    content: {},
    systems: createPhase17Systems({
      speedsX100PerSecond: {},
      basicAttack: {
        parameters: {
          unit_player_a: {
            attackIntervalTicks: 10,
            prepareTicks: 1,
            recoveryTicks: 3,
            preferredRangeX100: asX100(9000),
            delivery: { kind: 'direct', rawAmount: 400, damageTypeOrdinal: 0, defense: 0, bossCapBps: null },
          },
        },
      },
    }),
  });
  p17jlState = r.state;
  if (i === 0) p17jlCallOrder = r.callOrder;
  if (r.checkpoint) p17jlCheckpoints.push({ tick: p17jlState.tick, checksum: r.checkpoint.checksum });
  if (['VICTORY', 'DEFEAT', 'DRAW_ABORT'].includes(p17jlState.phase.phase)) {
    p17jlTerminal = true;
    break;
  }
}

const p17jlResult = Object.freeze({
  startHash: p17jlStartHash,
  tick30: p17jlCheckpoints.find((c) => c.tick === 2700)?.checksum ?? null,
  tick60: p17jlCheckpoints.find((c) => c.tick === 2880)?.checksum ?? null,
  endHash: createSnapshot(p17jlState).checksum,
  endTick: p17jlState.tick,
  endReason: p17jlState.endReason,
  eventCount: p17jlState.emittedEventCount,
  terminal: p17jlTerminal,
  callOrder: p17jlCallOrder,
});

(globalThis as unknown as { __P17JL_CROSSRUNTIME__: unknown }).__P17JL_CROSSRUNTIME__ = p17jlResult;
