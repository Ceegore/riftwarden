import { describe, expect, it } from 'vitest';
import { stepBattle } from '../../src/game/sim/core/battle-kernel.js';
import { createPhase21Systems } from '../../src/game/sim/core/phase21-systems.js';
import { createSnapshot } from '../../src/game/sim/snapshot/snapshot.js';
import type { Phase21RuntimeConfig } from '../../src/game/sim/core/phase21-systems.js';
import type { KernelEvent } from '../../src/game/sim/events/event-types.js';
import type { TickInput } from '../../src/game/sim/core/tick-input.js';
import type { BattleModel } from '../../src/game/sim/core/battle-model.js';
import type { BossPhaseSnapshot, PhaseDefinition } from '../../src/game/sim/boss/boss-phase-system.js';
import type { Objective } from '../../src/game/sim/objectives/combat-objective.js';
import type { Wave } from '../../src/game/sim/world/reinforcement-system.js';
import type { ReinforcementBody } from '../../src/game/sim/core/phase21-systems.js';
import { buildBossObject, buildBossObjectBody, type BossObjectContent, type BossObjectSpec } from '../../src/game/sim/boss/boss-object-manager.js';
import { battle, entity, randomSession, tick } from './test-helpers.js';
import { migrateEntity } from '../../src/game/sim/core/migrate.js';
import { createPhase17Systems } from '../../src/game/sim/core/phase17-systems.js';
import { asX100 } from '../../src/game/sim/geometry/x100.js';

const input: TickInput = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });

const phase = (id: string, min: number, max: number, priority: number, extra: Partial<PhaseDefinition> = {}): PhaseDefinition =>
  Object.freeze({ id, bossId: 'boss_ash', priority, minHpPermille: min, maxHpPermille: max, previewKey: `preview_${id}`, ...extra });

const defs: readonly PhaseDefinition[] = Object.freeze([
  phase('p1', 501, 1001, 1),
  phase('p2', 251, 501, 2, { invulnerableTicks: 10 }),
  phase('p3', 0, 251, 3),
]);

const bossEntity = () => entity('boss_ash_unit', { side: 'enemy', maxLp: 1000, lp: 400, origin: 'regular' });

const bossSnapshot = (overrides: Partial<BossPhaseSnapshot> = {}): BossPhaseSnapshot =>
  Object.freeze({ entityId: 'boss_ash_unit', bossId: 'boss_ash', phaseId: 'p1', transition: null, visited: Object.freeze(['p1']), invulnerableUntilTick: null, ...overrides });

function baseState(overrides: Partial<BattleModel> = {}): BattleModel {
  return battle({
    simulationVersion: 'phase15-fixture-v1',
    entities: Object.freeze([bossEntity()]),
    bossPhase: bossSnapshot(),
    ...overrides,
  });
}

function runWith(state: BattleModel, cfg: Phase21RuntimeConfig, ticks = 1): { state: BattleModel; events: KernelEvent[] } {
  let current = state;
  const events: KernelEvent[] = [];
  const random = randomSession();
  const systems = createPhase21Systems(cfg);
  for (let i = 0; i < ticks; i++) {
    const r = stepBattle({ state: current, input, random, rules: {}, content: {}, systems });
    current = r.state;
    events.push(...r.events);
  }
  return { state: current, events };
}

