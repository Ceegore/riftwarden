/**
 * Phase 22 scenario registry.
 *
 * Maps the twelve canonical golden ids to real repository scenarios. Each
 * scenario is a battle builder + systems factory mirroring the pinned
 * reference-trace configs exactly, so the golden baselines are real kernel
 * output — never aspirational fixtures. The seed words feed both the battle's
 * authoritative streams and the runtime RandomSession, making every golden
 * entry a distinct deterministic vector.
 */
import {
  buildBattle,
  buildPhase15Battle,
  buildPhase16Battle,
  buildPhase17Battle,
  buildPhase17JLBattle,
} from './kernel-loader.mjs';
import { buildPhase18Battle } from './phase18-trace.mjs';
import { buildPhase19Battle } from './phase19-trace.mjs';
import { buildPhase20Battle } from './phase20-trace.mjs';
import { buildPhase21Battle } from './phase21-trace.mjs';

/** Deterministic seed derivation for a golden id (no wallclock, no Math.random). */
function goldenSeedWords(id) {
  const word = (salt) => {
    let hash = 2166136261 >>> 0;
    const text = `${id}:${salt}`;
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619) >>> 0;
    }
    return hash.toString(16).padStart(8, '0');
  };
  return [word('a'), word('b'), word('c'), word('d')];
}

/** Builds a random session from the given 4 hex words. */
export function sessionFromSeed(api, words) {
  const streams = api.random.RngStreamMap.fromRunSeed(api.random.parseRunSeed(words));
  return new api.random.RandomSession(streams, new api.random.RollSlotRegistry([]), false);
}

/** Replaces the authoritative streams of a built battle with seed-derived ones. */
export function withSeedStreams(battle, api, words) {
  const streams = api.random.RngStreamMap.fromRunSeed(api.random.parseRunSeed(words));
  return Object.freeze({ ...battle, authoritativeStreams: streams.snapshotAuthoritative() });
}

const P15_SYSTEMS = (api) =>
  api.phase15Systems.createPhase15Systems({
    speedsX100PerSecond: { unit_player_a: 305, unit_player_b: 300 },
  });

const P16_SYSTEMS = (api) =>
  api.phase16Systems.createPhase16Systems({
    speedsX100PerSecond: { unit_player_a: 305, unit_player_b: 300 },
    attackPrep: {
      preferredRangeX100: {
        unit_player_a: api.x100.asX100(5000),
        unit_player_b: api.x100.asX100(4000),
      },
    },
  });

const P17_SYSTEMS = (api) =>
  api.phase17Systems.createPhase17Systems({
    speedsX100PerSecond: { unit_player_a: 305, unit_player_b: 300 },
    attackPrep: {
      preferredRangeX100: {
        unit_player_a: api.x100.asX100(5000),
        unit_player_b: api.x100.asX100(4000),
      },
    },
    basicAttack: {
      parameters: {
        unit_player_a: {
          attackIntervalTicks: 20,
          prepareTicks: 1,
          recoveryTicks: 3,
          preferredRangeX100: api.x100.asX100(9000),
          delivery: {
            kind: 'projectile',
            speedX100PerSecond: 3000,
            homing: false,
            maxTurnX100PerTick: 0,
            expiryTicks: 60,
            lostTargetPolicy: 'impact_stored_position',
            coverIgnoring: true,
            piercing: false,
            rawAmount: 120,
            damageTypeOrdinal: 0,
            defense: 0,
            bossCapBps: null,
          },
        },
      },
    },
  });

const P17JL_SYSTEMS = (api) =>
  api.phase17Systems.createPhase17Systems({
    speedsX100PerSecond: {},
    basicAttack: {
      parameters: {
        unit_player_a: {
          attackIntervalTicks: 10,
          prepareTicks: 1,
          recoveryTicks: 3,
          preferredRangeX100: api.x100.asX100(9000),
          delivery: { kind: 'direct', rawAmount: 400, damageTypeOrdinal: 0, defense: 0, bossCapBps: null },
        },
      },
    },
  });

const P18_SYSTEMS = (api) =>
  api.phase18Systems.createPhase18Systems({
    speedsX100PerSecond: {},
    status: {
      periodic: {
        burn_01: { effectKind: 'burn', amountPerTick: 50 },
        poison_01: { effectKind: 'poison', amountPerTick: 40 },
        regen_01: { effectKind: 'regeneration', amountPerTick: 25 },
      },
    },
  });

const P19_SYSTEMS = (api) =>
  api.phase19Systems.createPhase19Systems({
    speedsX100PerSecond: {},
    abilities: { definitions: { ability_fireball: fireballDefinition() } },
  });

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

const P20_SYSTEMS = (api) =>
  api.phase20Systems.createPhase20Systems({
    unitTraits: Object.freeze({
      unit_player_a: Object.freeze(['kingdom', 'faith']),
      unit_player_b: Object.freeze(['kingdom']),
      unit_enemy_a: Object.freeze(['wild']),
      unit_enemy_b: Object.freeze(['wild']),
    }),
    spawnPolicies: Object.freeze({ ability_summon: 'BLOCK' }),
    spawnLifetimes: Object.freeze({ ability_summon: 30 }),
  });

const phase = (id, min, max, priority, extra = {}) =>
  Object.freeze({ id, bossId: 'boss_ash', priority, minHpPermille: min, maxHpPermille: max, previewKey: `preview_${id}`, ...extra });

