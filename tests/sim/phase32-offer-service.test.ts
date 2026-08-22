import { describe, expect, it } from 'vitest';
import { attachSnapshot, decrementStock, materializeOffers, replaceSnapshot, rerollOffers, MERCHANT_MAX_REROLLS, MERCHANT_OFFER_COUNT } from '../../src/game/expedition/offers/offer-service.js';
import { merchantHandler } from '../../src/game/expedition/nodes/handlers/merchant.js';
import { commitFlow, definition, openAndPrepare, request, baseState, offerOf } from './phase32-helpers.js';

describe('phase32 offer snapshots', () => {
  it('materializes exactly once and replays the stored snapshot on reload', () => {
    const state = baseState();
    const first = materializeOffers(state, 'node-merchant-1', MERCHANT_OFFER_COUNT);
    expect(first.kind).toBe('OFFERS');
    expect(first.offers).toHaveLength(MERCHANT_OFFER_COUNT);
    const attached = attachSnapshot(state, first);
    const replay = materializeOffers(attached, 'node-merchant-1', MERCHANT_OFFER_COUNT);
    expect(replay).toBe(first);
  });

  it('derives offers deterministically from runId + nodeId + contentRevision', () => {
    const stateA = baseState({ runId: 'run-offer-a' });
    const stateB = baseState({ runId: 'run-offer-a' });
    const a = materializeOffers(stateA, 'node-merchant-2', 4);
    const b = materializeOffers(stateB, 'node-merchant-2', 4);
    expect(a).toEqual(b);
    expect(a.seed).toBe(b.seed);
    const other = materializeOffers(baseState({ runId: 'run-offer-b' }), 'node-merchant-2', 4);
    expect(other.seed).not.toBe(a.seed);
  });

  it('every offer has stable ids, a positive price and stock 1', () => {
    const state = baseState();
    const snapshot = materializeOffers(state, 'node-merchant-3', 4);
    for (const offer of snapshot.offers) {
      expect(offer.offerId).toMatch(/^node-merchant-3-offer-\d+$/);
      expect(offer.priceGold).toBeGreaterThanOrEqual(10);
      expect(offer.priceGold).toBeLessThanOrEqual(100);
      expect(offer.stock).toBe(1);
      expect(offer.rewardId).toBeDefined();
    }
  });

  it('a reroll is limited, costs a fresh pool and is stored (never re-rolled in place)', () => {
    let state = baseState();
    const first = materializeOffers(state, 'node-merchant-4', 4);
    state = attachSnapshot(state, first);
    const rerolled = rerollOffers(state, 'node-merchant-4', 1);
    expect(rerolled).not.toBeNull();
    if (rerolled === null) throw new Error('reroll refused');
    expect(rerolled.rerollsUsed).toBe(1);
    expect(rerolled.seed).not.toBe(first.seed);
    expect(rerolled.offers).not.toEqual(first.offers);
    state = replaceSnapshot(state, rerolled);
    const stored = state.snapshots['node-merchant-4'];
    expect(stored?.kind).toBe('OFFERS');
    if (stored?.kind !== 'OFFERS') throw new Error('snapshot missing');
    expect(stored.rerollsUsed).toBe(1);
    const again = rerollOffers(state, 'node-merchant-4', 1);
    expect(again).toBeNull();
  });

  it('stock decrements on buy and stays decremented on reload', () => {
    const snapshot = materializeOffers(baseState(), 'node-merchant-5', 4);
    const offer = snapshot.offers[0];
    if (offer === undefined) throw new Error('offer missing');
    const decremented = decrementStock(snapshot, offer.offerId);
    expect(decremented.offers[0]?.stock).toBe(0);
    expect(decremented.rollSlots).toEqual(snapshot.rollSlots);
    expect(decremented.seed).toBe(snapshot.seed);
  });
});

