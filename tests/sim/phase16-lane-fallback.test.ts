import { describe, expect, it } from 'vitest';
import { stepBattle } from '../../src/game/sim/core/battle-kernel.js';
import { migrateEntity } from '../../src/game/sim/core/migrate.js';
import { createPhase15Systems } from '../../src/game/sim/core/phase15-systems.js';
import type { TickInput } from '../../src/game/sim/core/tick-input.js';
import type { BattleModel } from '../../src/game/sim/core/battle-model.js';
import type { KernelEvent } from '../../src/game/sim/events/event-types.js';
import { battle, entity, randomSession } from './test-helpers.js';

const input: TickInput = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });

function unit(id: string, overrides: Parameters<typeof entity>[1] = {}) {
  return migrateEntity({ entity: entity(id, overrides), radiusX100: 100 });
}

function run(state: BattleModel, ticks: number, roles?: Readonly<Record<string, 'defender' | 'fighter' | 'breaker' | 'duelist' | 'marksman' | 'mage' | 'controller' | 'healer' | 'support' | 'summoner' | 'constructor'>>): { state: BattleModel; events: KernelEvent[] } {
  let current = state;
  const events: KernelEvent[] = [];
  const random = randomSession();
  const systems = createPhase15Systems({
    speedsX100PerSecond: { unit_p: 300 },
    ...(roles === undefined ? {} : { roles }),
  });
  for (let i = 0; i < ticks; i++) {
    const r = stepBattle({ state: current, input, random, rules: {}, content: {}, systems });
    current = r.state;
    events.push(...r.events);
  }
  return { state: current, events };
}

describe('Phase 16 §9.2 deferred lane-fallback targeting', () => {
  it('switches once into the only valid neighboring lane after three repaths', () => {
    // The middle-lane enemy blocks the player at the stop distance; a second
    // enemy on the top lane is the only reachable alternative. Repaths fire at
    // ticks 29, 69 and 109 (each after 30 blocked ticks; the relief progress
    // between them resets the counter), so the fallback lands at tick 109.
    const state = battle({
      simulationVersion: 'phase15-fixture-v1',
      entities: [
        unit('unit_p', { x100: 1800 }),
        unit('unit_e', { side: 'enemy', x100: 2010 }),
        unit('unit_t', { side: 'enemy', lane: 'top', x100: 4000 }),
      ],
    });
    const result = run(state, 160);
    const player = result.state.entities.find((e) => e.id === 'unit_p');
    expect(player?.laneFallbackUsed).toBe(true);
    // The one-time fallback lane change completes: the unit ends on the top lane.
    expect(player?.lane).toBe('top');
    const used = result.events.filter((e) => e.type === 'FallbackRuleUsed' && e.sourceId === 'unit_p');
    expect(used).toHaveLength(1);
    expect(used[0]?.payload['ruleOrdinal']).toBe(0);
  });

  it('picks the neighboring lane with the lowest target score when both are valid', { timeout: 60_000 }, () => {
    // Two adjacent lanes with one enemy each. A duelist scores low-HP targets
    // higher, so the healthier enemy must be the lower score → the fallback
    // must pick the lane holding the *healthier* enemy.
    const state = battle({
      simulationVersion: 'phase15-fixture-v1',
      entities: [
        unit('unit_p', { x100: 1800 }),
        unit('unit_e', { side: 'enemy', x100: 2010 }),
        unit('unit_top', { side: 'enemy', lane: 'top', x100: 4000, lp: 200 }),
        unit('unit_bottom', { side: 'enemy', lane: 'bottom', x100: 4000 }),
      ],
    });
    const result = run(state, 160, { unit_p: 'duelist' });
    const player = result.state.entities.find((e) => e.id === 'unit_p');
    // The bottom enemy (full HP) scores lower for a duelist than the half-HP
    // top enemy, so the fallback targets the bottom lane; the completed lane
    // change leaves the unit on the bottom lane.
    expect(player?.lane).toBe('bottom');
  });

  it('emits RepathLaneUnavailable and stays in place when no neighboring lane is valid', () => {
    const state = battle({
      simulationVersion: 'phase15-fixture-v1',
      entities: [unit('unit_p', { x100: 1800 }), unit('unit_e', { side: 'enemy', x100: 2010 })],
    });
    const result = run(state, 130);
    const player = result.state.entities.find((e) => e.id === 'unit_p');
    expect(player?.laneFallbackUsed).toBe(true);
    expect(player?.laneChange).toBeNull();
    const unavailable = result.events.filter((e) => e.type === 'RepathLaneUnavailable' && e.sourceId === 'unit_p');
    expect(unavailable).toHaveLength(1);
  });

  it('never falls back a second time after the one-time switch', () => {
    const state = battle({
      simulationVersion: 'phase15-fixture-v1',
      entities: [
        unit('unit_p', { x100: 1800 }),
        unit('unit_e', { side: 'enemy', x100: 2010 }),
        unit('unit_t', { side: 'enemy', lane: 'top', x100: 4000 }),
      ],
    });
    const result = run(state, 260);
    expect(result.events.filter((e) => e.type === 'FallbackRuleUsed' && e.sourceId === 'unit_p')).toHaveLength(1);
  });
});
