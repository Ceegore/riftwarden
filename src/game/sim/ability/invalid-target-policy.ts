import { KernelInvariantError } from '../core/invariant-error.js';
import { mulDivRound } from '../math/fixed-math.js';

/**
 * Phase 19 T05 invalid-target and meaningful-use policies (§9). Closed
 * policies: `wait`, `retarget_once_then_wait`, `consume_without_effect`.
 *
 * - `wait`: re-check next tick, consume nothing.
 * - `retarget_once_then_wait`: query exactly once in the same tick, then wait.
 *   Multiple retargets in one tick and double-commits are forbidden.
 * - `consume_without_effect`: only for a risk ability that is explicitly
 *   validated and disclosed — an undisclosed consume is a hard error (§13.1).
 *
 * Meaningful-use defaults (§9): heal only from ≥12% missing max LP, shield not
 * wasted at the defined threshold, damage/status needs a valid target or an
 * authorized ground snapshot, and a once-per-battle marker is not consumed
 * when the effect was never committed due to an invalid target.
 */

export type InvalidTargetPolicy = 'wait' | 'retarget_once_then_wait' | 'consume_without_effect';

export const INVALID_TARGET_POLICIES = ['wait', 'retarget_once_then_wait', 'consume_without_effect'] as const;

/** §9: heal is meaningful from at least 12% missing target max LP. */
export const DEFAULT_HEAL_MISSING_LP_PERCENT = 12;

export interface InvalidTargetContext {
  readonly tick: number;
  readonly policy: InvalidTargetPolicy;
  /** True when a retarget query already ran this tick (§9: at most once). */
  readonly retargetedThisTick: boolean;
  /** True when the ability is an explicitly validated+disclosed risk ability. */
  readonly consumeAuthorized: boolean;
}

export type InvalidTargetResolution =
  | { readonly action: 'wait'; readonly consumeUses: boolean }
  | { readonly action: 'retarget'; readonly consumeUses: boolean }
  | { readonly action: 'consume_without_effect'; readonly consumeUses: boolean };

/**
 * §9 resolution. `consume_without_effect` without explicit authorization is a
 * hard error (never a hidden consume); `retarget_once_then_wait` retargets
 * exactly once per tick and then waits.
 */
export function resolveInvalidTarget(policy: InvalidTargetPolicy, ctx: InvalidTargetContext): InvalidTargetResolution {
  if (!(INVALID_TARGET_POLICIES as readonly string[]).includes(policy)) {
    throw new KernelInvariantError('P19_INVALID_TARGET', { reason: 'unknown-policy', policy });
  }
  if (!Number.isSafeInteger(ctx.tick) || ctx.tick < 0) {
    throw new KernelInvariantError('P19_INVALID_TARGET', { reason: 'tick', tick: ctx.tick });
  }
  switch (policy) {
    case 'wait':
      return Object.freeze({ action: 'wait', consumeUses: false });
    case 'retarget_once_then_wait':
      return ctx.retargetedThisTick
        ? Object.freeze({ action: 'wait', consumeUses: false })
        : Object.freeze({ action: 'retarget', consumeUses: false });
    case 'consume_without_effect':
      if (!ctx.consumeAuthorized) {
        throw new KernelInvariantError('P19_INVALID_TARGET', { reason: 'undisclosed-consume' });
      }
      return Object.freeze({ action: 'consume_without_effect', consumeUses: true });
    default:
      throw new KernelInvariantError('P19_INVALID_TARGET', { reason: 'unknown-policy', policy });
  }
}

/** §9: heal is meaningful when missing LP reaches the threshold percent. */
export function isHealMeaningful(targetMaxLp: number, targetLp: number, thresholdPercent = DEFAULT_HEAL_MISSING_LP_PERCENT): boolean {
  assertLp(targetMaxLp, targetLp);
  if (!Number.isSafeInteger(thresholdPercent) || thresholdPercent < 0 || thresholdPercent > 100) {
    throw new KernelInvariantError('P19_INVALID_TARGET', { reason: 'heal-threshold', thresholdPercent });
  }
  const missing = targetMaxLp - targetLp;
  return missing >= mulDivRound(targetMaxLp, thresholdPercent, 100);
}

/** §9: a shield is not wasted while below the defined existing-shield threshold. */
export function isShieldMeaningful(currentShield: number, shieldThreshold: number): boolean {
  if (!Number.isSafeInteger(currentShield) || currentShield < 0 || Object.is(currentShield, -0)) {
    throw new KernelInvariantError('P19_INVALID_TARGET', { reason: 'shield', currentShield });
  }
  if (!Number.isSafeInteger(shieldThreshold) || shieldThreshold < 0) {
    throw new KernelInvariantError('P19_INVALID_TARGET', { reason: 'shield-threshold', shieldThreshold });
  }
  return currentShield < shieldThreshold;
}

/** §9: damage/status needs a valid target or an authorized ground snapshot. */
export function isDamageOrStatusMeaningful(targetValid: boolean, groundSnapshotAuthorized: boolean): boolean {
  return targetValid || groundSnapshotAuthorized;
}

/** §9: a once-per-battle marker is consumed only when the effect committed. */
export function shouldConsumeOnceMarker(effectCommitted: boolean): boolean {
  return effectCommitted;
}

function assertLp(maxLp: number, lp: number): void {
  for (const [field, value] of [['maxLp', maxLp], ['lp', lp]] as const) {
    if (!Number.isSafeInteger(value) || value < 0 || Object.is(value, -0)) throw new KernelInvariantError('P19_INVALID_TARGET', { field, value });
  }
  if (lp > maxLp) throw new KernelInvariantError('P19_INVALID_TARGET', { reason: 'lp-over-max', maxLp, lp });
}
