import { statusKindOrdinal, removalReasonOrdinal, type RemovalReason, type StatusInstance } from './status-instance.js';

/**
 * Phase 18 T06 UI-safe events (§10). Payloads are integer/ID-based only — no
 * localized strings, no DOM/React/Pixi references, no callbacks. The string
 * enum values (kind, removal reason, ignore reason) are carried as stable
 * numeric ordinals so the event envelope stays `Record<string, number>`.
 */

export const STATUS_EVENT_TYPES = [
  'EffectApplied',
  'EffectRefreshed',
  'EffectIgnored',
  'EffectRemoved',
  'EffectTick',
  'EffectResisted',
] as const;
export type StatusEventType = (typeof STATUS_EVENT_TYPES)[number];

/** Closed ignore reasons for `EffectIgnored` (stack outcome tags, §6). */
export const STATUS_IGNORE_REASONS = [
  'ignored_weaker',
  'ignored_no_reapply',
  'ignored_duration_cap',
  'refreshed_no_delta',
] as const;
export type StatusIgnoreReason = (typeof STATUS_IGNORE_REASONS)[number];

const IGNORE_REASON_ORDINAL: Readonly<Record<StatusIgnoreReason, number>> = Object.freeze({
  ignored_weaker: 0,
  ignored_no_reapply: 1,
  ignored_duration_cap: 2,
  refreshed_no_delta: 3,
});

export function ignoreReasonOrdinal(reason: StatusIgnoreReason): number {
  return IGNORE_REASON_ORDINAL[reason];
}

/**
 * §10 payload: stackCount, endTick, strength and the kind/reason ordinals.
 * IDs (statusId/effectId/contentIconId) live in the event envelope's
 * `contentIds`; sourceId/targetId in `sourceId`/`targetIds`.
 */
export interface StatusEventPayload {
  readonly stackCount: number;
  readonly endTick: number;
  readonly strength: number;
  readonly kindOrdinal: number;
  readonly reasonOrdinal: number;
}

export function buildStatusPayload(instance: StatusInstance, stackCount: number, reason: RemovalReason): StatusEventPayload {
  return Object.freeze({
    stackCount,
    endTick: instance.endTick,
    strength: instance.strength,
    kindOrdinal: statusKindOrdinal(instance.kind),
    reasonOrdinal: removalReasonOrdinal(reason),
  });
}

/** Envelope contentIds for a status event: statusId, effectId, then optional contentIconId. */
export function statusContentIds(instance: StatusInstance): readonly string[] {
  const ids = [instance.statusId, instance.effectId];
  if (instance.contentIconId !== undefined) ids.push(instance.contentIconId);
  return Object.freeze(ids);
}
