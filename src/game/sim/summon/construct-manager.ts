import { KernelInvariantError } from '../core/invariant-error.js';
import { REPAIR_DELAY_TICKS, type ConstructSlotPolicy, type TempEntity } from './temporary-entity.js';

/**
 * Phase 20 §7 construct manager. Constructs are stationary, occupy a fixed
 * construct slot and never stack. An occupied slot follows content policy
 * FAIL or REPLACE; both paths are visible and diagnosable. Repair begins only
 * after exactly 90 ticks without incoming damage; the first destroyed
 * authorized construct may create a protection field exactly once through an
 * existing effect command, keyed by a stable once-key.
 */

export { REPAIR_DELAY_TICKS };

export interface ConstructSlotDecision {
  readonly kind: 'PLACED' | 'REPLACED' | 'FAILED';
  readonly removedId?: string;
  readonly diagnostic?: string;
}

/** §7: an occupied slot resolves to FAIL or REPLACE, never silent stacking. */
export function resolveConstructSlot(
  occupant: TempEntity | undefined,
  policy: ConstructSlotPolicy,
): ConstructSlotDecision {
  if (occupant === undefined) return Object.freeze({ kind: 'PLACED' });
  if (policy === 'REPLACE') return Object.freeze({ kind: 'REPLACED', removedId: occupant.id });
  return Object.freeze({ kind: 'FAILED', diagnostic: 'ConstructSlotOccupied' });
}

/** §7 repair: first allowed on tick lastDamageTick + 90 (inclusive boundary). */
export function canRepair(currentTick: number, lastDamageTick: number): boolean {
  return currentTick - lastDamageTick >= REPAIR_DELAY_TICKS;
}

/** §7: incoming damage resets the repair window (lastDamageTick = tick). */
export function damageResetTick(tick: number): number {
  return tick;
}

/** §7: stable once-key for the first destroyed authorized construct's protection field. */
export function firstDestroyProtectionOnceKey(constructId: string): string {
  if (!/^[a-z][a-z0-9_]*$/.test(constructId)) {
    throw new KernelInvariantError('P20_CONSTRUCT_INVALID', { reason: 'construct-id-invalid', constructId });
  }
  return `protection_field_${constructId}_first_destroyed`;
}

/** §7: boss objects are their own category and count as neither summon nor normal construct. */
export function isBossObject(entity: TempEntity): boolean {
  return entity.kind === 'BOSS_OBJECT';
}
