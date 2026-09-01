import { KernelInvariantError } from '../core/invariant-error.js';
import { overlapDepthX100, type Body } from '../geometry/distance.js';
import { asX100, laneOrdinal } from '../geometry/x100.js';

export const SEPARATION_MAX_X100_PER_ENTITY_TICK = asX100(25);

export interface SeparationResult {
  readonly bodies: readonly Body[];
  readonly residualOverlaps: number;
  readonly iterations: number;
  readonly safetyCapReached: boolean;
}

/** Canonical pair sort key per §8.2: lane ordinal, min entity id, max entity id. */
export function separationPairKey(a: Body, b: Body): readonly [number, string, string] {
  const minId = a.id < b.id ? a.id : b.id;
  const maxId = a.id < b.id ? b.id : a.id;
  return [laneOrdinal(a.lane), minId, maxId];
}

function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Resolves temporary ally overlap by moving each entity at most
 * `SEPARATION_MAX_X100_PER_ENTITY_TICK` per tick *cumulatively*, iterating until
 * no overlaps remain or the safety cap is reached. The per-entity movement
 * budget is tracked across iterations so a deep overlap is diagnosed as
 * residual instead of being silently over-resolved beyond the §8.2 cap. Pairs
 * are processed in canonical (lane, minId, maxId) order and re-derived from the
 * current state each iteration, so the result is permutation-invariant.
 */
export function separateAllies(bodies: readonly Body[], maxIterations = 8): SeparationResult {
  const working: Body[] = bodies.map((b) => ({ ...b }));
  const moved = new Map<string, number>();
  let iterations = 0;

  for (; iterations < maxIterations; iterations++) {
    const pairs: [number, number][] = [];
    for (let i = 0; i < working.length; i++) {
      const a = working[i];
      if (a === undefined) continue;
      for (let j = i + 1; j < working.length; j++) {
        const b = working[j];
        if (b === undefined) continue;
        if (a.lane === b.lane && overlapDepthX100(a, b) > 0) pairs.push([i, j]);
      }
    }
    if (pairs.length === 0) break;

    pairs.sort(([ai, aj], [bi, bj]) => {
      const a1 = working[ai];
      const a2 = working[aj];
      const b1 = working[bi];
      const b2 = working[bj];
      if (a1 === undefined || a2 === undefined || b1 === undefined || b2 === undefined) return 0;
      const ka = separationPairKey(a1, a2);
      const kb = separationPairKey(b1, b2);
      return ka[0] - kb[0] || compareIds(ka[1], kb[1]) || compareIds(ka[2], kb[2]);
    });

    for (const [i, j] of pairs) {
      const a = working[i];
      const b = working[j];
      if (a === undefined || b === undefined) continue;
      const depth = overlapDepthX100(a, b);
      if (depth <= 0) continue;
      // Deterministic left/right assignment: position first, then id.
      const aLeft = a.x100 < b.x100 || (a.x100 === b.x100 && a.id < b.id);
      const left = aLeft ? a : b;
      const right = aLeft ? b : a;
      const leftIndex = aLeft ? i : j;
      const rightIndex = aLeft ? j : i;
      const leftBudget = Math.max(0, SEPARATION_MAX_X100_PER_ENTITY_TICK - (moved.get(left.id) ?? 0));
      const rightBudget = Math.max(0, SEPARATION_MAX_X100_PER_ENTITY_TICK - (moved.get(right.id) ?? 0));
      const shift = Math.min(depth, leftBudget + rightBudget);
      if (shift <= 0) continue;
      const halfLow = Math.ceil(shift / 2);
      const leftShift = Math.min(halfLow, leftBudget);
      const rightShift = Math.min(shift - leftShift, rightBudget);
      working[leftIndex] = { ...left, x100: asX100(Math.max(0, left.x100 - leftShift)) };
      working[rightIndex] = { ...right, x100: asX100(Math.min(10000, right.x100 + rightShift)) };
      moved.set(left.id, (moved.get(left.id) ?? 0) + leftShift);
      moved.set(right.id, (moved.get(right.id) ?? 0) + rightShift);
    }
  }

  return {
    bodies: working,
    residualOverlaps: countResidualOverlaps(working),
    iterations,
    safetyCapReached: iterations >= maxIterations,
  };
}

function countResidualOverlaps(bodies: readonly Body[]): number {
  let count = 0;
  for (let i = 0; i < bodies.length; i++) {
    const a = bodies[i];
    if (a === undefined) continue;
    for (let j = i + 1; j < bodies.length; j++) {
      const b = bodies[j];
      if (b === undefined) continue;
      if (a.lane === b.lane && overlapDepthX100(a, b) > 0) count++;
    }
  }
  return count;
}

export interface EnemyBoundSeparation {
  /** +1 = team front is toward higher x (player), -1 = toward lower x (enemy). */
  readonly frontDirection: 1 | -1;
  /** Per-entity enemy boundary: the furthest center toward the enemy this tick. */
  readonly frontLimitX100: Readonly<Record<string, number>>;
}

