import { mulDivRound } from '../math/fixed-math.js';
import { PERMANENT_END_TICK, type StatusInstance, type StatusKind } from './status-instance.js';

/**
 * Phase 18 T06 pure read models (§10). Selectors expose only derived, integer
 * values — icon shape, progress in basis points, remaining ticks, source and
 * stack counts. The UI must never write status duration back (§10).
 */

/** Elapsed progress through the status duration in basis points, clamped to [0, 10000]. */
export function progressBps(instance: StatusInstance, now: number): number {
  if (instance.endTick === PERMANENT_END_TICK) return 0;
  const total = instance.endTick - instance.startTick;
  if (total <= 0) return 10000;
  const elapsed = Math.max(0, Math.min(now, instance.endTick) - instance.startTick);
  return Math.min(10000, Math.max(0, mulDivRound(elapsed, 10000, total)));
}

/** Number of distinct source entities across the given instances. */
export function sourceCount(instances: readonly StatusInstance[]): number {
  return new Set(instances.map((instance) => instance.sourceId)).size;
}

/** Stack count, optionally restricted to one kind. */
export function stackCount(instances: readonly StatusInstance[], kind?: StatusKind): number {
  if (kind === undefined) return instances.length;
  let result = 0;
  for (const instance of instances) if (instance.kind === kind) result += 1;
  return result;
}