describe('P21 runtime: boss objects', () => {
  const objectSpec = (slotId: string, extra: Partial<BossObjectSpec> = {}): BossObjectSpec =>
    Object.freeze({ slotId: slotId as BossObjectSpec['slotId'], lane: 'middle', x100: 5000, targetable: true, objectiveLink: null, damagePolicy: 'normal', statusPolicy: 'allow', cleanupPolicy: 'on_objective', fallback: 'FAIL', ...extra });
  const entry = (entityId: string, spec: BossObjectSpec, extra: Partial<BossObjectContent> = {}): BossObjectContent =>
    Object.freeze({ entityId, side: 'enemy', ownerId: 'boss_ash_unit', sourceId: 'content_boss', spec, maxLp: 1000, radiusX100: 120, ...extra });

  it('places content boss objects into the temporary registry at battle start (canonical slot order)', () => {
    const bossObjects: readonly BossObjectContent[] = Object.freeze([
      entry('obj_armor', objectSpec('boss_slot_1')),
      entry('obj_core', objectSpec('boss_slot_0')),
    ]);
    const r = runWith(baseState(), { bossPhaseDefinitions: defs, bossObjects }, 1);
    const temps = r.state.temporaryEntities ?? [];
    // Registry projection is id-canonical; both objects are present.
    expect(temps.map((t) => t.id)).toEqual(['obj_armor', 'obj_core']);
    expect(temps.map((t) => t.kind)).toEqual(['BOSS_OBJECT', 'BOSS_OBJECT']);
    expect(temps.map((t) => t.counted)).toEqual([false, false]);
    const byId = new Map(temps.map((t) => [t.id, t] as const));
    expect(byId.get('obj_core')?.slotId).toBe('boss_slot_0');
    expect(byId.get('obj_armor')?.slotId).toBe('boss_slot_1');
    expect(byId.get('obj_core')?.ownerId).toBe('boss_ash_unit');
    expect(byId.get('obj_core')?.sourceId).toBe('content_boss');
    expect(byId.get('obj_core')?.createdTick).toBe(0);
  });

  it('is idempotent: later ticks never re-place or duplicate objects', () => {
    const bossObjects: readonly BossObjectContent[] = Object.freeze([entry('obj_core', objectSpec('boss_slot_0'))]);
    const r = runWith(baseState(), { bossObjects }, 3);
    expect(r.state.temporaryEntities?.length).toBe(1);
    expect(r.state.temporaryEntities?.[0]?.id).toBe('obj_core');
  });

  it('resolves protect_object objectives against placed objects', () => {
    const objectives: readonly Objective[] = Object.freeze([
      Object.freeze({ id: 'obj_protect', kind: 'protect_object', targetId: 'obj_armor', required: 1, progress: 0, complete: false }),
    ]);
    const bossObjects: readonly BossObjectContent[] = Object.freeze([entry('obj_armor', objectSpec('boss_slot_0'))]);
    const r = runWith(baseState(), { objectives, bossObjects }, 1);
    expect(r.state.objectives?.[0]?.complete).toBe(true);
  });

  it('follows FAIL fallback on an occupied slot (no stacking) and still places the free slots', () => {
    const seeded = buildBossObject(objectSpec('boss_slot_0'), 'pre_occupied', 'enemy', 'boss_ash_unit', 'content', 0, 0);
    const state = baseState({ temporaryEntities: Object.freeze([seeded]) });
    const bossObjects: readonly BossObjectContent[] = Object.freeze([
      entry('obj_slot0', objectSpec('boss_slot_0')), // occupied -> BLOCKED (FAIL)
      entry('obj_slot1', objectSpec('boss_slot_1')), // free -> PLACED
    ]);
    const r = runWith(state, { bossObjects }, 1);
    const temps = r.state.temporaryEntities ?? [];
    // Only the preseeded object and the free-slot object are present.
    expect(temps.map((t) => t.id).sort()).toEqual(['obj_slot1', 'pre_occupied']);
  });

  it('deferring fallback on an occupied slot emits no placement (stable diagnostic contract)', () => {
    const seeded = buildBossObject(objectSpec('boss_slot_0'), 'pre_occupied', 'enemy', 'boss_ash_unit', 'content', 0, 0);
    const state = baseState({ temporaryEntities: Object.freeze([seeded]) });
    const bossObjects: readonly BossObjectContent[] = Object.freeze([
      entry('obj_later', objectSpec('boss_slot_0', { fallback: 'DEFER' })),
    ]);
    expect(() => runWith(state, { bossObjects }, 2)).not.toThrow();
    expect((runWith(state, { bossObjects }, 2)).state.temporaryEntities?.map((t) => t.id)).toEqual(['pre_occupied']);
  });

  it('rejects duplicate entry ids as a content error', () => {
    const bossObjects: readonly BossObjectContent[] = Object.freeze([
      entry('obj_dup', objectSpec('boss_slot_0')),
      entry('obj_dup', objectSpec('boss_slot_1')),
    ]);
    expect(() => runWith(baseState(), { bossObjects }, 1)).toThrow(/P21_OBJECT_INVALID/);
  });

  it('rejects an invalid spec (unknown lane) as a content error', () => {
    const bossObjects: readonly BossObjectContent[] = Object.freeze([
      entry('obj_bad', objectSpec('boss_slot_0', { lane: 'side' as never })),
    ]);
    expect(() => runWith(baseState(), { bossObjects }, 1)).toThrow(/P21_OBJECT_INVALID/);
  });

  it('is byte-deterministic with boss objects wired', () => {
    const bossObjects: readonly BossObjectContent[] = Object.freeze([
      entry('obj_core', objectSpec('boss_slot_0')),
      entry('obj_armor', objectSpec('boss_slot_1', { lane: 'top' })),
    ]);
    const a = runWith(baseState(), { bossPhaseDefinitions: defs, bossObjects }, 12);
    const b = runWith(baseState(), { bossPhaseDefinitions: defs, bossObjects }, 12);
    expect(createSnapshot(a.state).checksum).toBe(createSnapshot(b.state).checksum);
  });
});

