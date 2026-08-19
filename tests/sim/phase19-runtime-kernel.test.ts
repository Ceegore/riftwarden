import { describe, expect, it } from 'vitest';
import { stepBattle } from '../../src/game/sim/core/battle-kernel.js';
import { migrateEntity, migrateBattleModel, SIM_VERSION_PHASE14 } from '../../src/game/sim/core/migrate.js';
import { createPhase19Systems } from '../../src/game/sim/core/phase19-systems.js';
import { createSnapshot, verifySnapshot } from '../../src/game/sim/snapshot/snapshot.js';
import { createAbilityInstance } from '../../src/game/sim/ability/ability-system.js';
import { KernelInvariantError } from '../../src/game/sim/core/invariant-error.js';
import type { AbilityRuntimeDefinition } from '../../src/game/sim/ability/ability-runtime.js';
import type { EffectCommand } from '../../src/game/sim/ability/effect-command.js';
import type { KernelSystem, TickContext } from '../../src/game/sim/core/tick-context.js';
import type { KernelCommand } from '../../src/game/sim/core/command-types.js';
import type { TickInput } from '../../src/game/sim/core/tick-input.js';
import type { BattleModel } from '../../src/game/sim/core/battle-model.js';
import type { KernelEvent } from '../../src/game/sim/events/event-types.js';
import { battle, entity, randomSession } from './test-helpers.js';

const input: TickInput = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });

function unit(id: string, overrides: Parameters<typeof entity>[1] = {}) {
  return migrateEntity({ entity: entity(id, overrides), radiusX100: 100 });
}

function fireballDefinition(): AbilityRuntimeDefinition {
  return {
    config: {
      abilityId: 'ability_fireball',
      chargeTicks: null,
      cooldownTicks: 3,
      castTicks: 2,
      recoveryTicks: 1,
      interruptPolicy: 'interruptible',
      usesPerBattle: 2,
      invalidTargetPolicy: 'wait',
      bossPhaseCancelAllowed: false,
    },
    trigger: { type: 'battle_start' },
    targetQuery: { space: 'enemy_entity', profile: 'nearest' },
    effects: (ctx): readonly EffectCommand[] => [
      Object.freeze({
        commandId: `${ctx.abilityInstanceId}_effect_0`,
        abilityInstanceId: ctx.abilityInstanceId,
        abilityId: ctx.abilityId,
        effectIndex: 0,
        sourceId: ctx.source.sourceId,
        targetRef: Object.freeze({ kind: 'entity' as const, entityId: ctx.target.entityId, groundKey: null, slotId: null }),
        scheduledTick: ctx.commitTick,
        stage: 'I' as const,
        sourceSnapshot: ctx.source,
        sequence: 0,
        kind: 'damage' as const,
        amount: 100,
      }),
    ],
  };
}

function stateWith(): BattleModel {
  return battle({
    simulationVersion: 'phase15-fixture-v1',
    entities: Object.freeze([unit('unit_p'), unit('unit_e', { side: 'enemy', x100: 6200 })]),
    abilities: Object.freeze([createAbilityInstance(fireballDefinition().config, 'inst_fireball', 'unit_p')]),
  });
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

function systems(): readonly KernelSystem[] {
  return createPhase19Systems({ speedsX100PerSecond: {}, abilities: { definitions: { ability_fireball: fireballDefinition() } } });
}

function pushOnly(command: KernelCommand, stage: 'G' | 'I' = 'I'): readonly KernelSystem[] {
  return Object.freeze([Object.freeze({ id: 'test.g1.push', stage, run: (context: TickContext): void => { context.commands.push(command); } })]);
}

function expectInvariant(fn: () => unknown, reason: string): void {
  try {
    fn();
    expect.unreachable(`expected ${reason}`);
  } catch (error) {
    expect(error).toBeInstanceOf(KernelInvariantError);
    if (error instanceof KernelInvariantError) expect(error.details['reason']).toBe(reason);
  }
}

describe('Phase 19 kernel: reducer validation', () => {
  it('rejects a malformed ability batch and a duplicate instance id', () => {
    const base = stateWith();
    expectInvariant(() => runWith(base, pushOnly({ kind: 'set_abilities', abilities: 'nope' as never }, 'G')), 'abilities-not-array');
    const inst = createAbilityInstance(fireballDefinition().config, 'inst_fireball', 'unit_p');
    const dup = createAbilityInstance(fireballDefinition().config, 'inst_fireball', 'unit_p');
    expectInvariant(() => runWith(base, pushOnly({ kind: 'set_abilities', abilities: [inst, dup] }, 'G')), 'ability-duplicate-instance');
  });
});

describe('Phase 19 kernel: trigger/target/cast lifecycle', () => {
  it('fires battle_start, selects the enemy target, casts and deals damage at commit', () => {
    const { state, events } = runWith(stateWith(), systems(), 3);
    const enemy = state.entities.find((e) => e.id === 'unit_e');
    expect(enemy?.lp).toBe(900);
    const types = events.map((e) => e.type);
    for (const expected of ['AbilityTriggered', 'AbilityTargetSelected', 'AbilityCastStarted', 'AbilityCommitted', 'AbilityConsumed', 'AbilityEffectQueued']) {
      expect(types).toContain(expected);
    }
    const instance = state.abilities?.[0];
    expect(instance?.state).toBe('cast_committed');
    expect(instance?.usesRemaining).toBe(1);
  });

  it('moves through recovery, cooldown and back to ready after the cast', () => {
    const { state } = runWith(stateWith(), systems(), 8);
    expect(state.abilities?.[0]?.state).toBe('ready');
  });

  it('never double-commits and emits the full event trace deterministically', () => {
    const seed = stateWith();
    const a = runWith(seed, systems(), 10);
    const b = runWith(seed, systems(), 10);
    expect(createSnapshot(a.state).checksum).toBe(createSnapshot(b.state).checksum);
    expect(a.events.map((e) => `${String(e.tick)}:${e.type}:${String(e.sequence)}`)).toEqual(b.events.map((e) => `${String(e.tick)}:${e.type}:${String(e.sequence)}`));
    const commits = a.events.filter((e) => e.type === 'AbilityCommitted');
    expect(commits).toHaveLength(1);
  });
});

describe('Phase 19 kernel: snapshot and migration', () => {
  it('projects abilities into the snapshot and verifies symmetrically', () => {
    const state = battle({ ...stateWith(), plannedEffects: Object.freeze([]) });
    const snap = createSnapshot(state);
    expect(snap.abilities).toHaveLength(1);
    expect(verifySnapshot(snap)).toBe(true);
  });

  it('migration seeds empty abilities and plannedEffects', () => {
    const migrated = migrateBattleModel({ state: battle({ entities: [unit('unit_p')], simulationVersion: SIM_VERSION_PHASE14 }), radiiX100: { unit_p: 100 } });
    expect(migrated.abilities).toEqual([]);
    expect(migrated.plannedEffects).toEqual([]);
  });
});
