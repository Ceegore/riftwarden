/**
 * Shared handler helpers: the ENTER action (instability applies at enter,
 * exactly once via the ledger), visit-guarded validation and the preview
 * shape builder. No handler family exceeds its line budget; these helpers
 * keep the six families small.
 */
import { definitionOf } from '../../node-registry.js';
import { ExpeditionError } from '../../expedition-error.js';
import type { NodeDefinition, NodePreviewData, NodeRunState, OutcomeCommand, RewardSnapshot } from '../types.js';

/**
 * ENTER applies the registry default delta; reload never re-applies it.
 * A negative default (anchor rest) clamps at zero — instability is bounded
 * below at 0, so entering the anchor at instability < 10 reduces to 0
 * instead of throwing NEGATIVE_RESOURCE on a legitimate game action.
 */
export function enterCommands(definition: NodeDefinition, state?: NodeRunState): readonly OutcomeCommand[] {
  const delta = definitionOf(definition.type).defaultInstabilityDelta;
  if (delta === 0) return [];
  if (delta < 0 && state !== undefined) {
    const applied = Math.max(0, state.instability + delta);
    if (applied === state.instability) return [];
    return [{ kind: 'INSTABILITY_DELTA', amount: applied - state.instability }];
  }
  return [{ kind: 'INSTABILITY_DELTA', amount: delta }];
}

export function assertVisitOpen(state: NodeRunState, nodeId: string): void {
  const visit = state.visits[nodeId];
  if (visit === undefined) {
    throw new ExpeditionError('VISIT_STATE_INVALID', { nodeId, reason: 'visit missing' });
  }
  if (visit.status === 'COMMITTED' || visit.status === 'RESOLVED') {
    throw new ExpeditionError('NODE_ALREADY_COMPLETED', { nodeId, status: visit.status });
  }
}

export function previewOf(
  definition: NodeDefinition,
  actions: readonly string[],
  rewardCategoryKey: string,
  consequences: readonly string[],
): NodePreviewData {
  return {
    nodeId: definition.nodeId,
    type: definition.type,
    instabilityDelta: definitionOf(definition.type).defaultInstabilityDelta,
    rewardCategoryKey,
    actions,
    consequences,
  };
}

/** Throws for structural misuse (unknown offer/action); callers guard rules first. */
export function requireOffer(state: NodeRunState, nodeId: string, offerId: string): void {
  const snapshot = state.snapshots[nodeId];
  if (snapshot?.kind !== 'OFFERS') {
    throw new ExpeditionError('SNAPSHOT_MISMATCH', { nodeId, kind: snapshot?.kind });
  }
  if (!snapshot.offers.some((offer) => offer.offerId === offerId)) {
    throw new ExpeditionError('UNKNOWN_OFFER', { nodeId, offerId });
  }
}

/** True when a committed action of the given kinds exists for the node. */
export function hasCommittedAction(state: NodeRunState, nodeId: string, actions: readonly string[]): boolean {
  return Object.values(state.ledger).some(
    (entry) => entry.nodeId === nodeId && entry.status === 'COMMITTED' && actions.includes(entry.action),
  );
}

/** Returns the stored reward snapshot; a missing/wrong snapshot is structural. */
export function requireRewardSnapshot(state: NodeRunState, nodeId: string): RewardSnapshot {
  const snapshot = state.snapshots[nodeId];
  if (snapshot?.kind !== 'REWARD') {
    throw new ExpeditionError('SNAPSHOT_MISMATCH', { nodeId, kind: snapshot?.kind });
  }
  return snapshot;
}
