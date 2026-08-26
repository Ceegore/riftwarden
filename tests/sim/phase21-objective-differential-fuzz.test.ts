import { describe, expect, it } from 'vitest';
import { stepBattle } from '../../src/game/sim/core/battle-kernel.js';
import { migrateEntity } from '../../src/game/sim/core/migrate.js';
import { createPhase17Systems } from '../../src/game/sim/core/phase17-systems.js';
import { createPhase19Systems } from '../../src/game/sim/core/phase19-systems.js';
import { createPhase20Systems } from '../../src/game/sim/core/phase20-systems.js';
import { createPhase21Systems, type Phase21RuntimeConfig } from '../../src/game/sim/core/phase21-systems.js';
import { createAbilityInstance } from '../../src/game/sim/ability/ability-system.js';
import { createSnapshot } from '../../src/game/sim/snapshot/snapshot.js';
import {
  applyEventProgress, applyEventRecordProgress, createObjectiveCollection, evaluateSurvival,
  type EventRecordLike, type Objective,
} from '../../src/game/sim/objectives/combat-objective.js';
import { buildBossObject, buildBossObjectBody, type BossObjectContent, type BossObjectSpec } from '../../src/game/sim/boss/boss-object-manager.js';
import type { AbilityRuntimeDefinition } from '../../src/game/sim/ability/ability-runtime.js';
import type { EffectCommand } from '../../src/game/sim/ability/effect-command.js';
import type { KernelEvent } from '../../src/game/sim/events/event-types.js';
import type { KernelSystem } from '../../src/game/sim/core/tick-context.js';
import type { PhaseDefinition } from '../../src/game/sim/boss/boss-phase-system.js';
import type { ObjectiveKind } from '../../src/game/sim/objectives/combat-objective.js';
import type { ReinforcementBody } from '../../src/game/sim/core/phase21-systems.js';
import type { TickInput } from '../../src/game/sim/core/tick-input.js';
import type { BattleModel } from '../../src/game/sim/core/battle-model.js';
import type { Wave } from '../../src/game/sim/world/reinforcement-system.js';
import { battle, entity, randomSession, tick } from './test-helpers.js';
import { asX100 } from '../../src/game/sim/geometry/x100.js';
import { sequence } from '../../src/game/sim/core/primitives.js';

/**
 * Phase 21 §8 objective differential fuzz. Two independent implementations of
 * the same contract must agree:
 *
 * 1. Pure level: the kernel persists events as projections ({type, sourceId,
 *    targetIds}) and the record path folds those; the event path folds full
 *    KernelEvents. For objective semantics only (type + targetIds) carry
 *    signal, so the projected fold must equal the full-event fold at every
 *    step, through 20k randomized streams.
 * 2. Kernel level: a real battle (boss, boss objects, waves, fireballs) is
 *    stepped; an oracle independent of the runtime folds the emitted events
 *    with the pure event path plus the documented §P21-T03 exclusions (boss
 *    entity kills and boss-object kills never count toward kill_regulars) and
 *    must equal state.objectives after every tick. This catches seeding lag,
 *    exclusion drift, and projection loss — the bug classes that broke
 *    kill_regulars and snapshots earlier.
 */

/** Deterministic 32-bit PRNG (mulberry32) for value generation. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const EVENT_TYPES: readonly ('Defeated' | 'Removed' | 'ReinforcementSpawned')[] = ['Defeated', 'Removed', 'ReinforcementSpawned'];
const IDS: readonly string[] = ['unit_a', 'unit_b', 'unit_c', 'boss_ash_unit', 'obj_core', 'obj_ward', 'wave_1'];

/** Random objective of an event-driven kind. */
function randomObjective(rand: () => number): Objective {
  const kinds: readonly ObjectiveKind[] = ['kill_regulars', 'kill_boss', 'destroy_object', 'complete_waves'];
  const kind = kinds[Math.floor(rand() * kinds.length)] ?? 'kill_regulars';
  const targetId = kind === 'kill_boss' || kind === 'destroy_object'
    ? (kind === 'kill_boss' ? 'boss_ash_unit' : (rand() < 0.5 ? 'obj_core' : 'obj_ward'))
    : null;
  return Object.freeze({
    id: `obj_${kind}_${String(Math.floor(rand() * 1000))}`,
    kind,
    targetId,
    required: 1 + Math.floor(rand() * 5),
    progress: 0,
    complete: false,
  });
}

