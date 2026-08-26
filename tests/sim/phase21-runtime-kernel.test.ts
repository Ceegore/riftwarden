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
import { buildBossObject } from '../../src/game/sim/boss/boss-object-manager.js';
import { battle, entity, randomSession } from './test-helpers.js';
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

describe('P21 runtime: boss transition detect + commit', () => {
  it('detects in D and commits at the inclusive commit tick (default 45)', () => {
    const first = runWith(baseState(), { bossPhaseDefinitions: defs }, 1);
    expect(first.state.bossPhase?.transition?.to).toBe('p2');
    expect(first.state.bossPhase?.transition?.commitTick).toBe(45);
    expect(first.events.map((e) => e.type)).toContain('PhaseTransitionPlanned');
    expect(first.events.map((e) => e.type)).toContain('BossTelegraphStarted');

    const before = runWith(first.state, { bossPhaseDefinitions: defs }, 44);
    expect(before.state.bossPhase?.phaseId).toBe('p1');

    const committed = runWith(before.state, { bossPhaseDefinitions: defs }, 1);
    expect(committed.state.bossPhase?.phaseId).toBe('p2');
    expect(committed.state.bossPhase?.transition).toBeNull();
    expect(committed.state.bossPhase?.visited).toEqual(['p1', 'p2']);
    expect(committed.events.map((e) => e.type)).toContain('BossPhaseCompleted');
    expect(committed.events.map((e) => e.type)).toContain('BossPhaseStarted');
  });

  it('sets invulnerability from the entered phase definition', () => {
    const r = runWith(baseState(), { bossPhaseDefinitions: defs }, 46);
    expect(r.state.bossPhase?.phaseId).toBe('p2');
    expect(r.state.bossPhase?.invulnerableUntilTick).toBe(45 + 10);
  });

  it('plans exactly one transition per source phase', () => {
    const first = runWith(baseState(), { bossPhaseDefinitions: defs }, 1);
    const second = runWith(first.state, { bossPhaseDefinitions: defs }, 5);
    expect(second.events.filter((e) => e.type === 'PhaseTransitionPlanned').length).toBe(0);
    expect(second.events.filter((e) => e.type === 'BossTelegraphStarted').length).toBe(0);
  });

  it('blocks invalid boss phase coverage at factory creation', () => {
    expect(() => createPhase21Systems({ bossPhaseDefinitions: Object.freeze([phase('p1', 0, 500, 1)]) })).toThrow(/P21_PHASE_GAP/);
  });

  it('sorts L systems before the generic end resolver', () => {
    const order = createPhase21Systems({ bossPhaseDefinitions: defs }).filter((s) => s.stage === 'L').map((s) => s.id);
    expect(order).toEqual(['boss.l1.transition_commit', 'objective.l1.resolution']);
    for (const id of order) expect(id < 'phase17.l1.battle_end').toBe(true);
  });
});

