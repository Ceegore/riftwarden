import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PIPELINE_STAGES } from '../../src/game/sim/core/pipeline-stage.js';
import { EVENT_SPEC } from '../../src/game/sim/events/event-spec.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const pipelineContract = JSON.parse(readFileSync(path.join(here, '..', '..', 'contracts', 'sim', 'pipeline-stages.json'), 'utf8')) as { letter: string; priority: number; key: string }[];
const eventContract = JSON.parse(readFileSync(path.join(here, '..', '..', 'contracts', 'sim', 'event-priorities.json'), 'utf8')) as { sortKeys: string[]; priorityRange: { min: number; max: number }; eventCapPerBattle: number };

const requiredTypes = [
  'BattleStarted', 'PhaseStarted', 'BattleEnded', 'Spawned', 'Activated', 'TargetChanged', 'MovedLane', 'Defeated', 'Removed', 'Revived',
  'AttackPrepared', 'AttackInterrupted', 'AttackCommitted', 'AttackRecoveryStarted', 'AttackCycleCompleted', 'ProjectileSpawned', 'DamageApplied', 'HealApplied', 'ShieldApplied', 'ShieldAbsorbed', 'ShieldExpired', 'EffectApplied', 'EffectRefreshed', 'EffectIgnored', 'EffectRemoved', 'EffectTick', 'EffectResisted',
  'ChargeReady', 'AbilityPrepared', 'AbilityInterrupted', 'AbilityCommitted', 'AbilityResolved',
  'AbilityTriggered', 'AbilityTargetSelected', 'AbilityWaitingTarget', 'AbilityCastStarted', 'AbilityEffectQueued', 'AbilityRecovered', 'AbilityCooldownStarted', 'AbilityReady', 'AbilityConsumed', 'AbilityRejected',
  'ModifierTriggered', 'HazardTelegraphed', 'HazardResolved', 'ReinforcementQueued', 'ReinforcementSpawned', 'LifestealBlocked',
  'PhaseTransitionPlanned', 'BossTelegraphStarted', 'BossPhaseStarted', 'BossPhaseCompleted',
  'InvalidTargetPrevented', 'SummonLimitBlocked', 'FallbackRuleUsed', 'SafetyCapTriggered',
  'LaneLogicalSwitched', 'LaneChangeCompleted', 'LaneChangeInterrupted',
  'StuckRepath', 'RepathLaneUnavailable', 'FrontDeadlockRangeBoost', 'RiftCollapseWarning', 'RiftCollapseEndRequest', 'SpawnRejected',
];

describe('pipeline contract', () => {
  it('A-M stages match the JSON contract exactly', () => {
    const actual = PIPELINE_STAGES.map(([letter, priority, key]) => ({ letter, priority, key }));
    const expected = pipelineContract.map(({ letter, priority, key }) => ({ letter, priority, key }));
    expect(actual).toEqual(expected);
    expect(actual.length).toBe(13);
    expect(actual[0]?.priority).toBe(0);
    expect(actual[actual.length - 1]?.priority).toBe(120);
  });
});

describe('event contract', () => {
  it('65 required event types are registered with valid categories', () => {
    expect(Object.keys(EVENT_SPEC).sort()).toEqual([...requiredTypes].sort());
    const categories = ['lifecycle', 'entity', 'combat', 'ability', 'world', 'boss', 'diagnostics'];
    for (const spec of Object.values(EVENT_SPEC)) {
      expect(categories).toContain(spec.category);
      expect(new Set(spec.payload).size).toBe(spec.payload.length);
    }
  });

  it('priority range and event cap align with the scheduler contract', () => {
    expect(eventContract.priorityRange.min).toBe(0);
    expect(eventContract.priorityRange.max).toBe(120);
    expect(eventContract.eventCapPerBattle).toBe(10000);
    expect(eventContract.sortKeys).toEqual(['scheduledTick', 'eventPriority', 'sourceEntityId', 'abilityId', 'eventSequence']);
  });
});