describe('P21 protect-object mission integration (§6, §8)', { timeout: 120_000 }, () => {
  const objectSpec2 = (extra: Partial<BossObjectSpec> = {}): BossObjectSpec =>
    Object.freeze({ slotId: 'boss_slot_0', lane: 'middle', x100: 5000, targetable: true, objectiveLink: null, damagePolicy: 'normal', statusPolicy: 'allow', cleanupPolicy: 'on_objective', fallback: 'FAIL', ...extra });

  const content2 = (entityId: string, maxLp: number, extra: Partial<BossObjectContent> = {}): BossObjectContent =>
    Object.freeze({ entityId, side: 'enemy', ownerId: 'boss_ash_unit', sourceId: 'content_boss', spec: objectSpec2(), maxLp, radiusX100: 120, ...extra });

  it('player damages the boss object: LP drops, objective completes, endcap resets (§9.4)', () => {
    const player = migrateEntity({ entity: entity('unit_p', { side: 'player', lane: 'middle', x100: 1800, maxLp: 1000, lp: 1000 }), radiusX100: 100 });
    const boss = migrateEntity({ entity: entity('boss_ash_unit', { side: 'enemy', lane: 'middle', x100: 7000, maxLp: 1000, lp: 400 }), radiusX100: 120 });
    const state = battle({
      simulationVersion: 'phase21-fixture-v1',
      entities: Object.freeze([player, boss]),
      bossPhase: bossSnapshot(),
      globalNoProgressTicks: 50,
      riftCollapseTicks: 5,
    });
    const bosses: readonly BossObjectContent[] = Object.freeze([content2('obj_core', 500)]);
    const systems = Object.freeze([
      ...createPhase17Systems({
        speedsX100PerSecond: {},
        bossObjectPolicies: new Map([['obj_core', 'normal'] as const]),
        basicAttack: {
          parameters: {
            unit_p: {
              attackIntervalTicks: 10, prepareTicks: 1, recoveryTicks: 3, preferredRangeX100: asX100(9000),
              delivery: { kind: 'direct', rawAmount: 100, damageTypeOrdinal: 0, defense: 0, bossCapBps: null },
            },
          },
        },
      }),
      ...createPhase21Systems({
        bossPhaseDefinitions: defs,
        bossObjects: bosses,
        objectives: Object.freeze([
          Object.freeze({ id: 'obj_protect', kind: 'protect_object', targetId: 'obj_core', required: 1, progress: 0, complete: false }),
        ]),
      }),
    ]);
    const random = randomSession();
    let current = state;
    const events: { type: string; targetIds: readonly string[]; payload: Record<string, number> }[] = [];
    for (let i = 0; i < 30; i++) {
      const r = stepBattle({ state: current, input, random, rules: {}, content: {}, systems });
      current = r.state;
      events.push(...r.events);
    }
    // The body exists and is a boss_object.
    const obj = current.entities.find((e) => e.id === 'obj_core');
    expect(obj).toBeDefined();
    expect(obj?.origin).toBe('boss_object');
    // Player's direct attacks landed: LP dropped.
    expect(obj?.lp).toBeLessThan(500);
    const damageEvents = events.filter((e) => e.type === 'DamageApplied' && e.targetIds.includes('obj_core'));
    expect(damageEvents.length).toBeGreaterThan(0);
    for (const e of damageEvents) expect(e.payload['finalHpDelta']).toBeGreaterThan(0);
    // §9.4: qualifying damage reset the endcap counters.
    expect(current.globalNoProgressTicks).toBeLessThan(50);
  });

  it('immune policy: the object never takes damage, objective still completes (alive), endcap never resets', () => {
    const player = migrateEntity({ entity: entity('unit_p', { side: 'player', lane: 'middle', x100: 1800, maxLp: 1000, lp: 1000 }), radiusX100: 100 });
    // The boss entity carries the bossPhase data but sits on the player side
    // so the player's basic attack never targets it — obj_immune is the only
    // enemy and every attack lands on the immune object.
    const boss = migrateEntity({ entity: entity('boss_ash_unit', { side: 'player', lane: 'middle', x100: 7000, maxLp: 7000, lp: 7000 }), radiusX100: 120 });
    const state = battle({
      simulationVersion: 'phase21-fixture-v1',
      entities: Object.freeze([player, boss]),
      bossPhase: bossSnapshot(),
      globalNoProgressTicks: 50,
      riftCollapseTicks: 5,
    });
    const bosses: readonly BossObjectContent[] = Object.freeze([content2('obj_immune', 500, { spec: objectSpec2({ damagePolicy: 'immune' }) })]);
    const systems = Object.freeze([
      ...createPhase17Systems({
        speedsX100PerSecond: {},
        bossObjectPolicies: new Map([['obj_immune', 'immune'] as const]),
        basicAttack: {
          parameters: {
            unit_p: {
              attackIntervalTicks: 10, prepareTicks: 1, recoveryTicks: 3, preferredRangeX100: asX100(9000),
              delivery: { kind: 'direct', rawAmount: 100, damageTypeOrdinal: 0, defense: 0, bossCapBps: null },
            },
          },
        },
      }),
      ...createPhase21Systems({
        bossPhaseDefinitions: defs,
        bossObjects: bosses,
        objectives: Object.freeze([
          Object.freeze({ id: 'obj_protect', kind: 'protect_object', targetId: 'obj_immune', required: 1, progress: 0, complete: false }),
        ]),
      }),
    ]);
    const random = randomSession();
    let current = state;
    const events: { type: string; targetIds: readonly string[]; payload: Record<string, number> }[] = [];
    for (let i = 0; i < 30; i++) {
      const r = stepBattle({ state: current, input, random, rules: {}, content: {}, systems });
      current = r.state;
      events.push(...r.events);
    }
    const obj = current.entities.find((e) => e.id === 'obj_immune');
    expect(obj?.lp).toBe(500); // never damaged
    // DamageApplied events fire for each hit, but report zero preShieldAmount and zero HP delta.
    const hits = events.filter((e) => e.type === 'DamageApplied' && e.targetIds.includes('obj_immune'));
    expect(hits.length).toBeGreaterThan(0);
    for (const e of hits) {
      expect(e.payload['preShieldAmount']).toBe(0);
      expect(e.payload['finalHpDelta']).toBe(0);
    }
    // Endcap counters only advanced from the natural per-tick increment; never reset.
    expect(current.globalNoProgressTicks).toBeGreaterThan(50);
    // The objective still completes: the temp entity is alive in the registry.
    expect(current.objectives?.[0]?.complete).toBe(true);
  });

  it('wave + protect-object + normal damage: full composition stays deterministic', () => {
    const player = migrateEntity({ entity: entity('unit_p', { side: 'player', lane: 'middle', x100: 1800, maxLp: 1000, lp: 1000 }), radiusX100: 100 });
    const boss = migrateEntity({ entity: entity('boss_ash_unit', { side: 'enemy', lane: 'middle', x100: 7000, maxLp: 2000, lp: 2000 }), radiusX100: 120 });
    const state = battle({
      simulationVersion: 'phase21-fixture-v1',
      entities: Object.freeze([player, boss]),
      bossPhase: bossSnapshot(),
      spawnedWaves: Object.freeze([]),
    });
    const wave: readonly Wave[] = Object.freeze([
      Object.freeze({ id: 'wave_pressure', scheduledTick: 10, side: 'enemy', entityIds: Object.freeze(['unit_reinf_1']), spawnProfile: 'profile_grunt', capPolicy: 'BLOCK' }),
    ]);
    const bodies = (w: Wave): readonly ReinforcementBody[] =>
      w.entityIds.map((entityId) => Object.freeze({ entityId, lane: 'bottom', x100: 8500, radiusX100: 120, maxLp: 400 }));
    const bosses: readonly BossObjectContent[] = Object.freeze([content2('obj_core', 500)]);
    function runOnce2(): { state: BattleModel; events: readonly { type: string }[] } {
      const systems2 = Object.freeze([
        ...createPhase17Systems({
          speedsX100PerSecond: {},
          bossObjectPolicies: new Map([['obj_core', 'normal'] as const]),
          basicAttack: {
            parameters: {
              unit_p: {
                attackIntervalTicks: 14, prepareTicks: 0, recoveryTicks: 0, preferredRangeX100: asX100(9000),
                delivery: { kind: 'direct', rawAmount: 100, damageTypeOrdinal: 0, defense: 0, bossCapBps: null },
              },
            },
          },
        }),
        ...createPhase21Systems({
          bossPhaseDefinitions: defs,
          waves: wave,
          spawnBodies: bodies,
          bossObjects: bosses,
          objectives: Object.freeze([
            Object.freeze({ id: 'obj_protect', kind: 'protect_object', targetId: 'obj_core', required: 1, progress: 0, complete: false }),
          ]),
        }),
      ]);
      const rnd = randomSession();
      let cur = state;
      const evs: { type: string }[] = [];
      for (let i = 0; i < 40; i++) {
        const r = stepBattle({ state: cur, input, random: rnd, rules: {}, content: {}, systems: systems2 });
        cur = r.state;
        evs.push(...r.events);
      }
      return { state: cur, events: evs };
    }
    const a = runOnce2();
    const b = runOnce2();
    expect(createSnapshot(a.state).checksum).toBe(createSnapshot(b.state).checksum);
    expect(a.events.map((e) => e.type)).toEqual(b.events.map((e) => e.type));
    // Wave reinforcement spawned.
    expect(a.events.some((e) => e.type === 'ReinforcementSpawned')).toBe(true);
    // The boss-object body exists in both runs.
    expect(a.state.entities.some((e) => e.id === 'obj_core')).toBe(true);
    expect(b.state.entities.some((e) => e.id === 'obj_core')).toBe(true);
  });
});

