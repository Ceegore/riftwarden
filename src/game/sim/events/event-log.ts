import { KernelInvariantError } from '../core/invariant-error.js';
import type { EventSequence, Tick } from '../core/primitives.js';
import type { KernelEvent,KernelEventInput } from './event-types.js';
import { validateEventInput } from './event-validation.js';
export class EventLog {
  readonly #events:KernelEvent[]=[];
  append(tick:Tick,sequence:EventSequence,input:KernelEventInput):KernelEvent {
    validateEventInput(input);
    if (this.#events.length>=10000) throw new KernelInvariantError('P14_QUEUE_CAP',{kind:'event-log'});
    const event=Object.freeze({...input,targetIds:Object.freeze([...input.targetIds]),contentIds:Object.freeze([...input.contentIds]),payload:Object.freeze({...input.payload}),logTags:Object.freeze([...input.logTags]),tick,sequence});
    this.#events.push(event); return event;
  }
  events():readonly KernelEvent[]{return Object.freeze([...this.#events]);}
  size():number{return this.#events.length;}
}
