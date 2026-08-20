/**
 * Closed error-code union for the Phase 28 expedition layer. Guard misuse of
 * the pure contract modules (invalid transitions, transaction conflicts,
 * unreachable nodes, negative resources) throws an ExpeditionError with one
 * of these codes. Structural map violations are validation results, not
 * errors, and live in reachability.
 */
export type ExpeditionErrorCode =
  | 'INVALID_NODE_TRANSITION'
  | 'NODE_ALREADY_COMPLETED'
  | 'TRANSACTION_PENDING'
  | 'TRANSACTION_MISMATCH'
  | 'NODE_NOT_REACHABLE'
  | 'NEGATIVE_RESOURCE'
  | 'REVISION_MISMATCH'
  | 'UNKNOWN_NODE_TYPE'
  | 'UNKNOWN_PROFILE'
  | 'INVALID_MAP'
  | 'UNKNOWN_COMMAND'
  | 'LOOT_NOT_AVAILABLE';

export class ExpeditionError extends Error {
  readonly code: ExpeditionErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(code: ExpeditionErrorCode, details: Readonly<Record<string, unknown>> = {}) {
    super(`expedition.${code}`);
    this.name = 'ExpeditionError';
    this.code = code;
    this.details = details;
  }
}
