/**
 * Closed error-code union for the Phase 29 slice layer. Guard misuse of the
 * pure contract modules (invalid route transitions, commit conflicts) throws
 * a SliceError with one of these codes; manifest validation findings are
 * validation results, not errors, and live in the slice validator.
 */
export type SliceErrorCode =
  | 'INVALID_ROUTE_TRANSITION'
  | 'COMMIT_KIND_CONFLICT'
  | 'UNKNOWN_COMMIT_ID'
  | 'UNKNOWN_QUALITY'
  | 'UNKNOWN_SLICE_KIND';

export class SliceError extends Error {
  readonly code: SliceErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(code: SliceErrorCode, details: Readonly<Record<string, unknown>> = {}) {
    super(`slice.${code}`);
    this.name = 'SliceError';
    this.code = code;
    this.details = details;
  }
}
