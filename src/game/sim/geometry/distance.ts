import { KernelInvariantError } from '../core/invariant-error.js';
import { asX100, type Lane, type X100 } from './x100.js';

/** A geometric body: position, radius and lane. Rendering pixels excluded. */
export interface Body {
  readonly id: string;
  readonly x100: X100;
  readonly radiusX100: X100;
  readonly lane: Lane;
}

/** Edge-to-edge distance; touching bodies yield 0. */
export function edgeDistanceX100(a: Body, b: Body): X100 {
  return asX100(Math.max(0, Math.abs(a.x100 - b.x100) - a.radiusX100 - b.radiusX100));
}

/** Overlap depth; disjoint bodies yield 0. */
export function overlapDepthX100(a: Body, b: Body): X100 {
  return asX100(Math.max(0, a.radiusX100 + b.radiusX100 - Math.abs(a.x100 - b.x100)));
}

/** Range check; the range boundary is inclusive. */
export function isInRange(a: Body, b: Body, range: X100): boolean {
  if (range < 0) throw new KernelInvariantError('P15_RANGE_NEGATIVE', { range });
  return edgeDistanceX100(a, b) <= range;
}

/** Center distance required to keep a given edge-to-edge gap. */
export function requiredCenterDistanceX100(a: Body, b: Body, gap: X100): X100 {
  return asX100(a.radiusX100 + b.radiusX100 + gap);
}
