import { describe, expect, it } from 'vitest';
import { EVENT_SPEC } from '../../src/game/sim/events/event-spec.js';
import { validateEventInput } from '../../src/game/sim/events/event-validation.js';
import { EventLog } from '../../src/game/sim/events/event-log.js';
import { eventInput, tick, sequence } from './test-helpers.js';

const required = [
  'BattleStarted', 'PhaseStarted', 'BattleEnded', 'Spawned', 'Activated', 'TargetChanged', 'MovedLane', 'Defeated', 'Removed', 'Revived',
  'AttackPrepared', 'AttackInterrupted', 'AttackCommitted', 'AttackRecoveryStarted', 'AttackCycleCompleted', 'ProjectileSpawned', 'DamageApplied', 'HealApplied', 'ShieldApplied', 'EffectApplied', 'EffectRemoved',
  'ChargeReady', 'AbilityPrepared', 'AbilityInterrupted', 'AbilityCommitted', 'AbilityResolved',
  'ModifierTriggered', 'HazardTelegraphed', 'HazardResolved', 'ReinforcementQueued', 'ReinforcementSpawned',
  'InvalidTargetPrevented', 'SummonLimitBlocked', 'FallbackRuleUsed', 'SafetyCapTriggered',
  'LaneLogicalSwitched', 'LaneChangeCompleted', 'LaneChangeInterrupted',
  'StuckRepath', 'RepathLaneUnavailable', 'FrontDeadlockRangeBoost', 'RiftCollapseWarning', 'RiftCollapseEndRequest', 'SpawnRejected',
];

describe('event registry', () => {
  it('all 44 required event types are registered', () => {
    expect(Object.keys(EVENT_SPEC).sort()).toEqual([...required].sort());
  });

  it('every registered event validates with exact payload', () => {
    for (const type of Object.keys(EVENT_SPEC) as (keyof typeof EVENT_SPEC)[]) {
      expect(() => { validateEventInput(eventInput(type)); }).not.toThrow();
    }
  });
});

describe('event validation', () => {
  it('unknown top field and payload field block', () => {
    expect(() => { validateEventInput({ ...eventInput(), displayText: 'Start' }); }).toThrow(/P14_EVENT_SCHEMA/);
    expect(() => { validateEventInput({ ...eventInput(), payload: { battleOrdinal: 1, extra: 2 } }); }).toThrow(/P14_EVENT_SCHEMA/);
  });

  it('float, negative zero, duplicate targets and localized text block', () => {
    expect(() => { validateEventInput({ ...eventInput(), payload: { battleOrdinal: 1.5 } }); }).toThrow(/P14_EVENT_SCHEMA/);
    expect(() => { validateEventInput({ ...eventInput(), payload: { battleOrdinal: -0 } }); }).toThrow(/P14_EVENT_SCHEMA/);
    expect(() => { validateEventInput({ ...eventInput(), targetIds: ['entity_a', 'entity_a'] }); }).toThrow(/P14_EVENT_SCHEMA/);
    expect(() => { validateEventInput({ ...eventInput(), logTags: ['Der Kampf beginnt!'] }); }).toThrow(/P14_LOCALIZED_EVENT_TEXT/);
  });
});

describe('event log', () => {
  it('assigns externally supplied monotonic sequence and freezes events', () => {
    const log = new EventLog();
    const a = log.append(tick(4), sequence(9), eventInput());
    const b = log.append(tick(4), sequence(10), eventInput('PhaseStarted'));
    expect([a.sequence, b.sequence]).toEqual([9, 10]);
    expect(Object.isFrozen(a)).toBe(true);
  });
});
