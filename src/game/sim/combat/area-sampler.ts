import { KernelInvariantError } from '../core/invariant-error.js';
import type { KernelEntity } from '../core/entity.js';
import { edgeDistanceX100, type Body } from '../geometry/distance.js';
import { asX100, nonNegativeX100, type Lane, type X100 } from '../geometry/x100.js';

/**
 * Authoritative AoE shapes (§P17-T03 §7). All distances in X100, all checks
 * integer. A target is hit when its collision circle touches the AoE boundary
 * (inclusive: `edgeDistance <= 0`). Renderer hitboxes are never a source.
 *
 * - `point`: a circle in exactly one lane.
 * - `radius`: a circle whose lane set is the explicit `laneMask`. Multi-lane
 *   areas always require the explicit mask — never a guessed lane.
 * - `line`: a capsule of width `widthX100` along the `fromX100 -> toX100`
 *   segment in one lane.
 */
export type AoEShape =
  | Readonly<{ kind: 'point'; x100: X100; lane: Lane; radiusX100: X100 }>
  | Readonly<{ kind: 'radius'; x100: X100; radiusX100: X100; laneMask: readonly Lane[] }>
  | Readonly<{ kind: 'line'; fromX100: X100; toX100: X100; lane: Lane; widthX100: X100 }>;

const LANE_SET: ReadonlySet<string> = new Set(['top', 'middle', 'bottom']);

export function validateAoEShape(shape: AoEShape): void {
  if (shape.kind === 'point' || shape.kind === 'line') {
    if (!LANE_SET.has(shape.lane)) throw new KernelInvariantError('P15_LANE_INVALID', { lane: shape.lane });
  }
  if (shape.kind === 'point' || shape.kind === 'radius') {
    nonNegativeX100(shape.x100, 'P15_POSITION_OUT_OF_FIELD');
    if (shape.x100 > 10000) throw new KernelInvariantError('P15_POSITION_OUT_OF_FIELD', { value: shape.x100 });
    nonNegativeX100(shape.radiusX100, 'P15_RANGE_NEGATIVE');
  }
  if (shape.kind === 'radius') {
    if (shape.laneMask.length === 0) throw new KernelInvariantError('P15_LANE_INVALID', { reason: 'empty-lane-mask' });
    const seen = new Set<string>();
    for (const lane of shape.laneMask) {
      if (!LANE_SET.has(lane)) throw new KernelInvariantError('P15_LANE_INVALID', { lane });
      if (seen.has(lane)) throw new KernelInvariantError('P15_LANE_INVALID', { reason: 'duplicate-lane-mask', lane });
      seen.add(lane);
    }
  }
  if (shape.kind === 'line') {
    nonNegativeX100(shape.fromX100, 'P15_POSITION_OUT_OF_FIELD');
    nonNegativeX100(shape.toX100, 'P15_POSITION_OUT_OF_FIELD');
    if (shape.fromX100 > 10000 || shape.toX100 > 10000) throw new KernelInvariantError('P15_POSITION_OUT_OF_FIELD', { fromX100: shape.fromX100, toX100: shape.toX100 });
    nonNegativeX100(shape.widthX100, 'P15_RANGE_NEGATIVE');
    if (shape.fromX100 === shape.toX100 && shape.widthX100 === 0) throw new KernelInvariantError('P15_RANGE_NEGATIVE', { reason: 'degenerate-line' });
  }
}

function bodyOf(entity: KernelEntity): Body {
  return { id: entity.id, x100: asX100(entity.x100), radiusX100: asX100(entity.radiusX100 ?? 0), lane: entity.lane };
}

/** Distance from a point to the 1-D segment [a, b]; 0 when inside. */
function pointToSegmentDistanceX100(px: number, a: number, b: number): number {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  if (px < lo) return lo - px;
  if (px > hi) return px - hi;
  return 0;
}

function hitByShape(shape: AoEShape, entity: KernelEntity): boolean {
  const target = bodyOf(entity);
  if (shape.kind === 'point') {
    if (target.lane !== shape.lane) return false;
    const boundary: Body = { id: 'aoe', x100: shape.x100, radiusX100: shape.radiusX100, lane: shape.lane };
    return edgeDistanceX100(boundary, target) <= 0;
  }
  if (shape.kind === 'radius') {
    if (!(shape.laneMask as readonly string[]).includes(target.lane)) return false;
    const boundary: Body = { id: 'aoe', x100: shape.x100, radiusX100: shape.radiusX100, lane: target.lane };
    return edgeDistanceX100(boundary, target) <= 0;
  }
  // line: capsule of width `widthX100`; the target circle touches it when the
  // distance from its center to the segment minus its radius is <= width / 2.
  if (target.lane !== shape.lane) return false;
  const centerDistance = pointToSegmentDistanceX100(target.x100, shape.fromX100, shape.toX100);
  const halfWidth = Math.floor(shape.widthX100 / 2);
  return centerDistance - target.radiusX100 - halfWidth <= 0;
}

/**
 * §7 sampling: geometric validity first (inclusive boundary touch), then a
 * stable sort by entity id. Each entity is returned at most once — the
 * "at most once per attackInstanceId + effectIndex" rule is enforced by the
 * caller queueing exactly one application per sampled target per impact.
 * Cover never makes a target invalid. Friendly units of the source side are
 * excluded, mirroring the projectile impact convention.
 */
export function sampleAreaTargets(shape: AoEShape, entities: readonly KernelEntity[], sourceSide: string): readonly KernelEntity[] {
  validateAoEShape(shape);
  const seen = new Set<string>();
  const hits: KernelEntity[] = [];
  for (const entity of entities) {
    if (entity.side === sourceSide) continue;
    if (entity.phase.phase !== 'ACTIVE') continue;
    if (seen.has(entity.id)) continue;
    if (!hitByShape(shape, entity)) continue;
    seen.add(entity.id);
    hits.push(entity);
  }
  hits.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return Object.freeze(hits);
}

/** AoE cover: a shaped area is a magic area — no projectile cover reduction. */
export function aoeCoverReductionBps(): number {
  return 0;
}
