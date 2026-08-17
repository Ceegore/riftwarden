import { KernelInvariantError } from '../core/invariant-error.js';
import { overlapDepthX100, type Body } from '../geometry/distance.js';
import { asX100, type X100 } from '../geometry/x100.js';

export interface MoveIntent {
  readonly entityId: string;
  readonly fromX100: X100;
  readonly radiusX100: X100;
  readonly lane: Body['lane'];
  readonly direction: 1 | -1;
  readonly desiredStepX100: X100;
}

/** The minimum center distance two enemy bodies on the same lane must keep (§8.1). */
export function enemyContactDistanceX100(a: Body, b: Body): X100 {
  return asX100(a.radiusX100 + b.radiusX100);
}

/** True when two enemy bodies overlap, violating the pass-through contract. */
export function violatesEnemyPassThrough(a: Body, b: Body): boolean {
  return overlapDepthX100(a, b) > 0;
}

/**
 * Clamps a forward movement so the mover never crosses an enemy's boundary
 * (or, with a stop gap, stops at the legal melee stop distance). Only enemies
 * in front of the mover block, so front order is preserved. Returns a step in
 * `0..desiredStepX100`.
 */
export function resolveEnemyStop(intent: MoveIntent, enemies: readonly Body[], stopGapX100: X100): X100 {
  const mover: Body = { id: intent.entityId, x100: intent.fromX100, radiusX100: intent.radiusX100, lane: intent.lane };
  let allowedStep: number = intent.desiredStepX100;
  for (const enemy of enemies) {
    const forward = intent.direction === 1 ? enemy.x100 > intent.fromX100 : enemy.x100 < intent.fromX100;
    if (!forward) continue;
    const gap = enemyContactDistanceX100(mover, enemy) + stopGapX100;
    const reachable = intent.direction === 1 ? enemy.x100 - intent.fromX100 - gap : intent.fromX100 - enemy.x100 - gap;
    if (reachable < allowedStep) allowedStep = Math.max(0, reachable);
  }
  return asX100(allowedStep);
}

function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Verifies that the relative order of front positions on a lane did not change
 * between two snapshots. Equal positions keep their prior relative order via a
 * stable id tiebreak, so a pure front-order swap is always detected.
 */
export function preservesFrontOrder(before: readonly Body[], after: readonly Body[]): boolean {
  const orderOf = (bodies: readonly Body[]): readonly string[] =>
    [...bodies].sort((a, b) => a.x100 - b.x100 || compareIds(a.id, b.id)).map((b) => b.id);
  const beforeIds = orderOf(before);
  const afterIds = orderOf(after);
  if (beforeIds.length !== afterIds.length) return false;
  return beforeIds.every((id, index) => id === afterIds[index]);
}

/** Returns the bodies that overlap `target` beyond depth 0. */
export function overlappingBodies(target: Body, bodies: readonly Body[]): readonly Body[] {
  return bodies.filter((b) => b.id !== target.id && overlapDepthX100(target, b) > 0);
}

/** Throws when a radius is negative, per the P15 radius guard. */
export function assertNonNegativeRadius(radiusX100: X100): void {
  if (radiusX100 < 0) throw new KernelInvariantError('P15_RADIUS_NEGATIVE', { radiusX100 });
}
