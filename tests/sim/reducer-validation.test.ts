import { describe, expect, it } from 'vitest';
import { stepBattle } from '../../src/game/sim/core/battle-kernel.js';
import type { TickInput } from '../../src/game/sim/core/tick-input.js';
import type { KernelSystem } from '../../src/game/sim/core/tick-context.js';
import { battle, entity, randomSession, eventInput } from './test-helpers.js';

const input: TickInput = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });

describe('battle-wide event cap accounting', () => {
  it('counts same-tick emitted events once, not once per stage', () => {
    // Prior ticks already emitted 9990 events. Stage H emits 5 more (9995),
    // stage I emits the final 5 (10000). A per-stage double-count would fire
    // the cap at the first stage-I event (9995 + 5 = 10000 seen twice).
    const state = battle({ emittedEventCount: 9990 });
    const hSystem: KernelSystem = {
      id: 'emit.h', stage: 'H',
      run(c) {
        for (let i = 0; i < 5; i++) c.commands.push({ kind: 'append_event', event: eventInput('ProjectileSpawned') });
      },
    };
    const iSystem: KernelSystem = {
      id: 'emit.i', stage: 'I',
      run(c) {
        for (let i = 0; i < 5; i++) c.commands.push({ kind: 'append_event', event: eventInput('DamageApplied') });
      },
    };
    const r = stepBattle({ state, input, random: randomSession(), rules: {}, content: {}, systems: [hSystem, iSystem] });
    expect(r.state.emittedEventCount).toBe(10000);
    expect(r.events.length).toBe(10);
  });
});

describe('reducer reference validation', () => {
  it('set_target on an unknown entity blocks', () => {
    const system: KernelSystem = { id: 'bad.target', stage: 'E', run(c) { c.commands.push({ kind: 'set_target', entityId: 'missing', targetId: 'entity_alpha' }); } };
    expect(() => stepBattle({ state: battle(), input, random: randomSession(), rules: {}, content: {}, systems: [system] })).toThrow(/P14_SNAPSHOT_INVALID/);
  });

  it('remove_entity on an unknown entity blocks', () => {
    const system: KernelSystem = { id: 'bad.remove', stage: 'J', run(c) { c.commands.push({ kind: 'remove_entity', entityId: 'missing' }); } };
    expect(() => stepBattle({ state: battle(), input, random: randomSession(), rules: {}, content: {}, systems: [system] })).toThrow(/P14_SNAPSHOT_INVALID/);
  });

  it('set_movement_remainder on an unknown entity blocks', () => {
    const system: KernelSystem = { id: 'bad.remainder', stage: 'F', run(c) { c.commands.push({ kind: 'set_movement_remainder', entityId: 'missing', remainder: 0 }); } };
    expect(() => stepBattle({ state: battle(), input, random: randomSession(), rules: {}, content: {}, systems: [system] })).toThrow(/P14_SNAPSHOT_INVALID/);
  });
});

