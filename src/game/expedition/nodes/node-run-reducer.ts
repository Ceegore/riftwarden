/**
 * Node run reducer (PHASE32_RUN_REDUCER_CONTRACT): bridges the closed node
 * handler registry with the durable transaction system and the run-level
 * navigation. Every node action flows through the same five-step pipeline:
 * open → prepare → validate → commit → resolve. The pipeline is exposed as
 * three discrete dispatch functions (prepare, commit, resolve) so the UI
 * layer (operator-side) controls when each step runs and can inject
 * loading/save/error states between them without coupling.
 *
 * Navigation (advanceToNode) validates reachability against the map and
 * transitions to the next node. The reducer never rolls RNG — every
 * materialized snapshot derives from the persisted seed.
 */
import { ExpeditionError } from '../expedition-error.js';
import { handlerFor, type NodeHandler } from './registry.js';
import { commitNodeAction, prepareNodeCommit, resolveNode, type NodeCommitOutcome } from './node-transaction.js';
import { createNodeRunState, openVisit, type NodeRunStateSource } from './run-state.js';
import { validateMap } from '../reachability.js';
import type { ExpeditionMap, NodeId, NodeType } from '../types.js';
import type { NodeActionRequest, NodeDefinition, NodeRunState } from './types.js';
import { nodeRegistry } from './handlers/index.js';

export type { NodeCommitOutcome };

/** Creates the Phase 32 run container from a profile, seed, and starting gold. */
export function createExpeditionRun(
  map: ExpeditionMap,
  startGold: number,
  troopCopies: Readonly<Record<string, number>> = {},
): NodeRunState {
  const violations = validateMap(map);
  if (violations.length > 0) {
    throw new ExpeditionError('INVALID_MAP', { violations });
  }
  const source: NodeRunStateSource = {
    runId: `run-${String(map.seed)}`,
    modeId: map.profileId,
    contentRevision: map.contentRevision,
    seed: map.seed,
    mapHash: map.mapHash,
    gold: startGold,
    troopCopies,
  };
  return createNodeRunState(source);
}

/** Builds a NodeDefinition from a map node for handler dispatch. */
export function definitionOf(map: ExpeditionMap, nodeId: NodeId): NodeDefinition {
  const node = map.nodes.find((candidate) => candidate.id === nodeId);
  if (node === undefined) {
    throw new ExpeditionError('NODE_NOT_REACHABLE', { nodeId });
  }
  return {
    nodeId: node.id,
    type: node.type,
    contentRevision: map.contentRevision,
    payloadKey: node.previewKey,
  };
}

/** Looks up the handler for a node; structural error if the type is unknown. */
export function handlerForNode(type: NodeType): NodeHandler {
  return handlerFor(nodeRegistry, type);
}

/**
 * Phase 1: Open the visit and materialize deterministic preview/snapshot.
 * The snapshot is persisted here; reloading skips to the same snapshot
 * without re-rolling RNG. Returns the updated state and the preview data
 * the UI may display before the user commits any action.
 */
export function dispatchPrepare(
  state: NodeRunState,
  nodeId: NodeId,
  handler: NodeHandler,
  definition: NodeDefinition,
): { readonly state: NodeRunState; readonly preview: ReturnType<NodeHandler['prepare']>['preview'] } {
  const opened = openVisit(state, nodeId, state.revision);
  const prepared = handler.prepare(definition, opened);
  return { state: prepared.state, preview: prepared.preview };
}

/**
 * Phase 2+3: Durable exactly-once commit through the transaction ledger.
 * Steps: prepareNodeCommit (marks the visit COMMITTING) → commitNodeAction
 * (validate + commit, writes the ledger entry, advances visit to COMMITTED).
 * A replayed transactionId returns the prior result with zero mutation.
 * Rule violations (insufficient gold, exhausted stock) record REJECTED.
 */
export function dispatchCommit(
  state: NodeRunState,
  request: NodeActionRequest,
  definition: NodeDefinition,
  handler: NodeHandler,
): NodeCommitOutcome {
  const prepared = prepareNodeCommit(state, request);
  return commitNodeAction(prepared, request, definition, handler.validate.bind(handler), handler.commit.bind(handler));
}

/**
 * Phase 4: Mark the visit RESOLVED — presentation finished, only navigation
 * remains. A resolved node rejects further commands.
 */
export function dispatchResolve(state: NodeRunState, nodeId: NodeId): NodeRunState {
  return resolveNode(state, nodeId);
}

/**
 * Mutation: applies a resource delta (e.g. for transit/staging events).
 * Gold and instability are always safe integers and never go negative.
 */
export function applyGoldDelta(state: NodeRunState, amount: number): NodeRunState {
  const next = state.gold + amount;
  if (!Number.isSafeInteger(next) || next < 0) {
    throw new ExpeditionError('NEGATIVE_RESOURCE', { key: 'gold', amount, next });
  }
  return { ...state, revision: state.revision + 1, gold: next };
}

export function applyInstabilityDelta(state: NodeRunState, amount: number): NodeRunState {
  const next = state.instability + amount;
  if (next < 0) throw new ExpeditionError('NEGATIVE_RESOURCE', { key: 'instability', amount, next });
  return { ...state, revision: state.revision + 1, instability: next };
}

/**
 * Navigation: validates that the target node is reachable from the current
 * position and returns the new state positioned at that node. The map
 * provides the shared graph — nodes and edges are immutable.
 */
export function nextNodes(map: ExpeditionMap, currentNodeId: NodeId): readonly NodeId[] {
  return map.edges
    .filter((edge) => edge.from === currentNodeId)
    .map((edge) => edge.to)
    .sort();
}

export function advanceToNode(
  state: NodeRunState,
  currentNodeId: NodeId,
  targetNodeId: NodeId,
  map: ExpeditionMap,
): { readonly state: NodeRunState; readonly nodeId: NodeId } {
  const visit = state.visits[currentNodeId];
  if (visit?.status !== 'RESOLVED') {
    throw new ExpeditionError('VISIT_STATE_INVALID', {
      nodeId: currentNodeId,
      status: visit?.status ?? 'MISSING',
      reason: 'advance requires RESOLVED',
    });
  }
  if (!nextNodes(map, currentNodeId).includes(targetNodeId)) {
    throw new ExpeditionError('NODE_NOT_REACHABLE', { from: currentNodeId, to: targetNodeId });
  }
  return { state, nodeId: targetNodeId };
}

/**
 * Full pipeline convenience: prepare + commit for the standard ENTER action
 * (instability applies at enter, exactly once via the ledger).
 */
export function dispatchEnterNode(
  state: NodeRunState,
  nodeId: NodeId,
  definition: NodeDefinition,
  handler: NodeHandler,
  transactionId: string,
): { readonly outcome: NodeCommitOutcome; readonly state: NodeRunState } {
  const prepared = dispatchPrepare(state, nodeId, handler, definition);
  const enterRequest: NodeActionRequest = { transactionId, nodeId, action: 'ENTER' };
  const outcome = dispatchCommit(prepared.state, enterRequest, definition, handler);
  return { outcome, state: outcome.state };
}
