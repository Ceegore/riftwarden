import { KernelInvariantError } from '../core/invariant-error.js';
import { asX100, type X100 } from '../geometry/x100.js';

export interface MovementStep {
  readonly stepX100: X100;
  readonly remainder: number;
}

/**
 * Converts a per-second X100 speed plus an authoritative rational remainder
 * into one 30-TPS tick: `n = remainder + speed`, `step = floor(n/30)`,
 * `remainder = n % 30`. No float accumulation, no wallclock delta.
 */
export function movementStep(speedX100PerSecond: number, remainder: number): MovementStep {
  if (!Number.isSafeInteger(speedX100PerSecond) || speedX100PerSecond < 0) {
    throw new KernelInvariantError('P15_X100_NOT_INTEGER', { speedX100PerSecond });
  }
  if (!Number.isInteger(remainder) || remainder < 0 || remainder >= 30) {
    throw new KernelInvariantError('P15_MOVE_REMAINDER_INVALID', { remainder });
  }
  const n = remainder + speedX100PerSecond;
  return Object.freeze({ stepX100: asX100(Math.floor(n / 30)), remainder: n % 30 });
}

/** Applies a signed X100 delta and clamps to the field boundary 0..10000. */
export function clampToField(x: X100, delta: X100, direction: 1 | -1): X100 {
  return asX100(Math.min(10000, Math.max(0, x + delta * direction)));
}
