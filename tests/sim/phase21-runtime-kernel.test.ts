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
import { battle, entity, randomSession } from './test-helpers.js';

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

  it('blocks an invalid wave as a content error', () => {
    const bad = Object.freeze([Object.freeze({ id: 'wave_bad', scheduledTick: 0, side: 'enemy', entityIds: Object.freeze([]), spawnProfile: 'x', capPolicy: 'BLOCK' })]);
    expect(() => runWith(baseState(), { bossPhaseDefinitions: defs, waves: bad }, 1)).toThrow(/P21_WAVE_INVALID/);
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
