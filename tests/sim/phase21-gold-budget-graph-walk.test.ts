/**
 * Phase 21 §9 GOLD BUDGET THROUGH A REAL FULL-GRAPH WALK. The handler-level
 * budget (phase21-ceiling-gold-budget) pins prices in isolation; this drives
 * the SAME budget through a real `RunManager` greedy-last full-graph walk on
 * seed 503 (battle → merchant → battle → anchor → scout → boss) with the run
 * starting at EXACTLY 40 gold:
 *
 *   merchant SERVICE COMMITS (40 → 10, the recovery at the flat 30);
 *   anchor SERVICE is REFUSED mid-walk — `INSUFFICIENT_GOLD` at gold 10 < 30
 *   (the budget floor binds on the LIVE run, the refused record durably in
 *   the ledger and skipped by the gold fold);
 *   the greed — instability fold AND gold fold (`40 − 30×committed services`)
 *   hold at EVERY step with `RunManager.restore()` cuts at every hop;
 *
 * plus the CHEAPEST-LEVER boundary sweep over the REAL handlers: at the same
 * flat price (30 == 30), the merchant's deeper reduction (−10) re-opens a
 * 2-defeat stack exactly ONE instability point higher than the anchor (−8):
 * at i in 86..93 BOTH re-open, at 94..95 ONLY the merchant re-opens, and at
 * exactly 95 the merchant re-opens to land at EXACTLY the ceiling (100).
 */
import { describe, expect, it } from 'vitest';
import { RunManager } from '../../src/game/expedition/run-manager.js';
import { enterTransactionId, actionTransactionId } from '../../src/features/expedition/transaction-ids.js';
import { INSTABILITY_CEILING, battleHandler } from '../../src/game/expedition/nodes/handlers/combat.js';
import {
  ANCHOR_SERVICE_COST_GOLD,
  anchorStoryHandlers,
} from '../../src/game/expedition/nodes/handlers/anchor.js';
import { MERCHANT_SERVICE_INSTABILITY_REDUCTION, merchantHandler } from '../../src/game/expedition/nodes/handlers/merchant.js';
import { MERCHANT_SERVICE_PRICE_GOLD } from '../../src/game/expedition/offers/offer-service.js';
import { dispatchCommit } from '../../src/game/expedition/nodes/node-run-reducer.js';
import { createNodeRunState, openVisit } from '../../src/game/expedition/nodes/run-state.js';
import type { NodeDefinition, NodeRunState, TransactionRecord } from '../../src/game/expedition/nodes/types.js';
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

const ENTER_DELTA_BY_TYPE: Readonly<Record<string, number>> = Object.freeze({
  battle: 5, elite: 12, boss: 0, event: 3, merchant: 3, recruitment: 4,
  treasure: 5, workshop: 2, altar: 8, scout: 2, anchor: -10, story: 0,
});

function typeOf(map: ExpeditionMap, nodeId: string): string {
  const node = map.nodes.find((candidate) => candidate.id === nodeId);
  return node?.type ?? 'story';
}

const isCombat = (t: string): boolean => t === 'battle' || t === 'elite' || t === 'boss';

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

