import { describe, expect, it } from 'vitest';
import { stepBattle } from '../../src/game/sim/core/battle-kernel.js';
import { migrateEntity } from '../../src/game/sim/core/migrate.js';
import { createPhase19Systems } from '../../src/game/sim/core/phase19-systems.js';
import { createSnapshot, verifySnapshot } from '../../src/game/sim/snapshot/snapshot.js';
import { createAbilityInstance } from '../../src/game/sim/ability/ability-system.js';
import { triggerReasonOrdinal } from '../../src/game/sim/ability/ability-events.js';
import type { AbilityRuntimeDefinition } from '../../src/game/sim/ability/ability-runtime.js';
import type { KernelSystem, TickContext } from '../../src/game/sim/core/tick-context.js';
import type { TickInput } from '../../src/game/sim/core/tick-input.js';
import type { BattleModel } from '../../src/game/sim/core/battle-model.js';
import type { KernelEvent } from '../../src/game/sim/events/event-types.js';
import { battle, entity, randomSession } from './test-helpers.js';

const input: TickInput = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });

function unit(id: string, overrides: Parameters<typeof entity>[1] = {}) {
  return migrateEntity({ entity: entity(id, overrides), radiusX100: 100 });
}

function reactiveDefinition(trigger: AbilityRuntimeDefinition['trigger']): AbilityRuntimeDefinition {
  return {
    config: {
      abilityId: 'ability_reactive',
      chargeTicks: null,
      cooldownTicks: 3,
      castTicks: 1,
      recoveryTicks: 0,
      interruptPolicy: 'interruptible',
      usesPerBattle: null,
      invalidTargetPolicy: 'wait',
      bossPhaseCancelAllowed: false,
    },
    trigger,
    targetQuery: { space: 'enemy_entity', profile: 'nearest' },
    effects: () => [],
  };
}

function stateWith(trigger: AbilityRuntimeDefinition['trigger']): BattleModel {
  return battle({
    simulationVersion: 'phase15-fixture-v1',
    entities: Object.freeze([unit('unit_p'), unit('unit_e', { side: 'enemy', x100: 6200 })]),
    abilities: Object.freeze([createAbilityInstance(reactiveDefinition(trigger).config, 'inst_reactive', 'unit_p')]),
  });
}

function damageAtTick0(entityId: string, delta: number): KernelSystem {
  return Object.freeze({
    id: 'test.i9.damage',
    stage: 'I' as const,
    run: (context: TickContext): void => {
      if (context.state.tick === 0) context.commands.push({ kind: 'apply_lp_delta', entityId, delta, sourceId: null });
    },
  });
}

function systemsFor(trigger: AbilityRuntimeDefinition['trigger'], damage: KernelSystem): readonly KernelSystem[] {
  return Object.freeze([...createPhase19Systems({ speedsX100PerSecond: {}, abilities: { definitions: { ability_reactive: reactiveDefinition(trigger) } } }), damage]);
}

interface RunResult { state: BattleModel; events: KernelEvent[] }

function runWith(state: BattleModel, systems: readonly KernelSystem[], ticks = 1): RunResult {
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

describe('Phase 19 kernel: trigger history', () => {
  it('fires hp_threshold_crossed after the owner drops below the threshold', () => {
    const trigger = { type: 'hp_threshold_crossed', scope: 'self', thresholdPercent: 50, direction: 'below' } as const;
    const { events } = runWith(stateWith(trigger), systemsFor(trigger, damageAtTick0('unit_p', -600)), 2);
    const fired = events.find((e) => e.type === 'AbilityTriggered');
    expect(fired).toBeDefined();
    expect(fired?.payload['triggerOrdinal']).toBe(triggerReasonOrdinal('hp_below_crossed'));
  });

  it('fires entity_defeated after an enemy is defeated', () => {
    const trigger = { type: 'entity_defeated', side: 'enemy' } as const;
    const { events } = runWith(stateWith(trigger), systemsFor(trigger, damageAtTick0('unit_e', -1000)), 2);
    const fired = events.find((e) => e.type === 'AbilityTriggered');
    expect(fired).toBeDefined();
    expect(fired?.payload['triggerOrdinal']).toBe(triggerReasonOrdinal('entity_defeated'));
  });

  it('does not fire hp_threshold_crossed before the crossing tick', () => {
    const trigger = { type: 'hp_threshold_crossed', scope: 'self', thresholdPercent: 50, direction: 'below' } as const;
    const { events } = runWith(stateWith(trigger), systemsFor(trigger, damageAtTick0('unit_p', -100)), 2);
    expect(events.some((e) => e.type === 'AbilityTriggered')).toBe(false);
  });

  it('projects previousTickLp and previousTickEvents into the snapshot', () => {
    const trigger = { type: 'hp_threshold_crossed', scope: 'self', thresholdPercent: 50, direction: 'below' } as const;
    const { state } = runWith(stateWith(trigger), systemsFor(trigger, damageAtTick0('unit_p', -600)), 1);
    expect(state.previousTickLp).toBeDefined();
    expect(state.previousTickEvents).toBeDefined();
    const snap = createSnapshot(state);
    expect(snap.previousTickLp).toBeDefined();
    expect(snap.previousTickEvents).toBeDefined();
    expect(verifySnapshot(snap)).toBe(true);
  });
});