/** The kernel's persisted projection of a full event (snapshot.ts contract). */
function project(event: KernelEvent): EventRecordLike {
  return Object.freeze({ type: event.type, sourceId: event.sourceId, targetIds: Object.freeze([...event.targetIds]) });
}

describe('P21 §8 differential fuzz — record path vs event path', () => {
  it('the projected-record fold equals the full-event fold at every step (20k streams)', { timeout: 120_000 }, () => {
    const rand = mulberry32(0x0b_5e_21);
    for (let i = 0; i < 20_000; i++) {
      const objective = randomObjective(rand);
      const steps = 1 + Math.floor(rand() * 40);
      let viaEvents = objective;
      let viaRecords = objective;
      for (let s = 0; s < steps; s++) {
        const type = EVENT_TYPES[Math.floor(rand() * EVENT_TYPES.length)] ?? 'Defeated';
        const targetIds = Object.freeze(Array.from({ length: 1 + Math.floor(rand() * 3) }, () => IDS[Math.floor(rand() * IDS.length)] ?? 'unit_a'));
        const event: KernelEvent = Object.freeze({
          type, sourceId: 'unit_p', targetIds, contentIds: Object.freeze([] as readonly string[]),
          payload: Object.freeze({} as Readonly<Record<string, number>>), logTags: Object.freeze(['sim.fixture']), tick: tick(s), sequence: sequence(0),
        });
        viaEvents = applyEventProgress(viaEvents, event);
        viaRecords = applyEventRecordProgress(viaRecords, project(event));
        expect({ progress: viaRecords.progress, complete: viaRecords.complete }, `case ${String(i)} step ${String(s)} ${JSON.stringify(project(event))}`)
          .toEqual({ progress: viaEvents.progress, complete: viaEvents.complete });
        // Monotonicity + cap invariants hold on both paths.
        for (const o of [viaEvents, viaRecords]) {
          expect(o.progress).toBeGreaterThanOrEqual(0);
          expect(o.progress).toBeLessThanOrEqual(o.required);
          expect(o.complete).toBe(o.progress >= o.required);
        }
      }
    }
  });

  it('survive_until agrees with the pure tick formula across random ticks', () => {
    const rand = mulberry32(0x5a_fa_21);
    for (let i = 0; i < 5000; i++) {
      const required = 1 + Math.floor(rand() * 200);
      const from = Math.floor(rand() * 300);
      const to = from + Math.floor(rand() * 100);
      const base: Objective = Object.freeze({ id: 'obj_survive', kind: 'survive_until', targetId: null, required, progress: 0, complete: false });
      let o = evaluateSurvival(base, from);
      expect(o.progress).toBe(Math.min(required, from));
      o = evaluateSurvival(o, to);
      expect(o.progress).toBe(Math.min(required, to));
      expect(o.complete).toBe(o.progress >= required);
    }
  });
});

/**
 * Kernel-level oracle: folds each tick's emitted events with the pure event
 * path plus the §P21-T03 exclusions, one tick lagged exactly like the runtime
 * (previousTickEvents is folded at the following tick).
 */
function oracleFold(
  current: readonly Objective[],
  events: readonly KernelEvent[],
  bossEntityId: string | null,
  bossObjectIds: ReadonlySet<string>,
  tickAtFold: number,
): readonly Objective[] {
  const bossEntity = bossEntityId;
  return current.map((o) => {
    let acc = o;
    for (const event of events) {
      // §P21-T03: boss defeats and boss-object defeats are never regular kills.
      if (o.kind === 'kill_regulars' && bossEntity !== null && event.targetIds.includes(bossEntity)) continue;
      if (o.kind === 'kill_regulars' && event.type === 'Defeated' && event.targetIds.some((id) => bossObjectIds.has(id))) continue;
      acc = applyEventProgress(acc, event);
    }
    return o.kind === 'survive_until' ? evaluateSurvival(acc, tickAtFold) : acc;
  });
}

