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
  | 'UNSUPPORTED_CAPABILITY'
  // Phase 24 schema/migration/commit/transfer/recovery domain codes.
  | 'INVALID_OBJECT'
  | 'UNKNOWN_FIELD'
  | 'MISSING_FIELD'
  | 'INVALID_SCHEMA'
  | 'FUTURE_SCHEMA'
  | 'INVALID_FIELD'
  | 'INVALID_LANGUAGE'
  | 'INVALID_TEXT_SCALE'
  | 'INVALID_VOLUME'
  | 'INVALID_ENUM'
  | 'INVALID_RANGE'
  | 'INVALID_REFERENCE'
  | 'INVALID_ID'
  | 'MIGRATION_GAP'
  | 'MIGRATION_CYCLE'
  | 'INVALID_MIGRATION_EDGE'
  | 'NON_MONOTONIC_COMMIT'
  | 'DUPLICATE_COMMIT'
  | 'INVALID_SNAPSHOT'
  | 'GOLDEN_HASH_MISMATCH'
  | 'INVALID_ENTRY_NAME'
  | 'LINK_FORBIDDEN'
  | 'DUPLICATE_ENTRY'
  | 'ENTRY_TOO_LARGE'
  | 'TOTAL_TOO_LARGE'
  | 'BOMB_RATIO'
  | 'MISSING_CONTAINER_FILE'
  | 'UNKNOWN_CONTAINER_FILE'
  | 'EMPTY_IMPORT';

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
