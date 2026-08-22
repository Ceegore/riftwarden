/**
 * Closed error-code union for the Phase 28/32 expedition layers. Guard misuse
 * of the pure contract modules (invalid transitions, transaction conflicts,
 * unreachable nodes, negative resources, unknown node handlers, invalid
 * event content, snapshot mismatches) throws an ExpeditionError with one of
 * these codes. Structural map violations are validation results, not errors,
 * and live in reachability; rule violations (insufficient funds, exhausted
 * stock, copy/relic limits) are REJECTED ledger results, not exceptions.
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
  | 'LOOT_NOT_AVAILABLE'
  | 'UNKNOWN_HANDLER'
  | 'UNKNOWN_EVENT'
  | 'UNKNOWN_OFFER'
  | 'UNKNOWN_ACTION'
  | 'SNAPSHOT_MISMATCH'
  | 'VISIT_STATE_INVALID'
  | 'UNKNOWN_OUTCOME_COMMAND'
  | 'CONTENT_BUILD_ERROR';

export type NodeRejectionCode =
  | 'INSUFFICIENT_GOLD'
  | 'OFFER_EXHAUSTED'
  | 'REROLL_LIMIT'
  | 'COPY_LIMIT'
  | 'RELIC_CAP'
  | 'PREREQUISITE_MISSING'
  | 'OPTION_UNAVAILABLE'
  | 'ACTION_LIMIT'
  | 'REWARD_DUPLICATE'
  | 'NODE_ALREADY_RESOLVED';

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