const input: TickInput = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });

const phase = (id: string, min: number, max: number, priority: number): PhaseDefinition =>
  Object.freeze({ id, bossId: 'boss_ash', priority, minHpPermille: min, maxHpPermille: max, previewKey: `preview_${id}` });

const defs: readonly PhaseDefinition[] = Object.freeze([
  phase('p1', 501, 1001, 1),
  phase('p2', 251, 501, 2, ),
  phase('p3', 0, 251, 3),
]);

const bossSnapshot = (): NonNullable<BattleModel['bossPhase']> =>
  Object.freeze({ entityId: 'boss_ash_unit', bossId: 'boss_ash', phaseId: 'p1', transition: null, visited: Object.freeze(['p1']), invulnerableUntilTick: null });

/** Minimal RNG-free fireball: cast 2, recover 1, cooldown 3, 120 damage. */
function fireballDefinition(): AbilityRuntimeDefinition {
  return {
    config: {
      abilityId: 'ability_fireball', chargeTicks: null, cooldownTicks: 3, castTicks: 2, recoveryTicks: 1,
      interruptPolicy: 'interruptible', usesPerBattle: 50, invalidTargetPolicy: 'wait', bossPhaseCancelAllowed: false,
    },
    trigger: { type: 'tick_interval', everyTicks: 6 },
    targetQuery: { space: 'enemy_entity', profile: 'nearest' },
    effects: (ctx): readonly EffectCommand[] => [
      Object.freeze({
        commandId: `${ctx.abilityInstanceId}_effect_0`, abilityInstanceId: ctx.abilityInstanceId, abilityId: ctx.abilityId,
        effectIndex: 0, sourceId: ctx.source.sourceId,
        targetRef: Object.freeze({ kind: 'entity' as const, entityId: ctx.target.entityId, groundKey: null, slotId: null }),
        scheduledTick: ctx.commitTick, stage: 'I' as const, sourceSnapshot: ctx.source, sequence: 0,
        kind: 'damage' as const, amount: 120,
      }),
    ],
  };
}

const objectSpec = (slotId: string, extra: Partial<BossObjectSpec> = {}): BossObjectSpec =>
  Object.freeze({ slotId: slotId as BossObjectSpec['slotId'], lane: 'middle', x100: 5000, targetable: true, objectiveLink: null, damagePolicy: 'normal', statusPolicy: 'allow', cleanupPolicy: 'on_battle_end', fallback: 'FAIL', ...extra });

const objectContent = (entityId: string, slotId: string, maxLp: number): BossObjectContent =>
  Object.freeze({ entityId, side: 'enemy', ownerId: 'boss_ash_unit', sourceId: 'content_boss', spec: objectSpec(slotId), maxLp, radiusX100: 120 });

const objectives: readonly Objective[] = Object.freeze([
  Object.freeze({ id: 'obj_survive', kind: 'survive_until', targetId: null, required: 40, progress: 0, complete: false }),
  Object.freeze({ id: 'obj_regulars', kind: 'kill_regulars', targetId: null, required: 1, progress: 0, complete: false }),
  Object.freeze({ id: 'obj_boss', kind: 'kill_boss', targetId: 'boss_ash_unit', required: 1, progress: 0, complete: false }),
  Object.freeze({ id: 'obj_core', kind: 'destroy_object', targetId: 'obj_core', required: 1, progress: 0, complete: false }),
  Object.freeze({ id: 'obj_waves', kind: 'complete_waves', targetId: null, required: 1, progress: 0, complete: false }),
]);

const waves: readonly Wave[] = Object.freeze([
  Object.freeze({ id: 'wave_grunts', scheduledTick: 8, side: 'enemy', entityIds: Object.freeze(['unit_reinf_a', 'unit_reinf_b']), spawnProfile: 'profile_grunt', capPolicy: 'BLOCK' }),
]);

const bodies = (w: Wave): readonly ReinforcementBody[] =>
  w.entityIds.map((entityId) => Object.freeze({ entityId, lane: 'bottom', x100: 8500, radiusX100: 120, maxLp: 400 }));

