import { KernelInvariantError } from '../core/invariant-error.js';
import type { EventPriority, EventSequence, Tick } from '../core/primitives.js';
import { validateEventInput } from '../events/event-validation.js';
import { compareScheduled } from './event-order.js';
import type { ScheduledEvent, ScheduledEventInput } from './scheduled-event.js';

export class EventQueue {
  readonly #committed: ScheduledEvent[] = [];
  readonly #planned: ScheduledEventInput[] = [];
  #draining = false;

  constructor(initial: readonly ScheduledEvent[] = []) {
    this.#committed.push(...initial);
    this.#validateAndSort();
  }

  plan(input: ScheduledEventInput, currentTick: Tick, currentPriority: EventPriority): void {
    validateEventInput(input.event);
    if (input.scheduledTick < currentTick || (input.scheduledTick === currentTick && input.eventPriority <= currentPriority)) {
      throw new KernelInvariantError('P14_QUEUE_SORT', { reason: 'non-forward-same-tick', currentTick, currentPriority, input });
    }
    if (this.size() >= 10000) throw new KernelInvariantError('P14_QUEUE_CAP');
    this.#planned.push(Object.freeze({ ...input }));
  }

  commitPlanned(allocate: () => EventSequence): readonly ScheduledEvent[] {
    const added = this.#planned.splice(0).map((input) => Object.freeze({ ...input, eventSequence: allocate() }));
    this.#committed.push(...added);
    this.#validateAndSort();
    return Object.freeze(added);
  }

  drainDueThrough(tick: Tick, maxPriority: EventPriority): readonly ScheduledEvent[] {
    if (this.#draining) throw new KernelInvariantError('P14_QUEUE_REENTRANT');
    this.#draining = true;
    try {
      let end = 0;
      while (end < this.#committed.length) {
        const event = this.#committed[end];
        if (event === undefined) break;
        if (event.scheduledTick < tick || (event.scheduledTick === tick && event.eventPriority <= maxPriority)) end++;
        else break;
      }
      return Object.freeze(this.#committed.splice(0, end));
    } finally {
      this.#draining = false;
    }
  }

  snapshot(): readonly ScheduledEvent[] {
    return Object.freeze([...this.#committed].sort(compareScheduled));
  }

  size(): number {
    return this.#committed.length + this.#planned.length;
  }

  maxSequence(): number {
    return this.#committed.reduce((m, e) => Math.max(m, e.eventSequence), -1);
  }

  #validateAndSort(): void {
    this.#committed.sort(compareScheduled);
    const seen = new Set<number>();
    for (const event of this.#committed) {
      if (seen.has(event.eventSequence)) throw new KernelInvariantError('P14_SEQUENCE_INVALID', { sequence: event.eventSequence });
      seen.add(event.eventSequence);
    }
    if (this.#committed.length > 10000) throw new KernelInvariantError('P14_QUEUE_CAP');
  }
}
