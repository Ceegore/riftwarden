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
