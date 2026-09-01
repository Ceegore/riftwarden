import { describe, expect, it } from 'vitest';
import { stepBattle } from '../../src/game/sim/core/battle-kernel.js';
import { migrateEntity } from '../../src/game/sim/core/migrate.js';
import { createPhase17Systems } from '../../src/game/sim/core/phase17-systems.js';
import { createPhase16Systems } from '../../src/game/sim/core/phase16-systems.js';
import { asX100 } from '../../src/game/sim/geometry/x100.js';
import { MIN_ATTACK_INTERVAL_TICKS, recoveryMovementLockTicks } from '../../src/game/sim/attack/attack-state.js';
import type { TickInput } from '../../src/game/sim/core/tick-input.js';
import type { BattleModel } from '../../src/game/sim/core/battle-model.js';
import type { KernelEvent } from '../../src/game/sim/events/event-types.js';
import { battle, entity, randomSession } from './test-helpers.js';

const input: TickInput = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });

function unit(id: string, overrides: Parameters<typeof entity>[1] = {}) {
  return migrateEntity({ entity: entity(id, overrides), radiusX100: 100 });
}

function run(state: BattleModel, ticks: number, systems: ReturnType<typeof createPhase17Systems>): { state: BattleModel; events: KernelEvent[] } {
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

function phase17(config: { parameters?: Record<string, { attackIntervalTicks: number; prepareTicks: number; recoveryTicks: number; preferredRangeX100?: ReturnType<typeof asX100> }>; speedsX100PerSecond?: Record<string, number> }) {
  return createPhase17Systems({
    speedsX100PerSecond: config.speedsX100PerSecond ?? {},
    ...(config.parameters === undefined ? {} : { basicAttack: { parameters: config.parameters } }),
  });
}

/** Melee fixture: player and enemy close together so the attack starts immediately. */
function meleeState() {
  return battle({
    simulationVersion: 'phase15-fixture-v1',
    entities: [unit('unit_p', { x100: 1800 }), unit('unit_e', { side: 'enemy', x100: 2100 })],
  });
}

describe('Phase 17 T01 basic-attack lifecycle', () => {
  it('replaces the P16 attack-prep foundation with the lifecycle system', () => {
    const p16 = createPhase16Systems({ speedsX100PerSecond: {} });
    const p17 = phase17({ parameters: {} });
    const ids = (systems: readonly { id: string }[]) => systems.map((s) => s.id);
    expect(ids(p17)).toContain('phase17.g1.basic_attack');
    expect(ids(p17)).not.toContain('phase16.g1.attack_prep');
    expect(ids(p17)).toContain('phase17.h1.projectile');
    expect(ids(p17)).toContain('phase17.i1.combat_application');
    expect(ids(p17)).toContain('phase17.j1.defeat_resolver');
    expect(ids(p17)).not.toContain('noop.resolve_committed');
    expect(ids(p17)).not.toContain('noop.apply_effects');
    expect(ids(p17)).not.toContain('noop.death_resolution');
    // Everything else is carried over unchanged.
    const expected = ids(p16).filter((id) => id !== 'phase16.g1.attack_prep' && id !== 'noop.resolve_committed' && id !== 'noop.apply_effects' && id !== 'noop.death_resolution');
    const actual = ids(p17).filter((id) => id !== 'phase17.g1.basic_attack' && id !== 'phase17.h1.projectile' && id !== 'phase17.i1.combat_application' && id !== 'phase17.j1.defeat_resolver' && id !== 'phase17.l1.battle_end');
    expect(actual).toEqual(expected);
  });

  it('prepares, commits and completes one full cycle with all five diagnostics', () => {
    // prepareTicks 2 → commit at tick 2; recovery 4 → cycle complete at tick 6.
    const state = meleeState();
    const systems = phase17({
      parameters: {
        unit_p: { attackIntervalTicks: 30, prepareTicks: 2, recoveryTicks: 4, preferredRangeX100: asX100(500) },
      },
    });
    const result = run(state, 10, systems);
    const events = result.events.filter((e) => e.sourceId === 'unit_p');
    const types = events.map((e) => e.type);
    expect(types).toContain('AttackPrepared');
    expect(types).toContain('AttackCommitted');
    expect(types).toContain('AttackRecoveryStarted');
    expect(types).toContain('AttackCycleCompleted');
    expect(types).not.toContain('AttackInterrupted');
    // Recovery ends at commit + 4 = 6; the cycle completes by then.
    const p = result.state.entities.find((e) => e.id === 'unit_p');
    expect(p?.attackState).toBeNull();
    expect(p?.attackInstanceSeq).toBe(1);
  });

  it('records the commit and recovery ticks authoritatively', () => {
    const state = meleeState();
    const systems = phase17({
      parameters: {
        unit_p: { attackIntervalTicks: 30, prepareTicks: 3, recoveryTicks: 5, preferredRangeX100: asX100(500) },
      },
    });
    const result = run(state, 5, systems);
    const p = result.state.entities.find((e) => e.id === 'unit_p');
    expect(p?.attackState?.prepareStartedTick).toBe(0);
    expect(p?.attackState?.commitTick).toBe(3);
    expect(p?.attackState?.recoveryEndTick).toBe(8);
    const committed = result.events.find((e) => e.type === 'AttackCommitted');
    expect(committed?.payload['commitTick']).toBe(3);
    const recovery = result.events.find((e) => e.type === 'AttackRecoveryStarted');
    expect(recovery?.payload['recoveryEndTick']).toBe(8);
  });

  it('gates the next attack by the previous begin plus the interval', () => {
    // First prepare at tick 0, interval 30 → next prepare can only start at tick 30.
    const state = meleeState();
    const systems = phase17({
      parameters: {
        unit_p: { attackIntervalTicks: 30, prepareTicks: 0, recoveryTicks: 0, preferredRangeX100: asX100(500) },
      },
    });
    const result = run(state, 35, systems);
    const prepared = result.events.filter((e) => e.type === 'AttackPrepared' && e.sourceId === 'unit_p');
    expect(prepared).toHaveLength(2);
    // The second prepare begins at tick 30; with prepareTicks 0 the payload's
    // commitTick equals the begin tick (previous begin 0 + interval 30).
    expect(prepared[1]?.payload['commitTick']).toBe(30);
  });

  it('never lowers the interval below the 14-tick minimum', () => {
    const state = meleeState();
    const systems = phase17({
      parameters: {
        unit_p: { attackIntervalTicks: 5, prepareTicks: 0, recoveryTicks: 0, preferredRangeX100: asX100(500) },
      },
    });
    const result = run(state, 30, systems);
    const prepared = result.events.filter((e) => e.type === 'AttackPrepared' && e.sourceId === 'unit_p');
    // Interval clamped to 14: attacks at 0, 14, 28.
    expect(prepared).toHaveLength(3);
    const p = result.state.entities.find((e) => e.id === 'unit_p');
    expect(p?.attackState?.prepareStartedTick).toBe(28);
    expect(MIN_ATTACK_INTERVAL_TICKS).toBe(14);
  });

  it('interrupts the prepare when the target dies before commit', () => {
    const state = meleeState();
    const systems = phase17({
      parameters: {
        unit_p: { attackIntervalTicks: 30, prepareTicks: 10, recoveryTicks: 4, preferredRangeX100: asX100(500) },
      },
    });
    // Tick 1: kill the enemy before the tick-10 commit.
    const first = run(state, 1, systems);
    const dead = first.state.entities.map((e) =>
      e.id === 'unit_e'
        ? Object.freeze({ ...e, phase: Object.freeze({ phase: 'DEFEATED' as const, enteredTick: e.phase.enteredTick, controlledReturn: null }), lp: 0 })
        : e,
    );
    const second = run(Object.freeze({ ...first.state, entities: Object.freeze(dead) }), 2, systems);
    const interrupted = second.events.filter((e) => e.type === 'AttackInterrupted' && e.sourceId === 'unit_p');
    expect(interrupted).toHaveLength(1);
    const p = second.state.entities.find((e) => e.id === 'unit_p');
    expect(p?.attackState).toBeNull();
    // No commit may happen after the interrupt.
    expect(second.events.filter((e) => e.type === 'AttackCommitted' && e.sourceId === 'unit_p')).toHaveLength(0);
  });

  it('locks movement through the first half of recovery (odd counts use ceil)', () => {
    // recoveryTicks 5 → locked ticks ceil(5/2) = 3, i.e. through commit + 3.
    expect(recoveryMovementLockTicks(5)).toBe(3);
    expect(recoveryMovementLockTicks(4)).toBe(2);
    const state = battle({
      simulationVersion: 'phase15-fixture-v1',
      entities: [unit('unit_p', { x100: 1800 }), unit('unit_e', { side: 'enemy', x100: 6200 })],
    });
    const systems = phase17({
      parameters: {
        unit_p: { attackIntervalTicks: 30, prepareTicks: 1, recoveryTicks: 5, preferredRangeX100: asX100(5000) },
      },
      speedsX100PerSecond: { unit_p: 300 },
    });
    // Commit at tick 1; lock until tick 4 (commit + ceil(5/2) = 1 + 3). The
    // lock only starts after the commit tick (F runs before G), so ticks 2–3
    // are frozen and movement resumes at tick 4.
    const afterCommit = run(state, 2, systems);
    const p = afterCommit.state.entities.find((e) => e.id === 'unit_p');
    expect(p?.attackState?.commitTick).toBe(1);
    expect(p?.recoveryMovementLockedUntilTick).toBe(4);
    const xAt2 = afterCommit.state.entities.find((e) => e.id === 'unit_p')?.x100;
    expect(xAt2).toBe(1820); // moved during ticks 0–1, before the lock applies
    const duringLock = run(afterCommit.state, 1, systems);
    expect(duringLock.state.entities.find((e) => e.id === 'unit_p')?.x100).toBe(1820);
    const afterLock = run(duringLock.state, 2, systems);
    // Tick 3 still locked, tick 4 unlocked → exactly one tick of movement.
    expect(afterLock.state.entities.find((e) => e.id === 'unit_p')?.x100).toBe(1830);
  });

  it('does not start an attack without a valid in-range target', () => {
    const state = battle({
      simulationVersion: 'phase15-fixture-v1',
      entities: [unit('unit_p', { x100: 1800 }), unit('unit_e', { side: 'enemy', x100: 6200 })],
    });
    // Preferred range 200 is far below the 4200 edge distance.
    const systems = phase17({
      parameters: {
        unit_p: { attackIntervalTicks: 30, prepareTicks: 1, recoveryTicks: 4, preferredRangeX100: asX100(200) },
      },
    });
    const result = run(state, 5, systems);
    expect(result.events.filter((e) => e.type === 'AttackPrepared')).toHaveLength(0);
    const p = result.state.entities.find((e) => e.id === 'unit_p');
    expect(p?.attackState).toBeNull();
  });
});
