// Browser cross-runtime oracle for Phase 14. This runs the exact same 60-tick
// reference trace as `generate-crossruntime-matrix.mjs` (Node) inside a browser
// and publishes the result on `globalThis.__P14_CROSSRUNTIME__`. It is built
// with Vite into a self-contained IIFE and executed via Playwright; the runner
// asserts the produced hashes against the pinned reference trace, so any
// platform divergence is a real cross-runtime finding, not a self-consistency
// check.
import { stepBattle } from '../../../src/game/sim/core/battle-kernel.js';
import { createNoopSystems } from '../../../src/game/sim/core/noop-systems.js';
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
