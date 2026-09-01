import type { ReevaluateReason, TargetLock } from './types.js';

/**
 * Lock re-evaluation policy (kit): fixed locks never re-evaluate; an in-flight
 * lane change suppresses every reason except its own completion (a target-loss
 * signal must not abort a started normal lane change); signature locks only
 * re-evaluate on an invalid target.
 */
export function mayReevaluate(lock: TargetLock, reason: ReevaluateReason, laneChangeActive: boolean): boolean {
  if (lock.kind === 'fixed') return false;
  if (laneChangeActive && reason !== 'lanechange_completed') return false;
  if (lock.kind === 'signature_until_cast_end' && reason !== 'target_invalid') return false;
  return true;
}

/** A basic attack may not retarget in the same tick it was acquired. */
export function earliestRetargetTick(currentTick: number, isBasicAttack: boolean): number {
  return isBasicAttack ? currentTick + 1 : currentTick;
}
