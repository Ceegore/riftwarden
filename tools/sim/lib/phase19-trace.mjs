import { buildRandom } from './kernel-loader.mjs';

/**
 * Builds the Phase 19 60-tick reference battle: migrated entities plus one
 * `ability_fireball` instance on the player (tick_interval trigger, nearest
 * enemy target, stage-I damage effect), matching
 * tests/sim/fixtures/reference-traces-phase19.json exactly.
 */
export function buildPhase19Battle(api) {
  const { migrate, primitives, abilitySystem } = api;
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
  const config = {
    abilityId: 'ability_fireball',
    chargeTicks: null,
    cooldownTicks: 3,
    castTicks: 2,
    recoveryTicks: 1,
    interruptPolicy: 'interruptible',
    usesPerBattle: null,
    invalidTargetPolicy: 'wait',
    bossPhaseCancelAllowed: false,
  };
  const rnd = buildRandom(api);
  return Object.freeze({
    schemaVersion: 1,
    simulationVersion: 'phase19-fixture-v1',
    battleId: 'battle_fixture',
    tick: primitives.tick(0),
    nextSequence: primitives.sequence(0),
    emittedEventCount: 0,
    phase: Object.freeze({ phase: 'ACTIVE', enteredTick: primitives.tick(0), resolvingEndTicks: 0 }),
    entities: Object.freeze(entities),
    scheduledEvents: Object.freeze([]),
    authoritativeStreams: rnd.streams.snapshotAuthoritative(),
    endReason: null,
    abilities: Object.freeze([abilitySystem.createAbilityInstance(config, 'inst_fireball', 'unit_player_a')]),
  });
}

function fireballDefinition() {
  return {
    config: {
      abilityId: 'ability_fireball',
      chargeTicks: null,
      cooldownTicks: 3,
      castTicks: 2,
      recoveryTicks: 1,
      interruptPolicy: 'interruptible',
      usesPerBattle: null,
      invalidTargetPolicy: 'wait',
      bossPhaseCancelAllowed: false,
    },
    trigger: { type: 'tick_interval', everyTicks: 15 },
    targetQuery: { space: 'enemy_entity', profile: 'nearest' },
    effects: (ctx) => [
      Object.freeze({
        commandId: `${ctx.abilityInstanceId}_effect_0`,
        abilityInstanceId: ctx.abilityInstanceId,
        abilityId: ctx.abilityId,
        effectIndex: 0,
        sourceId: ctx.source.sourceId,
        targetRef: Object.freeze({ kind: 'entity', entityId: ctx.target.entityId, groundKey: null, slotId: null }),
        scheduledTick: ctx.commitTick,
        stage: 'I',
        sourceSnapshot: ctx.source,
        sequence: 0,
        kind: 'damage',
        amount: 120,
      }),
    ],
  };
}

/** Runs the Phase 19 60-tick trace and returns its hashes (the P19 Node reference column). */
export function runNodePhase19ReferenceTrace(api) {
  const { battleKernel, phase19Systems, snapshot } = api;
  const input = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });
  let state = buildPhase19Battle(api);
  const startHash = snapshot.createSnapshot(state).checksum;
  const random = buildRandom(api);
  const systems = phase19Systems.createPhase19Systems({ speedsX100PerSecond: {}, abilities: { definitions: { ability_fireball: fireballDefinition() } } });
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
