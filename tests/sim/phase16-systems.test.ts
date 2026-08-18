import { describe, expect, it } from 'vitest';
import { stepBattle } from '../../src/game/sim/core/battle-kernel.js';
import { migrateEntity } from '../../src/game/sim/core/migrate.js';
import { createPhase16Systems, type Phase16SystemsConfig } from '../../src/game/sim/core/phase16-systems.js';
import { createPhase15Systems } from '../../src/game/sim/core/phase15-systems.js';
import { startLaneChange } from '../../src/game/sim/movement/lane-change.js';
import { validateEntity } from '../../src/game/sim/core/entity.js';
import { asX100 } from '../../src/game/sim/geometry/x100.js';
import type { TickInput } from '../../src/game/sim/core/tick-input.js';
import type { BattleModel } from '../../src/game/sim/core/battle-model.js';
import type { KernelEntity } from '../../src/game/sim/core/entity.js';
import type { KernelEvent } from '../../src/game/sim/events/event-types.js';
import { battle, entity, randomSession, tick } from './test-helpers.js';

const input: TickInput = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });

function unit(id: string, overrides: Parameters<typeof entity>[1] = {}) {
  return migrateEntity({ entity: entity(id, overrides), radiusX100: 100 });
}

function run(state: BattleModel, ticks: number, systems: ReturnType<typeof createPhase16Systems>): { state: BattleModel; events: KernelEvent[] } {
  let current = state;
  const events: KernelEvent[] = [];
  const random = randomSession();
  for (let i = 0; i < ticks; i++) {
    const r = stepBattle({ state: current, input, random, rules: {}, content: {}, systems });
    current = r.state;
    events.push(...r.events);
  }
  return { state: current, events };
}

function phase16(speeds: Record<string, number> = {}, extra: Partial<Phase16SystemsConfig> = {}) {
  return createPhase16Systems({ speedsX100PerSecond: speeds, ...extra });
}

function defeated(entityInput: KernelEntity): KernelEntity {
  return Object.freeze({
    ...entityInput,
    phase: Object.freeze({ phase: 'DEFEATED' as const, enteredTick: entityInput.phase.enteredTick, controlledReturn: null }),
    lp: 0,
  });
}

describe('Phase 16 composition', () => {
  it('replaces the E and G noops with the targeting and attack-prep systems', () => {
    const p15 = createPhase15Systems({ speedsX100PerSecond: {} });
    const p16 = phase16();
    const ids = (systems: readonly { id: string }[]) => systems.map((s) => s.id);
    const replaced = ids(p15).filter((id) => id !== 'noop.targeting' && id !== 'noop.cast_progress');
    expect(ids(p16).filter((id) => replaced.includes(id))).toEqual(replaced);
    expect(ids(p16)).toContain('phase16.e1.targeting');
    expect(ids(p16)).toContain('phase16.g1.attack_prep');
    expect(ids(p16)).not.toContain('noop.targeting');
    expect(ids(p16)).not.toContain('noop.cast_progress');
  });
});

describe('Phase 16 E-stage targeting', () => {
  it('acquires the highest-score enemy on the first tick', () => {
    const state = battle({
      simulationVersion: 'phase15-fixture-v1',
      entities: [unit('unit_p', { x100: 1800 }), unit('unit_e', { side: 'enemy', x100: 2600 })],
    });
    const result = run(state, 1, phase16());
    expect(result.state.entities.find((e) => e.id === 'unit_p')?.targetId).toBe('unit_e');
    expect(result.events.filter((e) => e.type === 'TargetChanged' && e.sourceId === 'unit_p')).toHaveLength(1);
  });

  it('switches to the remaining valid target when the current one is defeated', () => {
    const state = battle({
      simulationVersion: 'phase15-fixture-v1',
      entities: [
        unit('unit_p', { x100: 1800 }),
        unit('unit_near', { side: 'enemy', x100: 2600 }),
        unit('unit_far', { side: 'enemy', x100: 4200 }),
      ],
    });
    const result = run(state, 1, phase16());
    expect(result.state.entities.find((e) => e.id === 'unit_p')?.targetId).toBe('unit_near');
    // Kill the locked target: the next tick re-evaluates and binds to the survivor.
    const dead = result.state.entities.map((e) => (e.id === 'unit_near' ? defeated(e) : e));
    const next = run(Object.freeze({ ...result.state, entities: Object.freeze(dead) }), 1, phase16());
    expect(next.state.entities.find((e) => e.id === 'unit_p')?.targetId).toBe('unit_far');
  });

  it('releases the target when no valid candidate remains', () => {
    const state = battle({
      simulationVersion: 'phase15-fixture-v1',
      entities: [unit('unit_p', { x100: 1800 }), unit('unit_e', { side: 'enemy', x100: 2600 })],
    });
    const result = run(state, 1, phase16());
    expect(result.state.entities.find((e) => e.id === 'unit_p')?.targetId).toBe('unit_e');
    const dead = result.state.entities.map((e) => (e.id === 'unit_e' ? defeated(e) : e));
    const next = run(Object.freeze({ ...result.state, entities: Object.freeze(dead) }), 1, phase16());
    expect(next.state.entities.find((e) => e.id === 'unit_p')?.targetId).toBeNull();
  });

  it('does not re-evaluate while a lane change is in flight', () => {
    const base = unit('unit_p', { x100: 1800 });
    const changing = Object.freeze({ ...base, laneChange: startLaneChange('middle', 'top', tick(0), 'unit_p', 'normal') });
    const state = battle({
      simulationVersion: 'phase15-fixture-v1',
      entities: [changing, unit('unit_e', { side: 'enemy', x100: 2600 })],
    });
    const result = run(state, 1, phase16());
    // The in-flight lane change suppresses state-entry re-evaluation entirely.
    expect(result.state.entities.find((e) => e.id === 'unit_p')?.targetId).toBeNull();
    expect(result.events.filter((e) => e.type === 'TargetChanged' && e.sourceId === 'unit_p')).toHaveLength(0);
  });

  it('applies the focus-fire modifier and the anti-summoner preference', () => {
    const summoned = Object.freeze({ ...unit('unit_other', { side: 'enemy', x100: 2600 }), origin: 'summoned' as const });
    const state = battle({
      simulationVersion: 'phase15-fixture-v1',
      entities: [
        unit('unit_p', { x100: 1800 }),
        unit('unit_focus', { side: 'enemy', x100: 2600 }),
        summoned,
      ],
    });
    const result = run(state, 1, phase16({}, { targeting: { focusTargetId: { unit_p: 'unit_focus' } } }));
    expect(result.state.entities.find((e) => e.id === 'unit_p')?.targetId).toBe('unit_focus');
  });
});

