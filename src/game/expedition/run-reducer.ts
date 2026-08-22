import { ExpeditionError } from './expedition-error.js';
import type { NodeId, RunState } from './types.js';
import type { NodeRunState, NodeActionRequest, NodeDefinition } from './nodes/types.js';
import {
  applyGoldDelta,
  applyInstabilityDelta as applyNodeInstability,
  dispatchEnterNode,
  dispatchCommit,
  dispatchResolve,
  advanceToNode as advanceNodeToNode,
  definitionOf,
  handlerForNode,
} from './nodes/node-run-reducer.js';
import type { NodeHandler } from './nodes/registry.js';
import type { NodeCommitOutcome } from './nodes/node-transaction.js';
import type { ExpeditionMap } from './types.js';

/**
 * Run reducers (RUN_DOMAIN_CONTRACT + NODE_TRANSACTION_CONTRACT): every
 * transition validates the expected revision and transaction identity.
 * Duplicate committed transactions return the prior receipt (the unchanged
 * state) without mutation; a pending lock allows exactly one transaction;
 * resources are safe integers and never negative. Kill/resume continues at
 * the last confirmed commit point.
 *
 * Phase 32: RunState-based functions (Phase 28) coexist with NodeRunState
 * delegation functions that forward to the node domain (node-run-reducer).
 * Prefer the NodeRunState path for new code.
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

// ── Phase 32: NodeRunState delegation (forwards to node-run-reducer) ──

/** Apply a safe gold delta against NodeRunState. Negative results throw. */
export function applyNodeGoldDelta(state: NodeRunState, amount: number): NodeRunState {
  return applyGoldDelta(state, amount);
}

/** Apply a safe instability delta against NodeRunState. Negative results throw. */
export function applyNodeInstabilityDelta(state: NodeRunState, amount: number): NodeRunState {
  return applyNodeInstability(state, amount);
}

/** Full pipeline convenience: ENTER (instability + snapshot) in one call. */
export function enterNode(
  state: NodeRunState,
  nodeId: NodeId,
  definition: NodeDefinition,
  handler: NodeHandler,
  transactionId: string,
): { readonly outcome: NodeCommitOutcome; readonly state: NodeRunState } {
  return dispatchEnterNode(state, nodeId, definition, handler, transactionId);
}

/** Commit a node action through the durable transaction ledger. */
export function commitNodeAction(
  state: NodeRunState,
  request: NodeActionRequest,
  definition: NodeDefinition,
  handler: NodeHandler,
): NodeCommitOutcome {
  return dispatchCommit(state, request, definition, handler);
}

/** Mark the node visit RESOLVED; further commands are rejected. */
export function resolveNode(state: NodeRunState, nodeId: NodeId): NodeRunState {
  return dispatchResolve(state, nodeId);
}

/** Validate reachability and return the updated position. */
export function advanceNode(
  state: NodeRunState,
  currentNodeId: NodeId,
  targetNodeId: NodeId,
  map: ExpeditionMap,
): { readonly state: NodeRunState; readonly nodeId: NodeId } {
  return advanceNodeToNode(state, currentNodeId, targetNodeId, map);
}

/** Look up the NodeDefinition for a map node. */
export { definitionOf as nodeDefinition };

/** Look up the handler for a node type. */
export { handlerForNode as nodeHandler };

export type { NodeRunState, NodeActionRequest, NodeCommitOutcome };
