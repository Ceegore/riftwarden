import { KernelInvariantError } from '../core/invariant-error.js';

declare const x100Brand: unique symbol;

/** Authoritative integer position/distance unit: 1 X = 100 X100. */
export type X100 = number & { readonly [x100Brand]: true };

export const LANES = ['top', 'middle', 'bottom'] as const;
export type Lane = (typeof LANES)[number];
export const LANE_ORDINAL: Readonly<Record<Lane, number>> = Object.freeze({ top: 0, middle: 1, bottom: 2 });

/** Deterministic lane ordinal; rejects an unknown lane at runtime (P15_LANE_INVALID). */
export function laneOrdinal(lane: Lane): number {
  const ordinal = (LANE_ORDINAL as Readonly<Record<string, number | undefined>>)[lane];
  if (ordinal === undefined) throw new KernelInvariantError('P15_LANE_INVALID', { lane });
  return ordinal;
}

/** Validates any integer X100 value (positions, radii, distances, gaps). */
export function asX100(value: number): X100 {
  if (!Number.isSafeInteger(value)) throw new KernelInvariantError('P15_X100_NOT_INTEGER', { value });
  return value as X100;
}

/** Validates an X100 value inside the battlefield center range 0..10000. */
export function asFieldX100(value: number): X100 {
  const x = asX100(value);
  if (x < 0 || x > 10000) throw new KernelInvariantError('P15_POSITION_OUT_OF_FIELD', { value: x });
  return x;
}

/** Validates a non-negative X100 value (radius, distance, gap, separation). */
export function nonNegativeX100(value: number, code = 'P15_RANGE_NEGATIVE'): X100 {
  const x = asX100(value);
  if (x < 0) throw new KernelInvariantError(code, { value: x });
  return x;
}
