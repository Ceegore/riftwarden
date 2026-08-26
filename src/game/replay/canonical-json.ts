/**
 * Replay canonical JSON — delegates to the shared implementation, wrapping
 * violations in `RandomInvariantError` with backward-compatible error codes.
 */
import { RandomInvariantError } from '../sim/random/invariant-error.js';
import { canonicalJsonWith, canonicalUtf8With } from '../sim/canonical-json-shared.js';
import type { JsonValue } from './json-value.js';

function error(reason: string, detail?: Readonly<Record<string, unknown>>): RandomInvariantError {
  // Map shared error reasons back to the original replay error code so
  // existing tests and catchers that look for P13_CANONICAL_JSON still work.
  const code = reason.startsWith('P_CANONICAL_JSON') ? 'P13_CANONICAL_JSON' : reason;
  return new RandomInvariantError(code, (detail ?? {}) as Readonly<Record<string, string | number | boolean>>);
}

export function canonicalJson(value: JsonValue): string {
  return canonicalJsonWith(value, error);
}

export function canonicalUtf8(value: JsonValue): Uint8Array {
  return canonicalUtf8With(value, error);
}
