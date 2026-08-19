import { buildRandom } from './kernel-loader.mjs';

function spawnEffect(summonId, index, sourceId) {
  return Object.freeze({
    commandId: `spawn_${String(index)}_${summonId}`,
    abilityInstanceId: `inst_summon_${String(index)}`,
    abilityId: 'ability_summon',
    effectIndex: 0,
    sourceId,
    targetRef: Object.freeze({ kind: 'summon_slot', entityId: null, groundKey: null, slotId: null }),
    scheduledTick: 0,
    stage: 'K',
    sourceSnapshot: Object.freeze({ sourceId, sourceLane: 'middle', sourceX100: 1800, sourceLp: 1000, sourceMaxLp: 1000 }),
    sequence: index,
    kind: 'spawn_request',
    summonId,
  });
}

/**
 * Builds the Phase 20 60-tick reference battle: four migrated entities, two
 * kingdom traits on the player side (tier 2), two wild traits on the enemy
 * side, and two reserved `spawn_request` effects — one permanent, one with a
 * 30-tick lifetime that expires mid-trace. Exercises synergy commit (stage D),
 * summon commit + expiry (stage K) and the registry snapshot.
 */
export function buildPhase20Battle(api) {
  const { migrate, primitives } = api;
  const mk = (id, side, x100, lane) =>
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
      radiusX100: 100,
    });
  const rnd = buildRandom(api);
  return Object.freeze({
    schemaVersion: 1,
    simulationVersion: 'phase20-fixture-v1',
    battleId: 'battle_fixture',
    tick: primitives.tick(0),
    nextSequence: primitives.sequence(0),
    emittedEventCount: 0,
    phase: Object.freeze({ phase: 'ACTIVE', enteredTick: primitives.tick(0), resolvingEndTicks: 0 }),
    entities: Object.freeze([
      mk('unit_player_a', 'player', 1800, 'top'),
      mk('unit_player_b', 'player', 2400, 'middle'),
      mk('unit_enemy_a', 'enemy', 6200, 'middle'),
      mk('unit_enemy_b', 'enemy', 7600, 'bottom'),
    ]),
    scheduledEvents: Object.freeze([]),
    authoritativeStreams: rnd.streams.snapshotAuthoritative(),
    endReason: null,
    temporaryEntities: Object.freeze([]),
    plannedEffects: Object.freeze([spawnEffect('summon_a', 0, 'unit_player_a'), spawnEffect('summon_b', 1, 'unit_player_b')]),
  });
}

/** Runs the Phase 20 60-tick trace and returns its hashes (the P20 Node reference column). */
export function runNodePhase20ReferenceTrace(api) {
  const { battleKernel, phase20Systems, snapshot } = api;
  const input = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });
  let state = buildPhase20Battle(api);
  const startHash = snapshot.createSnapshot(state).checksum;
  const random = buildRandom(api);
  const systems = phase20Systems.createPhase20Systems({
    unitTraits: Object.freeze({ unit_player_a: Object.freeze(['kingdom', 'faith']), unit_player_b: Object.freeze(['kingdom']), unit_enemy_a: Object.freeze(['wild']), unit_enemy_b: Object.freeze(['wild']) }),
    spawnPolicies: Object.freeze({ ability_summon: 'BLOCK' }),
    spawnLifetimes: Object.freeze({ ability_summon: 30 }),
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
