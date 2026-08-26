import type { KernelEvent } from '../events/event-types.js';
import type { EventSequence, Tick } from '../core/primitives.js';

/**
 * Phase 21 §6 boss-object reverse log. A deterministic, newest-first readable
 * view of object lifecycle for the dev-UX / save-resume evidence surface. It
 * folds the two signals the player must not miss into stable rows:
 * - `OBJECT_REMOVED`: the `Removed` kernel event a cleanup policy commits
 *   (owner source, object target) at the tick its removal lands;
 * - `PROTECT_OBJECT_FAILED`: the forced DEFEAT terminal produced when a
 *   protect_object body dies — read from the terminal `endReason`.
 *
 * The log is pure over two inputs — the *sequential* kernel event history and
 * the terminal outcome — so a resumed save reproduces bit-identical rows: a
 * resume reconstructs the same event history plus the same terminal, therefore
 * `buildReverseLog(prefix ++ suffix, end) ===
 * extendReverseLog(buildReverseLog(prefix), suffix, end)`.
 * Rows are newest-first (the top of a battle recap); sequences are assigned in
 * chronological order and monotonically increase, so the front row (newest)
 * carries the highest sequence and a UI can re-order/de-duplicate stably.
 */

export type BossObjectLogKind = 'OBJECT_REMOVED' | 'PROTECT_OBJECT_FAILED';

export interface BossObjectLogRow {
  readonly sequence: number;
  readonly tick: number;
  readonly kind: BossObjectLogKind;
  readonly objectId: string | null;
  readonly detail: string;
}

const SOURCE_PREFIX = 'row.object_removed:';

/** Builds the newest-first reverse log over a sequential event history. */
export function buildReverseLog(events: readonly KernelEvent[], endReason: string | null, startSequence = 0): readonly BossObjectLogRow[] {
  const removed: BossObjectLogRow[] = [];
  let sequence = startSequence;
  for (const event of events) {
    // Only the §6 cleanup system's `Removed` events describe boss-object
    // lifecycle; other removals (e.g. a Phase-20 summon despawn) carry other
    // log tags and must never appear as OBJECT_REMOVED rows.
    if (event.type !== 'Removed' || event.targetIds.length !== 1) continue;
    if (!event.logTags.includes('sim.phase21')) continue;
    const row: BossObjectLogRow = Object.freeze({
      sequence,
      tick: Number(event.tick),
      kind: 'OBJECT_REMOVED',
      objectId: event.targetIds[0] ?? null,
      detail: `${SOURCE_PREFIX}${event.sourceId ?? '?'}`,
    });
    sequence += 1;
    removed.push(row);
  }
  const protect: BossObjectLogRow | null = endReason === 'protect_object_failed'
    ? Object.freeze({ sequence, tick: 0, kind: 'PROTECT_OBJECT_FAILED' as const, objectId: null, detail: 'row.protect_object_failed' })
    : null;
  // Newest-first: the terminal (and later removals) land at the front.
  return Object.freeze([...(protect ? [protect] : []), ...removed.reverse()]);
}

function reconstructRemovedEvent(row: { readonly tick: number; readonly sequence: number; readonly objectId: string | null; readonly detail: string }): KernelEvent {
  const sourceId = row.detail.startsWith(SOURCE_PREFIX) ? row.detail.slice(SOURCE_PREFIX.length) : null;
  return Object.freeze({
    type: 'Removed',
    sourceId,
    targetIds: Object.freeze(row.objectId !== null ? [row.objectId] : []),
    contentIds: Object.freeze([]),
    payload: Object.freeze({}),
    logTags: Object.freeze(['sim.phase21']),
    tick: row.tick as Tick,
    sequence: row.sequence as EventSequence,
  });
}

/**
 * Appends a suffix of the event history to an existing reverse log (the resume
 * path). The base is the prefix run's newest-first rows; we reconstruct the
 * chronological prefix's `Removed` events and fold the suffix through the same
 * builder, so the result is byte-identical to building over the uninterrupted
 * history.
 */
export function extendReverseLog(base: readonly BossObjectLogRow[], suffixEvents: readonly KernelEvent[], endReason: string | null): readonly BossObjectLogRow[] {
  const prefixRemoved: KernelEvent[] = [];
  // base is newest-first; walk it new-to-old and collect only OBJECT_REMOVED rows
  // in oldest-first order so the fold reproduces the uninterrupted chronology.
  for (let i = base.length - 1; i >= 0; i--) {
    const row = base[i];
    if (row?.kind === 'OBJECT_REMOVED') prefixRemoved.push(reconstructRemovedEvent(row));
  }
  return buildReverseLog([...prefixRemoved, ...suffixEvents], endReason);
}
