export type SaveErrorCode =
  | 'INVALID_ARGUMENT'
  | 'INVALID_PATH'
  | 'INVALID_ENVELOPE'
  | 'HASH_MISMATCH'
  | 'IO_WRITE_FAILED'
  | 'IO_FLUSH_FAILED'
  | 'IO_READ_FAILED'
  | 'ATOMIC_RENAME_FAILED'
  | 'MANIFEST_COMMIT_FAILED'
  | 'NO_VALID_SLOT'
  | 'QUEUE_CLOSED'
  | 'UNSUPPORTED_CAPABILITY';

export type SaveDiagnosticDetails = Readonly<Record<string, string | number | boolean>>;

export class SaveError extends Error {
  readonly code: SaveErrorCode;
  readonly details: SaveDiagnosticDetails;

  constructor(code: SaveErrorCode, details: SaveDiagnosticDetails = {}) {
    super(code);
    this.name = 'SaveError';
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}
