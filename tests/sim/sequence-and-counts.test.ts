import { describe, expect, it } from 'vitest';
import { stepBattle } from '../../src/game/sim/core/battle-kernel.js';
import type { TickInput } from '../../src/game/sim/core/tick-input.js';
import type { KernelSystem } from '../../src/game/sim/core/tick-context.js';
import { battle, randomSession, eventInput, tick, priority, sequence, scheduled } from './test-helpers.js';

const input: TickInput = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });

describe('sequence and counts', () => {
  it('scheduled and emitted events share one monotonic sequence space', () => {
    let scheduledSeq: number | undefined;
    const systems: KernelSystem[] = [
      {
        id: 'both', stage: 'H',
        run(c) {
          c.commands.push({ kind: 'schedule_event', event: { scheduledTick: tick(c.state.tick), eventPriority: priority(80), sourceEntityId: null, abilityId: null, event: eventInput('DamageApplied') } });
          c.commands.push({ kind: 'append_event', event: eventInput('ProjectileSpawned') });
        },
      },
      { id: 'consume', stage: 'I', run(c) { scheduledSeq = c.dueEvents[0]?.eventSequence; } },
    ];
    const r = stepBattle({ state: battle(), input, random: randomSession(), rules: {}, content: {}, systems });
    const emitted = r.events[0]?.sequence;
    expect(new Set([emitted, scheduledSeq]).size).toBe(2);
    expect(r.state.nextSequence).toBe(2);
  });

  it('nextSequence must exceed every committed scheduled sequence', () => {
    const state = battle({ nextSequence: sequence(2), scheduledEvents: [scheduled('BattleStarted', { eventSequence: sequence(2) })] });
    expect(() => stepBattle({ state, input, random: randomSession(), rules: {}, content: {}, systems: [] })).toThrow(/P14_SEQUENCE_INVALID/);
  });

  it('emitted event count persists across stages and ticks', () => {
    const system: KernelSystem = { id: 'emit', stage: 'H', run(c) { c.commands.push({ kind: 'append_event', event: eventInput('ProjectileSpawned') }); } };
    let state = stepBattle({ state: battle(), input, random: randomSession(), rules: {}, content: {}, systems: [system] }).state;
    expect(state.emittedEventCount).toBe(1);
    state = stepBattle({ state, input, random: randomSession(), rules: {}, content: {}, systems: [system] }).state;
    expect(state.emittedEventCount).toBe(2);
  });

  it('battle-total event cap includes prior emitted count', () => {
    const system: KernelSystem = { id: 'emit', stage: 'H', run(c) { c.commands.push({ kind: 'append_event', event: eventInput('ProjectileSpawned') }); } };
    expect(() => stepBattle({ state: battle({ emittedEventCount: 10000 }), input, random: randomSession(), rules: {}, content: {}, systems: [system] })).toThrow(/P14_QUEUE_CAP/);
  });

  it('terminal transition records stable end reason and terminal checkpoint', () => {
    const system: KernelSystem = { id: 'end', stage: 'L', run(c) { c.commands.push({ kind: 'battle_transition', to: 'VICTORY', priority: 100, reason: 'all_enemy_regular_units_defeated' }); } };
    const state = battle({ phase: Object.freeze({ phase: 'RESOLVING_END', enteredTick: tick(0), resolvingEndTicks: 1 }) });
    const r = stepBattle({ state, input, random: randomSession(), rules: {}, content: {}, systems: [system] });
    expect(r.state.phase.phase).toBe('VICTORY');
    expect(r.state.endReason).toBe('all_enemy_regular_units_defeated');
    expect(r.checkpoint).toBeTruthy();
  });
});