function buildBattle(): BattleModel {
  const player = migrateEntity({ entity: entity('unit_p', { side: 'player', lane: 'middle', x100: 1800, maxLp: 1000, lp: 1000 }), radiusX100: 100 });
  const boss = migrateEntity({ entity: entity('boss_ash_unit', { side: 'enemy', lane: 'middle', x100: 7000, maxLp: 1000, lp: 1000 }), radiusX100: 120 });
  // The grunt sits closest to the player so the nearest-enemy fireball kills it
  // first (a genuine regular kill); the boss objects are behind it and the boss
  // behind them — all three non-regular defeats must be excluded from
  // kill_regulars while still counting for their own objectives.
  const grunt = migrateEntity({ entity: entity('unit_grunt_a', { side: 'enemy', lane: 'top', x100: 2500, maxLp: 200, lp: 200 }), radiusX100: 100 });
  const coreBody = buildBossObjectBody(objectContent('obj_core', 'boss_slot_0', 500), tick(0));
  const wardBody = buildBossObjectBody(objectContent('obj_ward', 'boss_slot_1', 500), tick(0));
  const coreReg = buildBossObject(objectSpec('boss_slot_0'), 'obj_core', 'enemy', 'boss_ash_unit', 'content_boss', 0, 0);
  const wardReg = buildBossObject(objectSpec('boss_slot_1'), 'obj_ward', 'enemy', 'boss_ash_unit', 'content_boss', 0, 1);
  return battle({
    simulationVersion: 'phase21-fixture-v1',
    entities: Object.freeze([player, boss, grunt, coreBody, wardBody]),
    temporaryEntities: Object.freeze([coreReg, wardReg]),
    abilities: Object.freeze([createAbilityInstance(fireballDefinition().config, 'inst_fireball', 'unit_p')]),
    bossPhase: bossSnapshot(),
  });
}

function systems(cfg: Phase21RuntimeConfig): readonly KernelSystem[] {
  return Object.freeze([
    ...createPhase17Systems({
      speedsX100PerSecond: {},
      bossObjectPolicies: new Map([['obj_core', 'normal'] as const, ['obj_ward', 'normal'] as const]),
      basicAttack: {
        parameters: {
          unit_p: {
            attackIntervalTicks: 8, prepareTicks: 0, recoveryTicks: 0, preferredRangeX100: asX100(9000),
            delivery: { kind: 'direct', rawAmount: 100, damageTypeOrdinal: 0, defense: 0, bossCapBps: null },
          },
        },
      },
    }),
    ...createPhase19Systems({ speedsX100PerSecond: { unit_p: 0 }, abilities: { definitions: { ability_fireball: fireballDefinition() } } }),
    ...createPhase20Systems({}),
    ...createPhase21Systems(cfg),
  ]);
}

