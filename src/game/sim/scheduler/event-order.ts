import { asciiCompare } from '../core/primitives.js';
import type { ScheduledEvent } from './scheduled-event.js';
export function compareScheduled(a:ScheduledEvent,b:ScheduledEvent):number {
  return a.scheduledTick-b.scheduledTick || a.eventPriority-b.eventPriority || asciiCompare(a.sourceEntityId??'',b.sourceEntityId??'') || asciiCompare(a.abilityId??'',b.abilityId??'') || a.eventSequence-b.eventSequence;
}
