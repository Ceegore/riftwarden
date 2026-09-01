/**
 * Closed error-code union for the Phase 27 formation layer. Guard misuse of
 * the pure contract modules (invalid transitions, missing state, locked
 * drafts) throws a FormationError with one of these codes; domain validation
 * findings are NOT errors and live in the validator's Finding codes.
 */
export type FormationErrorCode =
  | 'UNKNOWN_SLOT'
  | 'UNKNOWN_PRESET_KIND'
  | 'UNKNOWN_DISCLOSURE_ITEM'
  | 'DRAFT_INVALID_STATE'
  | 'DRAFT_ALREADY_PENDING'
  | 'DRAFT_NO_PENDING'
  | 'START_GUARD_ALREADY_PENDING'
  | 'START_GUARD_NOT_PENDING'
  | 'INVALID_DISCLOSURE'
  | 'RESTORE_INVALID_SOURCE';

export class FormationError extends Error {
  readonly code: FormationErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(code: FormationErrorCode, details: Readonly<Record<string, unknown>> = {}) {
    super(`formation.${code}`);
    this.name = 'FormationError';
    this.code = code;
    this.details = details;
  }
}
