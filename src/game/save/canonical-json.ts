/**
 * Phase 23 canonical JSON: UTF-8, LF, no pretty whitespace, object keys sorted
 * by stable code-unit comparison, arrays untouched, JSON primitives only.
 * NaN, Infinity, -Infinity, -0, BigInt, undefined, functions, symbols, cycles
 * and non-plain objects are rejected. SHA-256 operates over the exact UTF-8
 * bytes of this output.
 */

export type JsonScalar = null | boolean | string | number;
export type JsonValue = JsonScalar | readonly JsonValue[] | { readonly [key: string]: JsonValue };

function compareCodeUnits(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function assertNumber(value: number): void {
  if (!Number.isFinite(value) || Object.is(value, -0)) {
    throw new Error('INVALID_NUMBER');
  }
}

function isPlainObject(value: object): boolean {
  const proto: object | null = Object.getPrototypeOf(value) as object | null;
  return proto === Object.prototype || proto === null;
}

export function canonicalJson(value: unknown, seen = new Set<object>()): string {
  if (value === null) return 'null';
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    assertNumber(value);
    return JSON.stringify(value);
  }
  if (typeof value !== 'object') throw new Error('INVALID_JSON_VALUE');
  if (seen.has(value)) throw new Error('CYCLIC_VALUE');
  seen.add(value);
  try {
    if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item, seen)).join(',')}]`;
    if (!isPlainObject(value)) throw new Error('NON_PLAIN_OBJECT');
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort(compareCodeUnits);
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key], seen)}`).join(',')}}`;
  } finally {
    seen.delete(value);
  }
}

export function canonicalUtf8(value: unknown): Uint8Array {
  return new TextEncoder().encode(canonicalJson(value));
}
