/**
 * Phase 23 canonical JSON — delegates to the shared implementation so save,
 * snapshot and replay all use the same encoder. The save number policy is
 * `finite-allowed` (accepts non-integer finite numbers like 1.5), matching
 * the original Phase 23 contract.
 */
import { canonicalJsonWith, canonicalUtf8With, type NumberPolicy } from '../sim/random/canonical-json-shared.js';

export type JsonScalar = null | boolean | string | number;
export type JsonValue = JsonScalar | readonly JsonValue[] | { readonly [key: string]: JsonValue };

const NUMBER_POLICY: NumberPolicy = 'finite-allowed';

function error(reason: string, detail?: Readonly<Record<string, unknown>>): Error {
  return new Error(reason, detail !== undefined ? { cause: detail } : undefined);
}

export function canonicalJson(value: unknown, seen?: Set<object>): string {
  // The old signature accepted a `seen` set for recursive calls; the shared
  // impl manages its own seen-set, so an externally-supplied set is a no-op.
  void seen;
  return canonicalJsonWith(value, error, NUMBER_POLICY);
}

export function canonicalUtf8(value: unknown): Uint8Array {
  return canonicalUtf8With(value, error, NUMBER_POLICY);
}
