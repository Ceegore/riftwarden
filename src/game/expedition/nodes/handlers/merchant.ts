/**
 * Merchant node handler (S43, MERCHANT_RECRUITMENT_CONTRACT): four offers
 * plus one service, at most one authorized reroll. Offers are materialized
 * and persisted at first open; BUY checks funds, stock and the same
 * transaction; the last stock item can be bought; a reroll stores a NEW
 * snapshot (fresh seed) and costs gold. Double clicks, double callbacks and
 * reloads replay the ledger — never a second purchase.
 */
import { ExpeditionError, type NodeRejectionCode } from '../../expedition-error.js';
import { applyOutcomeCommands } from '../../outcome-commands.js';
import {
  MERCHANT_MAX_REROLLS,
  MERCHANT_OFFER_COUNT,
  MERCHANT_SERVICE_PRICE_GOLD,
  REROLL_COST_GOLD,
  attachSnapshot,
  decrementStock,
  materializeOffers,
  replaceSnapshot,
  rerollOffers,
} from '../../offers/offer-service.js';

export const MERCHANT_SERVICE_INSTABILITY_REDUCTION = 10;
import type { NodeHandler } from '../registry.js';
import type { NodeRunState, OfferSnapshot, OutcomeCommand } from '../types.js';
import { assertVisitOpen, enterCommands, previewOf, requireOffer } from './common.js';

function snapshotFor(state: NodeRunState, nodeId: string): OfferSnapshot {
  const snapshot = state.snapshots[nodeId];
  if (snapshot?.kind !== 'OFFERS') {
    throw new ExpeditionError('SNAPSHOT_MISMATCH', { nodeId, kind: snapshot?.kind });
  }
  return snapshot;
}

export const merchantHandler: NodeHandler = {
  type: 'merchant',
  allowedActions: ['ENTER', 'BUY', 'REROLL', 'SERVICE', 'DECLINE'],
  requiredData: [],
  commitPhase: 'ATOMIC',
  prepare(definition, state) {
    const snapshot = materializeOffers(state, definition.nodeId, MERCHANT_OFFER_COUNT);
    return { state: attachSnapshot(state, snapshot), preview: previewOf(definition, ['ENTER', 'BUY', 'REROLL', 'SERVICE', 'DECLINE'], 'reward.category.merchant', []) };
  },
  validate(definition, request, state): NodeRejectionCode | null {
    assertVisitOpen(state, definition.nodeId);
    if (request.action === 'ENTER' || request.action === 'DECLINE') return null;
    if (request.action === 'BUY') {
      if (request.optionId === undefined) {
        throw new ExpeditionError('UNKNOWN_ACTION', { nodeId: definition.nodeId, action: request.action, reason: 'optionId missing' });
      }
      requireOffer(state, definition.nodeId, request.optionId);
      const offer = snapshotFor(state, definition.nodeId).offers.find((candidate) => candidate.offerId === request.optionId);
      if (offer !== undefined && offer.stock <= 0) return 'OFFER_EXHAUSTED';
      if (offer !== undefined && state.gold < offer.priceGold) return 'INSUFFICIENT_GOLD';
      return null;
    }
    if (request.action === 'REROLL') {
      if (state.gold < REROLL_COST_GOLD) return 'INSUFFICIENT_GOLD';
      return rerollOffers(state, definition.nodeId, MERCHANT_MAX_REROLLS) === null ? 'REROLL_LIMIT' : null;
    }
    if (request.action === 'SERVICE') {
      if (state.gold < MERCHANT_SERVICE_PRICE_GOLD) return 'INSUFFICIENT_GOLD';
      // Instability is bounded below at 0; buying a reduction you cannot use
      // is refused with a visible reason, never a NEGATIVE_RESOURCE crash.
      return state.instability < MERCHANT_SERVICE_INSTABILITY_REDUCTION ? 'OPTION_UNAVAILABLE' : null;
    }
    throw new ExpeditionError('UNKNOWN_ACTION', { nodeId: definition.nodeId, action: request.action });
  },
  commit(definition, request, state) {
    if (request.action === 'ENTER') {
      return applyOutcomeCommands(state, enterCommands(definition, state));
    }
    if (request.action === 'DECLINE') {
      return { state, outcomeIds: [] };
    }
    if (request.action === 'BUY') {
      if (request.optionId === undefined) {
        throw new ExpeditionError('UNKNOWN_ACTION', { nodeId: definition.nodeId, action: request.action });
      }
      const snapshot = snapshotFor(state, definition.nodeId);
      const offer = snapshot.offers.find((candidate) => candidate.offerId === request.optionId);
      if (offer === undefined) {
        throw new ExpeditionError('UNKNOWN_OFFER', { nodeId: definition.nodeId, offerId: request.optionId });
      }
      const commands: OutcomeCommand[] = [{ kind: 'GOLD_DELTA', amount: -offer.priceGold }];
      if (offer.rewardId !== undefined) commands.push({ kind: 'GRANT_UNSECURED_LOOT', rewardId: offer.rewardId });
      const applied = applyOutcomeCommands(state, commands);
      const updated = decrementStock(snapshotFor(applied.state, definition.nodeId), request.optionId);
      return {
        state: {
          ...applied.state,
          snapshots: { ...applied.state.snapshots, [definition.nodeId]: updated },
        },
        outcomeIds: applied.outcomeIds,
      };
    }
    if (request.action === 'REROLL') {
      const rerolled = rerollOffers(state, definition.nodeId, MERCHANT_MAX_REROLLS);
      if (rerolled === null) {
        throw new ExpeditionError('UNKNOWN_ACTION', { nodeId: definition.nodeId, action: request.action, reason: 'reroll limit' });
      }
      const applied = applyOutcomeCommands(state, [{ kind: 'GOLD_DELTA', amount: -REROLL_COST_GOLD }]);
      return {
        state: replaceSnapshot(applied.state, rerolled),
        outcomeIds: applied.outcomeIds,
      };
    }
    if (request.action === 'SERVICE') {
      return applyOutcomeCommands(state, [
        { kind: 'GOLD_DELTA', amount: -MERCHANT_SERVICE_PRICE_GOLD },
        { kind: 'INSTABILITY_DELTA', amount: -MERCHANT_SERVICE_INSTABILITY_REDUCTION },
      ]);
    }
    throw new ExpeditionError('UNKNOWN_ACTION', { nodeId: definition.nodeId, action: request.action });
  },
};
