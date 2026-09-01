import { describe, expect, it } from 'vitest';
import { buildReverseLog, extendReverseLog, type BossObjectLogRow } from '../../src/game/sim/boss/boss-object-log.js';
import type { KernelEvent } from '../../src/game/sim/events/event-types.js';
import type { Tick, EventSequence } from '../../src/game/sim/core/primitives.js';

/**
 * Phase 21 §6 reverse-log contract. The readable object-lifecycle log must fold
 * the cleanup and protect-object-failure signals into stable newest-first rows,
 * and must be byte-identical across a save\->resume boundary: building the log
 * over the uninterrupted history equals folding a prefix log with the resume
 * suffix. This is the evidence a dev-UX / save-state resume view renders.
 */

function rem(tick: number, seq: number, sourceId: string, targetId: string): KernelEvent {
  return Object.freeze({
    type: 'Removed', sourceId, targetIds: Object.freeze([targetId]), contentIds: Object.freeze([]),
    payload: Object.freeze({}), logTags: Object.freeze(['sim.phase21']),
    tick: tick as Tick, sequence: seq as EventSequence,
  });
}

function rowsOf(events: readonly KernelEvent[], endReason: string | null): readonly BossObjectLogRow[] {
  return buildReverseLog(events, endReason);
}

const PREFIX = Object.freeze([rem(2, 1, 'boss_ash_unit', 'obj_ward'), rem(4, 2, 'boss_ash_unit', 'obj_pylon')]);
const SUFFIX = Object.freeze([rem(6, 3, 'boss_ash_unit', 'obj_core')]);
const ALL = Object.freeze([...PREFIX, ...SUFFIX]);

describe('P21 boss-object reverse log (§6)', () => {
  it('folds Removed events into newest-first stable rows', () => {
    const rows = rowsOf(ALL, null);
    // Newest (obj_core, tick 6) is at the front.
    expect(rows[0]?.objectId).toBe('obj_core');
    expect(rows[0]?.tick).toBe(6);
    expect(rows[0]?.kind).toBe('OBJECT_REMOVED');
    expect([...rows.map((r) => r.sequence)]).toEqual([2, 1, 0]);
    expect([...rows.map((r) => r.objectId)]).toEqual(['obj_core', 'obj_pylon', 'obj_ward']);
  });

  it('places the protect-object terminal as the top row when the reason signals the failure', () => {
    const rows = rowsOf(ALL, 'protect_object_failed');
    expect(rows[0]?.kind).toBe('PROTECT_OBJECT_FAILED');
    expect(rows[0]?.objectId).toBeNull();
    expect(rows[0]?.detail).toBe('row.protect_object_failed');
    expect([...rows.map((r) => r.sequence)]).toEqual([3, 2, 1, 0]);
  });

  it('a terminal that is not protect-object failure adds no terminal row', () => {
    const rows = rowsOf(ALL, 'elimination');
    expect(rows.some((r) => r.kind === 'PROTECT_OBJECT_FAILED')).toBe(false);
    expect([...rows.map((r) => r.kind)]).toEqual(['OBJECT_REMOVED', 'OBJECT_REMOVED', 'OBJECT_REMOVED']);
  });

  it('byte-identical across a resume boundary (fold == uninterrupted build)', () => {
    for (const end of ['protect_object_failed' as const, null]) {
      const full = buildReverseLog(ALL, end);
      const folded = extendReverseLog(buildReverseLog(PREFIX, null), SUFFIX, end);
      expect(folded, `endReason=${String(end)}`).toEqual(full);
    }
  });

  it('resume fold is stable even when the prefix has no removals (empty base)', () => {
    const full = buildReverseLog(SUFFIX, 'protect_object_failed');
    const folded = extendReverseLog(buildReverseLog([], null), SUFFIX, 'protect_object_failed');
    expect(folded).toEqual(full);
  });

  it('extends a partial log (mid-resume suffix) identically', () => {
    // Simulate resuming at tick 4: prefix includes the first two removals, the
    // resumed suffix adds the third plus the terminal.
    const base = buildReverseLog(PREFIX, null);
    const resumed = extendReverseLog(base, SUFFIX, 'protect_object_failed');
    const full = buildReverseLog(ALL, 'protect_object_failed');
    expect(resumed).toEqual(full);
  });

  it('ignores non-boss-object Removed events (other log tags never become rows)', () => {
    // A Phase-20 summon despawn also emits a single-target `Removed`, but with
    // the phase-20 log tag. Only the §6 cleanup tag may produce OBJECT_REMOVED
    // rows, so the summon removal must be invisible to the log.
    const summonRemoved = Object.freeze({
      type: 'Removed' as const, sourceId: 'ability_summoner', targetIds: Object.freeze(['unit_minion_1']),
      contentIds: Object.freeze([]), payload: Object.freeze({}), logTags: Object.freeze(['sim.phase20']),
      tick: 5 as Tick, sequence: 9 as EventSequence,
    });
    const bossRemoved = rem(6, 3, 'boss_ash_unit', 'obj_core');
    const rows = buildReverseLog(Object.freeze([summonRemoved, bossRemoved]), 'protect_object_failed');
    // Front row is the protect-failure terminal (null objectId), then the one
    // boss-object removal — the summon removal never becomes a row.
    expect(rows.map((r) => r.objectId)).toEqual([null, 'obj_core']);
    expect(rows.some((r) => r.objectId === 'unit_minion_1')).toBe(false);
  });
});
