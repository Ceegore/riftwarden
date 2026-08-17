import { describe, expect, it } from 'vitest';
import { EventQueue } from '../../src/game/sim/scheduler/event-queue.js';
import { compareScheduled } from '../../src/game/sim/scheduler/event-order.js';
import type { ScheduledEvent } from '../../src/game/sim/scheduler/scheduled-event.js';
import { scheduled, tick, priority, sequence } from './test-helpers.js';

function permute(a: ScheduledEvent[], seed: number): ScheduledEvent[] {
  const out = [...a];
  let x = seed >>> 0;
  for (let i = out.length - 1; i > 0; i--) {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    const j = x % (i + 1);
    const atI = out[i];
    const atJ = out[j];
    if (atI === undefined || atJ === undefined) continue;
    out[i] = atJ;
    out[j] = atI;
  }
  return out;
}

describe('event queue ordering', () => {
  it('five-key order is permutation invariant', () => {
    const base: ScheduledEvent[] = [
      scheduled('BattleStarted', { scheduledTick: tick(2), eventPriority: priority(20), sourceEntityId: 'entity_b', abilityId: 'ability_b', eventSequence: sequence(4) }),
      scheduled('BattleStarted', { scheduledTick: tick(1), eventPriority: priority(20), sourceEntityId: 'entity_a', abilityId: 'ability_b', eventSequence: sequence(3) }),
      scheduled('BattleStarted', { scheduledTick: tick(1), eventPriority: priority(10), sourceEntityId: 'entity_z', abilityId: 'ability_a', eventSequence: sequence(2) }),
      scheduled('BattleStarted', { scheduledTick: tick(1), eventPriority: priority(20), sourceEntityId: 'entity_a', abilityId: 'ability_a', eventSequence: sequence(1) }),
    ];
    const expected = [...base].sort(compareScheduled).map((x) => x.eventSequence);
    for (let i = 0; i < 500; i++) expect(new EventQueue(permute(base, i)).snapshot().map((x) => x.eventSequence)).toEqual(expected);
  });

  it('each of the five comparator keys is a distinct, ordered tiebreak', () => {
    const byTick = [scheduled('BattleStarted', { scheduledTick: tick(2), eventSequence: sequence(2) }), scheduled('BattleStarted', { scheduledTick: tick(1), eventSequence: sequence(1) })];
    expect([...byTick].sort(compareScheduled).map((x) => x.eventSequence)).toEqual([1, 2]);
    const byPriority = [
      scheduled('BattleStarted', { scheduledTick: tick(1), eventPriority: priority(20), eventSequence: sequence(2) }),
      scheduled('BattleStarted', { scheduledTick: tick(1), eventPriority: priority(10), eventSequence: sequence(1) }),
    ];
    expect([...byPriority].sort(compareScheduled).map((x) => x.eventSequence)).toEqual([1, 2]);
    const bySource = [
      scheduled('BattleStarted', { scheduledTick: tick(1), eventPriority: priority(10), sourceEntityId: 'entity_b', eventSequence: sequence(2) }),
      scheduled('BattleStarted', { scheduledTick: tick(1), eventPriority: priority(10), sourceEntityId: 'entity_a', eventSequence: sequence(1) }),
    ];
    expect([...bySource].sort(compareScheduled).map((x) => x.eventSequence)).toEqual([1, 2]);
    const byAbility = [
      scheduled('BattleStarted', { scheduledTick: tick(1), eventPriority: priority(10), sourceEntityId: 'entity_a', abilityId: 'ability_b', eventSequence: sequence(2) }),
      scheduled('BattleStarted', { scheduledTick: tick(1), eventPriority: priority(10), sourceEntityId: 'entity_a', abilityId: 'ability_a', eventSequence: sequence(1) }),
    ];
    expect([...byAbility].sort(compareScheduled).map((x) => x.eventSequence)).toEqual([1, 2]);
    const bySequence = [
      scheduled('BattleStarted', { scheduledTick: tick(1), eventPriority: priority(10), sourceEntityId: 'entity_a', abilityId: 'ability_a', eventSequence: sequence(2) }),
      scheduled('BattleStarted', { scheduledTick: tick(1), eventPriority: priority(10), sourceEntityId: 'entity_a', abilityId: 'ability_a', eventSequence: sequence(1) }),
    ];
    expect([...bySequence].sort(compareScheduled).map((x) => x.eventSequence)).toEqual([1, 2]);
  });

  it('duplicate committed sequence blocks', () => {
    const a = scheduled('BattleStarted', { eventSequence: sequence(1) });
    const b = scheduled('PhaseStarted', { eventSequence: sequence(1) });
    expect(() => new EventQueue([a, b])).toThrow(/P14_SEQUENCE_INVALID/);
  });

  it('same tick must target a later stage', () => {
    const q = new EventQueue();
    expect(() => { q.plan(scheduled('BattleStarted', { scheduledTick: tick(5), eventPriority: priority(20) }), tick(5), priority(20)); }).toThrow(/P14_QUEUE_SORT/);
    q.plan(scheduled('BattleStarted', { scheduledTick: tick(5), eventPriority: priority(30) }), tick(5), priority(20));
    let n = sequence(0);
    q.commitPlanned(() => {
      const current = n;
      n = sequence(n + 1);
      return current;
    });
    expect(q.drainDueThrough(tick(5), priority(20)).length).toBe(0);
    expect(q.drainDueThrough(tick(5), priority(30)).length).toBe(1);
  });

  it('event cap blocks the 10001st planned event', () => {
    const q = new EventQueue();
    for (let i = 0; i < 10000; i++) q.plan(scheduled('BattleStarted', { scheduledTick: tick(1), eventPriority: priority(10) }), tick(0), priority(0));
    expect(() => { q.plan(scheduled(), tick(0), priority(0)); }).toThrow(/P14_QUEUE_CAP/);
  });
});