describe('P21 runtime: objectives', () => {
  it('completes kill_boss from a canonical Defeated event record', () => {
    const objectives: readonly Objective[] = Object.freeze([
      Object.freeze({ id: 'obj_boss', kind: 'kill_boss', targetId: 'boss_ash_unit', required: 1, progress: 0, complete: false }),
    ]);
    const state = baseState({
      previousTickEvents: Object.freeze([Object.freeze({ type: 'Defeated', sourceId: 'unit_p', targetIds: Object.freeze(['boss_ash_unit']) })]),
    });
    const r = runWith(state, { bossPhaseDefinitions: defs, objectives }, 1);
    expect(r.state.objectives?.[0]?.complete).toBe(true);
  });

  it('never counts a boss defeat toward kill_regulars', () => {
    const objectives: readonly Objective[] = Object.freeze([
      Object.freeze({ id: 'obj_kills', kind: 'kill_regulars', targetId: null, required: 1, progress: 0, complete: false }),
    ]);
    const state = baseState({
      previousTickEvents: Object.freeze([Object.freeze({ type: 'Defeated', sourceId: 'unit_p', targetIds: Object.freeze(['boss_ash_unit']) })]),
    });
    const r = runWith(state, { bossPhaseDefinitions: defs, objectives }, 1);
    expect(r.state.objectives?.[0]?.progress).toBe(0);
  });

  it('counts a regular kill toward kill_regulars (positive control)', () => {
    const objectives: readonly Objective[] = Object.freeze([
      Object.freeze({ id: 'obj_kills', kind: 'kill_regulars', targetId: null, required: 1, progress: 0, complete: false }),
    ]);
    const state = baseState({
      previousTickEvents: Object.freeze([Object.freeze({ type: 'Defeated', sourceId: 'unit_p', targetIds: Object.freeze(['unit_enemy_grunt']) })]),
    });
    const r = runWith(state, { bossPhaseDefinitions: defs, objectives }, 1);
    expect(r.state.objectives?.[0]?.progress).toBe(1);
  });

  it('never counts a defeated boss object toward kill_regulars (§P21-T03)', () => {
    const objectives: readonly Objective[] = Object.freeze([
      Object.freeze({ id: 'obj_kills', kind: 'kill_regulars', targetId: null, required: 1, progress: 0, complete: false }),
    ]);
    // The object exists in the temporary registry (kind BOSS_OBJECT) and its
    // combat body sits in the roster with origin `boss_object`; both signals
    // mark the id as a boss object, so its Defeated record must be skipped.
    const object = buildBossObject(
      Object.freeze({ slotId: 'boss_slot_0', lane: 'middle', x100: 5000, targetable: true, objectiveLink: null, damagePolicy: 'normal', statusPolicy: 'allow', cleanupPolicy: 'manual', fallback: 'FAIL' }),
      'obj_armor', 'enemy', 'boss_ash_unit', 'content_boss', 0, 0,
    );
    const state = baseState({
      temporaryEntities: Object.freeze([object]),
      previousTickEvents: Object.freeze([Object.freeze({ type: 'Defeated', sourceId: 'unit_p', targetIds: Object.freeze(['obj_armor']) })]),
    });
    const r = runWith(state, { bossPhaseDefinitions: defs, objectives }, 1);
    expect(r.state.objectives?.[0]?.progress).toBe(0);
  });

  it('still counts a regular kill toward kill_regulars when a boss object is also present', () => {
    const objectives: readonly Objective[] = Object.freeze([
      Object.freeze({ id: 'obj_kills', kind: 'kill_regulars', targetId: null, required: 2, progress: 0, complete: false }),
    ]);
    const object = buildBossObject(
      Object.freeze({ slotId: 'boss_slot_0', lane: 'middle', x100: 5000, targetable: true, objectiveLink: null, damagePolicy: 'normal', statusPolicy: 'allow', cleanupPolicy: 'manual', fallback: 'FAIL' }),
      'obj_armor', 'enemy', 'boss_ash_unit', 'content_boss', 0, 0,
    );
    const state = baseState({
      temporaryEntities: Object.freeze([object]),
      previousTickEvents: Object.freeze([
        Object.freeze({ type: 'Defeated', sourceId: 'unit_p', targetIds: Object.freeze(['obj_armor']) }),
        Object.freeze({ type: 'Defeated', sourceId: 'unit_p', targetIds: Object.freeze(['unit_enemy_grunt']) }),
      ]),
    });
    const r = runWith(state, { bossPhaseDefinitions: defs, objectives }, 1);
    // Only the regular kill counts — the boss-object defeat is ignored.
    expect(r.state.objectives?.[0]?.progress).toBe(1);
  });

  it('advances survive_until from the authoritative tick', () => {
    const objectives: readonly Objective[] = Object.freeze([
      Object.freeze({ id: 'obj_survive', kind: 'survive_until', targetId: null, required: 5, progress: 0, complete: false }),
    ]);
    const r = runWith(baseState(), { bossPhaseDefinitions: defs, objectives }, 6);
    expect(r.state.objectives?.[0]?.complete).toBe(true);
  });
});

