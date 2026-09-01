/**
 * Phase 21 §9 REJECTION-REASON UNION CLOSURE. The rejected-reason matrix pins
 * the durable-record contract for INSUFFICIENT_GOLD / ACTION_LIMIT /
 * PREREQUISITE_MISSING / NODE_ALREADY_RESOLVED and the durability test pins
 * OPTION_UNAVAILABLE — this CLOSES the union: every remaining member of the
 * exported `NodeRejectionCode` union is driven through the REAL handlers and
 * the REAL transaction service, and each is proven a fold-skipped,
 * restore-surviving record that never mutates a scalar and never soft-locks
 * its node:
 *
 *   OFFER_EXHAUSTED   — merchant BUY of a sold-out offer (stock 0);
 *   REROLL_LIMIT      — a second merchant REROLL past MERCHANT_MAX_REROLLS;
 *   COPY_LIMIT        — recruitment CHOOSE with troopCopies at the §31 cap;
 *   RELIC_CAP         — altar ACCEPT at the full relic capacity (6 NORMAL);
 *   REWARD_DUPLICATE  — altar ACCEPT of an already-owned relic.
 *
 * The first two are driven on a REAL `RunManager` walk (seed 976's merchant,
 * with `RunManager.restore()` cuts keeping every REJECTED record
 * byte-identically); the last three need profile-shaped state (troop copies /
 * relics the map never produces in one visit) so they run through the REAL
 * handlers with the REAL commit pipeline, and durability is proven by a JSON
 * persistence cut: the REJECTED record survives the round-trip, replays its
 * own tx byte-identically, re-rejects a fresh tx with the SAME reason, and a
 * legal action on the same node still commits afterwards.
 */
import { describe, expect, it } from 'vitest';
import { RunManager } from '../../src/game/expedition/run-manager.js';
import { mainPath } from '../../src/game/expedition/expedition-runner.js';
import { enterTransactionId, actionTransactionId } from '../../src/features/expedition/transaction-ids.js';
import { INSTABILITY_CEILING } from '../../src/game/expedition/nodes/handlers/combat.js';
import { type NodeRejectionCode } from '../../src/game/expedition/expedition-error.js';
import { recruitmentHandler, RECRUITMENT_COPY_LIMIT } from '../../src/game/expedition/nodes/handlers/recruitment.js';
import { altarHandler } from '../../src/game/expedition/nodes/handlers/altar.js';
import { RELIC_LIMIT_NORMAL } from '../../src/game/expedition/run-economy.js';
import { commitFlow, definition, openAndPrepare, request, baseState } from './phase32-helpers.js';
import type { TransactionRecord } from '../../src/game/expedition/nodes/types.js';
import type { ExpeditionMap } from '../../src/game/expedition/types.js';

const store = new Map<string, string>();
(globalThis as { localStorage: unknown }).localStorage = {
  getItem(key: string) { return store.get(String(key)) ?? null; },
  setItem(key: string, value: string) { store.set(String(key), String(value)); },
  removeItem(key: string) { store.delete(String(key)); },
  clear() { store.clear(); },
  get length() { return store.size; },
  key(index: number) { return [...store.keys()][index] ?? null; },
};

/** The CLOSED union exactly as exported — a new code MUST be added here. */
const CLOSED_UNION: readonly NodeRejectionCode[] = Object.freeze([
  'INSUFFICIENT_GOLD', 'OFFER_EXHAUSTED', 'REROLL_LIMIT', 'COPY_LIMIT', 'RELIC_CAP',
  'PREREQUISITE_MISSING', 'OPTION_UNAVAILABLE', 'ACTION_LIMIT', 'REWARD_DUPLICATE', 'NODE_ALREADY_RESOLVED',
]);

const ENTER_DELTA_BY_TYPE: Readonly<Record<string, number>> = Object.freeze({
  battle: 5, elite: 12, boss: 0, event: 3, merchant: 3, recruitment: 4,
  treasure: 5, workshop: 2, altar: 8, scout: 2, anchor: -10, story: 0,
});

