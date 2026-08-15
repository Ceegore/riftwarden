import { RandomInvariantError } from '../sim/random/invariant-error.js';
import type { JsonValue } from './json-value.js';

function encode(value: unknown, seen: Set<object>): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || Object.is(value, -0)) throw new RandomInvariantError('P13_CANONICAL_JSON');
    return String(value);
  }
  if (typeof value !== 'object') throw new RandomInvariantError('P13_CANONICAL_JSON');
  if (seen.has(value)) throw new RandomInvariantError('P13_CANONICAL_JSON');
  seen.add(value);
  try {
    if (Array.isArray(value)) return `[${value.map((item) => encode(item, seen)).join(',')}]`;
    const proto = Object.getPrototypeOf(value) as object | null;
    if (proto !== Object.prototype && proto !== null) throw new RandomInvariantError('P13_CANONICAL_JSON');
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${encode(record[key], seen)}`).join(',')}}`;
  } finally { seen.delete(value); }
}

export function canonicalJson(value: JsonValue): string { return encode(value, new Set()); }
export function canonicalUtf8(value: JsonValue): Uint8Array { return new TextEncoder().encode(canonicalJson(value)); }
