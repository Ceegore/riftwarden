import { buildRandom } from './kernel-loader.mjs';

const phase = (id, min, max, priority, extra = {}) =>
  Object.freeze({ id, bossId: 'boss_ash', priority, minHpPermille: min, maxHpPermille: max, previewKey: `preview_${id}`, ...extra });

const defs = Object.freeze([
  phase('p1', 501, 1001, 1),
  phase('p2', 251, 501, 2, { invulnerableTicks: 10 }),
  phase('p3', 0, 251, 3),
]);

const modifiers = Object.freeze([
  Object.freeze({ id: 'mod_ash_1', previewKey: 'preview_mod_ash_1', hooks: Object.freeze(['on_battle_start']), incompatibilityTags: Object.freeze([]), params: Object.freeze({}) }),
  Object.freeze({ id: 'mod_ash_2', previewKey: 'preview_mod_ash_2', hooks: Object.freeze(['on_phase_entry']), incompatibilityTags: Object.freeze([]), params: Object.freeze({}) }),
]);

const waves = Object.freeze([
  Object.freeze({ id: 'wave_ash_1', scheduledTick: 10, side: 'enemy', entityIds: Object.freeze(['unit_reinforce_a', 'unit_reinforce_b']), spawnProfile: 'profile_grunt', capPolicy: 'BLOCK' }),
]);

const objectives = Object.freeze([
  Object.freeze({ id: 'obj_survive', kind: 'survive_until', targetId: null, required: 60, progress: 0, complete: false }),
  Object.freeze({ id: 'obj_boss', kind: 'kill_boss', targetId: 'boss_ash_unit', required: 1, progress: 0, complete: false }),
  Object.freeze({ id: 'obj_protect', kind: 'protect_object', targetId: 'obj_core', required: 1, progress: 0, complete: false }),
]);

const bossObjects = Object.freeze([
  Object.freeze({
    entityId: 'obj_core',
    side: 'enemy',
    ownerId: 'boss_ash_unit',
    sourceId: 'content_ash',
    spec: Object.freeze({ slotId: 'boss_slot_0', lane: 'middle', x100: 5000, targetable: true, objectiveLink: null, damagePolicy: 'normal', statusPolicy: 'allow', cleanupPolicy: 'on_objective', fallback: 'FAIL' }),
    maxLp: 1000,
    radiusX100: 120,
  }),
]);

const hazards = Object.freeze([
  Object.freeze({ id: 'hazard_ash_1', scheduledTick: 5, telegraphTicks: 10, resolveTick: 15, expired: false, form: 'circle', edgePattern: 'edge_dashed', shapeSymbol: 'symbol_skull' }),
]);

/**
 * Builds the Phase 21 60-tick reference battle: a boss at 40% HP in phase p1,
 * encounter modifiers, a survive/kill-boss mission, a reinforcement wave due at
 * tick 10 and one hazard (telegraph at 5, resolve at 15). Exercises modifier
 * commit (D), hazard advance (C), boss detect (D) -> commit (L at tick 45),
 * wave commit (K) and objective resolution (L).
 */
export function buildPhase21Battle(api) {
  const { migrate, primitives } = api;
  const mk = (id, side, x100, lane) =>
    migrate.migrateEntity({
      entity: Object.freeze({
        id,
        side,
        phase: Object.freeze({ phase: 'ACTIVE', enteredTick: primitives.tick(0), controlledReturn: null }),
        maxLp: 1000,
        lp: 400,
        shield: 0,
        lane,
        x100,
        targetId: null,
        timers: Object.freeze({}),
      }),
      radiusX100: 120,
    });
  const rnd = buildRandom(api);
  return Object.freeze({
    schemaVersion: 1,
    simulationVersion: 'phase21-fixture-v1',
    battleId: 'battle_fixture',
    tick: primitives.tick(0),
    nextSequence: primitives.sequence(0),
    emittedEventCount: 0,
    phase: Object.freeze({ phase: 'ACTIVE', enteredTick: primitives.tick(0), resolvingEndTicks: 0 }),
    entities: Object.freeze([
      mk('unit_player_a', 'player', 1800, 'top'),
      mk('boss_ash_unit', 'enemy', 5000, 'middle'),
    ]),
    scheduledEvents: Object.freeze([]),
    authoritativeStreams: rnd.streams.snapshotAuthoritative(),
    endReason: null,
    bossPhase: Object.freeze({
      entityId: 'boss_ash_unit',
      bossId: 'boss_ash',
      phaseId: 'p1',
      transition: null,
      visited: Object.freeze(['p1']),
      invulnerableUntilTick: null,
    }),
    hazards,
  });
}