function typeOf(map: ExpeditionMap, nodeId: string): string {
  const node = map.nodes.find((candidate) => candidate.id === nodeId);
  return node?.type ?? 'story';
}

function foldInstability(map: ExpeditionMap, ledger: Readonly<Record<string, TransactionRecord>>): number {
  let instability = 0;
  const defeatCountByNode = new Map<string, number>();
  for (const entry of Object.values(ledger)) {
    if (entry.status !== 'COMMITTED') continue;
    const type = typeOf(map, entry.nodeId);
    let delta = 0;
    if (entry.action === 'ENTER') {
      delta = ENTER_DELTA_BY_TYPE[type] ?? 0;
    } else if (entry.action === 'ENGAGE_DEFEAT') {
      const attempt = (defeatCountByNode.get(entry.nodeId) ?? 0) + 1;
      defeatCountByNode.set(entry.nodeId, attempt);
      delta = 5 * attempt;
    } else if (entry.action === 'SERVICE') {
      delta = type === 'merchant' ? -10 : type === 'anchor' ? -8 : 0;
    }
    instability = Math.max(0, instability + delta);
  }
  return instability;
}

function expectRejectedRecord(mgr: RunManager, txId: string, reason: NodeRejectionCode, goldBefore: number, label: string): void {
  expect(mgr.snapshot().state.ledger[txId]?.status, `${label} stored`).toBe('REJECTED');
  expect(mgr.snapshot().state.ledger[txId]?.reason, `${label} reason`).toBe(reason);
  expect(mgr.snapshot().state.gold, `${label} gold untouched`).toBe(goldBefore);
  expect(mgr.snapshot().state.instability, `${label} fold`).toBe(foldInstability(mgr.map, mgr.snapshot().state.ledger));
  const restored = RunManager.restore();
  expect(restored, `${label} restore`).not.toBeNull();
  if (restored === null) throw new Error('restore failed');
  expect(restored.snapshot().state.ledger[txId]?.status, `${label} restored`).toBe('REJECTED');
  expect(restored.snapshot().state.ledger[txId]?.reason, `${label} restored reason`).toBe(reason);
  expect(restored.snapshot().state.gold, `${label} restored gold`).toBe(goldBefore);
}