const P21_SYSTEMS = (api) =>
  api.phase21Systems.createPhase21Systems({
    bossPhaseDefinitions: Object.freeze([
      phase('p1', 501, 1001, 1),
      phase('p2', 251, 501, 2, { invulnerableTicks: 10 }),
      phase('p3', 0, 251, 3),
    ]),
    modifiers: Object.freeze([
      Object.freeze({ id: 'mod_ash_1', previewKey: 'preview_mod_ash_1', hooks: Object.freeze(['on_battle_start']), incompatibilityTags: Object.freeze([]), params: Object.freeze({}) }),
    ]),
    waves: Object.freeze([
      Object.freeze({ id: 'wave_ash_1', scheduledTick: 10, side: 'enemy', entityIds: Object.freeze(['unit_reinforce_a', 'unit_reinforce_b']), spawnProfile: 'profile_grunt', capPolicy: 'BLOCK' }),
    ]),
    objectives: Object.freeze([
      Object.freeze({ id: 'obj_survive', kind: 'survive_until', targetId: null, required: 60, progress: 0, complete: false }),
      Object.freeze({ id: 'obj_boss', kind: 'kill_boss', targetId: 'boss_ash_unit', required: 1, progress: 0, complete: false }),
    ]),
    bossCoreMechanicTags: Object.freeze(['core_phase']),
    bossAnnouncedCounterTags: Object.freeze(['dispel']),
  });

/**
 * Scenario surface: build(api, words) -> battle, systems(api) -> systems,
 * simulationVersion + contentVersion + defaultCapTicks. The builders mirror
 * the pinned reference-trace builders from kernel-loader / the phase trace
 * libs; only the authoritative streams are reseeded per golden entry.
 */
export const SCENARIOS = Object.freeze({
  phase14: {
    simulationVersion: 'phase14-fixture-v1',
    build(api, words) {
      return withSeedStreams(buildBattle(api), api, words);
    },
    systems(api) {
      return Object.freeze([...api.noopSystems.createNoopSystems()]);
    },
  },
  phase15: {
    simulationVersion: 'phase15-fixture-v1',
    build(api, words) {
      return withSeedStreams(buildPhase15Battle(api), api, words);
    },
    systems: P15_SYSTEMS,
  },
  phase16: {
    simulationVersion: 'phase16-fixture-v1',
    build(api, words) {
      return withSeedStreams(buildPhase16Battle(api), api, words);
    },
    systems: P16_SYSTEMS,
  },
  phase17: {
    simulationVersion: 'phase17-fixture-v1',
    build(api, words) {
      return withSeedStreams(buildPhase17Battle(api), api, words);
    },
    systems: P17_SYSTEMS,
  },
  phase17jl: {
    simulationVersion: 'phase17jl-fixture-v1',
    build(api, words) {
      return withSeedStreams(buildPhase17JLBattle(api), api, words);
    },
    systems: P17JL_SYSTEMS,
  },
  phase18: {
    simulationVersion: 'phase18-fixture-v1',
    build(api, words) {
      return withSeedStreams(buildPhase18Battle(api), api, words);
    },
    systems: P18_SYSTEMS,
  },
  phase19: {
    simulationVersion: 'phase19-fixture-v1',
    build(api, words) {
      return withSeedStreams(buildPhase19Battle(api), api, words);
    },
    systems: P19_SYSTEMS,
  },
  phase20: {
    simulationVersion: 'phase20-fixture-v1',
    build(api, words) {
      return withSeedStreams(buildPhase20Battle(api), api, words);
    },
    systems: P20_SYSTEMS,
  },
  phase21: {
    simulationVersion: 'phase21-fixture-v1',
    build(api, words) {
      return withSeedStreams(buildPhase21Battle(api), api, words);
    },
    systems: P21_SYSTEMS,
  },
});

/**
 * The twelve canonical golden entries. Each maps to a real scenario surface;
 * the seed is derived deterministically from the golden id so baselines are
 * reproducible everywhere.
 */
export const GOLDEN_ENTRIES = Object.freeze([
  { id: 'golden_basic_001', purpose: 'physical armor defeat end', scenario: 'phase15', capTicks: 60 },
  { id: 'golden_lane_002', purpose: 'lanes switch empty lane protection', scenario: 'phase16', capTicks: 60 },
  { id: 'golden_status_003', purpose: 'all stack policies cleanse periodic', scenario: 'phase18', capTicks: 60 },
  { id: 'golden_summon_004', purpose: 'six slots multispawn replace expiration', scenario: 'phase20', capTicks: 60 },
  { id: 'golden_revive_005', purpose: 'revive simultaneous death draw', scenario: 'phase17jl', capTicks: 300 },
  { id: 'golden_projectile_006', purpose: 'target loss homing phase transition', scenario: 'phase17', capTicks: 60 },
  { id: 'golden_boss_ash_101', purpose: 'ash boss all phases normal ascension', scenario: 'phase21', capTicks: 60 },
  { id: 'golden_boss_thorn_102', purpose: 'plant slots shield vulnerability', scenario: 'phase21', capTicks: 60 },
  { id: 'golden_boss_smith_103', purpose: 'construct slots overheat', scenario: 'phase21', capTicks: 60 },
  { id: 'golden_boss_heart_104', purpose: 'four final phases curator rank10', scenario: 'phase21', capTicks: 60 },
  { id: 'golden_timeout_201', purpose: 'stall collapse timeout tiebreak', scenario: 'phase17jl', capTicks: 500 },
  { id: 'golden_save_301', purpose: 'snapshot cast projectile spawn resume', scenario: 'phase17jl', capTicks: 300 },
]);

/** Looks up a golden entry by id. */
export function goldenById(id) {
  return GOLDEN_ENTRIES.find((entry) => entry.id === id);
}

export { goldenSeedWords };
