// Phase 18 browser cross-runtime oracle. This module is imported (side-effect)
// by browser-fixture.ts and bundled into the same IIFE; it publishes the
// status periodic/expiry trace result on `globalThis.__P18_CROSSRUNTIME__`.
import { stepBattle } from '../../../src/game/sim/core/battle-kernel.js';
import { migrateEntity } from '../../../src/game/sim/core/migrate.js';
import { createPhase18Systems } from '../../../src/game/sim/core/phase18-systems.js';
import { sequence, tick } from '../../../src/game/sim/core/primitives.js';
import { RngStreamMap } from '../../../src/game/sim/random/rng-stream-map.js';
import { RandomSession } from '../../../src/game/sim/random/random-session.js';
import { RollSlotRegistry } from '../../../src/game/sim/random/roll-slot-registry.js';
import { parseRunSeed } from '../../../src/game/sim/random/run-seed.js';
import { createSnapshot } from '../../../src/game/sim/snapshot/snapshot.js';

const SEED = ['00000001', '00000002', '00000003', '00000004'] as const;
const input = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });

function buildRandom(): RandomSession {
  const streams = RngStreamMap.fromRunSeed(parseRunSeed([...SEED]));
  return new RandomSession(streams, new RollSlotRegistry([]), false);
}

// ---------------------------------------------------------------------------
// Phase 18 oracle: status periodic/expiry trace matching
// tests/sim/fixtures/reference-traces-phase18.json (burn on the player,
// poison expiring mid-trace on the enemy, regeneration on the player).
// ---------------------------------------------------------------------------
function buildPhase18Battle() {
  const rnd = buildRandom();
  const mk = (id: string, side: 'player' | 'enemy', x100: number, lane: 'top' | 'middle' | 'bottom') =>
    migrateEntity({
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
      radiusX100: 100,
    });
  const entities = Object.freeze([
    mk('unit_player_a', 'player', 1800, 'top'),
    mk('unit_player_b', 'player', 2400, 'middle'),
    mk('unit_enemy_a', 'enemy', 6200, 'middle'),
    mk('unit_enemy_b', 'enemy', 7600, 'bottom'),
  ]);
  const st = (overrides: Record<string, unknown>) =>
    Object.freeze({
      statusId: 'st_burn_a',
      kind: 'burn',
      polarity: 'negative',
      targetId: 'unit_player_a',
      sourceId: 'unit_enemy_a',
      effectId: 'ef_burn',
      startTick: 0,
      endTick: 100,
      strength: 1,
      stackGroup: 'burn',
      sequence: 1,
      stackPolicy: 'extend_duration_capped',
      maxStacks: 5,
      flags: Object.freeze([]),
      ...overrides,
    });
  return Object.freeze({
    schemaVersion: 1,
    simulationVersion: 'phase18-fixture-v1',
    battleId: 'battle_fixture',
    tick: tick(0),
    nextSequence: sequence(0),
    emittedEventCount: 0,
    phase: Object.freeze({ phase: 'ACTIVE', enteredTick: tick(0), resolvingEndTicks: 0 }),
    entities,
    scheduledEvents: Object.freeze([]),
    authoritativeStreams: rnd.streams.snapshotAuthoritative(),
    endReason: null,
    statuses: Object.freeze([
      st({ statusId: 'st_burn_a', endTick: 100, periodic: Object.freeze({ effectKind: 'burn', intervalTicks: 10, nextTick: 10, tickIndex: 0, initialTick: false, dedupKey: 'burn_01' }) }),
      st({ statusId: 'st_poison_a', kind: 'poison', polarity: 'negative', targetId: 'unit_enemy_a', sourceId: 'unit_player_a', effectId: 'ef_poison', stackGroup: 'poison', sequence: 2, endTick: 45, periodic: Object.freeze({ effectKind: 'poison', intervalTicks: 15, nextTick: 15, tickIndex: 0, initialTick: false, dedupKey: 'poison_01' }) }),
      st({ statusId: 'st_regen_a', kind: 'regeneration', polarity: 'positive', targetId: 'unit_player_b', sourceId: 'unit_player_a', effectId: 'ef_regen', stackGroup: 'regen', sequence: 3, endTick: 100, periodic: Object.freeze({ effectKind: 'regeneration', intervalTicks: 20, nextTick: 20, tickIndex: 0, initialTick: false, dedupKey: 'regen_01' }) }),
    ]),
  });
}

const p18State0 = buildPhase18Battle();
const p18Random = buildRandom();
const p18StartHash = createSnapshot(p18State0).checksum;
const p18Checkpoints: { tick: number; checksum: string }[] = [];

let p18State = p18State0;
let p18CallOrder: readonly string[] = [];
for (let i = 0; i < 60; i++) {
  const r = stepBattle({
    state: p18State,
    input,
    random: p18Random,
    rules: {},
    content: {},
    systems: createPhase18Systems({
      speedsX100PerSecond: {},
      status: {
        periodic: {
          burn_01: { effectKind: 'burn', amountPerTick: 50 },
          poison_01: { effectKind: 'poison', amountPerTick: 40 },
          regen_01: { effectKind: 'regeneration', amountPerTick: 25 },
        },
      },
    }),
  });
  p18State = r.state;
  if (i === 0) p18CallOrder = r.callOrder;
  if (r.checkpoint) p18Checkpoints.push({ tick: p18State.tick, checksum: r.checkpoint.checksum });
}

const p18Result = Object.freeze({
  startHash: p18StartHash,
  tick30: p18Checkpoints.find((c) => c.tick === 30)?.checksum ?? null,
  tick60: p18Checkpoints.find((c) => c.tick === 60)?.checksum ?? null,
  endHash: createSnapshot(p18State).checksum,
  endTick: p18State.tick,
  endReason: p18State.endReason,
  eventCount: p18State.emittedEventCount,
  callOrder: p18CallOrder,
});

(globalThis as unknown as { __P18_CROSSRUNTIME__: unknown }).__P18_CROSSRUNTIME__ = p18Result;
