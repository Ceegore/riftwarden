import type { AnnouncementEvent, AnnouncementKind } from './types.js';
import { HudError } from './hud-error.js';

/**
 * Live region contract: announcements are limited to battle/boss phase,
 * regular player unit loss, critical boss/hazard warnings and battle end —
 * never damage/heal/shield/target/status-tick spam. Deduplication uses the
 * stable event id plus a presentation-only cooldown window; authoritative
 * events are never lost.
 */
export const ANNOUNCE_KINDS: readonly AnnouncementKind[] = Object.freeze([
  'BATTLE_PHASE',
  'PLAYER_UNIT_LOST',
  'CRITICAL_BOSS_WARNING',
  'BATTLE_ENDED',
]);

export const SUPPRESSED_KINDS: readonly AnnouncementKind[] = Object.freeze([
  'DAMAGE',
  'HEAL',
  'SHIELD_CHANGED',
  'TARGET_CHANGED',
  'STATUS_TICK',
]);

export function isAnnounceable(kind: AnnouncementKind): boolean {
  return ANNOUNCE_KINDS.includes(kind);
}

export function validateAnnouncement(event: AnnouncementEvent): void {
  if (typeof event.id !== 'string' || event.id.length === 0) throw new HudError('INVALID_ANNOUNCEMENT', { field: 'id' });
  if (![...ANNOUNCE_KINDS, ...SUPPRESSED_KINDS].includes(event.kind)) throw new HudError('INVALID_ANNOUNCEMENT', { field: 'kind' });
  if (typeof event.text !== 'string') throw new HudError('INVALID_ANNOUNCEMENT', { field: 'text' });
  if (!Number.isSafeInteger(event.tick) || event.tick < 0) throw new HudError('INVALID_ANNOUNCEMENT', { field: 'tick' });
}

/**
 * Pure announcement filter: only announceable kinds, never an id that was
 * already announced.
 */
export function filterAnnouncements(events: readonly AnnouncementEvent[], seen: ReadonlySet<string>): AnnouncementEvent[] {
  const output: AnnouncementEvent[] = [];
  for (const event of events) {
    validateAnnouncement(event);
    if (isAnnounceable(event.kind) && !seen.has(event.id)) output.push(event);
  }
  return output;
}

export interface LiveRegionFilter {
  /**
   * Returns the events to announce for the given batch. An event id is only
   * announced once ever; a kind repeats only after the cooldown window (in
   * authoritative ticks) has passed. The window is presentation-only and
   * never discards authoritative events.
   */
  filter(events: readonly AnnouncementEvent[]): AnnouncementEvent[];
  readonly seenCount: number;
  hasSeen(id: string): boolean;
}

export function createLiveRegionFilter(windowTicks: number): LiveRegionFilter {
  if (!Number.isSafeInteger(windowTicks) || windowTicks < 0) throw new HudError('INVALID_ANNOUNCEMENT', { field: 'windowTicks' });
  let seen = new Set<string>();
  const lastKindTick = new Map<AnnouncementKind, number>();

  return {
    filter(events) {
      const output: AnnouncementEvent[] = [];
      for (const event of events) {
        validateAnnouncement(event);
        if (!isAnnounceable(event.kind)) continue;
        if (seen.has(event.id)) continue;
        const lastTick = lastKindTick.get(event.kind);
        if (lastTick !== undefined && event.tick - lastTick < windowTicks) continue;
        seen = new Set([...seen, event.id]);
        lastKindTick.set(event.kind, event.tick);
        output.push(event);
      }
      return output;
    },
    get seenCount() {
      return seen.size;
    },
    hasSeen(id) {
      return seen.has(id);
    },
  };
}