describe('reducer bounds validation', () => {
  it('apply_lp_delta with a float delta blocks', () => {
    const system: KernelSystem = { id: 'bad.delta', stage: 'I', run(c) { c.commands.push({ kind: 'apply_lp_delta', entityId: 'entity_alpha', delta: -0.5 }); } };
    expect(() => stepBattle({ state: battle(), input, random: randomSession(), rules: {}, content: {}, systems: [system] })).toThrow(/P14_SNAPSHOT_INVALID/);
  });

  it('set_global_progress from stage I resets the rift-collapse counters', () => {
    const state = battle({ globalNoProgressTicks: 299, riftCollapseTicks: 42, riftCollapseWarningEmitted: true });
    const system: KernelSystem = {
      id: 'combat.progress.i', stage: 'I',
      run(c) { c.commands.push({ kind: 'set_global_progress', noProgressTicks: 0, collapseTicks: 0, warned: false }); },
    };
    const r = stepBattle({ state, input, random: randomSession(), rules: {}, content: {}, systems: [system] });
    expect(r.state.globalNoProgressTicks).toBe(0);
    expect(r.state.riftCollapseTicks).toBe(0);
    expect(r.state.riftCollapseWarningEmitted).toBe(false);
  });

  it('set_global_progress from stage J resets the rift-collapse counters', () => {
    const state = battle({ globalNoProgressTicks: 300, riftCollapseTicks: 300, riftCollapseWarningEmitted: true });
    const system: KernelSystem = {
      id: 'combat.progress.j', stage: 'J',
      run(c) { c.commands.push({ kind: 'set_global_progress', noProgressTicks: 0, collapseTicks: 0, warned: false }); },
    };
    const r = stepBattle({ state, input, random: randomSession(), rules: {}, content: {}, systems: [system] });
    expect(r.state.globalNoProgressTicks).toBe(0);
    expect(r.state.riftCollapseTicks).toBe(0);
    expect(r.state.riftCollapseWarningEmitted).toBe(false);
  });

  it('consumes the deadlock buff when the buffed unit takes an entity-sourced hit', () => {
    const buffed = entity('entity_alpha', { deadlockBuffedEntityId: 'entity_alpha', deadlockBuffConsumed: false });
    const state = battle({ entities: Object.freeze([buffed, entity('entity_beta', { side: 'enemy', x100: 2010 })]) });
    const system: KernelSystem = {
      id: 'hit.buffed', stage: 'I',
      run(c) { c.commands.push({ kind: 'apply_lp_delta', entityId: 'entity_alpha', delta: -50, sourceId: 'entity_beta' }); },
    };
    const r = stepBattle({ state, input, random: randomSession(), rules: {}, content: {}, systems: [system] });
    const after = r.state.entities.find((e) => e.id === 'entity_alpha');
    expect(after?.lp).toBe(950);
    expect(after?.deadlockBuffedEntityId).toBeNull();
    expect(after?.deadlockBuffConsumed).toBe(true);
  });

  it('keeps the deadlock buff on unsourced or non-damage deltas', () => {
    const buffed = entity('entity_alpha', { deadlockBuffedEntityId: 'entity_alpha', deadlockBuffConsumed: false });
    const state = battle({ entities: Object.freeze([buffed, entity('entity_beta', { side: 'enemy', x100: 2010 })]) });
    const systems: KernelSystem[] = [
      { id: 'hit.unsourced', stage: 'I', run(c) { c.commands.push({ kind: 'apply_lp_delta', entityId: 'entity_alpha', delta: -50 }); } },
      { id: 'heal.sourced', stage: 'I', run(c) { c.commands.push({ kind: 'apply_lp_delta', entityId: 'entity_alpha', delta: 20, sourceId: 'entity_beta' }); } },
    ];
    for (const system of systems) {
      const r = stepBattle({ state, input, random: randomSession(), rules: {}, content: {}, systems: [system] });
      const after = r.state.entities.find((e) => e.id === 'entity_alpha');
      expect(after?.deadlockBuffedEntityId).toBe('entity_alpha');
      expect(after?.deadlockBuffConsumed).toBe(false);
    }
  });

  it('set_position with an out-of-range x100 blocks', () => {
    const system: KernelSystem = { id: 'bad.pos', stage: 'F', run(c) { c.commands.push({ kind: 'set_position', entityId: 'entity_alpha', lane: 'middle', x100: 15000 }); } };
    expect(() => stepBattle({ state: battle(), input, random: randomSession(), rules: {}, content: {}, systems: [system] })).toThrow(/P14_SNAPSHOT_INVALID/);
  });

  it('set_position with an invalid lane blocks', () => {
    const system: KernelSystem = { id: 'bad.pos.lane', stage: 'F', run(c) { c.commands.push({ kind: 'set_position', entityId: 'entity_alpha', lane: 'sideways' as never, x100: 4000 }); } };
    expect(() => stepBattle({ state: battle(), input, random: randomSession(), rules: {}, content: {}, systems: [system] })).toThrow(/P14_SNAPSHOT_INVALID/);
  });

  it('set_timer with negative or float ticks blocks', () => {
    const negative: KernelSystem = { id: 'bad.timer.neg', stage: 'B', run(c) { c.commands.push({ kind: 'set_timer', entityId: 'entity_alpha', timer: 'cooldown', ticks: -1 }); } };
    expect(() => stepBattle({ state: battle(), input, random: randomSession(), rules: {}, content: {}, systems: [negative] })).toThrow(/P14_SNAPSHOT_INVALID/);
    const floatTimer: KernelSystem = { id: 'bad.timer.float', stage: 'B', run(c) { c.commands.push({ kind: 'set_timer', entityId: 'entity_alpha', timer: 'cooldown', ticks: 0.5 }); } };
    expect(() => stepBattle({ state: battle(), input, random: randomSession(), rules: {}, content: {}, systems: [floatTimer] })).toThrow(/P14_SNAPSHOT_INVALID/);
  });

  it('set_movement_remainder with out-of-range or non-integer remainder blocks', () => {
    const negative: KernelSystem = { id: 'bad.remainder.neg', stage: 'F', run(c) { c.commands.push({ kind: 'set_movement_remainder', entityId: 'entity_alpha', remainder: -1 }); } };
    expect(() => stepBattle({ state: battle(), input, random: randomSession(), rules: {}, content: {}, systems: [negative] })).toThrow(/P14_SNAPSHOT_INVALID/);
    const floatRemainder: KernelSystem = { id: 'bad.remainder.float', stage: 'F', run(c) { c.commands.push({ kind: 'set_movement_remainder', entityId: 'entity_alpha', remainder: 0.5 }); } };
    expect(() => stepBattle({ state: battle(), input, random: randomSession(), rules: {}, content: {}, systems: [floatRemainder] })).toThrow(/P14_SNAPSHOT_INVALID/);
    const tooBig: KernelSystem = { id: 'bad.remainder.big', stage: 'F', run(c) { c.commands.push({ kind: 'set_movement_remainder', entityId: 'entity_alpha', remainder: 30 }); } };
    expect(() => stepBattle({ state: battle(), input, random: randomSession(), rules: {}, content: {}, systems: [tooBig] })).toThrow(/P14_SNAPSHOT_INVALID/);
  });
});
