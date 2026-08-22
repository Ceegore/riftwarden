/**
 * Node transaction service (NODE_TRANSACTION_CONTRACT): every node action
 * carries a stable transaction id and is committed exactly once. A replayed
 * id returns the stored ledger result with zero mutation. Rule violations
 * (insufficient gold, exhausted stock, limits) record a REJECTED entry;
 * structural misuse throws. The visit machine is OPEN → COMMITTING →
 * COMMITTED → RESOLVED; a saved COMMITTING resumes via the ledger.
 */
import { ExpeditionError } from '../expedition-error.js';
import type { NodeRejectionCode } from '../expedition-error.js';
import { applyVisitCommand } from './visit-state.js';
import type { NodeActionRequest, NodeDefinition, NodeRunState, NodeVisitState, TransactionRecord } from './types.js';

export interface NodeCommitOutcome {
  readonly state: NodeRunState;
  readonly result: TransactionRecord;
  readonly replayed: boolean;
}

/** A node handler's commit step: pure state transformation + outcome ids. */
export type NodeCommitStep = (
  definition: NodeDefinition,
  request: NodeActionRequest,
  state: NodeRunState,
) => {
  readonly state: NodeRunState;
  readonly outcomeIds: readonly string[];
};

function recordResult(state: NodeRunState, result: TransactionRecord): NodeRunState {
  return { ...state, ledger: { ...state.ledger, [result.transactionId]: result } };
}

function rejected(request: NodeActionRequest, reason: NodeRejectionCode): TransactionRecord {
  return {
    transactionId: request.transactionId,
    nodeId: request.nodeId,
    action: request.action,
    status: 'REJECTED',
    reason,
    outcomeIds: [],
  };
}

function withVisit(state: NodeRunState, visit: NodeVisitState): NodeRunState {
  return { ...state, visits: { ...state.visits, [visit.nodeId]: visit } };
}

/**
 * Phase 1: durable preparation. Marks the visit COMMITTING so a kill here
 * resumes via the ledger instead of re-rolling. Idempotent for the same
 * transaction; a different pending transaction is a hard conflict.
 */
export function prepareNodeCommit(state: NodeRunState, request: NodeActionRequest): NodeRunState {
  if (state.ledger[request.transactionId] !== undefined) return state;
  const visit = state.visits[request.nodeId];
  if (visit === undefined) {
    throw new ExpeditionError('VISIT_STATE_INVALID', { nodeId: request.nodeId, reason: 'visit missing' });
  }
  if (visit.status === 'COMMITTING') {
    if (visit.transactionId === request.transactionId) return state;
    throw new ExpeditionError('TRANSACTION_PENDING', { pendingTransactionId: visit.transactionId });
  }
  if (visit.status === 'RESOLVED') {
    const result = rejected(request, 'NODE_ALREADY_RESOLVED');
    return recordResult(state, result);
  }
  if (visit.status === 'COMMITTED') {
    if (visit.transactionId === request.transactionId) return state;
    // A committed node may start a NEW transaction (multi-action nodes).
    return withVisit(state, {
      ...visit,
      status: applyVisitCommand(visit.status, 'startCommit'),
      transactionId: request.transactionId,
    });
  }
  return withVisit(state, {
    ...visit,
    status: applyVisitCommand(visit.status, 'startCommit'),
    transactionId: request.transactionId,
  });
}

/**
 * Phase 2: durable exactly-once commit. The handler's validate step decides
 * rule rejections; structural misuse throws with no ledger entry. A storage
 * failure is simulated by the caller throwing before this returns — the old
 * COMMITTING state stays persisted and recovery re-runs the same commit.
 */
export function commitNodeAction(
  state: NodeRunState,
  request: NodeActionRequest,
  definition: NodeDefinition,
  validate: (definition: NodeDefinition, request: NodeActionRequest, state: NodeRunState) => NodeRejectionCode | null,
  commit: NodeCommitStep,
): NodeCommitOutcome {
  const previous = state.ledger[request.transactionId];
  if (previous !== undefined) {
    return { state, result: previous, replayed: true };
  }
  const visit = state.visits[request.nodeId];
  if (visit === undefined) {
    throw new ExpeditionError('VISIT_STATE_INVALID', { nodeId: request.nodeId, reason: 'visit missing' });
  }
  if (visit.status === 'RESOLVED') {
    const result = rejected(request, 'NODE_ALREADY_RESOLVED');
    return { state: recordResult(state, result), result, replayed: false };
  }
  const violation = validate(definition, request, state);
  if (violation !== null) {
    const result = rejected(request, violation);
    return { state: recordResult(state, result), result, replayed: false };
  }
  const committed = commit(definition, request, state);
  const result: TransactionRecord = {
    transactionId: request.transactionId,
    nodeId: request.nodeId,
    action: request.action,
    status: 'COMMITTED',
    outcomeIds: committed.outcomeIds,
  };
  const withLedger = recordResult(committed.state, result);
  const visitAfter = withLedger.visits[request.nodeId];
  if (visitAfter === undefined) {
    throw new ExpeditionError('VISIT_STATE_INVALID', { nodeId: request.nodeId, reason: 'visit lost' });
  }
  let nextStatus = visitAfter.status;
  if (nextStatus === 'OPEN') nextStatus = applyVisitCommand(nextStatus, 'startCommit');
  if (nextStatus === 'COMMITTING') nextStatus = applyVisitCommand(nextStatus, 'commit');
  return {
    state: withVisit(withLedger, { ...visitAfter, status: nextStatus, transactionId: request.transactionId }),
    result,
    replayed: false,
  };
}

/** Phase 3: presentation finished — the visit may only navigate from now on. */
export function resolveNode(state: NodeRunState, nodeId: string): NodeRunState {
  const visit = state.visits[nodeId];
  if (visit === undefined) {
    throw new ExpeditionError('VISIT_STATE_INVALID', { nodeId, reason: 'visit missing' });
  }
  if (visit.status === 'RESOLVED') return state;
  if (visit.status !== 'COMMITTED') {
    throw new ExpeditionError('VISIT_STATE_INVALID', { nodeId, status: visit.status, reason: 'resolve requires COMMITTED' });
  }
  return withVisit(state, { ...visit, status: applyVisitCommand(visit.status, 'resolve') });
}
