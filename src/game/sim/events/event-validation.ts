import { KernelInvariantError } from '../core/invariant-error.js';
import { EVENT_SPEC, type EventType } from './event-spec.js';
import type { KernelEventInput } from './event-types.js';

const ID = /^[a-z][a-z0-9_]*$/;
const TAG = /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)*$/;
const TOP = ['type', 'sourceId', 'targetIds', 'contentIds', 'payload', 'logTags'];

export function validateEventInput(value: unknown): asserts value is KernelEventInput {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new KernelInvariantError('P14_EVENT_SCHEMA');
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !TOP.includes(key)) || Object.keys(record).length !== TOP.length) {
    throw new KernelInvariantError('P14_EVENT_SCHEMA', { keys: Object.keys(record) });
  }
  const rawType = record['type'];
  if (typeof rawType !== 'string' || !(rawType in EVENT_SPEC)) throw new KernelInvariantError('P14_EVENT_SCHEMA', { type: rawType });
  const type = rawType as EventType;
  const spec = EVENT_SPEC[type];
  const rawSourceId = record['sourceId'];
  if (!(rawSourceId === null || (typeof rawSourceId === 'string' && ID.test(rawSourceId)))) {
    throw new KernelInvariantError('P14_EVENT_SCHEMA', { field: 'sourceId' });
  }
  const rawTargetIds = record['targetIds'];
  const rawContentIds = record['contentIds'];
  const rawLogTags = record['logTags'];
  for (const field of ['targetIds', 'contentIds', 'logTags'] as const) {
    if (!Array.isArray(record[field])) throw new KernelInvariantError('P14_EVENT_SCHEMA', { field });
  }
  for (const id of [...(rawTargetIds as unknown[]), ...(rawContentIds as unknown[])]) {
    if (typeof id !== 'string' || !ID.test(id)) throw new KernelInvariantError('P14_EVENT_SCHEMA', { field: 'id', id });
  }
  const targetIds = rawTargetIds as string[];
  if (new Set(targetIds).size !== targetIds.length) throw new KernelInvariantError('P14_EVENT_SCHEMA', { field: 'targetIds-duplicate' });
  for (const tag of rawLogTags as unknown[]) {
    if (typeof tag !== 'string' || !TAG.test(tag)) throw new KernelInvariantError('P14_LOCALIZED_EVENT_TEXT', { tag });
  }
  const rawPayload = record['payload'];
  if (typeof rawPayload !== 'object' || rawPayload === null || Array.isArray(rawPayload)) {
    throw new KernelInvariantError('P14_EVENT_SCHEMA', { field: 'payload' });
  }
  const payload = rawPayload as Record<string, unknown>;
  const expected = [...spec.payload].sort();
  const actual = Object.keys(payload).sort();
  if (JSON.stringify(expected) !== JSON.stringify(actual)) throw new KernelInvariantError('P14_EVENT_SCHEMA', { type, expected, actual });
  for (const [key, n] of Object.entries(payload)) {
    if (typeof n !== 'number' || !Number.isSafeInteger(n) || Object.is(n, -0)) throw new KernelInvariantError('P14_EVENT_SCHEMA', { key, n });
  }
}
