/**
 * Snapshot canonical JSON — delegates to the shared implementation, wrapping
 * violations in `KernelInvariantError` with backward-compatible error codes.
 */
import { KernelInvariantError } from '../core/invariant-error.js';
import { canonicalJsonWith, canonicalUtf8With } from '../random/canonical-json-shared.js';

function error(reason: string, detail?: Readonly<Record<string, unknown>>): KernelInvariantError {
  // Map shared error reasons back to the original snapshot error code so
  // existing tests and catchers that look for P14_SNAPSHOT_INVALID still work.
  const code = reason.startsWith('P_CANONICAL_JSON') ? 'P14_SNAPSHOT_INVALID' : reason;
  return new KernelInvariantError(code, detail ?? {});
}

export function canonicalJson(value: unknown): string {
  return canonicalJsonWith(value, error);
}

export function canonicalUtf8(value: unknown): Uint8Array {
  return canonicalUtf8With(value, error);
}
