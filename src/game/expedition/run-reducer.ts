import { ExpeditionError } from './expedition-error.js';
import type { NodeId, RunState } from './types.js';

/**
 * Run reducers (RUN_DOMAIN_CONTRACT + NODE_TRANSACTION_CONTRACT): every
 * transition validates the expected revision and transaction identity.
 * Duplicate committed transactions return the prior receipt (the unchanged
 * state) without mutation; a pending lock allows exactly one transaction;
 * resources are safe integers and never negative. Kill/resume continues at
 * the last confirmed commit point — these pure steps are the commit points.
 */
function assertRevision(state: RunState, expectedRevision: number): void {
  if (state.revision !== expectedRevision) {
    throw new ExpeditionError('REVISION_MISMATCH', { expected: expectedRevision, actual: state.revision });
  }
}

/** Opens a pending transaction; idempotent for already-committed ids. */
export function beginTransaction(state: RunState, transactionId: string, expectedRevision: number): RunState {
  if (state.committedTransactionIds.includes(transactionId)) return state;
  assertRevision(state, expectedRevision);
  if (state.pendingTransactionId !== undefined) {
    throw new ExpeditionError('TRANSACTION_PENDING', { pendingTransactionId: state.pendingTransactionId });
  }
  return { ...state, pendingTransactionId: transactionId };
}

export function commitVisit(
  state: RunState,
  transactionId: string,
  nodeId: NodeId,
  nextAvailable: readonly NodeId[],
  expectedRevision: number,
): RunState {
  if (state.committedTransactionIds.includes(transactionId)) return state;
  assertRevision(state, expectedRevision);
  if (state.pendingTransactionId !== transactionId) {
    throw new ExpeditionError('TRANSACTION_MISMATCH', { expected: state.pendingTransactionId, actual: transactionId });
  }
  if (!state.availableNodeIds.includes(nodeId)) {
    throw new ExpeditionError('NODE_NOT_REACHABLE', { nodeId });
  }
  const base = { ...state };
  delete base.pendingTransactionId;
  return {
    ...base,
    revision: base.revision + 1,
    currentNodeId: nodeId,
    visitedNodeIds: [...base.visitedNodeIds, nodeId],
    availableNodeIds: [...nextAvailable],
    committedTransactionIds: [...base.committedTransactionIds, transactionId],
  };
}

export function applyResourceDelta(state: RunState, key: string, delta: number, expectedRevision: number): RunState {
  assertRevision(state, expectedRevision);
  const next = (state.resources[key] ?? 0) + delta;
  if (!Number.isSafeInteger(next) || next < 0) {
    throw new ExpeditionError('NEGATIVE_RESOURCE', { key, delta, next });
  }
  return { ...state, revision: state.revision + 1, resources: { ...state.resources, [key]: next } };
}

export function applyInstabilityDelta(state: RunState, delta: number, expectedRevision: number): RunState {
  assertRevision(state, expectedRevision);
  const next = state.instability + delta;
  if (next < 0) throw new ExpeditionError('NEGATIVE_RESOURCE', { key: 'instability', delta, next });
  return { ...state, revision: state.revision + 1, instability: next };
}

/** Anchor: secured loot leaves unsecured and can no longer be lost. */
export function secureLoot(state: RunState, transactionId: string, itemIds: readonly string[], expectedRevision: number): RunState {
  if (state.committedTransactionIds.includes(transactionId)) return state;
  assertRevision(state, expectedRevision);
  if (state.pendingTransactionId !== transactionId) {
    throw new ExpeditionError('TRANSACTION_MISMATCH', { expected: state.pendingTransactionId, actual: transactionId });
  }
  const missing = itemIds.filter((id) => !state.unsecuredLoot.includes(id));
  if (missing.length > 0) {
    throw new ExpeditionError('LOOT_NOT_AVAILABLE', { missing });
  }
  const base = { ...state };
  delete base.pendingTransactionId;
  const secured = [...base.securedLoot, ...itemIds].sort();
  const unsecured = base.unsecuredLoot.filter((id) => !itemIds.includes(id));
  return {
    ...base,
    revision: base.revision + 1,
    securedLoot: secured,
    unsecuredLoot: unsecured,
    committedTransactionIds: [...base.committedTransactionIds, transactionId],
  };
}

/** Unsecured loot drop (battle resolution): resources/loot never go negative. */
export function dropUnsecuredLoot(state: RunState, itemIds: readonly string[], expectedRevision: number): RunState {
  assertRevision(state, expectedRevision);
  const missing = itemIds.filter((id) => !state.unsecuredLoot.includes(id));
  if (missing.length > 0) {
    throw new ExpeditionError('LOOT_NOT_AVAILABLE', { missing });
  }
  return {
    ...state,
    revision: state.revision + 1,
    unsecuredLoot: state.unsecuredLoot.filter((id) => !itemIds.includes(id)),
  };
}
