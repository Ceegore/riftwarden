import { buildRandom } from './kernel-loader.mjs';

/**
 * Builds the Phase 18 60-tick reference battle: migrated entities plus the
 * Phase 18 status collection (burn on the player, poison expiring mid-trace on
 * the enemy, regeneration on the player), matching
 * tests/sim/fixtures/reference-traces-phase18.json exactly. Periodic
 * coefficients are content-supplied via the phase18 status config.
 */
export function buildPhase18Battle(api) {
  const { migrate, primitives } = api;
  const mk = (id, side, x100, lane, radius) =>
    migrate.migrateEntity({
      entity: Object.freeze({
        id,
        side,
        phase: Object.freeze({ phase: 'ACTIVE', enteredTick: primitives.tick(0), controlledReturn: null }),
        maxLp: 1000,
        lp: 1000,
        shield: 0,
        lane,
        x100,
        targetId: null,
        timers: Object.freeze({}),
      }),
      radiusX100: radius,
    });
  const entities = [
    mk('unit_player_a', 'player', 1800, 'top', 100),
    mk('unit_player_b', 'player', 2400, 'middle', 100),
    mk('unit_enemy_a', 'enemy', 6200, 'middle', 100),
    mk('unit_enemy_b', 'enemy', 7600, 'bottom', 100),
  ];
  const rnd = buildRandom(api);
  const statuses = [
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
      periodic: Object.freeze({ effectKind: 'burn', intervalTicks: 10, nextTick: 10, tickIndex: 0, initialTick: false, dedupKey: 'burn_01' }),
    }),
    Object.freeze({
      statusId: 'st_poison_a',
      kind: 'poison',
      polarity: 'negative',
      targetId: 'unit_enemy_a',
      sourceId: 'unit_player_a',
      effectId: 'ef_poison',
      startTick: 0,
      endTick: 45,
      strength: 1,
      stackGroup: 'poison',
      sequence: 2,
      stackPolicy: 'extend_duration_capped',
      maxStacks: 5,
      flags: Object.freeze([]),
      periodic: Object.freeze({ effectKind: 'poison', intervalTicks: 15, nextTick: 15, tickIndex: 0, initialTick: false, dedupKey: 'poison_01' }),
    }),
    Object.freeze({
      statusId: 'st_regen_a',
      kind: 'regeneration',
      polarity: 'positive',
      targetId: 'unit_player_b',
      sourceId: 'unit_player_a',
      effectId: 'ef_regen',
      startTick: 0,
      endTick: 100,
      strength: 1,
      stackGroup: 'regen',
      sequence: 3,
      stackPolicy: 'extend_duration_capped',
      maxStacks: 5,
      flags: Object.freeze([]),
      periodic: Object.freeze({ effectKind: 'regeneration', intervalTicks: 20, nextTick: 20, tickIndex: 0, initialTick: false, dedupKey: 'regen_01' }),
    }),
  ];
  return Object.freeze({
    schemaVersion: 1,
    simulationVersion: 'phase18-fixture-v1',
    battleId: 'battle_fixture',
    tick: primitives.tick(0),
    nextSequence: primitives.sequence(0),
    emittedEventCount: 0,
    phase: Object.freeze({ phase: 'ACTIVE', enteredTick: primitives.tick(0), resolvingEndTicks: 0 }),
    entities: Object.freeze(entities),
    scheduledEvents: Object.freeze([]),
    authoritativeStreams: rnd.streams.snapshotAuthoritative(),
    endReason: null,
    statuses: Object.freeze(statuses),
  });
}

/** Runs the Phase 18 60-tick trace and returns its hashes (the P18 Node reference column). */
export function runNodePhase18ReferenceTrace(api) {
  const { battleKernel, phase18Systems, snapshot } = api;
  const input = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });
  let state = buildPhase18Battle(api);
  const startHash = snapshot.createSnapshot(state).checksum;
  const random = buildRandom(api);
  const systems = phase18Systems.createPhase18Systems({
    speedsX100PerSecond: {},
    status: {
      periodic: {
        burn_01: { effectKind: 'burn', amountPerTick: 50 },
        poison_01: { effectKind: 'poison', amountPerTick: 40 },
        regen_01: { effectKind: 'regeneration', amountPerTick: 25 },
      },
    },
  });
  const checkpoints = [];
  let callOrder = [];
  for (let i = 0; i < 60; i++) {
    const r = battleKernel.stepBattle({ state, input, random, rules: {}, content: {}, systems });
    state = r.state;
    if (i === 0) callOrder = [...r.callOrder];
    if (r.checkpoint) checkpoints.push({ tick: state.tick, checksum: r.checkpoint.checksum });
  }
  return {
    startHash,
    tick30: checkpoints.find((c) => c.tick === 30)?.checksum ?? null,
    tick60: checkpoints.find((c) => c.tick === 60)?.checksum ?? null,
    endHash: snapshot.createSnapshot(state).checksum,
    endTick: state.tick,
    endReason: state.endReason,
    eventCount: state.emittedEventCount,
    callOrder,
  };
}
