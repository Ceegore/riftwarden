import { describe, expect, it } from 'vitest';
import { stepBattle } from '../../src/game/sim/core/battle-kernel.js';
import type { TickInput } from '../../src/game/sim/core/tick-input.js';
import type { KernelSystem } from '../../src/game/sim/core/tick-context.js';
import { battle, randomSession, eventInput, tick, priority } from './test-helpers.js';

const input: TickInput = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });

describe('scheduler/pipeline integration', () => {
  it('stage C planned D event is visible in D, not C', () => {
    const seen: string[] = [];
    const systems: KernelSystem[] = [
      {
        id: 'plan', stage: 'C',
        run(c) {
          expect(c.dueEvents.length).toBe(0);
          c.commands.push({ kind: 'schedule_event', event: { scheduledTick: tick(c.state.tick), eventPriority: priority(30), sourceEntityId: null, abilityId: null, event: eventInput('PhaseStarted') } });
        },
      },
      { id: 'consume', stage: 'D', run(c) { seen.push(...c.dueEvents.map((e) => e.event.type)); } },
    ];
    const r = stepBattle({ state: battle(), input, random: randomSession(), rules: {}, content: {}, systems });
    expect(seen).toEqual(['PhaseStarted']);
    expect(r.state.scheduledEvents.length).toBe(0);
  });

  it('same-stage reentrant scheduling is blocked by forward-priority rule', () => {
    const system: KernelSystem = {
      id: 'loop', stage: 'C',
      run(c) {
        c.commands.push({ kind: 'schedule_event', event: { scheduledTick: tick(c.state.tick), eventPriority: priority(20), sourceEntityId: null, abilityId: null, event: eventInput('PhaseStarted') } });
      },
    };
    expect(() => stepBattle({ state: battle(), input, random: randomSession(), rules: {}, content: {}, systems: [system] })).toThrow(/P14_QUEUE_SORT/);
  });

  it('future event remains committed and drains on exact future stage', () => {
    const plan: KernelSystem = {
      id: 'plan', stage: 'C',
      run(c) {
        c.commands.push({ kind: 'schedule_event', event: { scheduledTick: tick(c.state.tick + 1), eventPriority: priority(80), sourceEntityId: null, abilityId: null, event: eventInput('DamageApplied') } });
      },
    };
    let state = stepBattle({ state: battle(), input, random: randomSession(), rules: {}, content: {}, systems: [plan] }).state;
    expect(state.scheduledEvents.length).toBe(1);
    let seen = 0;
    const consume: KernelSystem = { id: 'consume', stage: 'I', run(c) { seen += c.dueEvents.length; } };
    state = stepBattle({ state, input, random: randomSession(), rules: {}, content: {}, systems: [consume] }).state;
    expect(seen).toBe(1);
    expect(state.scheduledEvents.length).toBe(0);
  });
});
