/**
 * Offer service (OFFER_SNAPSHOT_CONTRACT, MERCHANT_RECRUITMENT_CONTRACT):
 * offers are materialized exactly once from runId + nodeId + contentRevision
 * + seed, then only read — reload, resume and parallel UI callbacks see the
 * same snapshot. A reroll stores a NEW snapshot (authorized, max-limited)
 * instead of re-rolling in place; stock lives in the snapshot and is
 * decremented by the buying transaction.
 */
import { ExpeditionError } from '../expedition-error.js';
import { fnv1a32, nextU32 } from '../stable.js';
import type { NodeRunState, Offer, OfferSnapshot } from '../nodes/types.js';

/** Merchant: four offers plus one service (pinned constants). */
export const MERCHANT_OFFER_COUNT = 4;
export const MERCHANT_SERVICE_PRICE_GOLD = 30;
export const MERCHANT_MAX_REROLLS = 1;
export const REROLL_COST_GOLD = 40;

/** Default recruitment pool (fixture-pinned troop types; regional pools are content-side). */
export const RECRUITMENT_POOL: readonly string[] = ['troop-01', 'troop-02', 'troop-03'];

function snapshotSeed(state: NodeRunState, nodeId: string): number {
  return fnv1a32([state.runId, nodeId, state.contentRevision]);
}

function buildOffers(state: NodeRunState, nodeId: string, count: number, seed: number): OfferSnapshot {
  let cursor = seed;
  const offers: Offer[] = [];
  for (let index = 0; index < count; index += 1) {
    cursor = nextU32(cursor);
    offers.push({
      offerId: `${nodeId}-offer-${String(index)}`,
      priceGold: 10 + (cursor % 91),
      stock: 1,
      rewardId: `reward:${nodeId}:${String(index)}`,
      labelKey: `Merchant Offer ${String(index + 1)}`,
    });
  }
  return {
    kind: 'OFFERS',
    snapshotId: `${state.runId}:${nodeId}`,
    nodeId,
    seed,
    offers,
    rollSlots: { risk: nextU32(cursor) % 10000, reward: nextU32(nextU32(cursor)) % 10000 },
    rerollsUsed: 0,
  };
}

/** Materializes the offer snapshot for a node exactly once. */
export function materializeOffers(state: NodeRunState, nodeId: string, count: number): OfferSnapshot {
  const existing = state.snapshots[nodeId];
  if (existing !== undefined) {
    if (existing.kind !== 'OFFERS') {
      throw new ExpeditionError('SNAPSHOT_MISMATCH', { nodeId, kind: existing.kind });
    }
    return existing;
  }
  return buildOffers(state, nodeId, count, snapshotSeed(state, nodeId));
}

/** Attaches a freshly materialized snapshot (idempotent for stored nodes). */
export function attachSnapshot(state: NodeRunState, snapshot: OfferSnapshot): NodeRunState {
  if (state.snapshots[snapshot.nodeId] !== undefined) return state;
  return { ...state, revision: state.revision + 1, snapshots: { ...state.snapshots, [snapshot.nodeId]: snapshot } };
}

/** Stores a NEW snapshot (authorized reroll: the stored pool is replaced). */
export function replaceSnapshot(state: NodeRunState, snapshot: OfferSnapshot): NodeRunState {
  return { ...state, revision: state.revision + 1, snapshots: { ...state.snapshots, [snapshot.nodeId]: snapshot } };
}

/**
 * Authorized reroll: returns the NEW snapshot (fresh seed, rerollsUsed + 1)
 * or null when the reroll limit is exhausted. The caller persists it through
 * the transaction — a reload after a committed reroll sees the new pool.
 */
export function rerollOffers(state: NodeRunState, nodeId: string, maxRerolls: number): OfferSnapshot | null {
  const existing = state.snapshots[nodeId];
  if (existing?.kind !== 'OFFERS') {
    throw new ExpeditionError('SNAPSHOT_MISMATCH', { nodeId, kind: existing?.kind });
  }
  if (existing.rerollsUsed >= maxRerolls) return null;
  const nextSeed = nextU32(existing.seed);
  const count = existing.offers.length;
  const rebuilt = buildOffers(state, nodeId, count, nextSeed);
  return { ...rebuilt, rerollsUsed: existing.rerollsUsed + 1 };
}

/** Decrements the stock of one bought offer in the stored snapshot.
 * Guard: stock can never go negative — an offer with stock <= 0 is returned
 * unchanged (the validate step should have rejected the buy, but this is a
 * defensive net so a direct caller can never produce a negative stock). */
export function decrementStock(snapshot: OfferSnapshot, offerId: string): OfferSnapshot {
  return {
    ...snapshot,
    offers: snapshot.offers.map((offer) => (offer.offerId === offerId ? { ...offer, stock: Math.max(0, offer.stock - 1) } : offer)),
  };
}
