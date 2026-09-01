/**
 * Deterministic inspector selection fallback (INSPECTOR_SELECTION_CONTRACT):
 * when the selected entity disappears, the selection moves to the next entity
 * of the same sorted list, otherwise to the first entity, otherwise to the
 * empty state. The starter-kit reference returned the previous entity when
 * the removed one was last; the handbook (primary authority) specifies the
 * first entity instead — all pinned fixture cases agree with both readings.
 */
export function fallbackSelection(orderedIds: readonly string[], selectedId: string | undefined, removedId: string): string | undefined {
  if (selectedId !== removedId) return selectedId;
  const index = orderedIds.indexOf(removedId);
  if (index < 0) return orderedIds[0];
  const next = orderedIds[index + 1];
  if (next !== undefined) return next;
  // The removed entity was last: fall back to the first OTHER entity, or to
  // the empty state when it was the only entity.
  return orderedIds.find((id) => id !== removedId);
}