/**
 * Side-aware ally separation (§8.2). For each overlapping pair the team-front
 * entity may advance toward the enemy only into its free space (up to its enemy
 * boundary), and the rear entity absorbs the remaining overlap away from the
 * enemy. Each entity still moves at most `SEPARATION_MAX_X100_PER_ENTITY_TICK`
 * cumulatively across iterations, and field bounds always hold. Residual
 * overlap is counted on the final state, so the §8.2 safety-cap diagnostic is
 * never under-reported.
 */
export function separateAlliesTowardEnemy(bodies: readonly Body[], maxIterations: number, separation: EnemyBoundSeparation): SeparationResult {
  const working: Body[] = bodies.map((b) => ({ ...b }));
  const moved = new Map<string, number>();
  const dir = separation.frontDirection;
  let iterations = 0;

  for (; iterations < maxIterations; iterations++) {
    const pairs: [number, number][] = [];
    for (let i = 0; i < working.length; i++) {
      const a = working[i];
      if (a === undefined) continue;
      for (let j = i + 1; j < working.length; j++) {
        const b = working[j];
        if (b === undefined) continue;
        if (a.lane === b.lane && overlapDepthX100(a, b) > 0) pairs.push([i, j]);
      }
    }
    if (pairs.length === 0) break;

    pairs.sort(([ai, aj], [bi, bj]) => {
      const a1 = working[ai];
      const a2 = working[aj];
      const b1 = working[bi];
      const b2 = working[bj];
      if (a1 === undefined || a2 === undefined || b1 === undefined || b2 === undefined) return 0;
      const ka = separationPairKey(a1, a2);
      const kb = separationPairKey(b1, b2);
      return ka[0] - kb[0] || compareIds(ka[1], kb[1]) || compareIds(ka[2], kb[2]);
    });

    for (const [i, j] of pairs) {
      const a = working[i];
      const b = working[j];
      if (a === undefined || b === undefined) continue;
      const depth = overlapDepthX100(a, b);
      if (depth <= 0) continue;
      // Front = more advanced toward the enemy; ties break by descending id so
      // the assignment is permutation-invariant.
      const aScore = dir * a.x100;
      const bScore = dir * b.x100;
      const frontIsA = aScore > bScore || (aScore === bScore && a.id > b.id);
      const front = frontIsA ? a : b;
      const rear = frontIsA ? b : a;
      const frontIndex = frontIsA ? i : j;
      const rearIndex = frontIsA ? j : i;
      const frontBudget = Math.max(0, SEPARATION_MAX_X100_PER_ENTITY_TICK - (moved.get(front.id) ?? 0));
      const rearBudget = Math.max(0, SEPARATION_MAX_X100_PER_ENTITY_TICK - (moved.get(rear.id) ?? 0));
      if (frontBudget + rearBudget <= 0) continue;
      const limit = separation.frontLimitX100[front.id];
      // A missing boundary means "no forward space": never push toward the enemy
      // without an explicit limit.
      const frontFree = limit === undefined ? 0 : dir === 1 ? limit - front.x100 : front.x100 - limit;
      const frontStep = Math.min(frontBudget, Math.max(0, frontFree));
      const rearStep = Math.min(rearBudget, Math.max(0, depth - frontStep));
      if (frontStep <= 0 && rearStep <= 0) continue;
      const frontX = dir === 1 ? Math.min(10000, front.x100 + frontStep) : Math.max(0, front.x100 - frontStep);
      const rearX = dir === 1 ? Math.max(0, rear.x100 - rearStep) : Math.min(10000, rear.x100 + rearStep);
      working[frontIndex] = { ...front, x100: asX100(frontX) };
      working[rearIndex] = { ...rear, x100: asX100(rearX) };
      moved.set(front.id, (moved.get(front.id) ?? 0) + frontStep);
      moved.set(rear.id, (moved.get(rear.id) ?? 0) + rearStep);
    }
  }

  return {
    bodies: working,
    residualOverlaps: countResidualOverlaps(working),
    iterations,
    safetyCapReached: iterations >= maxIterations,
  };
}

export interface OvertakeGrant {
  readonly entityId: string;
  readonly effectId: string;
  readonly startTick: number;
  readonly endTick: number;
}

/** Overtake authorization per §8.3: explicit, snapshotable and time-boxed. */
export function isOvertakeAuthorized(grant: OvertakeGrant, entityId: string, tick: number): boolean {
  return grant.entityId === entityId && tick >= grant.startTick && tick <= grant.endTick;
}

/** Validates an overtake grant; the window must be non-empty and non-negative. */
export function validateOvertakeGrant(grant: OvertakeGrant): void {
  if (!Number.isSafeInteger(grant.startTick) || !Number.isSafeInteger(grant.endTick) || grant.startTick < 0 || grant.endTick < grant.startTick) {
    throw new KernelInvariantError('P15_OVERTAKE_UNAUTHORIZED', { grant });
  }
}
