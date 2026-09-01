import type { Lane, PresentedEntity, Side, WarningItem } from './types.js';

/**
 * Canonical presentation ordering (A11Y_TREE_LIVE_REGION_CONTRACT). Entities
 * sort by side (player before enemy), lane in canonical order, front X, then
 * stable entity id. Warnings sort by due tick, descending severity, lane,
 * front X, then stable event id. Never localeCompare, never array index —
 * ordering must be identical on every platform and locale.
 */
const SIDE_RANK: Readonly<Record<Side, number>> = Object.freeze({ PLAYER: 0, ENEMY: 1 });
const LANE_RANK: Readonly<Record<Lane, number>> = Object.freeze({ TOP: 0, MIDDLE: 1, BOTTOM: 2 });

export function compareCodeUnits(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export function sortEntities(items: readonly PresentedEntity[]): readonly PresentedEntity[] {
  return [...items].sort(
    (a, b) => SIDE_RANK[a.side] - SIDE_RANK[b.side] || LANE_RANK[a.lane] - LANE_RANK[b.lane] || a.x - b.x || compareCodeUnits(a.id, b.id),
  );
}

export function sortWarnings(items: readonly WarningItem[]): readonly WarningItem[] {
  return [...items].sort(
    (a, b) => a.dueTick - b.dueTick || b.severity - a.severity || LANE_RANK[a.lane] - LANE_RANK[b.lane] || a.x - b.x || compareCodeUnits(a.id, b.id),
  );
}

/**
 * Expired warnings (dueTick < currentTick) disappear deterministically.
 * Withdrawn warnings are simply absent from the authoritative list.
 */
export function filterActiveWarnings(items: readonly WarningItem[], currentTick: number): readonly WarningItem[] {
  return items.filter((item) => item.dueTick >= currentTick);
}
