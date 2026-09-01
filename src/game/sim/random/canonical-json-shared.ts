/**
 * Shared canonical JSON encoder (§8.1 integer pipeline, §23 save, §22
 * snapshot, §13 replay). One implementation with a configurable number
 * policy, so all callers produce identical output for the same input.
 *
 * Rules: UTF-8, LF, no pretty whitespace, object keys sorted by stable
 * code-unit comparison, arrays untouched. Only JSON primitives and plain
 * objects/arrays are accepted. Cycles and non-plain prototypes are rejected.
 *
 * Number policy:
 * - `safe-integers-only` (snapshot, replay): NaN, Infinity, -0, and
 *   non-integer floats are rejected. Output uses `String(value)`.
 * - `finite-allowed` (save): any finite number is accepted; NaN, Infinity,
 *   and -0 are rejected. Output uses `JSON.stringify(value)`.
 */

export type CanonicalJsonError = (reason: string, detail?: Readonly<Record<string, unknown>>) => Error;
export type NumberPolicy = 'safe-integers-only' | 'finite-allowed';

function compareCodeUnits(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function encodeInternal(value: unknown, seen: Set<object>, error: CanonicalJsonError, numberPolicy: NumberPolicy): string {
  if (value === null) return 'null';
  if (typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (numberPolicy === 'safe-integers-only') {
      if (!Number.isSafeInteger(value) || Object.is(value, -0)) {
        throw error('P_CANONICAL_JSON_NUMBER', { value: String(value) });
      }
      return String(value);
    }
    // finite-allowed: reject NaN, Infinity, -0; accept everything else.
    if (!Number.isFinite(value) || Object.is(value, -0)) {
      throw error('P_CANONICAL_JSON_NUMBER', { value: String(value) });
    }
    return JSON.stringify(value);
  }
  if (typeof value !== 'object') throw error('P_CANONICAL_JSON_TYPE', { type: typeof value });
  if (seen.has(value)) throw error('P_CANONICAL_JSON_CYCLE');
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      return `[${value.map((item) => encodeInternal(item, seen, error, numberPolicy)).join(',')}]`;
    }
    const proto = Object.getPrototypeOf(value) as object | null;
    if (proto !== Object.prototype && proto !== null) {
      throw error('P_CANONICAL_JSON_PROTOTYPE');
    }
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort(compareCodeUnits);
    return `{${keys.map((key) => `${JSON.stringify(key)}:${encodeInternal(record[key], seen, error, numberPolicy)}`).join(',')}}`;
  } finally {
    seen.delete(value);
  }
}

/** Encode `value` as canonical JSON, using `error` to wrap violations. */
export function canonicalJsonWith(value: unknown, error: CanonicalJsonError, numberPolicy: NumberPolicy = 'safe-integers-only'): string {
  return encodeInternal(value, new Set(), error, numberPolicy);
}

/** Encode `value` as canonical UTF-8, using `error` to wrap violations. */
export function canonicalUtf8With(value: unknown, error: CanonicalJsonError, numberPolicy: NumberPolicy = 'safe-integers-only'): Uint8Array {
  return new TextEncoder().encode(canonicalJsonWith(value, error, numberPolicy));
}