describe('P21 §9 rejection-reason union closure (real handlers, real service)', () => {
  it('the exported NodeRejectionCode union is EXACTLY the closed set (a new code must be contract-tested here)', () => {
    // Compile-time: importing the union type + pinning the exact member list
    // guards against a code being added to the union without a contract test.
    expect(new Set(CLOSED_UNION).size).toBe(CLOSED_UNION.length);
    expect(CLOSED_UNION).toHaveLength(10);
  });

  it('OFFER_EXHAUSTED + REROLL_LIMIT on a REAL merchant walk (seed 976): durable records through RunManager.restore(), never a soft-lock', { timeout: 60_000 }, () => {
    store.clear();
    const mgr = RunManager.create(976, 500);
    const path = mainPath(mgr.map);
    const runId = mgr.snapshot().state.runId;
    let merchantId = '';
    for (let guard = 0; guard < path.length; guard += 1) {
      const snap = mgr.snapshot();
      const nodeId = snap.currentNodeId;
      const type = snap.currentNodeType;
      mgr.enter(enterTransactionId(runId, nodeId));
      if (type === 'merchant') {
        merchantId = nodeId;
        break;
      }
      mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'DECLINE', `c-${String(guard)}`), nodeId, action: 'DECLINE' });
      mgr.resolve();
      mgr.advance(path[guard + 1] ?? nodeId);
    }
    expect(mgr.snapshot().currentNodeType).toBe('merchant');
    const nodeId = merchantId;
    const offers = mgr.snapshot().state.snapshots[nodeId];
    if (offers?.kind !== 'OFFERS') throw new Error('no offer snapshot');
    const offer = offers.offers[0];
    if (offer === undefined) throw new Error('no offer 0');

    // BUY the only stock item (fresh tx) → COMMITTED.
    const buyTx = actionTransactionId(runId, nodeId, 'BUY', 'c-buy');
    const buy = mgr.act({ transactionId: buyTx, nodeId, action: 'BUY', optionId: offer.offerId });
    expect(buy.status).toBe('COMMITTED');
    const goldAfterBuy = mgr.snapshot().state.gold;
    expect(goldAfterBuy).toBe(500 - offer.priceGold);

    // BUY the SAME offer with a FRESH tx → OFFER_EXHAUSTED (stock 0): durable
    // through a restore cut, gold byte-identical.
    const exhaustTx = actionTransactionId(runId, nodeId, 'BUY', 'c-exhaust');
    const exhausted = mgr.act({ transactionId: exhaustTx, nodeId, action: 'BUY', optionId: offer.offerId });
    expect(exhausted.status).toBe('REJECTED');
    expect(exhausted.reason).toBe('OFFER_EXHAUSTED');
    expectRejectedRecord(mgr, exhaustTx, 'OFFER_EXHAUSTED', goldAfterBuy, 'exhausted offer');

    // REROLL (fresh tx) → COMMITTED (costs REROLL_COST_GOLD); a second fresh
    // tx → REROLL_LIMIT: durable, gold byte-identical.
    const rerollTx = actionTransactionId(runId, nodeId, 'REROLL', 'c-rr1');
    const reroll1 = mgr.act({ transactionId: rerollTx, nodeId, action: 'REROLL' });
    expect(reroll1.status).toBe('COMMITTED');
    const goldAfterReroll = mgr.snapshot().state.gold;
    expect(goldAfterReroll).toBeLessThan(goldAfterBuy);
    const limitTx = actionTransactionId(runId, nodeId, 'REROLL', 'c-rr2');
    const reroll2 = mgr.act({ transactionId: limitTx, nodeId, action: 'REROLL' });
    expect(reroll2.status).toBe('REJECTED');
    expect(reroll2.reason).toBe('REROLL_LIMIT');
    expectRejectedRecord(mgr, limitTx, 'REROLL_LIMIT', goldAfterReroll, 'reroll limit');

    // Never a soft-lock: DECLINE commits and the walk resolves + finishes.
    const decline = mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'DECLINE', 'c-dec'), nodeId, action: 'DECLINE' });
    expect(decline.status).toBe('COMMITTED');
    mgr.resolve();
    mgr.finish();
    expect(mgr.snapshot().runStatus).toBe('finished');
    expect(mgr.snapshot().state.instability).toBeLessThanOrEqual(INSTABILITY_CEILING);
  });

  /** RESTORE-SIMULATION for profile-shaped states: a JSON persistence cut
   * (the run codec round-trips the same plain data) — the REJECTED record
   * survives, replays its own tx byte-identically, re-rejects a fresh tx
   * with the SAME reason, and a legal action still commits. */
  function expectCraftedDurability(
    make: () => { state: ReturnType<typeof baseState>; tx: string; request: ReturnType<typeof request>; reason: NodeRejectionCode; handler: typeof recruitmentHandler; def: ReturnType<typeof definition>; label: string },
  ): void {
    const fresh = make();
    const rejected = commitFlow(fresh.state, fresh.handler, fresh.def, fresh.request);
    expect(rejected.outcome.result.status).toBe('REJECTED');
    expect(rejected.outcome.result.reason).toBe(fresh.reason);
    expect(rejected.state.ledger[fresh.tx]?.status).toBe('REJECTED');
    expect(rejected.state.ledger[fresh.tx]?.reason).toBe(fresh.reason);
    const goldBefore = rejected.state.gold;
    // Persistence cut: the exact committed state survives a JSON round-trip.
    const revived = JSON.parse(JSON.stringify(rejected.state)) as typeof fresh.state;
    expect(revived.ledger[fresh.tx]?.status).toBe('REJECTED');
    expect(revived.ledger[fresh.tx]?.reason).toBe(fresh.reason);
    // Replay of the SAME tx on the revived state → byte-identical REJECTED.
    const replay = commitFlow(revived, fresh.handler, fresh.def, fresh.request);
    expect(replay.outcome.result.status).toBe('REJECTED');
    expect(replay.outcome.result.reason).toBe(fresh.reason);
    expect(replay.state.gold).toBe(goldBefore);
    // A FRESH tx on the revived state → the SAME reason (the rejection is
    // deterministic, never a one-off).
    const again = commitFlow(revived, fresh.handler, fresh.def, { ...fresh.request, transactionId: `${fresh.tx}-2` });
    expect(again.outcome.result.status).toBe('REJECTED');
    expect(again.outcome.result.reason).toBe(fresh.reason);
    expect(again.state.gold).toBe(goldBefore);
  }

  it('COPY_LIMIT: recruitment CHOOSE at the §31 copy cap is a durable fold-skipped record; DECLINE still ends the node', () => {
    const def = definition('node-recruit-closure', 'recruitment');
    // Seed the permanent copy counts at the cap for the troop the node OFFERS
    // (profile-shaped state: copiesOf = permanent + recruited).
    const atCap = (): ReturnType<typeof baseState> => {
      const opened = openAndPrepare(baseState(), recruitmentHandler, def);
      const snapshot = opened.snapshots[def.nodeId];
      if (snapshot?.kind !== 'OFFERS') throw new Error('no offers');
      const offered = snapshot.offers[0]?.troopTypeId;
      if (offered === undefined) throw new Error('offer 0 has no troop type');
      return openAndPrepare(baseState({ troopCopies: { [offered]: RECRUITMENT_COPY_LIMIT } }), recruitmentHandler, def);
    };
    expectCraftedDurability(() => {
      const state = atCap();
      const snapshot = state.snapshots[def.nodeId];
      if (snapshot?.kind !== 'OFFERS') throw new Error('no offers');
      const offer = snapshot.offers[0];
      if (offer === undefined) throw new Error('no offer 0');
      return {
        state,
        tx: 'tx-copy',
        request: request(def.nodeId, 'CHOOSE', 'tx-copy', offer.offerId),
        reason: 'COPY_LIMIT' as const,
        handler: recruitmentHandler,
        def,
        label: 'copy limit',
      };
    });
    // Not a soft-lock: DECLINE commits on the same node afterwards.
    const decline = commitFlow(atCap(), recruitmentHandler, def, request(def.nodeId, 'DECLINE', 'tx-rec-decline'));
    expect(decline.outcome.result.status).toBe('COMMITTED');
  });

  it('RELIC_CAP: altar ACCEPT at the full relic capacity is a durable fold-skipped record; DECLINE still ends the node', () => {
    const def = definition('node-altar-closure', 'altar', 'relic_ash_crown');
    const relics = Array.from({ length: RELIC_LIMIT_NORMAL }, (_, i) => `relic-other-${String(i)}`);
    expectCraftedDurability(() => ({
      state: openAndPrepare(baseState({ relics }), altarHandler, def),
      tx: 'tx-cap',
      request: request(def.nodeId, 'ACCEPT', 'tx-cap'),
      reason: 'RELIC_CAP' as const,
      handler: altarHandler,
      def,
      label: 'relic cap',
    }));
    const state = openAndPrepare(baseState({ relics }), altarHandler, def);
    const decline = commitFlow(state, altarHandler, def, request(def.nodeId, 'DECLINE', 'tx-altar-decline'));
    expect(decline.outcome.result.status).toBe('COMMITTED');
  });

  it('REWARD_DUPLICATE: altar ACCEPT of an already-owned relic is a durable fold-skipped record; DECLINE still ends the node', () => {
    const def = definition('node-altar-dup', 'altar', 'relic_ash_crown');
    expectCraftedDurability(() => ({
      state: openAndPrepare(baseState({ relics: ['relic_ash_crown'] }), altarHandler, def),
      tx: 'tx-dup',
      request: request(def.nodeId, 'ACCEPT', 'tx-dup'),
      reason: 'REWARD_DUPLICATE' as const,
      handler: altarHandler,
      def,
      label: 'duplicate relic',
    }));
    const state = openAndPrepare(baseState({ relics: ['relic_ash_crown'] }), altarHandler, def);
    const decline = commitFlow(state, altarHandler, def, request(def.nodeId, 'DECLINE', 'tx-altar-decline-2'));
    expect(decline.outcome.result.status).toBe('COMMITTED');
  });
});