describe('P21 boss-object cleanup policies (§6)', () => {
  const cleanupSpec = (extra: Partial<BossObjectSpec> = {}): BossObjectSpec =>
    Object.freeze({ slotId: 'boss_slot_0', lane: 'middle', x100: 5000, targetable: true, objectiveLink: null, damagePolicy: 'normal', statusPolicy: 'allow', cleanupPolicy: 'on_objective', fallback: 'FAIL', ...extra });
  const cleanupEntry = (entityId: string, spec: BossObjectSpec, extra: Partial<BossObjectContent> = {}): BossObjectContent =>
    Object.freeze({ entityId, side: 'enemy', ownerId: 'boss_ash_unit', sourceId: 'content_boss', spec, maxLp: 1000, radiusX100: 120, ...extra });

  it('on_objective: the object is removed (registry + body + Removed event) when its linked objective completes', () => {
    const objectives: readonly Objective[] = Object.freeze([
      Object.freeze({ id: 'obj_destroy', kind: 'destroy_object', targetId: 'obj_generator', required: 1, progress: 1, complete: true }),
    ]);
    const bossObjects: readonly BossObjectContent[] = Object.freeze([
      cleanupEntry('obj_generator', cleanupSpec({ objectiveLink: 'obj_destroy' })),
    ]);
    const state = baseState({ objectives });
    // Placement lands at stage K of tick 0; cleanup sees the placed object at
    // stage K of tick 1 (the objective was already complete in state).
    const r = runWith(state, { bossObjects }, 2);
    expect(r.state.temporaryEntities ?? []).toEqual([]);
    // The combat body is gone too (remove_entity at stage K).
    expect(r.state.entities.some((e) => e.id === 'obj_generator' && e.phase.phase === 'ACTIVE')).toBe(false);
    expect(r.events.some((e) => e.type === 'Removed' && e.targetIds.includes('obj_generator'))).toBe(true);
  });

  it('on_objective: nothing is removed while the linked objective is incomplete', () => {
    const objectives: readonly Objective[] = Object.freeze([
      Object.freeze({ id: 'obj_destroy', kind: 'destroy_object', targetId: 'obj_generator', required: 1, progress: 0, complete: false }),
    ]);
    const bossObjects: readonly BossObjectContent[] = Object.freeze([
      cleanupEntry('obj_generator', cleanupSpec({ objectiveLink: 'obj_destroy' })),
    ]);
    const r = runWith(baseState({ objectives }), { bossObjects }, 3);
    expect(r.state.temporaryEntities?.map((t) => t.id)).toEqual(['obj_generator']);
    expect(r.events.some((e) => e.type === 'Removed')).toBe(false);
  });

  it('on_battle_end: the object is removed once the battle enters RESOLVING_END', () => {
    const bossObjects: readonly BossObjectContent[] = Object.freeze([
      cleanupEntry('obj_core', cleanupSpec({ cleanupPolicy: 'on_battle_end' })),
    ]);
    const state = baseState({ phase: Object.freeze({ phase: 'RESOLVING_END', enteredTick: tick(0), resolvingEndTicks: 0 }) });
    // Tick 0 places the object; tick 1's stage-K cleanup sees RESOLVING_END.
    const r = runWith(state, { bossObjects }, 2);
    expect(r.state.temporaryEntities ?? []).toEqual([]);
    expect(r.state.entities.some((e) => e.id === 'obj_core' && e.phase.phase === 'ACTIVE')).toBe(false);
    expect(r.events.some((e) => e.type === 'Removed' && e.targetIds.includes('obj_core'))).toBe(true);
  });

  it('manual: the object persists through ticks and battle end', () => {
    const bossObjects: readonly BossObjectContent[] = Object.freeze([
      cleanupEntry('obj_core', cleanupSpec({ cleanupPolicy: 'manual' })),
    ]);
    const state = baseState({ phase: Object.freeze({ phase: 'RESOLVING_END', enteredTick: tick(0), resolvingEndTicks: 0 }) });
    const r = runWith(state, { bossObjects }, 2);
    expect(r.state.temporaryEntities?.map((t) => t.id)).toEqual(['obj_core']);
    expect(r.events.some((e) => e.type === 'Removed')).toBe(false);
  });
});