/** Runs the Phase 21 60-tick trace and returns its hashes (the P21 Node reference column). */
export function runNodePhase21ReferenceTrace(api) {
  const { battleKernel, phase21Systems, snapshot } = api;
  const input = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });
  let state = buildPhase21Battle(api);
  const startHash = snapshot.createSnapshot(state).checksum;
  const random = buildRandom(api);
  const systems = phase21Systems.createPhase21Systems({
    bossPhaseDefinitions: defs,
    modifiers,
    waves,
    objectives,
    bossObjects,
    bossCoreMechanicTags: Object.freeze(['core_phase']),
    bossAnnouncedCounterTags: Object.freeze(['dispel']),
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

/**
 * The Phase 21 protect_object FAILURE 60-tick reference battle. The player's
 * direct attack kills the protected boss-object body on the first hit, the
 * protect_object objective flips to incomplete, and the forced DEFEAT sends the
 * battle through RESOLVING_END; the on_battle_end cleanup then removes the
 * destroyed body so the terminal snapshot is clean, ending with endReason
 * `protect_object_failed`. Mirrors reference-traces-phase21-fail.json exactly
 * and exercises the §8 teeth (force_battle_outcome) + §6 cleanup together.
 */
export function buildPhase21FailureBattle(api) {
  const { migrate, primitives } = api;
  const { buildBossObjectBody, buildBossObject } = api.bossObjectManager;
  const mk = (id, side, x100, lane, lp = 1000, maxLp = 1000) =>
    migrate.migrateEntity({
      entity: Object.freeze({
        id, side,
        phase: Object.freeze({ phase: 'ACTIVE', enteredTick: primitives.tick(0), controlledReturn: null }),
        maxLp, lp, shield: 0, lane, x100, targetId: null, timers: Object.freeze({}),
      }),
      radiusX100: 100,
    });
  const content = Object.freeze({
    entityId: 'obj_protected',
    side: 'player',
    ownerId: 'boss_ash_unit',
    sourceId: 'content_ash_fail',
    spec: Object.freeze({ slotId: 'boss_slot_0', lane: 'middle', x100: 4400, targetable: true, objectiveLink: null, damagePolicy: 'normal', statusPolicy: 'allow', cleanupPolicy: 'on_battle_end', fallback: 'FAIL' }),
    maxLp: 100,
    radiusX100: 120,
  });
  const body = buildBossObjectBody(content, primitives.tick(0));
  const temp = buildBossObject(content.spec, content.entityId, content.side, content.ownerId, content.sourceId, 0, 0);
  const rnd = buildRandom(api);
  return Object.freeze({
    schemaVersion: 1,
    simulationVersion: 'phase21-fail-fixture-v1',
    battleId: 'battle_fixture',
    tick: primitives.tick(0),
    nextSequence: primitives.sequence(0),
    emittedEventCount: 0,
    phase: Object.freeze({ phase: 'ACTIVE', enteredTick: primitives.tick(0), resolvingEndTicks: 0 }),
    entities: Object.freeze([
      mk('unit_player_a', 'player', 1800, 'top'),
      mk('unit_player_b', 'player', 2400, 'middle'),
      mk('boss_ash_unit', 'enemy', 8200, 'bottom', 1000),
      body,
    ]),
    temporaryEntities: Object.freeze([temp]),
    // A stage-I direct hit that kills the 100-HP protected body on tick 0.
    pendingCombatApplications: Object.freeze([
      Object.freeze({ kind: 'damage', sourceId: 'unit_enemy_attacker', targetId: 'obj_protected', effectId: 'ef_kill', attackInstanceId: 1, effectIndex: 0, rawAmount: 200, damageTypeOrdinal: 0, defense: 0, coverReductionBps: 0, bossCapBps: null }),
    ]),
    scheduledEvents: Object.freeze([]),
    authoritativeStreams: rnd.streams.snapshotAuthoritative(),
    endReason: null,
    objectives: Object.freeze([
      Object.freeze({ id: 'obj_protect', kind: 'protect_object', targetId: 'obj_protected', required: 1, progress: 0, complete: false }),
    ]),
  });
}

/** Runs the protect_object FAILURE trace to its terminal outcome (the P21-fail Node reference column). */
export function runNodePhase21FailureReferenceTrace(api) {
  const { battleKernel, phase17Systems, phase21Systems, snapshot, x100 } = api;
  const input = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });
  let state = buildPhase21FailureBattle(api);
  const startHash = snapshot.createSnapshot(state).checksum;
  const random = buildRandom(api);
  const systems = Object.freeze([
    ...phase17Systems.createPhase17Systems({
      speedsX100PerSecond: {},
      basicAttack: {
        parameters: {
          unit_player_a: {
            attackIntervalTicks: 10,
            prepareTicks: 1,
            recoveryTicks: 3,
            preferredRangeX100: x100.asX100(9000),
            delivery: { kind: 'direct', rawAmount: 200, damageTypeOrdinal: 0, defense: 0, bossCapBps: null },
          },
        },
      },
    }),
    ...phase21Systems.createPhase21Systems({
      bossPhaseDefinitions: defs,
      objectives: Object.freeze([
        Object.freeze({ id: 'obj_protect', kind: 'protect_object', targetId: 'obj_protected', required: 1, progress: 0, complete: false }),
      ]),
      bossObjects: Object.freeze([
        Object.freeze({
          entityId: 'obj_protected', side: 'player', ownerId: 'boss_ash_unit', sourceId: 'content_ash_fail',
          spec: Object.freeze({ slotId: 'boss_slot_0', lane: 'middle', x100: 4400, targetable: true, objectiveLink: null, damagePolicy: 'normal', statusPolicy: 'allow', cleanupPolicy: 'on_battle_end', fallback: 'FAIL' }),
          maxLp: 100, radiusX100: 120,
        }),
      ]),
      bossCoreMechanicTags: Object.freeze(['core_phase']),
      bossAnnouncedCounterTags: Object.freeze(['dispel']),
    }),
  ]);
  const checkpoints = [];
  let callOrder = [];
  let terminal = false;
  for (let i = 0; i < 60; i++) {
    const r = battleKernel.stepBattle({ state, input, random, rules: {}, content: {}, systems });
    state = r.state;
    if (i === 0) callOrder = [...r.callOrder];
    if (r.checkpoint) checkpoints.push({ tick: state.tick, checksum: r.checkpoint.checksum });
    if (['VICTORY', 'DEFEAT', 'DRAW_ABORT'].includes(state.phase.phase)) { terminal = true; break; }
  }
  return {
    startHash,
    tick30: checkpoints.find((c) => c.tick === 30)?.checksum ?? null,
    tick60: checkpoints.find((c) => c.tick === 60)?.checksum ?? null,
    endHash: snapshot.createSnapshot(state).checksum,
    endTick: state.tick,
    endReason: state.endReason,
    eventCount: state.emittedEventCount,
    terminal,
    callOrder,
  };
}
