import { describe, expect, it } from 'vitest';
import { stepBattle } from '../../src/game/sim/core/battle-kernel.js';
import { migrateEntity } from '../../src/game/sim/core/migrate.js';
import { createPhase15Systems } from '../../src/game/sim/core/phase15-systems.js';
import type { TickInput } from '../../src/game/sim/core/tick-input.js';
import type { BattleModel } from '../../src/game/sim/core/battle-model.js';
import type { KernelEvent } from '../../src/game/sim/events/event-types.js';
import { battle, entity, randomSession } from './test-helpers.js';

const input: TickInput = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });

function player(x100: number) {
  return migrateEntity({ entity: entity('unit_p', { x100 }), radiusX100: 100 });
}

function enemy(x100: number) {
  return migrateEntity({ entity: entity('unit_e', { side: 'enemy', x100 }), radiusX100: 100 });
}

function run(state: BattleModel, speeds: Record<string, number>, ticks: number): { state: BattleModel; events: KernelEvent[] } {
  let current = state;
  const events: KernelEvent[] = [];
  const random = randomSession();
  const systems = createPhase15Systems({ speedsX100PerSecond: speeds });
  for (let i = 0; i < ticks; i++) {
    const r = stepBattle({ state: current, input, random, rules: {}, content: {}, systems });
    current = r.state;
    events.push(...r.events);
  }
  return { state: current, events };
}

describe('Phase 15 anti-stuck system', () => {
  it('emits a stuck repath after 30 blocked ticks and resets the counter', () => {
    // Player at stop distance from a stationary enemy: desired step > 0, applied 0.
    const state = battle({ entities: [player(1800), enemy(2010)], simulationVersion: 'phase15-fixture-v1' });
    const result = run(state, { unit_p: 300 }, 30);
    expect(result.events.filter((e) => e.type === 'StuckRepath')).toHaveLength(1);
    expect(result.state.entities.find((e) => e.id === 'unit_p')?.noProgressTicks).toBe(0);
    expect(result.state.entities.find((e) => e.id === 'unit_p')?.repathTicks).toEqual([29]);
  });

  it('emits the rift-collapse warning after 300 ticks without qualifying progress', { timeout: 25_000 }, () => {
    const state = battle({ entities: [player(1800)], simulationVersion: 'phase15-fixture-v1' });
    const result = run(state, { unit_p: 300 }, 300);
    expect(result.events.filter((e) => e.type === 'RiftCollapseWarning')).toHaveLength(1);
    expect(result.state.globalNoProgressTicks).toBe(300);
  });

  it('grants one melee-range boost per side after 60 deadlocked ticks', () => {
    // Both fronts block each other at the stop distance with no progress.
    const state = battle({ entities: [player(1800), enemy(2010)], simulationVersion: 'phase15-fixture-v1' });
    const result = run(state, { unit_p: 300, unit_e: 300 }, 60);
    expect(result.events.filter((e) => e.type === 'FrontDeadlockRangeBoost')).toHaveLength(2);
    const buffed = result.state.entities.filter((e) => e.deadlockBuffedEntityId !== null);
    expect(buffed.map((e) => e.id).sort()).toEqual(['unit_e', 'unit_p']);
  });

  it('requests the rift-collapse resolution after the full 300+300 window', { timeout: 25_000 }, () => {
    const state = battle({ entities: [player(1800)], simulationVersion: 'phase15-fixture-v1' });
    const result = run(state, {}, 601);
    expect(result.state.phase.phase).toBe('RESOLVING_END');
    expect(result.events.filter((e) => e.type === 'RiftCollapseEndRequest')).toHaveLength(1);
  });
});
