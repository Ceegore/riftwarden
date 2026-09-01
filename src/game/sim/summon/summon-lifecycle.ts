import type { TempEntity } from './temporary-entity.js';

/**
 * Phase 20 §6 summon lifecycle. Expiry (`currentTick >= expiresAtTick`) is
 * `EXPIRED`, never `DEFEATED`. Owner death removes a summon only when content
 * sets `removeOnOwnerDefeat`. Removal cleans up target indexes, planned
 * events, projectiles, status references, slot/counter entries and pending
 * commands; removed entities cannot be revived except through an explicit
 * replace/revive contract that issues a new entity id.
 */

export type LifecycleStatus = 'ACTIVE' | 'EXPIRED' | 'DEFEATED';

/** §6 expiry boundary is inclusive: at currentTick === expiresAtTick it expires. */
export function isExpired(entity: TempEntity, tick: number): boolean {
  return entity.expiresAtTick !== undefined && tick >= entity.expiresAtTick;
}

export function removalReason(entity: TempEntity, tick: number, lp: number): LifecycleStatus {
  if (isExpired(entity, tick)) return 'EXPIRED';
  if (lp <= 0) return 'DEFEATED';
  return 'ACTIVE';
}

/** §6: summons alone never prevent battle end; only regular units and objectives continue it. */
export function eligibleForCombatContinuation(entity: TempEntity): boolean {
  return entity.kind !== 'SUMMON';
}

/** §6: owner death removes the summon only when content opts in. */
export function shouldRemoveOnOwnerDefeat(entity: TempEntity): boolean {
  return entity.removeOnOwnerDefeat === true;
}

/** Removal cleanup categories (§6). The kernel maps these onto removal commands. */
export const REMOVAL_CLEANUP_CATEGORIES = [
  'target_index',
  'planned_events',
  'projectiles',
  'status_references',
  'slot_counter',
  'pending_commands',
] as const;
export type RemovalCleanupCategory = (typeof REMOVAL_CLEANUP_CATEGORIES)[number];

/** Deterministic cleanup plan for a removed temporary entity (§6). */
export function removalCleanupPlan(entityId: string): readonly { readonly category: RemovalCleanupCategory; readonly entityId: string }[] {
  return Object.freeze(REMOVAL_CLEANUP_CATEGORIES.map((category) => Object.freeze({ category, entityId })));
}
