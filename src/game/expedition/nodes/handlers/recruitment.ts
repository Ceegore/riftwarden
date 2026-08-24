/**
 * Recruitment node handler (S44, MERCHANT_RECRUITMENT_CONTRACT): two to three
 * deterministic troop offers from the regional pool, materialized and
 * persisted at first open. The Phase 31 copy limit (≤3 copies per troop
 * type) is checked before preview and before commit; CHOOSE or DECLINE ends
 * the node exactly once. Reload reproduces the same candidates and the same
 * selection state.
 */
import { ExpeditionError, type NodeRejectionCode } from '../../expedition-error.js';
import { applyOutcomeCommands } from '../../outcome-commands.js';
import { fnv1a32, nextU32 } from '../../stable.js';
import { RECRUITMENT_POOL } from '../../offers/offer-service.js';
import type { NodeHandler } from '../registry.js';
import type { NodeRunState, Offer, OfferSnapshot, OutcomeCommand } from '../types.js';
import { assertVisitOpen, enterCommands, hasCommittedAction, previewOf, requireOffer } from './common.js';

export const RECRUITMENT_COPY_LIMIT = 3;
export const RECRUITMENT_OFFER_COST_GOLD = 40;

function recruitmentSeed(state: NodeRunState, nodeId: string): number {
  return fnv1a32([state.runId, nodeId, state.contentRevision, 'recruit']);
}

function buildRecruitmentOffers(state: NodeRunState, nodeId: string): OfferSnapshot {
  const count = 2 + (recruitmentSeed(state, nodeId) % 2);
  const offers: Offer[] = [];
  const used = new Set<string>();
  let cursor = recruitmentSeed(state, nodeId);
  let guard = 0;
  while (offers.length < count && guard < 16) {
    cursor = nextU32(cursor);
    const troopTypeId = RECRUITMENT_POOL[cursor % RECRUITMENT_POOL.length];
    guard += 1;
    if (troopTypeId === undefined) {
      throw new ExpeditionError('CONTENT_BUILD_ERROR', { nodeId, reason: 'recruitment pool empty' });
    }
    if (used.has(troopTypeId)) continue;
    used.add(troopTypeId);
    const index = offers.length;
    offers.push({
      offerId: `${nodeId}-recruit-${String(index)}`,
      priceGold: index === 0 ? 0 : RECRUITMENT_OFFER_COST_GOLD,
      stock: 1,
      troopTypeId,
      labelKey: `Recruit ${troopTypeId}`,
    });
  }
  return {
    kind: 'OFFERS',
    snapshotId: `${state.runId}:${nodeId}`,
    nodeId,
    seed: recruitmentSeed(state, nodeId),
    offers,
    rollSlots: {},
    rerollsUsed: 0,
  };
}

function materializeRecruitment(state: NodeRunState, nodeId: string): OfferSnapshot {
  const existing = state.snapshots[nodeId];
  if (existing !== undefined) {
    if (existing.kind !== 'OFFERS') {
      throw new ExpeditionError('SNAPSHOT_MISMATCH', { nodeId, kind: existing.kind });
    }
    return existing;
  }
  return buildRecruitmentOffers(state, nodeId);
}

function copiesOf(state: NodeRunState, troopTypeId: string): number {
  const permanent = state.troopCopies[troopTypeId] ?? 0;
  const recruited = state.recruits.filter((id) => id === troopTypeId).length;
  return permanent + recruited;
}

export const recruitmentHandler: NodeHandler = {
  type: 'recruitment',
  allowedActions: ['ENTER', 'CHOOSE', 'DECLINE'],
  requiredData: [],
  commitPhase: 'ATOMIC',
  prepare(definition, state) {
    const snapshot = materializeRecruitment(state, definition.nodeId);
    return { state: attachSnapshotFor(state, snapshot), preview: previewOf(definition, ['ENTER', 'CHOOSE', 'DECLINE'], 'reward.category.recruitment', []) };
  },
  validate(definition, request, state): NodeRejectionCode | null {
    assertVisitOpen(state, definition.nodeId);
    if (hasCommittedAction(state, definition.nodeId, ['CHOOSE', 'DECLINE'])) return 'ACTION_LIMIT';
    if (request.action === 'ENTER' || request.action === 'DECLINE') return null;
    if (request.action !== 'CHOOSE') {
      throw new ExpeditionError('UNKNOWN_ACTION', { nodeId: definition.nodeId, action: request.action });
    }
    if (request.optionId === undefined) {
      throw new ExpeditionError('UNKNOWN_ACTION', { nodeId: definition.nodeId, action: request.action, reason: 'optionId missing' });
    }
    requireOffer(state, definition.nodeId, request.optionId);
    const snapshot = materializeRecruitment(state, definition.nodeId);
    const offer = snapshot.offers.find((candidate) => candidate.offerId === request.optionId);
    if (offer === undefined) {
      throw new ExpeditionError('UNKNOWN_OFFER', { nodeId: definition.nodeId, offerId: request.optionId });
    }
    if (offer.troopTypeId === undefined) {
      throw new ExpeditionError('CONTENT_BUILD_ERROR', { nodeId: definition.nodeId, offerId: offer.offerId, reason: 'troop mapping missing' });
    }
    if (copiesOf(state, offer.troopTypeId) >= RECRUITMENT_COPY_LIMIT) return 'COPY_LIMIT';
    return state.gold < offer.priceGold ? 'INSUFFICIENT_GOLD' : null;
  },
  commit(definition, request, state) {
    if (request.action === 'ENTER') {
      return applyOutcomeCommands(state, enterCommands(definition));
    }
    if (request.action === 'DECLINE') {
      return { state, outcomeIds: [] };
    }
    if (request.optionId === undefined) {
      throw new ExpeditionError('UNKNOWN_ACTION', { nodeId: definition.nodeId, action: request.action });
    }
    const snapshot = materializeRecruitment(state, definition.nodeId);
    const offer = snapshot.offers.find((candidate) => candidate.offerId === request.optionId);
    if (offer === undefined) {
      throw new ExpeditionError('UNKNOWN_OFFER', { nodeId: definition.nodeId, offerId: request.optionId });
    }
    if (offer.troopTypeId === undefined) {
      throw new ExpeditionError('CONTENT_BUILD_ERROR', { nodeId: definition.nodeId, offerId: offer.offerId, reason: 'troop mapping missing' });
    }
    const commands: OutcomeCommand[] = [{ kind: 'RECRUIT_TROOP', troopTypeId: offer.troopTypeId }];
    if (offer.priceGold > 0) commands.unshift({ kind: 'GOLD_DELTA', amount: -offer.priceGold });
    return applyOutcomeCommands(state, commands);
  },
};

function attachSnapshotFor(state: NodeRunState, snapshot: OfferSnapshot): NodeRunState {
  if (state.snapshots[snapshot.nodeId] !== undefined) return state;
  return { ...state, revision: state.revision + 1, snapshots: { ...state.snapshots, [snapshot.nodeId]: snapshot } };
}
