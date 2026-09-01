import type { EventPriority,EventSequence,Tick } from '../core/primitives.js';
import type { KernelEventInput } from '../events/event-types.js';
export interface ScheduledEventInput { readonly scheduledTick:Tick; readonly eventPriority:EventPriority; readonly sourceEntityId:string|null; readonly abilityId:string|null; readonly event:KernelEventInput; }
export interface ScheduledEvent extends ScheduledEventInput { readonly eventSequence:EventSequence; }