describe('Phase 16 G-stage attack prep', () => {
  function prepared(ticks: number, options: Parameters<typeof phase16>[1] = {}) {
    const state = battle({
      simulationVersion: 'phase15-fixture-v1',
      entities: [unit('unit_p', { x100: 1800 }), unit('unit_e', { side: 'enemy', x100: 1900 })],
    });
    const systems = phase16({}, { attackPrep: { preferredRangeX100: { unit_p: asX100(100) } }, ...options });
    const result = run(state, ticks, systems);
    return result;
  }

  it('emits AttackPrepared once, edge-triggered, when the inclusive edge distance reaches range', () => {
    // Edge distance = |1900-1800| - 100 - 100 = -100 → clamped 0 ≤ 100 → in range on tick 0.
    const result = prepared(3);
    const events = result.events.filter((e) => e.type === 'AttackPrepared');
    expect(events).toHaveLength(1);
    expect(result.state.entities.find((e) => e.id === 'unit_p')?.inRangeSinceTick).toBe(0);
    // Still in range at tick 3: no repeat event.
    expect(result.state.entities.find((e) => e.id === 'unit_p')?.inRangeSinceTick).toBe(0);
  });

  it('clears the in-range marker when the target leaves range', () => {
    const state = battle({
      simulationVersion: 'phase15-fixture-v1',
      entities: [unit('unit_p', { x100: 1800 }), unit('unit_e', { side: 'enemy', x100: 3000 })],
    });
    // Range 2000: in range at tick 0; the enemy flees to 4200 and exits range.
    const systems = phase16({}, { attackPrep: { preferredRangeX100: { unit_p: asX100(2000) } } });
    const first = run(state, 1, systems);
    expect(first.state.entities.find((e) => e.id === 'unit_p')?.inRangeSinceTick).toBe(0);
    const far = first.state.entities.map((e) => (e.id === 'unit_e' ? Object.freeze({ ...e, x100: 4200 }) : e));
    const second = run(Object.freeze({ ...first.state, entities: Object.freeze(far) }), 1, systems);
    expect(second.state.entities.find((e) => e.id === 'unit_p')?.inRangeSinceTick).toBeNull();
  });

  it('does not fire for entities without a configured range or without a target', () => {
    const result = prepared(2, { attackPrep: { preferredRangeX100: { unit_other: asX100(100) } } });
    expect(result.events.filter((e) => e.type === 'AttackPrepared')).toHaveLength(0);
  });
});

describe('Phase 16 reducer and schema validation', () => {
  it('records and clears the in-range marker through the reducer', () => {
    const state = battle({
      simulationVersion: 'phase15-fixture-v1',
      entities: [unit('unit_p', { x100: 1800 })],
    });
    const result = run(state, 1, phase16());
    expect(result.state.entities.find((e) => e.id === 'unit_p')?.inRangeSinceTick).toBeNull();
    // The marker field round-trips through the snapshot without corruption.
    const withMarker = result.state.entities.map((e) => (e.id === 'unit_p' ? Object.freeze({ ...e, inRangeSinceTick: 7 }) : e));
    const second = run(Object.freeze({ ...result.state, entities: Object.freeze(withMarker) }), 1, phase16());
    expect(second.state.entities.find((e) => e.id === 'unit_p')?.inRangeSinceTick).toBe(7);
  });

  it('validates the additive fields in the entity schema', () => {
    expect(() => {
      validateEntity(Object.freeze({ ...entity('ok'), origin: 'summoned' as const, inRangeSinceTick: 12 }));
    }).not.toThrow();
    expect(() => {
      validateEntity(Object.freeze({ ...entity('bad'), origin: 'boss' as never }));
    }).toThrow(/P14_SNAPSHOT_INVALID/);
    expect(() => {
      validateEntity(Object.freeze({ ...entity('neg'), inRangeSinceTick: -1 }));
    }).toThrow(/P14_SNAPSHOT_INVALID/);
  });

  it('migrates defaults: regular origin, null in-range marker', () => {
    const migrated = migrateEntity({ entity: entity('unit_p', { x100: 1800 }), radiusX100: 100 });
    expect(migrated.origin).toBe('regular');
    expect(migrated.inRangeSinceTick).toBeNull();
  });
});
