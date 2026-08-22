/**
 * Phase 31 collection state (COMPARE_SORT_RESTORE_CONTRACT): default sorting
 * uses canonical keys (never localized strings), filters and scroll anchors
 * are serializable, and the return state restores deterministically. Deltas
 * are shown with symbol and number — this module owns the canonical ordering
 * and anchor restore, never display.
 */
export type SortKey = 'canonicalId' | 'sourceOrder';

export interface CollectionState {
  readonly sortKey: SortKey;
  readonly filter: string;
  readonly scrollAnchor?: string;
}

/** Canonical id order: locale-independent byte-wise comparison. */
export function canonicalSort(ids: readonly string[]): readonly string[] {
  return [...ids].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/**
 * Restores a scroll anchor: returns it when still present, otherwise the
 * first canonical id (or undefined for an empty collection).
 */
export function restoreAnchor(ids: readonly string[], anchor?: string): string | undefined {
  if (anchor !== undefined && ids.includes(anchor)) return anchor;
  return ids[0];
}