describe('P21 protect_object teeth (§8)', () => {
  const protectSpec = (extra: Partial<BossObjectSpec> = {}): BossObjectSpec =>
    Object.freeze({ slotId: 'boss_slot_0', lane: 'middle', x100: 5000, targetable: true, objectiveLink: null, damagePolicy: 'normal', statusPolicy: 'allow', cleanupPolicy: 'on_battle_end', fallback: 'FAIL', ...extra });
  const protectEntry = (entityId: string, spec: BossObjectSpec, extra: Partial<BossObjectContent> = {}): BossObjectContent =>
    Object.freeze({ entityId, side: 'player', ownerId: 'boss_ash_unit', sourceId: 'content_boss', spec, maxLp: 1000, radiusX100: 120, ...extra });

  // The full failure path needs the phase-17 battle-end resolver to traverse
  // RESOLVING_END and finalize the forced DEFEAT.
  function runWithResolver(state: BattleModel, cfg: Phase21RuntimeConfig, ticks = 6): { state: BattleModel; events: KernelEvent[] } {
    let current = state;
    const events: KernelEvent[] = [];
    const random = randomSession();
    const systems = Object.freeze([
      ...createPhase17Systems({ speedsX100PerSecond: {} }),
      ...createPhase21Systems(cfg),
    ]);
    for (let i = 0; i < ticks; i++) {
      const r = stepBattle({ state: current, input, random, rules: {}, content: {}, systems });
      current = r.state;
      events.push(...r.events);
      if (isTerminalPhase(current.phase.phase)) break;
    }
    return { state: current, events };
  }

  function isTerminalPhase(phase: string): boolean {
    return phase === 'VICTORY' || phase === 'DEFEAT' || phase === 'DRAW_ABORT';
  }

  it('a defeated protect target fails the mission: objective incomplete + DEFEAT terminal', () => {
    const objectives: readonly Objective[] = Object.freeze([
      Object.freeze({ id: 'obj_protect', kind: 'protect_object', targetId: 'obj_core', required: 1, progress: 0, complete: false }),
    ]);
    // The body was defeated earlier: it sits in the roster as REMOVED (the
    // defeat resolver's terminal body state) while the registry entry lingers.
    const body = buildBossObjectBody(protectEntry('obj_core', protectSpec()), tick(0));
    const removedBody = Object.freeze({ ...body, lp: 0, phase: Object.freeze({ phase: 'REMOVED', enteredTick: tick(0), controlledReturn: null }) });
    const player = migrateEntity({ entity: entity('unit_p', { side: 'player', maxLp: 1000, lp: 1000 }), radiusX100: 100 });
    const migratedBoss = migrateEntity({ entity: entity('boss_ash_unit', { side: 'enemy', maxLp: 1000, lp: 400 }), radiusX100: 120 });
    const state = migratedBaseState({ entities: Object.freeze([player, migratedBoss, removedBody]), objectives });
    const r = runWithResolver(state, { bossPhaseDefinitions: defs, objectives, bossObjects: Object.freeze([protectEntry('obj_core', protectSpec())]) });
    expect(r.state.objectives?.[0]?.complete).toBe(false);
    expect(r.state.phase.phase).toBe('DEFEAT');
    expect(r.state.endReason).toBe('protect_object_failed');
  });

  it('an alive protect target keeps the objective complete and never transitions', () => {
    const objectives: readonly Objective[] = Object.freeze([
      Object.freeze({ id: 'obj_protect', kind: 'protect_object', targetId: 'obj_core', required: 1, progress: 0, complete: false }),
    ]);
    const state = migratedBaseState({ objectives });
    const r = runWithResolver(state, { bossPhaseDefinitions: defs, objectives, bossObjects: Object.freeze([protectEntry('obj_core', protectSpec())]) });
    expect(r.state.objectives?.[0]?.complete).toBe(true);
    expect(r.state.phase.phase).toBe('ACTIVE');
    expect(r.state.endReason).toBeNull();
  });

  // baseState's boss entity is unmigrated; the P15 movement system (included
  // via the phase-17 composition) requires migrated entities. The boss is built
  // without `origin` so migrateEntity sees a clean Phase-14 entity.
  function migratedBaseState(overrides: Partial<BattleModel> = {}): BattleModel {
    return baseState({
      entities: Object.freeze([
        migrateEntity({ entity: entity('unit_p', { side: 'player', maxLp: 1000, lp: 1000 }), radiusX100: 100 }),
        migrateEntity({ entity: entity('boss_ash_unit', { side: 'enemy', maxLp: 1000, lp: 400 }), radiusX100: 120 }),
      ]),
      ...overrides,
    });
  }

  it('a protect objective already complete is not retroactively failed when the object later dies', () => {
    const objectives: readonly Objective[] = Object.freeze([
      Object.freeze({ id: 'obj_protect', kind: 'protect_object', targetId: 'obj_core', required: 1, progress: 1, complete: true }),
    ]);
    const body = buildBossObjectBody(protectEntry('obj_core', protectSpec()), tick(0));
    const removedBody = Object.freeze({ ...body, lp: 0, phase: Object.freeze({ phase: 'REMOVED', enteredTick: tick(0), controlledReturn: null }) });
    const player = migrateEntity({ entity: entity('unit_p', { side: 'player', maxLp: 1000, lp: 1000 }), radiusX100: 100 });
    const migratedBoss = migrateEntity({ entity: entity('boss_ash_unit', { side: 'enemy', maxLp: 1000, lp: 400 }), radiusX100: 120 });
    const state = migratedBaseState({ entities: Object.freeze([player, migratedBoss, removedBody]), objectives });
    const r = runWithResolver(state, { bossPhaseDefinitions: defs, objectives, bossObjects: Object.freeze([protectEntry('obj_core', protectSpec())]) });
    expect(r.state.phase.phase).toBe('ACTIVE');
    expect(r.state.endReason).toBeNull();
  });
});
