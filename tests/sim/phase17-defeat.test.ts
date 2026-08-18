import { describe, expect, it } from 'vitest';
import { stepBattle } from '../../src/game/sim/core/battle-kernel.js';
import { migrateEntity } from '../../src/game/sim/core/migrate.js';
import { createPhase17Systems } from '../../src/game/sim/core/phase17-systems.js';
import { resolveEntityDefeat, validateDefeatHooks } from '../../src/game/sim/combat/defeat-resolver.js';
import { asX100 } from '../../src/game/sim/geometry/x100.js';
import type { TickInput } from '../../src/game/sim/core/tick-input.js';
import type { BattleModel } from '../../src/game/sim/core/battle-model.js';
import type { KernelEntity } from '../../src/game/sim/core/entity.js';
import { battle, entity, randomSession } from './test-helpers.js';
import type { DefeatHookInput } from '../../src/game/sim/combat/defeat-resolver.js';

const input: TickInput = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });

function unit(id: string, side: 'player' | 'enemy', overrides: Partial<KernelEntity> = {}): KernelEntity {
  return migrateEntity({ entity: entity(id, { side, ...overrides }), radiusX100: 100 });
}

interface RunResult {
  readonly state: BattleModel;
  readonly events: { tick: number; type: string; sourceId: string | null; payload: Record<string, number> }[];
}

function run(ticks: number, hooks: DefeatHookInput, entities: KernelEntity[]): RunResult {
  const state = battle({ simulationVersion: 'phase17-fixture-v1', entities });
  const systems = createPhase17Systems({ speedsX100PerSecond: {}, defeatHooks: hooks });
  let current = state;
  const random = randomSession();
  const events: RunResult['events'] = [];
  for (let i = 0; i < ticks; i++) {
    const r = stepBattle({ state: current, input, random, rules: {}, content: {}, systems });
    current = r.state;
    for (const e of r.events) {
      events.push({ tick: current.tick, type: e.type, sourceId: e.sourceId, payload: e.payload });
    }
  }
  return { state: current, events };
}

function defeated(entity: KernelEntity): KernelEntity {
  return Object.freeze({ ...entity, lp: 0, phase: Object.freeze({ phase: 'DEFEATED', enteredTick: 0, controlledReturn: null }) }) as KernelEntity;
}

const NO_HOOKS: DefeatHookInput = { preventDefeat: {}, revives: {}, removeOnDefeat: new Set() };

