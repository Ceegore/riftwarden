/**
 * Event content validator (EVENT_SYSTEM_CONTRACT): exactly 30 events, unique
 * event ids, 2–3 unique options per event, stable id shapes and closed
 * preview kinds. Unknown event references are content build errors — never
 * silently skipped. Ported from the Phase 32 starter-kit semantics and
 * extended with the pinned fixture fields.
 */
import { ExpeditionError } from '../expedition-error.js';
import type { EventDefinition, EventPreview } from './event-types.js';

export const EVENT_COUNT = 30;
export const EVENT_PREVIEWS: readonly EventPreview[] = ['VISIBLE_SAFE_OUTCOME', 'VISIBLE_RISK', 'VISIBLE_TRADEOFF'];

function assertIdShape(id: string, label: string): void {
  if (!/^[a-z0-9_.:-]+$/.test(id)) {
    throw new ExpeditionError('CONTENT_BUILD_ERROR', { label, id, reason: 'invalid id shape' });
  }
}

/** Validates compiled event content; throws CONTENT_BUILD_ERROR on violation. */
export function validateEvents(events: readonly EventDefinition[]): void {
  if (events.length !== EVENT_COUNT) {
    throw new ExpeditionError('CONTENT_BUILD_ERROR', { count: events.length, expected: EVENT_COUNT });
  }
  const ids = new Set<string>();
  for (const event of events) {
    assertIdShape(event.eventId, 'eventId');
    if (ids.has(event.eventId)) {
      throw new ExpeditionError('CONTENT_BUILD_ERROR', { eventId: event.eventId, reason: 'duplicate event' });
    }
    ids.add(event.eventId);
    if (event.options.length < 2 || event.options.length > 3) {
      throw new ExpeditionError('CONTENT_BUILD_ERROR', { eventId: event.eventId, reason: 'option count' });
    }
    const optionIds = new Set<string>();
    for (const option of event.options) {
      assertIdShape(option.optionId, 'optionId');
      if (optionIds.has(option.optionId)) {
        throw new ExpeditionError('CONTENT_BUILD_ERROR', { eventId: event.eventId, optionId: option.optionId, reason: 'duplicate option' });
      }
      optionIds.add(option.optionId);
      if (option.preview.length === 0 || option.preview.some((kind) => !EVENT_PREVIEWS.includes(kind))) {
        throw new ExpeditionError('CONTENT_BUILD_ERROR', { eventId: event.eventId, optionId: option.optionId, reason: 'preview kind' });
      }
      for (const slot of option.rollSlots) assertIdShape(slot, 'rollSlot');
      for (const prerequisite of event.prerequisites) assertIdShape(prerequisite, 'prerequisite');
    }
  }
}

/** Exactly-one free option per event (GDD §20.1). */
export function hasFreeOption(event: EventDefinition): boolean {
  return event.options.some((option) => (option.cost.gold ?? 0) === 0 && (option.cost.instability ?? 0) === 0);
}
