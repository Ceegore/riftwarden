import { describe, expect, it } from 'vitest';
import { createLiveRegionFilter, filterAnnouncements, isAnnounceable, validateAnnouncement } from '../../src/game/hud/live-region.js';
import type { AnnouncementEvent } from '../../src/game/hud/types.js';
import { announcement, catchHudCode, readJson } from './phase26-helpers.js';

const liveRegionMatrix = readJson('fixtures/live-region-matrix.json') as {
  announce: readonly string[];
  suppress: readonly string[];
};

function rawAnnouncement(partial: Record<string, unknown>): AnnouncementEvent {
  return partial as unknown as AnnouncementEvent;
}

describe('Live region announcement matrix (live-region-matrix.json)', () => {
  it('announces exactly the pinned kinds and suppresses the rest', () => {
    for (const kind of liveRegionMatrix.announce) {
      expect(isAnnounceable(kind as AnnouncementEvent['kind'])).toBe(true);
    }
    for (const kind of liveRegionMatrix.suppress) {
      expect(isAnnounceable(kind as AnnouncementEvent['kind'])).toBe(false);
    }
  });

  it('filters out suppressed kinds and pre-seen ids', () => {
    const events = [
      announcement('d1', 'DAMAGE', { tick: 5 }),
      announcement('p1', 'BATTLE_PHASE', { tick: 6 }),
      announcement('h1', 'HEAL', { tick: 7 }),
      announcement('e1', 'BATTLE_ENDED', { tick: 9 }),
    ];
    const result = filterAnnouncements(events, new Set());
    expect(result.map((e) => e.id)).toEqual(['p1', 'e1']);
    // In-batch duplicate dedupe is the stateful LiveRegionFilter's job; the
    // pure function only filters kinds and ids already seen in prior batches.
    const withDup = filterAnnouncements([announcement('p1', 'BATTLE_PHASE', { tick: 8 })], new Set(['p1']));
    expect(withDup).toEqual([]);
  });

  it('never re-announces an id already seen in a previous batch', () => {
    const seen = new Set(['p1']);
    const result = filterAnnouncements([announcement('p1', 'BATTLE_PHASE', { tick: 6 })], seen);
    expect(result).toEqual([]);
  });
});

describe('Live region cooldown filter', () => {
  it('deduplicates a duplicate live event within one batch', () => {
    const filter = createLiveRegionFilter(30);
    const events = [
      announcement('a', 'BATTLE_PHASE', { tick: 10 }),
      announcement('a', 'BATTLE_PHASE', { tick: 10 }),
    ];
    expect(filter.filter(events).map((e) => e.id)).toEqual(['a']);
  });

  it('suppresses a kind repeat inside the cooldown window and allows it after', () => {
    const filter = createLiveRegionFilter(30);
    const first = filter.filter([announcement('a', 'CRITICAL_BOSS_WARNING', { tick: 10 })]);
    expect(first.map((e) => e.id)).toEqual(['a']);
    const inside = filter.filter([announcement('b', 'CRITICAL_BOSS_WARNING', { tick: 20 })]);
    expect(inside).toEqual([]);
    const after = filter.filter([announcement('c', 'CRITICAL_BOSS_WARNING', { tick: 40 })]);
    expect(after.map((e) => e.id)).toEqual(['c']);
  });

  it('tracks seen ids without ever losing authoritative events', () => {
    const filter = createLiveRegionFilter(0);
    filter.filter([announcement('x', 'PLAYER_UNIT_LOST', { tick: 1 })]);
    expect(filter.seenCount).toBe(1);
    expect(filter.hasSeen('x')).toBe(true);
    expect(filter.filter([announcement('x', 'PLAYER_UNIT_LOST', { tick: 2 })])).toEqual([]);
    // A different kind is still allowed immediately (window 0).
    expect(filter.filter([announcement('y', 'BATTLE_PHASE', { tick: 2 })])).toHaveLength(1);
  });

  it('suppresses only presentation, never the underlying events', () => {
    const filter = createLiveRegionFilter(30);
    const batch = [
      announcement('a', 'DAMAGE', { tick: 1 }),
      announcement('b', 'BATTLE_PHASE', { tick: 1 }),
      announcement('c', 'BATTLE_PHASE', { tick: 2 }),
    ];
    filter.filter(batch);
    expect(filter.seenCount).toBe(1);
  });

  it('rejects a negative cooldown window', () => {
    expect(catchHudCode(() => createLiveRegionFilter(-1))).toBe('INVALID_ANNOUNCEMENT');
  });
});

describe('Announcement validation', () => {
  it('rejects malformed announcements with a closed code', () => {
    expect(catchHudCode(() => {
      validateAnnouncement(rawAnnouncement({ id: '', kind: 'BATTLE_PHASE', text: 'x', tick: 0 }));
    })).toBe('INVALID_ANNOUNCEMENT');
    expect(catchHudCode(() => {
      validateAnnouncement(rawAnnouncement({ id: 'a', kind: 'UNKNOWN_KIND', text: 'x', tick: 0 }));
    })).toBe('INVALID_ANNOUNCEMENT');
    expect(catchHudCode(() => {
      validateAnnouncement(rawAnnouncement({ id: 'a', kind: 'BATTLE_PHASE', text: 42, tick: 0 }));
    })).toBe('INVALID_ANNOUNCEMENT');
    expect(catchHudCode(() => {
      validateAnnouncement(rawAnnouncement({ id: 'a', kind: 'BATTLE_PHASE', text: 'x', tick: -1 }));
    })).toBe('INVALID_ANNOUNCEMENT');
  });
});