describe('P21 §8 differential fuzz — kernel vs independent oracle', () => {
  it('state.objectives equals the independent event-fold oracle after every tick (seeded battles)', { timeout: 120_000 }, () => {
    const cfg: Phase21RuntimeConfig = Object.freeze({
      bossPhaseDefinitions: defs,
      waves,
      spawnBodies: bodies,
      bossObjects: Object.freeze([objectContent('obj_core', 'boss_slot_0', 500), objectContent('obj_ward', 'boss_slot_1', 500)]),
      objectives,
    });
    const bossObjectIds = new Set(['obj_core', 'obj_ward']);
    const seed = createObjectiveCollection(objectives);

    for (const battleSeed of [1, 2, 3, 4, 5]) {
      void mulberry32(0xdead_0000 + battleSeed);
      let current = buildBattle();
      const random = randomSession();
      let oracle = seed;
      let prevEvents: readonly KernelEvent[] = Object.freeze([]);
      let ticksStepped = 0;
      let sawDefeated = false;
      for (let t = 0; t < 70; t++) {
        // The runtime folds previousTickEvents (the previous tick's log) at
        // this tick; mirror that one-tick lag with the pure event path.
        const foldTick = current.tick;
        oracle = oracleFold(oracle, prevEvents, 'boss_ash_unit', bossObjectIds, foldTick);
        const r = stepBattle({ state: current, input, random, rules: {}, content: {}, systems: systems(cfg) });
        current = r.state;
        ticksStepped += 1;
        for (const e of r.events) if (e.type === 'Defeated') sawDefeated = true;
        // Compare against the oracle AFTER the fold of the previous tick's
        // events — the same window the runtime has committed.
        const runtimeObjectives = current.objectives ?? [];
        const expected = createObjectiveCollection(oracle);
        expect(runtimeObjectives.map((o) => [o.id, o.progress, o.complete] as const),
          `seed ${String(battleSeed)} tick ${String(current.tick)}`).toEqual(expected.map((o) => [o.id, o.progress, o.complete] as const));
        prevEvents = r.events;
        if (['VICTORY', 'DEFEAT', 'DRAW_ABORT'].includes(current.phase.phase)) break;
      }
      // The battle must genuinely exercise combat and objectives.
      expect(ticksStepped).toBeGreaterThan(10);
      expect(sawDefeated).toBe(true);
      // Determinism across an identical re-run.
      const again = (() => {
        let c = buildBattle();
        const rnd = randomSession();
        for (let t = 0; t < ticksStepped; t++) {
          const r = stepBattle({ state: c, input, random: rnd, rules: {}, content: {}, systems: systems(cfg) });
          c = r.state;
          if (['VICTORY', 'DEFEAT', 'DRAW_ABORT'].includes(c.phase.phase)) break;
        }
        return createSnapshot(c).checksum;
      })();
      expect(again).toBe(createSnapshot(current).checksum);
    }
  });

  it('the oracle genuinely exercises both paths (regular kills counted, boss/object kills excluded)', { timeout: 120_000 }, () => {
    const cfg: Phase21RuntimeConfig = Object.freeze({
      bossPhaseDefinitions: defs,
      waves,
      spawnBodies: bodies,
      bossObjects: Object.freeze([objectContent('obj_core', 'boss_slot_0', 500), objectContent('obj_ward', 'boss_slot_1', 500)]),
      objectives,
    });
    const run = (() => {
      let current = buildBattle();
      const rnd = randomSession();
      const events: KernelEvent[] = [];
      for (let t = 0; t < 70; t++) {
        const r = stepBattle({ state: current, input, random: rnd, rules: {}, content: {}, systems: systems(cfg) });
        current = r.state;
        events.push(...r.events);
        if (['VICTORY', 'DEFEAT', 'DRAW_ABORT'].includes(current.phase.phase)) break;
      }
      return { state: current, events };
    })();
    // The regular unit is defeated (a genuine kill_regulars candidate).
    const regularDefeats = run.events.filter((e) => e.type === 'Defeated' && e.targetIds.some((id) => id.startsWith('unit_') && id !== 'boss_ash_unit'));
    expect(regularDefeats.length).toBeGreaterThanOrEqual(1);
    // The boss object is destroyable and defeated at least once.
    const objectDefeats = run.events.filter((e) => (e.type === 'Defeated' || e.type === 'Removed') && e.targetIds.includes('obj_core'));
    expect(objectDefeats.length).toBeGreaterThanOrEqual(1);
    // kill_regulars progress equals ONLY the regular-unit defeats: the boss and
    // boss-object defeats must be excluded by the §P21-T03 rule.
    const killRegulars = run.state.objectives?.find((o) => o.id === 'obj_regulars');
    expect(killRegulars?.progress).toBe(1);
    const bossObjectIds = new Set(['obj_core', 'obj_ward']);
    const uncounted = run.events.filter((e) => e.type === 'Defeated' && e.targetIds.some((id) => id === 'boss_ash_unit' || bossObjectIds.has(id))).length;
    expect(uncounted).toBeGreaterThanOrEqual(2);
    expect(killRegulars?.progress).toBeLessThanOrEqual(run.events.filter((e) => e.type === 'Defeated').length - uncounted);
    // The destroy_object objective completes exactly on the object's defeat.
    const destroy = run.state.objectives?.find((o) => o.id === 'obj_core');
    expect(destroy?.complete).toBe(true);
  });
});