describe('P21 §9 gold budget through the real full-graph walk (seed 503, 40 gold)', () => {
  it('the SERVICE costs 30 through the live ledger: merchant commits 40→10, anchor is REFUSED INSUFFICIENT_GOLD, folds hold at every step with restore cuts at EVERY hop', { timeout: 60_000 }, () => {
    store.clear();
    const seed = 503;
    const startGold = 40;
    let mgr = RunManager.create(seed, startGold);
    const visited = new Set<string>();
    const runId = mgr.snapshot().state.runId;
    let servicesCommitted = 0;
    const goldFold = (ledger: Readonly<Record<string, TransactionRecord>>): number => {
      let gold = startGold;
      for (const entry of Object.values(ledger)) {
        if (entry.status !== 'COMMITTED' || entry.action !== 'SERVICE') continue;
        gold -= MERCHANT_SERVICE_PRICE_GOLD;
      }
      return gold;
    };
    const assertFolds = (label: string): void => {
      const snap = mgr.snapshot();
      expect(snap.state.instability, `${label} instability`).toBe(foldInstability(mgr.map, snap.state.ledger));
      expect(snap.state.gold, `${label} gold`).toBe(goldFold(snap.state.ledger));
      expect(snap.state.gold, `${label} gold non-negative`).toBeGreaterThanOrEqual(0);
    };
    const rejectedServices: string[] = [];
    let cuts = 0;
    let guard = 0;
    for (; guard < 200; guard += 1) {
      const snap = mgr.snapshot();
      const nodeId = snap.currentNodeId;
      const type = snap.currentNodeType;
      visited.add(nodeId);
      mgr.enter(enterTransactionId(runId, nodeId));
      assertFolds(`enter ${nodeId}`);
      if (isCombat(type)) {
        for (let attempt = 1; attempt <= 3; attempt += 1) {
          const record = mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'ENGAGE_DEFEAT', `g-${String(guard)}-${String(attempt)}`), nodeId, action: 'ENGAGE_DEFEAT' });
          if (record.status !== 'COMMITTED') break;
          assertFolds(`defeat ${String(attempt)} ${nodeId}`);
        }
        mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'DECLINE', `gd-${String(guard)}`), nodeId, action: 'DECLINE' });
      } else if (type === 'anchor' || type === 'merchant') {
        const txId = actionTransactionId(runId, nodeId, 'SERVICE', `gs-${String(guard)}`);
        const record = mgr.act({ transactionId: txId, nodeId, action: 'SERVICE' });
        if (record.status === 'COMMITTED') {
          servicesCommitted += 1;
          // The FIRST service (merchant, 40 → 10): the flat 30 price through
          // the live ledger.
        } else {
          // The anchor service is refused: the BUDGET FLOOR binds mid-walk at
          // gold 10 < 30, and the reason is a durable ledger record.
          expect(record.reason, `${nodeId} refusal`).toBe('INSUFFICIENT_GOLD');
          expect(mgr.snapshot().state.ledger[txId]?.status).toBe('REJECTED');
          expect(mgr.snapshot().state.ledger[txId]?.reason).toBe('INSUFFICIENT_GOLD');
          rejectedServices.push(typeOf(mgr.map, nodeId));
          mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'DECLINE', `gx-${String(guard)}`), nodeId, action: 'DECLINE' });
        }
        assertFolds(`service ${nodeId}`);
      } else {
        mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'DECLINE', `gy-${String(guard)}`), nodeId, action: 'DECLINE' });
      }
      assertFolds(`pre-resolve ${nodeId}`);
      mgr.resolve();
      assertFolds(`resolve ${nodeId}`);
      // RESTORE CUT AT EVERY HOP.
      const beforeNode = mgr.snapshot().currentNodeId;
      const restored = RunManager.restore();
      expect(restored).not.toBeNull();
      if (restored === null) throw new Error('restore failed');
      mgr = restored;
      expect(mgr.snapshot().currentNodeId).toBe(beforeNode);
      assertFolds(`restore-cut ${nodeId}`);
      cuts += 1;
      const candidates = mgr.snapshot().reachableNodes.filter((id) => !visited.has(id));
      const next = candidates[candidates.length - 1];
      if (next === undefined) break;
      mgr.advance(next);
    }
    const final = mgr.snapshot();
    // The full graph was threaded; the budget binds EXACTLY where it must.
    expect(cuts).toBeGreaterThanOrEqual(5);
    expect(final.currentNodeType).toBe('boss');
    expect(servicesCommitted).toBe(1); // merchant committed; anchor refused
    expect(rejectedServices).toContain('anchor');
    expect(final.state.gold).toBe(10); // 40 − 30×1 — never negative
    expect(goldFold(final.state.ledger)).toBe(10);
    expect(final.state.instability).toBeLessThanOrEqual(INSTABILITY_CEILING);
    expect(final.state.instability).toBe(foldInstability(mgr.map, final.state.ledger));
    expect(final.state.killsEarned).toBe(0);
    const covered = new Set<string>();
    for (const id of visited) covered.add(typeOf(mgr.map, id));
    expect(covered.has('merchant')).toBe(true);
    expect(covered.has('anchor')).toBe(true);
  });

  it('CHEAPEST LEVER at the boundary: at the SAME flat price the merchant (−10) re-opens a 2-defeat stack one point higher than the anchor (−8), landing exactly at 100 at i=95', () => {
    // Real handlers + real transaction service on a 2-defeat (re-3) state.
    const anchorHandler = anchorStoryHandlers[0];
    if (anchorHandler === undefined) throw new Error('anchor handler missing');
    const DEF = (id: string, type: 'battle' | 'anchor' | 'merchant'): NodeDefinition =>
      Object.freeze({ nodeId: id, type, contentRevision: '32.0', payloadKey: type === 'battle' ? 'e' : '' });
    const BATTLE = DEF('n_battle', 'battle');
    const ANCHOR = DEF('n_anchor', 'anchor');
    const MERCHANT = DEF('n_merchant', 'merchant');
    function stateAtWithDefeats(instability: number): NodeRunState {
      let state = createNodeRunState({ runId: 'r', modeId: 'm', contentRevision: '32.0', seed: 1, mapHash: 'h', gold: 500 });
      state = openVisit(state, BATTLE.nodeId, 0);
      state = openVisit(state, ANCHOR.nodeId, 0);
      state = openVisit(state, MERCHANT.nodeId, 0);
      const ledger: Record<string, TransactionRecord> = {};
      for (let k = 1; k <= 2; k += 1) {
        ledger[`tx-prior-${String(k)}`] = { transactionId: `tx-prior-${String(k)}`, nodeId: BATTLE.nodeId, action: 'ENGAGE_DEFEAT', status: 'COMMITTED', outcomeIds: [] };
      }
      return { ...state, instability, ledger: { ...state.ledger, ...ledger } };
    }
    const tryReengage = (state: NodeRunState): string | null => {
      const outcome = dispatchCommit(state, Object.freeze({ transactionId: 'tx-re-b', nodeId: BATTLE.nodeId, action: 'ENGAGE_DEFEAT' }), BATTLE, battleHandler);
      return outcome.result.status === 'COMMITTED' ? null : outcome.result.reason ?? 'FAILED';
    };
    expect(MERCHANT_SERVICE_PRICE_GOLD).toBe(ANCHOR_SERVICE_COST_GOLD); // same price
    expect(MERCHANT_SERVICE_INSTABILITY_REDUCTION).toBe(10); // the deeper reduction (10 > 8)
    let anchorReopens = 0;
    let merchantReopens = 0;
    for (let i = 86; i <= 100; i += 1) {
      // BLOCKED without a lever: the 2-defeat stack's next tax (+15) pushes
      // past the ceiling at i ≥ 86.
      expect(tryReengage(stateAtWithDefeats(i)), `blocked at i=${String(i)}`).toBe('OPTION_UNAVAILABLE');
      // ONE anchor service (−8): re-opens iff (i−8)+15 ≤ 100 → i ≤ 93.
      let after = dispatchCommit(stateAtWithDefeats(i), Object.freeze({ transactionId: 'tx-sa-b', nodeId: ANCHOR.nodeId, action: 'SERVICE' }), ANCHOR, anchorHandler).state;
      const anchorReopened = tryReengage(after) === null;
      if (i <= 93) {
        expect(anchorReopened, `anchor reopens i=${String(i)}`).toBe(true);
        expect(after.gold).toBe(470);
        anchorReopens += 1;
      } else {
        expect(anchorReopened, `anchor stays blocked i=${String(i)}`).toBe(false);
      }
      // ONE merchant service (−10): re-opens iff (i−10)+15 ≤ 100 → i ≤ 95,
      // landing at EXACTLY 100 at i=95 (the final value never exceeds it).
      after = dispatchCommit(stateAtWithDefeats(i), Object.freeze({ transactionId: 'tx-sm-b', nodeId: MERCHANT.nodeId, action: 'SERVICE' }), MERCHANT, merchantHandler).state;
      const merchantReopened = tryReengage(after) === null;
      if (i <= 95) {
        expect(merchantReopened, `merchant reopens i=${String(i)}`).toBe(true);
        expect(after.gold).toBe(470);
        merchantReopens += 1;
      } else {
        expect(merchantReopened, `merchant stays blocked i=${String(i)}`).toBe(false);
      }
      // The re-opened attempt lands ≤ the ceiling ALWAYS (exact at 95).
      if (i === 95) {
        const reopened = dispatchCommit(after, Object.freeze({ transactionId: 'tx-re-c', nodeId: BATTLE.nodeId, action: 'ENGAGE_DEFEAT' }), BATTLE, battleHandler);
        expect(reopened.result.status).toBe('COMMITTED');
        expect(reopened.state.instability).toBe(100);
      }
    }
    // The merchant's window is exactly ONE instability point wider (95 vs 93)
    // at the same price — the strictly cheapest recovery.
    expect(merchantReopens).toBe(anchorReopens + 2);
    expect(anchorReopens).toBe(8); // 86..93
    expect(merchantReopens).toBe(10); // 86..95
  });
});
