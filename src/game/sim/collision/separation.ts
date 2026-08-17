import { KernelInvariantError } from '../core/invariant-error.js';
import { overlapDepthX100, type Body } from '../geometry/distance.js';
import { asX100 } from '../geometry/x100.js';

export const SEPARATION_MAX_X100_PER_ENTITY_TICK = asX100(25);

export interface SeparationResult {
  readonly bodies: readonly Body[];
  readonly residualOverlaps: number;
  readonly iterations: number;
  readonly safetyCapReached: boolean;
}

const LANE_ORDINAL: Readonly<Record<Body['lane'], number>> = Object.freeze({ top: 0, middle: 1, bottom: 2 });

/** Canonical pair sort key per §8.2: lane ordinal, min entity id, max entity id. */
export function separationPairKey(a: Body, b: Body): readonly [number, string, string] {
  const minId = a.id < b.id ? a.id : b.id;
  const maxId = a.id < b.id ? b.id : a.id;
  return [LANE_ORDINAL[a.lane], minId, maxId];
}

function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Resolves temporary ally overlap by moving each entity at most
 * `SEPARATION_MAX_X100_PER_ENTITY_TICK` per tick, iterating until no overlaps
 * remain or the safety cap is reached. Residual overlap is reported, never
 * silently dropped. Pairs are processed in canonical (lane, minId, maxId)
 * order and re-derived from the current state each iteration, so the result is
 * permutation-invariant and independent of entity insertion order.
 */
export function separateAllies(bodies: readonly Body[], maxIterations = 8): SeparationResult {
  const working: Body[] = bodies.map((b) => ({ ...b }));
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
      const shift = Math.min(depth, SEPARATION_MAX_X100_PER_ENTITY_TICK);
      // Deterministic left/right assignment: position first, then id, so the
      // ceil/floor split never depends on input array order.
      const aLeft = a.x100 < b.x100 || (a.x100 === b.x100 && a.id < b.id);
      const left = aLeft ? a : b;
      const right = aLeft ? b : a;
      const leftIndex = aLeft ? i : j;
      const rightIndex = aLeft ? j : i;
      const halfLow = Math.ceil(shift / 2);
      const halfHigh = shift - halfLow;
      working[leftIndex] = { ...left, x100: asX100(Math.max(0, left.x100 - halfLow)) };
      working[rightIndex] = { ...right, x100: asX100(Math.min(10000, right.x100 + halfHigh)) };
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
