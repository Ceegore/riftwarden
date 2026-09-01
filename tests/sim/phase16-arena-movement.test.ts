import { describe, expect, it } from 'vitest';
import { stepBattle } from '../../src/game/sim/core/battle-kernel.js';
import { migrateEntity } from '../../src/game/sim/core/migrate.js';
import { createPhase15Systems } from '../../src/game/sim/core/phase15-systems.js';
import type { TickInput } from '../../src/game/sim/core/tick-input.js';
import type { BattleModel } from '../../src/game/sim/core/battle-model.js';
import type { KernelEvent } from '../../src/game/sim/events/event-types.js';
import { asX100 } from '../../src/game/sim/geometry/x100.js';
import { battle, entity, randomSession } from './test-helpers.js';

const input: TickInput = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });

function unit(id: string, overrides: Parameters<typeof entity>[1] = {}) {
  return migrateEntity({ entity: entity(id, overrides), radiusX100: 100 });
}

function arena(state: BattleModel, bodies: readonly { id: string; x100: number; radiusX100: number; lane: 'top' | 'middle' | 'bottom' }[], ticks: number, speeds: Record<string, number> = { unit_p: 3000 }): { state: BattleModel; events: KernelEvent[] } {
  let current = state;
  const events: KernelEvent[] = [];
  const random = randomSession();
  const systems = createPhase15Systems({
    speedsX100PerSecond: speeds,
    arenaBodies: () => bodies.map((b) => ({ id: b.id, x100: asX100(b.x100), radiusX100: asX100(b.radiusX100), lane: b.lane })),
  });
  for (let i = 0; i < ticks; i++) {
    const r = stepBattle({ state: current, input, random, rules: {}, content: {}, systems });
    current = r.state;
    events.push(...r.events);
  }
  return { state: current, events };
}

describe('Phase 16 arena-object movement', () => {
  it('stops a moving unit at the arena edge in its lane', () => {
    // Body spans 2300..2500 (radius 100 at x 2400). The unit at 1800 moving
    // right at 100/tick would reach 2400 in 6 ticks but must clamp to
    // 2400 − 100 (unit radius) − 100 (body radius) = 2200.
    const state = battle({
      simulationVersion: 'phase15-fixture-v1',
      entities: [unit('unit_p', { x100: 1800 })],
    });
    const result = arena(state, [{ id: 'rock', x100: 2400, radiusX100: 100, lane: 'middle' }], 6);
    const unitP = result.state.entities.find((e) => e.id === 'unit_p');
    expect(unitP?.x100).toBe(2200);
  });

  it('never lets the arena pull a unit backward (bodies behind do not block)', () => {
    // A body behind the unit must not affect its forward progress.
    const state = battle({
      simulationVersion: 'phase15-fixture-v1',
      entities: [unit('unit_p', { x100: 1800 })],
    });
    const result = arena(state, [{ id: 'behind', x100: 1200, radiusX100: 100, lane: 'middle' }], 2);
    const unitP = result.state.entities.find((e) => e.id === 'unit_p');
    // 1800 + 2 * 100 = 2000, unaffected by the body behind.
    expect(unitP?.x100).toBe(2000);
  });

  it('only blocks in the lane the body occupies', () => {
    const state = battle({
      simulationVersion: 'phase15-fixture-v1',
      entities: [unit('unit_p', { x100: 1800 })],
    });
    const result = arena(state, [{ id: 'rock', x100: 2400, radiusX100: 100, lane: 'top' }], 2);
    const unitP = result.state.entities.find((e) => e.id === 'unit_p');
    expect(unitP?.x100).toBe(2000);
  });

  it('clamps an enemy against an arena edge from the other side', () => {
    // Enemy moving left at 100/tick; arena body spans 2100..2300. The enemy at
    // 3600 must stop with its right edge at the body's right edge:
    // 2300 + 100 (unit radius) = 2400.
    const state = battle({
      simulationVersion: 'phase15-fixture-v1',
      entities: [unit('unit_e', { side: 'enemy', x100: 3600 })],
    });
    const result = arena(state, [{ id: 'wall', x100: 2200, radiusX100: 100, lane: 'middle' }], 15, { unit_e: 3000 });
    const unitE = result.state.entities.find((e) => e.id === 'unit_e');
    expect(unitE?.x100).toBe(2400);
  });

  it('combines arena clamping with the enemy pass-through safety net', () => {
    // Player closes toward an enemy while a body sits between them; the unit
    // must stop at the nearer obstacle without crossing the enemy boundary.
    const state = battle({
      simulationVersion: 'phase15-fixture-v1',
      entities: [unit('unit_p', { x100: 1800 }), unit('unit_e', { side: 'enemy', x100: 2600 })],
    });
    const result = arena(state, [{ id: 'rock', x100: 2100, radiusX100: 50, lane: 'middle' }], 5);
    const unitP = result.state.entities.find((e) => e.id === 'unit_p');
    // 2100 − 100 (unit) − 50 (body) = 1950; the enemy edge (2400) is farther.
    expect(unitP?.x100).toBe(1950);
    expect(result.state.entities.find((e) => e.id === 'unit_e')?.x100).toBe(2600);
  });
});
