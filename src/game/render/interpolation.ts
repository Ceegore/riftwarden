import { RenderError } from './render-error.js';

/**
 * Alpha is an integer in 0..1000 only (SNAPSHOT_INTERPOLATION_CONTRACT).
 * Non-integer or out-of-range values are contract violations, not silent
 * clamps.
 */
export function clampAlpha1000(value: number): number {
  if (!Number.isInteger(value)) throw new RenderError('ALPHA_NOT_INTEGER', { value });
  return Math.max(0, Math.min(1000, value));
}

/**
 * Integer visual interpolation between two confirmed snapshot values.
 * Rounds half away from zero; never extrapolates because alpha is clamped to
 * 0..1000. Gameplay values (lane, existence, HP, defeat) are never passed
 * through this function.
 */
export function interpolateInt(from: number, to: number, alpha1000: number): number {
  const alpha = clampAlpha1000(alpha1000);
  const delta = to - from;
  const scaled = delta * alpha;
  const quotient = Math.trunc(scaled / 1000);
  const remainder = Math.abs(scaled % 1000);
  const rounded = remainder >= 500 ? quotient + (scaled >= 0 ? 1 : -1) : quotient;
  const result = from + rounded;
  // Canonical encoders reject -0; normalize it away defensively.
  return Object.is(result, -0) ? 0 : result;
}