describe('P17 T05 defeat resolver (stage J)', () => {
  it('marks an entity with 0 LP as DEFEATED with overkill', () => {
    const dying = Object.freeze({ ...unit('unit_dying', 'player'), lp: 0, pendingOverkill: 40 }) as KernelEntity;
    const { state, events } = run(1, NO_HOOKS, [dying, unit('unit_other', 'enemy')]);
    const resolved = state.entities.find((e) => e.id === 'unit_dying');
    expect(resolved?.phase.phase).toBe('DEFEATED');
    const defeatedEvent = events.find((e) => e.type === 'Defeated');
    expect(defeatedEvent?.payload['overkill']).toBe(40);
  });

  it('never marks DEFEATED in stage I while HP is still positive', () => {
    const hurt = Object.freeze({ ...unit('unit_hurt', 'player'), lp: 5 }) as KernelEntity;
    const { state, events } = run(1, NO_HOOKS, [hurt, unit('unit_other', 'enemy')]);
    expect(state.entities.find((e) => e.id === 'unit_hurt')?.phase.phase).toBe('ACTIVE');
    expect(events.some((e) => e.type === 'Defeated')).toBe(false);
  });

  it('death prevention keeps the entity ACTIVE at 0 LP', () => {
    const dying = Object.freeze({ ...unit('unit_dying', 'player'), lp: 0 }) as KernelEntity;
    const hooks: DefeatHookInput = { preventDefeat: { unit_dying: 10 }, revives: {}, removeOnDefeat: new Set() };
    const { state, events } = run(1, hooks, [dying, unit('unit_other', 'enemy')]);
    const resolved = state.entities.find((e) => e.id === 'unit_dying');
    expect(resolved?.phase.phase).toBe('ACTIVE');
    expect(resolved?.lp).toBe(0);
    expect(events.some((e) => e.type === 'Defeated')).toBe(false);
  });

  it('committed revive restores LP and returns the entity to ACTIVE', () => {
    const dead = defeated(unit('unit_dead', 'player'));

    const hooks: DefeatHookInput = { preventDefeat: {}, revives: { unit_dead: { restoredLp: 500, oncePerBattle: true } }, removeOnDefeat: new Set() };
    const { state, events } = run(1, hooks, [dead, unit('unit_other', 'enemy')]);
    const resolved = state.entities.find((e) => e.id === 'unit_dead');
    expect(resolved?.phase.phase).toBe('ACTIVE');
    expect(resolved?.lp).toBe(500);
    expect(resolved?.reviveCount).toBe(1);
    const revived = events.find((e) => e.type === 'Revived');
    expect(revived?.payload['restoredLp']).toBe(500);
  });

  it('revive clamps restored LP to max LP', () => {
    const dead = defeated(unit('unit_dead', 'player', { maxLp: 1000, lp: 0 }));
    const hooks: DefeatHookInput = { preventDefeat: {}, revives: { unit_dead: { restoredLp: 5000, oncePerBattle: false } }, removeOnDefeat: new Set() };
    const { state } = run(1, hooks, [dead, unit('unit_other', 'enemy')]);
    const resolved = state.entities.find((e) => e.id === 'unit_dead');
    expect(resolved?.lp).toBe(1000);
  });

  it('once-per-battle refuses a second revive of the same entity', () => {
    const dead = Object.freeze({ ...defeated(unit('unit_dead', 'player')), reviveCount: 1 }) as KernelEntity;
    const hooks: DefeatHookInput = { preventDefeat: {}, revives: { unit_dead: { restoredLp: 500, oncePerBattle: true } }, removeOnDefeat: new Set() };
    const { state, events } = run(1, hooks, [dead, unit('unit_other', 'enemy')]);
    const resolved = state.entities.find((e) => e.id === 'unit_dead');
    expect(resolved?.phase.phase).toBe('DEFEATED');
    expect(events.some((e) => e.type === 'Revived')).toBe(false);
  });

  it('remove hook transitions the entity to REMOVED after Defeated', () => {
    const dying = Object.freeze({ ...unit('unit_dying', 'player'), lp: 0 }) as KernelEntity;
    const hooks: DefeatHookInput = { preventDefeat: {}, revives: {}, removeOnDefeat: new Set(['unit_dying']) };
    const { state, events } = run(1, hooks, [dying, unit('unit_other', 'enemy')]);
    expect(state.entities.find((e) => e.id === 'unit_dying')?.phase.phase).toBe('REMOVED');
    expect(events.some((e) => e.type === 'Defeated')).toBe(true);
  });

  it('does not touch an entity that is already DEFEATED without a revive', () => {
    const dead = defeated(unit('unit_dead', 'player'));
    const { state, events } = run(1, NO_HOOKS, [dead, unit('unit_other', 'enemy')]);
    expect(state.entities.find((e) => e.id === 'unit_dead')?.phase.phase).toBe('DEFEATED');
    expect(events.filter((e) => e.type === 'Defeated')).toHaveLength(0);
  });

  it('stage J runs after stage I: a lethal hit in the same tick resolves to DEFEATED', () => {
    // Player at 1000 LP; direct hit of 1000 lands in stage G, applies in stage
    // I; stage J must see HP 0 and mark DEFEATED with overkill 0.
    const attacker = unit('unit_attacker', 'player', { x100: 1000 });
    const victim = unit('unit_victim', 'enemy', { x100: 2000, maxLp: 1000, lp: 1000 });
    const systems = createPhase17Systems({
      speedsX100PerSecond: {},
      basicAttack: {
        parameters: {
          unit_attacker: {
            attackIntervalTicks: 40,
            prepareTicks: 0,
            recoveryTicks: 1,
            preferredRangeX100: asX100(9000),
            delivery: { kind: 'direct', rawAmount: 1000, damageTypeOrdinal: 0, defense: 0 },
          },
        },
      },
    });
    const state = battle({ simulationVersion: 'phase17-fixture-v1', entities: [attacker, victim] });
    let current = state;
    const random = randomSession();
    const events: { type: string; tick: number }[] = [];
    for (let i = 0; i < 3; i++) {
      const r = stepBattle({ state: current, input, random, rules: {}, content: {}, systems });
      current = r.state;
      for (const e of r.events) events.push({ type: e.type, tick: current.tick });
    }
    const victimAfter = current.entities.find((e) => e.id === 'unit_victim');
    expect(victimAfter?.phase.phase).toBe('DEFEATED');
    expect(victimAfter?.lp).toBe(0);
    expect(events.some((e) => e.type === 'Defeated')).toBe(true);
  });

  it('validates hook inputs strictly', () => {
    expect(() => { validateDefeatHooks({ preventDefeat: { 'unit_x': 10 }, revives: {}, removeOnDefeat: new Set() }); }).not.toThrow();
    expect(() => { validateDefeatHooks({ preventDefeat: { 'BAD ID': 10 }, revives: {}, removeOnDefeat: new Set() }); }).toThrow();
    expect(() => { validateDefeatHooks({ preventDefeat: {}, revives: { unit_x: { restoredLp: -1, oncePerBattle: true } }, removeOnDefeat: new Set() }); }).toThrow();
    expect(() => { validateDefeatHooks({ preventDefeat: {}, revives: {}, removeOnDefeat: new Set(['unit_x']) }); }).not.toThrow();
  });

  it('resolveEntityDefeat pure helper agrees with the system', () => {
    const dying = Object.freeze({ ...unit('unit_dying', 'player'), lp: 0, pendingOverkill: 12 });
    const outcome = resolveEntityDefeat(dying, { preventDefeat: {}, revives: {}, removeOnDefeat: new Set() }, 0);
    expect(outcome.resolution).toBe('defeated');
    expect(outcome.overkill).toBe(12);
  });
});