describe('phase32 merchant handler', () => {
  const def = definition('node-merchant-10', 'merchant');

  function prepared(gold = 100): ReturnType<typeof baseState> {
    return openAndPrepare(baseState({ gold }), merchantHandler, def);
  }

  it('shows four offers plus one service and allows exactly one authorized reroll', () => {
    const state = prepared();
    const snapshot = state.snapshots[def.nodeId];
    if (snapshot?.kind !== 'OFFERS') throw new Error('offer snapshot missing');
    expect(snapshot.offers).toHaveLength(MERCHANT_OFFER_COUNT);
    expect(snapshot.rerollsUsed).toBe(0);
  });

  it('buys the last stock item exactly once and rejects a repeat buy', () => {
    let state = prepared(100);
    const offer = offerOf(state, def.nodeId, 0);
    const buy = commitFlow(state, merchantHandler, def, request(def.nodeId, 'BUY', 'tx-buy-last', offer.offerId));
    expect(buy.outcome.result.status).toBe('COMMITTED');
    state = buy.state;
    expect(state.gold).toBe(100 - offer.priceGold);
    expect(state.unsecuredLoot).toContain(offer.rewardId);
    expect(offerOf(state, def.nodeId, 0).stock).toBe(0);
    const repeat = commitFlow(state, merchantHandler, def, request(def.nodeId, 'BUY', 'tx-buy-last', offer.offerId));
    expect(repeat.outcome.replayed).toBe(true);
    expect(repeat.state.gold).toBe(100 - offer.priceGold);
  });

  it('a double callback (same transaction) never double-charges', () => {
    const state = prepared(100);
    const offer = offerOf(state, def.nodeId, 1);
    const first = commitFlow(state, merchantHandler, def, request(def.nodeId, 'BUY', 'tx-buy-double', offer.offerId));
    const second = commitFlow(first.state, merchantHandler, def, request(def.nodeId, 'BUY', 'tx-buy-double', offer.offerId));
    expect(first.state.gold).toBe(second.state.gold);
    expect(second.outcome.replayed).toBe(true);
    expect(second.state.unsecuredLoot.filter((id) => id === offer.rewardId)).toHaveLength(1);
  });

  it('rejects with insufficient funds and records a REJECTED entry', () => {
    const state = prepared(5);
    const offer = offerOf(state, def.nodeId, 2);
    const buy = commitFlow(state, merchantHandler, def, request(def.nodeId, 'BUY', 'tx-buy-poor', offer.offerId));
    expect(buy.outcome.result.status).toBe('REJECTED');
    expect(buy.outcome.result.reason).toBe('INSUFFICIENT_GOLD');
    expect(buy.state.gold).toBe(5);
    expect(buy.state.ledger['tx-buy-poor']?.status).toBe('REJECTED');
  });

  it('rejects an exhausted offer (stock 0)', () => {
    let state = prepared(100);
    const offer = offerOf(state, def.nodeId, 3);
    state = commitFlow(state, merchantHandler, def, request(def.nodeId, 'BUY', 'tx-buy-exhaust', offer.offerId)).state;
    const again = commitFlow(state, merchantHandler, def, request(def.nodeId, 'BUY', 'tx-buy-exhaust-2', offer.offerId));
    expect(again.outcome.result.status).toBe('REJECTED');
    expect(again.outcome.result.reason).toBe('OFFER_EXHAUSTED');
  });

  it('reroll costs gold and is refused after the reroll limit', () => {
    let state = prepared(100);
    const rerolled = commitFlow(state, merchantHandler, def, request(def.nodeId, 'REROLL', 'tx-reroll-1'));
    expect(rerolled.outcome.result.status).toBe('COMMITTED');
    state = rerolled.state;
    expect(state.gold).toBeLessThan(100);
    const snapshot = state.snapshots[def.nodeId];
    if (snapshot?.kind !== 'OFFERS') throw new Error('offer snapshot missing');
    expect(snapshot.rerollsUsed).toBe(1);
    const second = commitFlow(state, merchantHandler, def, request(def.nodeId, 'REROLL', 'tx-reroll-2'));
    expect(second.outcome.result.status).toBe('REJECTED');
    expect(second.outcome.result.reason).toBe('REROLL_LIMIT');
  });

  it('the service reduces instability for gold', () => {
    let state = prepared(100);
    state = { ...state, instability: 40 };
    const service = commitFlow(state, merchantHandler, def, request(def.nodeId, 'SERVICE', 'tx-service'));
    expect(service.outcome.result.status).toBe('COMMITTED');
    expect(service.state.instability).toBe(30);
    expect(service.state.gold).toBe(70);
  });

  it('reload reproduces the same offers and replays the same transaction', () => {
    const a = prepared(100);
    const b = prepared(100);
    expect(a.snapshots[def.nodeId]).toEqual(b.snapshots[def.nodeId]);
    const buy = commitFlow(a, merchantHandler, def, request(def.nodeId, 'BUY', 'tx-buy-reload', offerOf(a, def.nodeId, 0).offerId));
    expect(buy.state.visits[def.nodeId]?.status).toBe('COMMITTED');
    // The reloaded (persisted) state replays the same transaction — never re-buys.
    const reloaded = commitFlow(buy.state, merchantHandler, def, request(def.nodeId, 'BUY', 'tx-buy-reload', offerOf(buy.state, def.nodeId, 0).offerId));
    expect(reloaded.outcome.replayed).toBe(true);
    expect(reloaded.state.gold).toBe(buy.state.gold);
    expect(reloaded.state.unsecuredLoot).toEqual(buy.state.unsecuredLoot);
  });

  it('decline resolves the node without any cost', () => {
    const state = prepared(100);
    const decline = commitFlow(state, merchantHandler, def, request(def.nodeId, 'DECLINE', 'tx-merchant-decline'));
    expect(decline.outcome.result.status).toBe('COMMITTED');
    expect(decline.state.gold).toBe(100);
  });

  it('refuses an unknown offer as structural misuse', () => {
    const state = prepared(100);
    expect(() => commitFlow(state, merchantHandler, def, request(def.nodeId, 'BUY', 'tx-buy-unknown', 'offer-unknown'))).toThrow();
  });

  it('merchant max rerolls constant matches the pinned fixture', () => {
    expect(MERCHANT_MAX_REROLLS).toBe(1);
  });
});
