import type { Lane } from './types.js';

/**
 * Code-unit stable string comparison. Never localeCompare: canonical ordering
 * must be identical on every platform and locale (LAYER_GRAPH_SORT_CONTRACT).
 */
export function compareCodeUnits(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export interface SortableEntityView {
  readonly lane: Lane;
  readonly logicalX100: number;
  readonly id: string;
}

/**
 * Canonical entity presentation order: lane ordinal, logical X, stable entity
 * id. Array index or render insertion order is never authority.
 */
export function compareEntityViewOrder(a: SortableEntityView, b: SortableEntityView): number {
  return a.lane - b.lane || a.logicalX100 - b.logicalX100 || compareCodeUnits(a.id, b.id);
}

/** Stable sort: identical input in permuted order yields identical output. */
export function sortedEntityFrames<T extends SortableEntityView>(values: readonly T[]): readonly T[] {
  return [...values].sort(compareEntityViewOrder);
}
