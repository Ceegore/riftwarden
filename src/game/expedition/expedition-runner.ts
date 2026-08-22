/**
 * Expedition runner (EXPEDITION_LOOP_CONTRACT): ties map generation, the
 * 12-type closed node handler registry, the durable transaction system, and
 * reachability-based navigation into a single playable loop. Each step
 * produces an immutable snapshot; the runner is a lightweight wrapper that
 * holds the current state, map, and position — never owns RNG and never
 * mutates in place.
 *
 * Usage:
 *   const exp = createExpedition(map, { startGold: 100 });
 *   exp.enter('tx-1');                  // apply instability, materialize snapshot
 *   exp = exp.act({ transactionId: 'tx-2', nodeId: exp.currentNodeId, action: 'ENGAGE' });
 *   exp = exp.resolve();                // mark visit resolved
 *   exp = exp.advance(nextNodeId);      // validate reachability, move
 */
import { ExpeditionError } from './expedition-error.js';
import { validateMap } from './reachability.js';
import { createNodeRunState } from './nodes/run-state.js';
import { handlerForNode, definitionOf, dispatchEnterNode, dispatchCommit, dispatchResolve, advanceToNode, nextNodes } from './nodes/node-run-reducer.js';
import type { NodeHandler } from './nodes/registry.js';
import type { NodeActionRequest, NodeDefinition, NodeRunState } from './nodes/types.js';
import type { ExpeditionMap, NodeId, NodeType } from './types.js';

export interface ExpeditionConfig {
  readonly startGold: number;
  readonly troopCopies?: Readonly<Record<string, number>>;
}

export interface ExpeditionRunner {
  /** The current immutable run state. */
  readonly state: NodeRunState;
  /** The expedition map (nodes, edges, start/boss, seed). */
  readonly map: ExpeditionMap;
  /** The current node the runner is positioned at. */
  readonly currentNodeId: NodeId;
  /** Nodes reachable from the current position in one step. */
  readonly reachableNodes: readonly NodeId[];
  /** The handler for the current node type. */
  readonly handler: NodeHandler;
  /** The definition for the current node (type, payload, revision). */
  readonly definition: NodeDefinition;

  /**
   * Enter the current node: open the visit, apply instability, and
   * materialize the deterministic preview snapshot. Idempotent: replaying
   * the same transaction returns the same state.
   */
  enter(transactionId: string): ExpeditionRunner;

  /**
   * Perform a node-type-specific action (ENGAGE, BUY, TAKE, CONFIRM, etc.).
   * The action must be valid for the current node type and the visit must
   * be open. Returns a new runner with the updated state.
   */
  act(request: NodeActionRequest): ExpeditionRunner;

  /** Mark the current visit RESOLVED. A resolved node rejects further commands. */
  resolve(): ExpeditionRunner;

  /**
   * Validate reachability and advance to the next node. The target must be
   * directly reachable from the current position.
   */
  advance(nextNodeId: NodeId): ExpeditionRunner;

  /**
   * Convenience: enter + act + resolve in one step. The primary action
   * request is dispatched after ENTER. For node types like anchor where the
   * primary action is optional, pass a request with action='ENTER'.
   */
  visit(enterTxId: string, actionRequest?: NodeActionRequest): ExpeditionRunner;
}

function buildRunner(
  state: NodeRunState,
  map: ExpeditionMap,
  currentNodeId: NodeId,
): ExpeditionRunner {
  const reachableNodes = nextNodes(map, currentNodeId);
  const definition = definitionOf(map, currentNodeId);
  const handler = handlerForNode(definition.type);
  const self: ExpeditionRunner = {
    state,
    map,
    currentNodeId,
    reachableNodes,
    handler,
    definition,
    enter(transactionId: string): ExpeditionRunner {
      const result = dispatchEnterNode(state, currentNodeId, definition, handler, transactionId);
      return buildRunner(result.state, map, currentNodeId);
    },
    act(request: NodeActionRequest): ExpeditionRunner {
      const outcome = dispatchCommit(state, request, definition, handler);
      return buildRunner(outcome.state, map, currentNodeId);
    },
    resolve(): ExpeditionRunner {
      return buildRunner(dispatchResolve(state, currentNodeId), map, currentNodeId);
    },
    advance(nextNodeId: NodeId): ExpeditionRunner {
      const result = advanceToNode(state, currentNodeId, nextNodeId, map);
      return buildRunner(result.state, map, result.nodeId);
    },
    visit(enterTxId: string, actionRequest?: NodeActionRequest): ExpeditionRunner {
      let next = self.enter(enterTxId);
      if (actionRequest !== undefined) {
        next = next.act(actionRequest);
      }
      return next.resolve();
    },
  };
  return self;
}

/**
 * Create a fresh expedition: validates the map, initializes the run state
 * at the start node with the given gold, and returns a runner ready for the
 * first enter/visit call.
 */
export function createExpedition(map: ExpeditionMap, config: ExpeditionConfig): ExpeditionRunner {
  const violations = validateMap(map);
  if (violations.length > 0) {
    throw new ExpeditionError('INVALID_MAP', { violations });
  }
  const state = createNodeRunState({
    runId: `run-${String(map.seed)}`,
    modeId: map.profileId,
    contentRevision: map.contentRevision,
    seed: map.seed,
    mapHash: map.mapHash,
    gold: config.startGold,
    troopCopies: config.troopCopies ?? {},
  });
  return buildRunner(state, map, map.startNodeId);
}

/**
 * Restore a runner from a previously persisted state and map. The current
 * node must be valid on the map; visits and ledger are replayed from the
 * state without re-materializing snapshots.
 */
export function restoreExpedition(state: NodeRunState, map: ExpeditionMap, currentNodeId: NodeId): ExpeditionRunner {
  const node = map.nodes.find((candidate) => candidate.id === currentNodeId);
  if (node === undefined) {
    throw new ExpeditionError('NODE_NOT_REACHABLE', { currentNodeId });
  }
  if (state.seed !== map.seed || state.mapHash !== map.mapHash || state.contentRevision !== map.contentRevision) {
    throw new ExpeditionError('SAVE_MAP_MISMATCH', {
      stateSeed: state.seed,
      mapSeed: map.seed,
      stateMapHash: state.mapHash,
      mapHash: map.mapHash,
      stateContentRevision: state.contentRevision,
      mapContentRevision: map.contentRevision,
    });
  }
  return buildRunner(state, map, currentNodeId);
}

/** Directly available next nodes from the current position. */
export function availableNodes(map: ExpeditionMap, currentNodeId: NodeId): readonly NodeId[] {
  return nextNodes(map, currentNodeId);
}

/** Type guard: is this node type present on the current map? */
export function nodesOfType(map: ExpeditionMap, type: NodeType): readonly NodeId[] {
  return map.nodes.filter((node) => node.type === type).map((node) => node.id);
}

/** Walk the main path from start to boss (non-side-branch forward edges). */
export function mainPath(map: ExpeditionMap): readonly NodeId[] {
  const result: NodeId[] = [];
  let cur: NodeId | undefined = map.startNodeId;
  const seen = new Set<NodeId>();
  while (cur !== undefined && !seen.has(cur)) {
    seen.add(cur);
    result.push(cur);
    const forward = map.edges.find((e) => e.from === cur && !e.to.includes('s') && e.from !== e.to);
    cur = forward?.to;
  }
  return result;
}
