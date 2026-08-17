import { KernelInvariantError } from './invariant-error.js';

declare const tickBrand: unique symbol;
declare const sequenceBrand: unique symbol;
declare const priorityBrand: unique symbol;
export type Tick = number & { readonly [tickBrand]: true };
export type EventSequence = number & { readonly [sequenceBrand]: true };
export type EventPriority = number & { readonly [priorityBrand]: true };

function nonNegativeSafe(value: number, code: string): number {
  if (!Number.isSafeInteger(value) || value < 0 || Object.is(value, -0)) throw new KernelInvariantError(code, { value });
  return value;
}
export function tick(value: number): Tick { return nonNegativeSafe(value, 'P14_TICK_INVALID') as Tick; }
export function sequence(value: number): EventSequence { return nonNegativeSafe(value, 'P14_SEQUENCE_INVALID') as EventSequence; }
export function priority(value: number): EventPriority {
  nonNegativeSafe(value, 'P14_QUEUE_SORT');
  if (value > 120) throw new KernelInvariantError('P14_QUEUE_SORT', { value });
  return value as EventPriority;
}
export function nextTick(value: Tick): Tick { return tick(value + 1); }
export function nextSequence(value: EventSequence): EventSequence { return sequence(value + 1); }
export function asciiCompare(a: string, b: string): number { return a < b ? -1 : a > b ? 1 : 0; }
