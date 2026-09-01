import { KernelInvariantError } from '../core/invariant-error.js';
import type { KernelEventInput } from '../events/event-types.js';
import type { TriggerReasonCode } from './trigger-evaluator.js';

/**
 * Phase 19 T06/§12 UI-safe ability events. Payloads are integer/ID-based only:
 * no localized strings, no DOM/React/Pixi references, no callbacks. Closed
 * trigger/rejection reasons are carried as stable numeric ordinals so the
 * event envelope stays `Record<string, number>`.
 */

export const TRIGGER_REASON_CODES = [
  'battle_start',
  'tick_interval_due',
  'hp_below_crossed',
  'hp_above_crossed',
  'event_seen',
  'event_not_seen',
  'status_present',
  'status_absent',
  'target_condition',
  'once_already_fired',
  'once_first_fire',
  'charge_ready',
  'charge_not_ready',
  'entity_defeated',
  'boss_phase',
  'count_in_range',
  'all_matched',
  'any_matched',
  'not_matched',
  'no_match',
] as const;

const TRIGGER_REASON_ORDINAL: Readonly<Record<TriggerReasonCode, number>> = Object.freeze(
  Object.fromEntries(TRIGGER_REASON_CODES.map((code, index) => [code, index])) as Record<TriggerReasonCode, number>,
);

export function triggerReasonOrdinal(reason: TriggerReasonCode): number {
  return TRIGGER_REASON_ORDINAL[reason];
}

export const ABILITY_REJECT_REASONS = ['not_ready', 'no_target', 'silenced', 'exhausted'] as const;
export type AbilityRejectReason = (typeof ABILITY_REJECT_REASONS)[number];

const ABILITY_REJECT_ORDINAL: Readonly<Record<AbilityRejectReason, number>> = Object.freeze({
  not_ready: 0,
  no_target: 1,
  silenced: 2,
  exhausted: 3,
});

export function abilityRejectOrdinal(reason: AbilityRejectReason): number {
  return ABILITY_REJECT_ORDINAL[reason];
}

/** Envelope for an ability event; sourceId/targetIds/contentIds are IDs only. */
export function abilityEventInput(
  type: 'AbilityTriggered' | 'AbilityTargetSelected' | 'AbilityWaitingTarget' | 'AbilityCastStarted' | 'AbilityCommitted' | 'AbilityInterrupted' | 'AbilityEffectQueued' | 'AbilityRecovered' | 'AbilityCooldownStarted' | 'AbilityReady' | 'AbilityConsumed' | 'AbilityRejected',
  sourceId: string | null,
  targetIds: readonly string[],
  contentIds: readonly string[],
  payload: Readonly<Record<string, number>>,
): KernelEventInput {
  return Object.freeze({ type, sourceId, targetIds: Object.freeze([...targetIds]), contentIds: Object.freeze([...contentIds]), payload: Object.freeze({ ...payload }), logTags: Object.freeze([]) });
}

export function assertAbilityEventType(type: string): void {
  const closed = [
    'AbilityTriggered',
    'AbilityTargetSelected',
    'AbilityWaitingTarget',
    'AbilityCastStarted',
    'AbilityCommitted',
    'AbilityInterrupted',
    'AbilityEffectQueued',
    'AbilityRecovered',
    'AbilityCooldownStarted',
    'AbilityReady',
    'AbilityConsumed',
    'AbilityRejected',
  ];
  if (!closed.includes(type)) throw new KernelInvariantError('P19_ABILITY_EVENT', { type });
}