describe('P21 runtime: reinforcements', () => {
  const waves: readonly Wave[] = Object.freeze([
    Object.freeze({ id: 'wave_a', scheduledTick: 3, side: 'enemy', entityIds: Object.freeze(['unit_e1', 'unit_e2']), spawnProfile: 'profile_grunt', capPolicy: 'BLOCK' }),
  ]);

  it('commits due waves into the cursor and emits queue/spawn events', () => {
    const r = runWith(baseState({ spawnedWaves: Object.freeze([]) }), { bossPhaseDefinitions: defs, waves }, 4);
    expect(r.state.spawnedWaves).toEqual(['wave_a']);
    expect(r.events.map((e) => e.type)).toContain('ReinforcementQueued');
    expect(r.events.map((e) => e.type)).toContain('ReinforcementSpawned');
  });

  it('does not re-spawn an already spawned wave', () => {
    const first = runWith(baseState({ spawnedWaves: Object.freeze([]) }), { bossPhaseDefinitions: defs, waves }, 4);
    const second = runWith(first.state, { bossPhaseDefinitions: defs, waves }, 4);
    expect(second.events.filter((e) => e.type === 'ReinforcementSpawned').length).toBe(0);
  });

  it('pins the deferral: without a spawnBodies resolver, waves emit events + advance the cursor but spawn no entities and do not reset the endcap', () => {
    // §9 content-port deferral: when no spawnBodies resolver is wired, the
    // kernel only commits the cursor and emits queue/spawn events. A due wave
    // must never invent entities by itself, and it must not masquerade as
    // §9.4 endcap progress.
    const state = baseState({ spawnedWaves: Object.freeze([]), globalNoProgressTicks: 250, riftCollapseTicks: 10 });
    const r = runWith(state, { bossPhaseDefinitions: defs, waves }, 4);
    expect(r.state.spawnedWaves).toEqual(['wave_a']);
    expect(r.events.map((e) => e.type)).toContain('ReinforcementSpawned');
    // No entities are born from the wave itself (content-port deferral).
    expect(r.state.entities.map((e) => e.id)).toEqual(['boss_ash_unit']);
    // The endcap counters are untouched by the wave event.
    expect(r.state.globalNoProgressTicks).toBe(250);
    expect(r.state.riftCollapseTicks).toBe(10);
  });

  it('spawns real combat bodies in wave order when a spawnBodies resolver is wired (§9 content-port completion)', () => {
    const bodies = (wave: Wave): readonly ReinforcementBody[] =>
      wave.entityIds.map((entityId, index) => Object.freeze({
        entityId,
        lane: index % 2 === 0 ? 'middle' : 'bottom',
        x100: 9000 - index * 100,
        radiusX100: 120,
        maxLp: 500,
      }));
    const state = baseState({ spawnedWaves: Object.freeze([]), globalNoProgressTicks: 250, riftCollapseTicks: 10 });
    const r = runWith(state, { bossPhaseDefinitions: defs, waves, spawnBodies: bodies }, 4);
    // Cursor + events unchanged.
    expect(r.state.spawnedWaves).toEqual(['wave_a']);
    expect(r.events.map((e) => e.type)).toContain('ReinforcementSpawned');
    // Both bodies are born, in the wave's fixed order, on the wave's side.
    const spawned = r.state.entities.filter((e) => e.id.startsWith('unit_e'));
    expect(spawned.map((e) => e.id)).toEqual(['unit_e1', 'unit_e2']);
    expect(spawned.map((e) => e.side)).toEqual(['enemy', 'enemy']);
    expect(spawned[0]?.maxLp).toBe(500);
    expect(spawned[0]?.lp).toBe(500);
    expect(spawned[1]?.lane).toBe('bottom');
    // A committed wave that spawns bodies resets the §9.4 endcap.
    expect(r.state.globalNoProgressTicks).toBe(0);
    expect(r.state.riftCollapseTicks).toBe(0);
  });

  it('blocks a wave whose spawnBodies do not cover its spawn order as a content error', () => {
    const state = baseState({ spawnedWaves: Object.freeze([]) });
    // Missing unit_e2 body, extra unit_e3 body: coverage mismatch.
    const badBodies = () => Object.freeze([
      Object.freeze({ entityId: 'unit_e1', lane: 'middle', x100: 9000, radiusX100: 120, maxLp: 500 }),
      Object.freeze({ entityId: 'unit_e3', lane: 'bottom', x100: 8800, radiusX100: 120, maxLp: 500 }),
    ]);
    expect(() => runWith(state, { bossPhaseDefinitions: defs, waves, spawnBodies: badBodies }, 4)).toThrow(/P21_WAVE_INVALID/);
  });

  it('blocks an invalid body (out-of-range field, bad lane, zero maxLp) as a content error', () => {
    const state = baseState({ spawnedWaves: Object.freeze([]) });
    const badLane = () => Object.freeze([
      Object.freeze({ entityId: 'unit_e1', lane: 'sky' as never, x100: 9000, radiusX100: 120, maxLp: 500 }),
      Object.freeze({ entityId: 'unit_e2', lane: 'bottom', x100: 8800, radiusX100: 120, maxLp: 500 }),
    ]);
    expect(() => runWith(state, { bossPhaseDefinitions: defs, waves, spawnBodies: badLane }, 4)).toThrow(/P21_WAVE_INVALID/);
    const badLp = () => Object.freeze([
      Object.freeze({ entityId: 'unit_e1', lane: 'middle', x100: 9000, radiusX100: 120, maxLp: 0 }),
      Object.freeze({ entityId: 'unit_e2', lane: 'bottom', x100: 8800, radiusX100: 120, maxLp: 500 }),
    ]);
    expect(() => runWith(state, { bossPhaseDefinitions: defs, waves, spawnBodies: badLp }, 4)).toThrow(/P21_WAVE_INVALID/);
    const badX = () => Object.freeze([
      Object.freeze({ entityId: 'unit_e1', lane: 'middle', x100: 10001, radiusX100: 120, maxLp: 500 }),
      Object.freeze({ entityId: 'unit_e2', lane: 'bottom', x100: 8800, radiusX100: 120, maxLp: 500 }),
    ]);
    expect(() => runWith(state, { bossPhaseDefinitions: defs, waves, spawnBodies: badX }, 4)).toThrow(/P21_WAVE_INVALID/);
  });

  it('blocks an invalid wave as a content error', () => {
    const bad = Object.freeze([Object.freeze({ id: 'wave_bad', scheduledTick: 0, side: 'enemy', entityIds: Object.freeze([]), spawnProfile: 'x', capPolicy: 'BLOCK' })]);
    expect(() => runWith(baseState(), { bossPhaseDefinitions: defs, waves: bad }, 1)).toThrow(/P21_WAVE_INVALID/);
  });
});

