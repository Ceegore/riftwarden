export type RenderErrorCode =
  | 'ALPHA_NOT_INTEGER'
  | 'RESTORE_INVALID_STATE'
  | 'COMPLETE_INVALID_STATE'
  | 'LIFECYCLE_INVALID_TRANSITION'
  | 'PRESENTER_INVALID_FRAME'
  | 'PRESENTER_STALE_FRAME'
  | 'PRESENTER_FROZEN'
  | 'CLOCK_INVALID_CONFIG'
  | 'CLOCK_NON_MONOTONIC'
  | 'CAPABILITY_INVALID_PROBE'
  | 'POOL_UNDERFLOW'
  | 'EVENT_INVALID'
  | 'RECOVERY_NO_SNAPSHOT';

export type RenderDiagnosticDetails = Readonly<Record<string, string | number | boolean>>;

export class RenderError extends Error {
  readonly code: RenderErrorCode;
  readonly details: RenderDiagnosticDetails;

  constructor(code: RenderErrorCode, details: RenderDiagnosticDetails = {}) {
    super(code);
    this.name = 'RenderError';
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}
