import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ExpeditionError } from '../../src/game/expedition/expedition-error.js';
import { commitNodeAction, prepareNodeCommit, resolveNode, type NodeCommitOutcome } from '../../src/game/expedition/nodes/node-transaction.js';
import { type NodeHandler } from '../../src/game/expedition/nodes/registry.js';
import { createNodeRunState, openVisit } from '../../src/game/expedition/nodes/run-state.js';
import type { NodeActionRequest, NodeDefinition, NodeRunState } from '../../src/game/expedition/nodes/types.js';
import type { NodeType } from '../../src/game/expedition/types.js';

export type { NodeCommitOutcome };

const here = path.dirname(fileURLToPath(import.meta.url));

/** Reads a Phase 32 contract or fixture file (JSON). */
export function readJson(name: string): unknown {
  return JSON.parse(readFileSync(path.join(here, '..', '..', 'contracts', 'phase32', name), 'utf8'));
}

/** Returns the ExpeditionError code of a throwing call, or null when it succeeds. */
export function catchExpeditionCode(fn: () => void): string | null {
  try {
    fn();
    return null;
  } catch (error) {
    return error instanceof ExpeditionError ? error.code : null;
  }
}

export function baseState(overrides: Partial<NodeRunState> = {}): NodeRunState {
  const state = createNodeRunState({
    runId: 'run-32',
    modeId: 'NORMAL',
    contentRevision: '32.0',
    seed: 1000,
    mapHash: 'fixture-map-hash',
    gold: 100,
  });
  return { ...state, ...overrides };
}

export function definition(nodeId: string, type: NodeType, payloadKey?: string): NodeDefinition {
  return { nodeId, type, contentRevision: '32.0', payloadKey: payloadKey ?? type.concat('.', nodeId) };
}

export function request(nodeId: string, action: string, transactionId: string, optionId?: string): NodeActionRequest {
  return optionId === undefined ? { transactionId, nodeId, action } : { transactionId, nodeId, action, optionId };
}

/** Opens the visit and runs the handler prepare step (persisted snapshot). */
export function openAndPrepare(state: NodeRunState, handler: NodeHandler, definition: NodeDefinition): NodeRunState {
  const opened = openVisit(state, definition.nodeId, 0);
  return handler.prepare(definition, opened).state;
}

/** Full commit flow: prepare (COMMITTING) → durable commit → resolve. */
export function commitFlow(
  state: NodeRunState,
  handler: NodeHandler,
  definition: NodeDefinition,
  nodeRequest: NodeActionRequest,
): { readonly outcome: NodeCommitOutcome; readonly state: NodeRunState } {
  const prepared = prepareNodeCommit(state, nodeRequest);
  const outcome = commitNodeAction(prepared, nodeRequest, definition, handler.validate.bind(handler), handler.commit.bind(handler));
  return { outcome, state: outcome.state };
}

export function resolveFlow(state: NodeRunState, nodeId: string): NodeRunState {
  return resolveNode(state, nodeId);
}

export function merchantSnapshotState(state: NodeRunState, handler: NodeHandler, definition: NodeDefinition): NodeRunState {
  return openAndPrepare(state, handler, definition);
}

export function offerOf(state: NodeRunState, nodeId: string, index: number): {
  readonly offerId: string;
  readonly priceGold: number;
  readonly stock: number;
  readonly rewardId?: string;
} {
  const snapshot = state.snapshots[nodeId];
  if (snapshot?.kind !== 'OFFERS') throw new Error('offer snapshot missing');
  const offer = snapshot.offers[index];
  if (offer === undefined) throw new Error('offer missing');
  return offer.rewardId === undefined
    ? { offerId: offer.offerId, priceGold: offer.priceGold, stock: offer.stock }
    : { offerId: offer.offerId, priceGold: offer.priceGold, stock: offer.stock, rewardId: offer.rewardId };
}