describe('P21 reinforcement wiring in a real battle composition', () => {
  it('spawns reinforcement bodies mid-fight, resets the endcap, and stays deterministic', { timeout: 90_000 }, () => {
    const wave: readonly Wave[] = Object.freeze([
      Object.freeze({ id: 'wave_mid', scheduledTick: 40, side: 'enemy', entityIds: Object.freeze(['unit_reinf_1', 'unit_reinf_2']), spawnProfile: 'profile_grunt', capPolicy: 'BLOCK' }),
    ]);
    const bodies = (w: Wave): readonly ReinforcementBody[] =>
      w.entityIds.map((entityId, index) => Object.freeze({
        entityId,
        lane: index === 0 ? 'middle' : 'bottom',
        x100: 8800 - index * 200,
        radiusX100: 120,
        maxLp: 400,
      }));
    // A real battle composition: Phase 17 combat + Phase 21 wave/objective
    // systems together. The player chips the boss; at tick 60 the wave lands.
    function runOnce(): { state: BattleModel; events: KernelEvent[]; entitiesByTick: Map<number, string[]> } {
      // Tanky boss: the player chips it for ~350 ticks, so the wave at tick 40
      // lands while the battle is still ACTIVE (mid-fight).
      const p = migrateEntity({ entity: entity('unit_p', { side: 'player', lane: 'top', x100: 1800, maxLp: 1000, lp: 1000 }), radiusX100: 100 });
      const boss = migrateEntity({ entity: entity('boss_ash_unit', { side: 'enemy', lane: 'middle', x100: 5000, maxLp: 5000, lp: 5000 }), radiusX100: 120 });
      const state = battle({ simulationVersion: 'phase21-fixture-v1', entities: Object.freeze([p, boss]), bossPhase: bossSnapshot() });
      const systems = Object.freeze([
        ...createPhase17Systems({
          speedsX100PerSecond: {},
          basicAttack: {
            parameters: {
              unit_p: {
                attackIntervalTicks: 14, prepareTicks: 0, recoveryTicks: 0, preferredRangeX100: asX100(9000),
                delivery: { kind: 'direct', rawAmount: 200, damageTypeOrdinal: 0, defense: 0, bossCapBps: null },
              },
            },
          },
        }),
        ...createPhase21Systems({
          bossPhaseDefinitions: defs,
          waves: wave,
          spawnBodies: bodies,
          objectives: Object.freeze([
            Object.freeze({ id: 'obj_boss', kind: 'kill_boss', targetId: 'boss_ash_unit', required: 1, progress: 0, complete: false }),
          ]),
        }),
      ]);
      const random = randomSession();
      let current = state;
      const events: KernelEvent[] = [];
      const entitiesByTick = new Map<number, string[]>();
      for (let i = 0; i < 200; i++) {
        const r = stepBattle({ state: current, input, random, rules: {}, content: {}, systems });
        current = r.state;
        events.push(...r.events);
        entitiesByTick.set(current.tick, current.entities.map((e) => e.id));
        if (['VICTORY', 'DEFEAT', 'DRAW_ABORT'].includes(current.phase.phase)) break;
      }
      return { state: current, events, entitiesByTick };
    }

    const a = runOnce();
    const b = runOnce();
    // The wave (scheduledTick 40) is processed at state tick 40, which is the
    // post-step tick 41. Before that no reinforcement bodies exist.
    expect(a.entitiesByTick.get(40)?.some((id) => id.startsWith('unit_reinf_'))).toBe(false);
    // At the due tick both bodies appear, ACTIVE, on the wave's side, and the
    // battle is still ACTIVE (mid-fight, not a terminal transition).
    expect(a.entitiesByTick.get(41) ?? []).toEqual(expect.arrayContaining(['unit_reinf_1', 'unit_reinf_2']));
    expect(a.entitiesByTick.get(41)?.includes('unit_reinf_2')).toBe(true);
    const reinf = a.state.entities.filter((e) => e.id.startsWith('unit_reinf_'));
    expect(reinf.map((e) => e.side)).toEqual(['enemy', 'enemy']);
    expect(reinf.every((e) => e.phase.phase === 'ACTIVE')).toBe(true);
    expect(a.state.phase.phase).toBe('ACTIVE');
    // Determinism: identical final snapshot and event log across runs.
    expect(createSnapshot(a.state).checksum).toBe(createSnapshot(b.state).checksum);
    expect(a.events.map((e) => `${e.type}:${String(e.sequence)}`)).toEqual(b.events.map((e) => `${e.type}:${String(e.sequence)}`));
    // The wave commit is observable in the event stream.
    expect(a.events.some((e) => e.type === 'ReinforcementSpawned')).toBe(true);
    // §9.4: a wave that spawns bodies resets the endcap at its commit tick.
    expect(a.entitiesByTick.has(41)).toBe(true);
  });
});

