import { describe, expect, it } from 'vitest';
import { EventQueue } from '../../src/game/sim/scheduler/event-queue.js';
import { scheduled, tick, priority, sequence } from './test-helpers.js';

describe('scheduler boundaries', () => {
  it('overdue event drains in A regardless of original priority', () => {
    const q = new EventQueue([scheduled('BattleStarted', { scheduledTick: tick(4), eventPriority: priority(120), eventSequence: sequence(1) })]);
    expect(q.drainDueThrough(tick(5), priority(0)).length).toBe(1);
  });

  it('current tick events drain only through their priority boundary', () => {
    const q = new EventQueue([
      scheduled('BattleStarted', { scheduledTick: tick(5), eventPriority: priority(30), eventSequence: sequence(1) }),
      scheduled('PhaseStarted', { scheduledTick: tick(5), eventPriority: priority(80), eventSequence: sequence(2) }),
    ]);
    expect(q.drainDueThrough(tick(5), priority(20)).length).toBe(0);
    expect(q.drainDueThrough(tick(5), priority(30)).length).toBe(1);
    expect(q.drainDueThrough(tick(5), priority(80)).length).toBe(1);
  });

  it('future tick never drains early', () => {
    const q = new EventQueue([scheduled('BattleStarted', { scheduledTick: tick(6), eventPriority: priority(0), eventSequence: sequence(1) })]);
    expect(q.drainDueThrough(tick(5), priority(120)).length).toBe(0);
    expect(q.size()).toBe(1);
  });
});
