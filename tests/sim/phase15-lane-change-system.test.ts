import { describe, expect, it } from 'vitest';
import { stepBattle } from '../../src/game/sim/core/battle-kernel.js';
import { migrateEntity } from '../../src/game/sim/core/migrate.js';
import { createPhase15Systems, type Phase15SystemsConfig } from '../../src/game/sim/core/phase15-systems.js';
import { startLaneChange } from '../../src/game/sim/movement/lane-change.js';
import { tick } from '../../src/game/sim/core/primitives.js';
import type { TickInput } from '../../src/game/sim/core/tick-input.js';
import type { BattleModel } from '../../src/game/sim/core/battle-model.js';
import type { KernelEvent } from '../../src/game/sim/events/event-types.js';
import { battle, entity, randomSession } from './test-helpers.js';

const input: TickInput = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });

function player() {
  return migrateEntity({ entity: entity('unit_a', { lane: 'top' }), radiusX100: 100 });
}

function systems(overrides: Partial<Phase15SystemsConfig> = {}) {
  return createPhase15Systems({ speedsX100PerSecond: { unit_a: 300 }, ...overrides });
}

function run(state: BattleModel, sys: ReturnType<typeof systems>, ticks: number): { state: BattleModel; events: KernelEvent[] } {
  let current = state;
  const events: KernelEvent[] = [];
  const random = randomSession();
  for (let i = 0; i < ticks; i++) {
    const r = stepBattle({ state: current, input, random, rules: {}, content: {}, systems: sys });
    current = r.state;
    events.push(...r.events);
  }
  return { state: current, events };
}

describe('Phase 15 lane-change system', () => {
  it('starts, advances, switches at 18 and completes at 36 with one event each', () => {
    const requests = (context: { state: BattleModel }) => (context.state.tick === tick(0) ? [{ entityId: 'unit_a', to: 'middle' as const, reason: 'normal' as const, sourceId: 'ai', priority: 1 }] : []);
    const state = battle({ entities: [player()], simulationVersion: 'phase15-fixture-v1' });

    const first = run(state, systems({ laneChangeRequests: requests }), 18);
    expect(first.state.entities[0]?.lane).toBe('top');
    expect(first.state.entities[0]?.laneChange?.progressTicks).toBe(17);
    expect(first.events.filter((e) => e.type === 'LaneLogicalSwitched')).toHaveLength(0);

    const second = run(first.state, systems({ laneChangeRequests: requests }), 1);
    expect(second.state.entities[0]?.lane).toBe('middle');
    expect(second.events.filter((e) => e.type === 'LaneLogicalSwitched')).toHaveLength(1);

    const third = run(second.state, systems({ laneChangeRequests: requests }), 18);
    expect(third.state.entities[0]?.laneChange).toBeNull();
    expect(third.state.entities[0]?.normalLaneChangeCooldownUntilTick).toBe(36 + 90);
    expect(third.events.filter((e) => e.type === 'LaneChangeCompleted')).toHaveLength(1);
  });

  it('blocks a second normal lane change within the 90-tick cooldown', () => {
    const startRequest = { entityId: 'unit_a', to: 'middle' as const, reason: 'normal' as const, sourceId: 'ai', priority: 1 };
    const state = battle({ entities: [player()], simulationVersion: 'phase15-fixture-v1' });
    const done = run(state, systems({ laneChangeRequests: (c) => (c.state.tick === tick(0) ? [startRequest] : []) }), 37);
    expect(done.state.entities[0]?.laneChange).toBeNull();
    expect(done.state.entities[0]?.normalLaneChangeCooldownUntilTick).toBe(126);

    const retry = systems({ laneChangeRequests: () => [{ entityId: 'unit_a', to: 'bottom' as const, reason: 'normal' as const, sourceId: 'ai', priority: 1 }] });
    expect(() => run(done.state, retry, 1)).toThrow(/P15_LANECHANGE_COOLDOWN/);
  });

  it('rejects a non-adjacent top-to-bottom request', () => {
    const sys = systems({ laneChangeRequests: () => [{ entityId: 'unit_a', to: 'bottom' as const, reason: 'normal' as const, sourceId: 'ai', priority: 1 }] });
    const state = battle({ entities: [player()], simulationVersion: 'phase15-fixture-v1' });
    expect(() => run(state, sys, 1)).toThrow(/P15_LANECHANGE_DIRECT_NON_ADJACENT/);
  });

  it('blocks ambiguous equal-priority requests for the same entity', () => {
    const sys = systems({
      laneChangeRequests: () => [
        { entityId: 'unit_a', to: 'top' as const, reason: 'normal' as const, sourceId: 'ai', priority: 1 },
        { entityId: 'unit_a', to: 'bottom' as const, reason: 'normal' as const, sourceId: 'player', priority: 1 },
      ],
    });
    const state = battle({ entities: [player()], simulationVersion: 'phase15-fixture-v1' });
    expect(() => run(state, sys, 1)).toThrow(/P15_LANECHANGE_AMBIGUOUS/);
  });

  it('interrupts an in-flight lane change on death and clears it', () => {
    const migrated = migrateEntity({ entity: entity('unit_a'), radiusX100: 100 });
    const interrupted = Object.freeze({
      ...migrated,
      laneChange: startLaneChange('top', 'middle', tick(0), 'ai'),
      phase: Object.freeze({ phase: 'DEFEATED' as const, enteredTick: tick(0), controlledReturn: null }),
    });
    const state = battle({ entities: [interrupted], simulationVersion: 'phase15-fixture-v1' });
    const result = run(state, systems(), 1);
    expect(result.state.entities[0]?.laneChange).toBeNull();
    expect(result.events.filter((e) => e.type === 'LaneChangeInterrupted')).toHaveLength(1);
  });
});