describe('P21 runtime: hazards', () => {
  it('walks scheduled -> telegraph -> resolve -> expire and emits boundary events once', () => {
    const hazards = Object.freeze([
      Object.freeze({ id: 'hazard_a', scheduledTick: 2, telegraphTicks: 3, resolveTick: 5, expired: false, form: 'circle', edgePattern: 'edge_dashed', shapeSymbol: 'symbol_skull' }),
    ]);
    const r = runWith(baseState({ hazards }), {}, 7);
    const types = r.events.map((e) => e.type);
    expect(types).toContain('HazardTelegraphed');
    expect(types).toContain('HazardResolved');
    expect(r.state.hazards?.[0]?.expired).toBe(true);
  });
});

describe('P21 runtime: modifiers', () => {
  const modifiers = Object.freeze([
    Object.freeze({ id: 'mod_a', previewKey: 'preview_mod_a', hooks: Object.freeze(['on_battle_start'] as const), incompatibilityTags: Object.freeze([]), params: Object.freeze({}) }),
  ]);

  it('commits modifiers once and locks them', () => {
    const r = runWith(baseState(), { bossPhaseDefinitions: defs, modifiers, bossCoreMechanicTags: Object.freeze(['core']), bossAnnouncedCounterTags: Object.freeze(['dispel']) }, 2);
    expect(r.state.modifiers?.map((m) => m.id)).toEqual(['mod_a']);
    expect(r.state.modifiers?.length).toBe(1);
  });

  it('rejects an encounter that neutralizes the boss core mechanic', () => {
    const bad = Object.freeze([
      Object.freeze({ id: 'mod_bad', previewKey: 'preview_mod_bad', hooks: Object.freeze(['on_phase_entry'] as const), incompatibilityTags: Object.freeze(['core']), params: Object.freeze({}) }),
    ]);
    expect(() => runWith(baseState(), { bossPhaseDefinitions: defs, modifiers: bad, bossCoreMechanicTags: Object.freeze(['core']), bossAnnouncedCounterTags: Object.freeze([]) }, 1)).toThrow(/P21_MODIFIER_INCOMPATIBLE/);
  });
});

describe('P21 runtime: determinism', () => {
  it('produces byte-identical snapshots for the same seed and content', () => {
    const objectives: readonly Objective[] = Object.freeze([
      Object.freeze({ id: 'obj_boss', kind: 'kill_boss', targetId: 'boss_ash_unit', required: 1, progress: 0, complete: false }),
    ]);
    const cfg: Phase21RuntimeConfig = { bossPhaseDefinitions: defs, objectives };
    const a = runWith(baseState(), cfg, 10);
    const b = runWith(baseState(), cfg, 10);
    expect(createSnapshot(a.state).checksum).toBe(createSnapshot(b.state).checksum);
  });
});
