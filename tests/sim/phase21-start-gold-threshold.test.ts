/**
 * Phase 21 §9 START-GOLD THRESHOLD SWEEP. The gold budget pins ONE start-gold
 * cell (seed 503 at 40); this sweeps the start gold over the gated class and
 * pins the EXACT gold-side cut — the gold-side analog of the 0..100
 * instability sweep:
 *
 *   1. every gated walk has EXACTLY ONE recovery service node (the anchor —
 *      probe-verified over the whole class), so the exact cut is S = 30 (the
 *      flat price): at S ≥ 30 the service COMMITS and gold lands at S − 30
 *      (EXACTLY 0 at S = 30); at S ≤ 29 it is REFUSED `INSUFFICIENT_GOLD`;
 *   2. the refusal is a DURABLE, fold-skipped ledger record (a
 *      `RunManager.restore()` cut keeps it byte-identically) and never moves
 *      a scalar — but it DOES change WHICH attempts commit: the sweep found
 *      TWO REGIMES — with the recovery affordable the boss gates at its FIRST
 *      re-engage (the PURE shape); without it the prior combat node gates
 *      EARLIER and the boss commits one defeat before gating at attempt 2
 *      (the gold side SHAPES the ceiling class itself);
 *   3. gold never goes negative at any step of any walk;
 *   4. the clean-room gold fold (`S − 30 × committed services`) equals the
 *      scalar at every step.
 *
 * Full sweep 0..500 on seed 903 (the whole threshold curve) + the exact
 * boundary (0 / 29 / 30 / 31 / 500) on ALL 13 gated seeds.
 */
import { describe, expect, it } from 'vitest';
import { RunManager } from '../../src/game/expedition/run-manager.js';
import { mainPath } from '../../src/game/expedition/expedition-runner.js';
import { enterTransactionId, actionTransactionId } from '../../src/features/expedition/transaction-ids.js';
import { INSTABILITY_CEILING, MAX_REENGAGE_ATTEMPTS } from '../../src/game/expedition/nodes/handlers/combat.js';
import { MERCHANT_SERVICE_PRICE_GOLD } from '../../src/game/expedition/offers/offer-service.js';
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

const isCombat = (t: string): boolean => t === 'battle' || t === 'elite' || t === 'boss';

const PURE_SEEDS: readonly number[] = Object.freeze([903, 962, 963]);
const CASCADE_SEEDS: readonly number[] = Object.freeze([900, 915, 916, 917, 918, 942, 947, 959, 967, 973]);
const ALL_GATED: readonly number[] = Object.freeze([...PURE_SEEDS, ...CASCADE_SEEDS]);
const PRICE = MERCHANT_SERVICE_PRICE_GOLD;

interface WalkMetrics {
  readonly servicesCommitted: number;
  readonly serviceRefused: boolean;
  readonly finalGold: number;
  readonly finalInstability: number;
  readonly ladder: readonly number[];
  readonly refusalTx: string | undefined;
  readonly bossDefeats: number;
  readonly bossGatedAttempt: number;
}

/** The SERVICE walk at a given start gold; fold-exact + non-negative asserted
 * at every step, the boss DECLINEs (no bounty — pure gold-side view). */
function walkAtGold(seed: number, startGold: number): WalkMetrics {
  store.clear();
  const mgr = RunManager.create(seed, startGold);
  const path = mainPath(mgr.map);
  const runId = mgr.snapshot().state.runId;
  const ladder: number[] = [];
  let servicesCommitted = 0;
  let serviceRefused = false;
  let refusalTx: string | undefined;
  let bossDefeats = 0;
  let bossGatedAttempt = 0;
  const goldFold = (ledger: Readonly<Record<string, TransactionRecord>>): number => {
    let gold = startGold;
    for (const entry of Object.values(ledger)) {
      if (entry.status !== 'COMMITTED' || entry.action !== 'SERVICE') continue;
      gold -= PRICE;
    }
    return gold;
  };
  const assertFolds = (label: string): void => {
    const snap = mgr.snapshot();
    expect(snap.state.instability, `${label} instability fold (seed ${String(seed)} @${String(startGold)})`)
      .toBe(foldInstability(mgr.map, snap.state.ledger));
    expect(snap.state.gold, `${label} gold fold (seed ${String(seed)} @${String(startGold)})`)
      .toBe(goldFold(snap.state.ledger));
    expect(snap.state.gold, `${label} gold never negative`).toBeGreaterThanOrEqual(0);
  };
  for (let guard = 0; guard < path.length; guard += 1) {
    const snap = mgr.snapshot();
    const nodeId = snap.currentNodeId;
    const type = snap.currentNodeType;
    mgr.enter(enterTransactionId(runId, nodeId));
    assertFolds(`enter ${type}`);
    if (isCombat(type)) {
      for (let attempt = 1; attempt <= MAX_REENGAGE_ATTEMPTS; attempt += 1) {
        const record = mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'ENGAGE_DEFEAT', `g-${String(guard)}-${String(attempt)}`), nodeId, action: 'ENGAGE_DEFEAT' });
        if (record.status !== 'COMMITTED') {
          if (type === 'boss') bossGatedAttempt = attempt;
          break;
        }
        if (type === 'boss') bossDefeats = attempt;
        assertFolds(`defeat ${String(attempt)} ${type}`);
      }
      mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'DECLINE', `gd-${String(guard)}`), nodeId, action: 'DECLINE' });
    } else if (type === 'anchor' || type === 'merchant') {
      const txId = actionTransactionId(runId, nodeId, 'SERVICE', `gs-${String(guard)}`);
      const record = mgr.act({ transactionId: txId, nodeId, action: 'SERVICE' });
      if (record.status === 'COMMITTED') {
        servicesCommitted += 1;
      } else {
        expect(record.reason, `service refusal @${String(startGold)}`).toBe('INSUFFICIENT_GOLD');
        expect(mgr.snapshot().state.ledger[txId]?.status).toBe('REJECTED');
        expect(mgr.snapshot().state.ledger[txId]?.reason).toBe('INSUFFICIENT_GOLD');
        serviceRefused = true;
        refusalTx = txId;
        mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'DECLINE', `gx-${String(guard)}`), nodeId, action: 'DECLINE' });
      }
      assertFolds(`service ${type}`);
    } else {
      mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'DECLINE', `gy-${String(guard)}`), nodeId, action: 'DECLINE' });
    }
    assertFolds(`pre-resolve ${type}`);
    mgr.resolve();
    assertFolds(`resolve ${type}`);
    ladder.push(mgr.snapshot().state.instability);
    const next = path[guard + 1];
    if (next === undefined) break;
    mgr.advance(next);
  }
  const final = mgr.snapshot();
  mgr.finish();
  return {
    servicesCommitted,
    serviceRefused,
    finalGold: final.state.gold,
    finalInstability: final.state.instability,
    ladder,
    refusalTx,
    bossDefeats,
    bossGatedAttempt,
  };
}

describe('P21 §9 start-gold threshold sweep over the gated class', () => {
  it('the FULL threshold curve on seed 903: S 0..29 refuses the recovery INSUFFICIENT_GOLD, S 30..500 commits it — gold lands at S−30 (exactly 0 at S=30), never negative, and the INSTABILITY ladder is byte-identical for every start gold', { timeout: 60_000 }, () => {
    // The TWO REGIMES (probe-pinned): with the recovery affordable (S ≥ 30)
    // the ladder is the PURE shape and the boss gates at its FIRST re-engage;
    // without it (S ≤ 29) the elite gates at attempt 3 and the boss commits
    // one defeat before gating at attempt 2.
    const RECOVERY_LADDER: readonly number[] = Object.freeze([35, 38, 73, 55, 97, 97]);
    const NO_RECOVERY_LADDER: readonly number[] = Object.freeze([35, 38, 73, 63, 90, 95]);
    for (let s = 0; s <= 500; s += 1) {
      const m = walkAtGold(903, s);
      if (s < PRICE) {
        expect(m.servicesCommitted, `S=${String(s)}`).toBe(0);
        expect(m.serviceRefused, `S=${String(s)}`).toBe(true);
        expect(m.finalGold, `S=${String(s)}`).toBe(s);
        expect(m.ladder, `ladder S=${String(s)}`).toEqual(NO_RECOVERY_LADDER);
        expect(m.bossDefeats, `boss defeats S=${String(s)}`).toBe(1);
        expect(m.bossGatedAttempt, `boss gated attempt S=${String(s)}`).toBe(2);
      } else {
        expect(m.servicesCommitted, `S=${String(s)}`).toBe(1);
        expect(m.serviceRefused, `S=${String(s)}`).toBe(false);
        expect(m.finalGold, `S=${String(s)}`).toBe(s - PRICE);
        expect(m.ladder, `ladder S=${String(s)}`).toEqual(RECOVERY_LADDER);
        expect(m.bossDefeats, `boss defeats S=${String(s)}`).toBe(0);
        expect(m.bossGatedAttempt, `boss gated attempt S=${String(s)}`).toBe(1);
      }
      // Never negative was asserted at every step inside the walk.
      expect(m.finalInstability, `S=${String(s)}`).toBeLessThanOrEqual(INSTABILITY_CEILING);
    }
  });

  it('the EXACT boundary on ALL 13 gated seeds: at S=30 the service commits to EXACTLY 0 gold; at S=29 and S=0 it is refused; at S=31/500 it commits — the refusal is a durable restore-surviving record', { timeout: 60_000 }, () => {
    expect(ALL_GATED.length).toBe(13);
    for (const seed of ALL_GATED) {
      // S = 30: commits, gold lands at EXACTLY 0 (never negative).
      const at30 = walkAtGold(seed, PRICE);
      expect(at30.servicesCommitted, `seed ${String(seed)} @30`).toBe(1);
      expect(at30.serviceRefused, `seed ${String(seed)} @30`).toBe(false);
      expect(at30.finalGold, `seed ${String(seed)} @30`).toBe(0);
      // S = 31: commits, gold lands at 1.
      const at31 = walkAtGold(seed, PRICE + 1);
      expect(at31.servicesCommitted, `seed ${String(seed)} @31`).toBe(1);
      expect(at31.finalGold, `seed ${String(seed)} @31`).toBe(1);
      // S = 500: commits, gold lands at 470.
      const at500 = walkAtGold(seed, 500);
      expect(at500.servicesCommitted, `seed ${String(seed)} @500`).toBe(1);
      expect(at500.finalGold, `seed ${String(seed)} @500`).toBe(470);
      // S = 29: refused INSUFFICIENT_GOLD at gold 29 — the refusal never
      // moves a scalar and the walk still finishes (never a soft-lock).
      const at29 = walkAtGold(seed, PRICE - 1);
      expect(at29.servicesCommitted, `seed ${String(seed)} @29`).toBe(0);
      expect(at29.serviceRefused, `seed ${String(seed)} @29`).toBe(true);
      expect(at29.finalGold, `seed ${String(seed)} @29`).toBe(PRICE - 1);
      // The refusal record is DURABLE: a restore cut right after the refusal
      // (the autosave is still the S=29 run at this point) keeps it
      // byte-identically at the same gold.
      if (at29.refusalTx !== undefined) {
        const restored = RunManager.restore();
        expect(restored, `seed ${String(seed)} restore`).not.toBeNull();
        if (restored === null) throw new Error('restore failed');
        expect(restored.snapshot().state.ledger[at29.refusalTx]?.status).toBe('REJECTED');
        expect(restored.snapshot().state.ledger[at29.refusalTx]?.reason).toBe('INSUFFICIENT_GOLD');
        expect(restored.snapshot().state.gold).toBe(PRICE - 1);
      }
      // S = 0: refused at gold 0 — the budget floor binds even at 0.
      const at0 = walkAtGold(seed, 0);
      expect(at0.servicesCommitted, `seed ${String(seed)} @0`).toBe(0);
      expect(at0.serviceRefused, `seed ${String(seed)} @0`).toBe(true);
      expect(at0.finalGold, `seed ${String(seed)} @0`).toBe(0);
      // The TWO-REGIME shape: within each regime the ladder is identical
      // (at0 === at29 refused; at30 === at500 committed) — the regime cut is
      // EXACTLY at S=30, the flat price.
      expect(at0.ladder, `seed ${String(seed)} refused regime`).toEqual(at29.ladder);
      expect(at30.ladder, `seed ${String(seed)} recovery regime`).toEqual(at500.ladder);
      // The regimes differ: the refused walk gates the boss LATER (it paid
      // gold-lessly — one committed defeat before the ceiling binds) or at a
      // different attempt; never an EARLIER boss gate than the recovery walk.
      expect(at29.bossDefeats, `seed ${String(seed)} boss defeats refused`).toBeGreaterThanOrEqual(at30.bossDefeats);
      expect(at29.bossGatedAttempt, `seed ${String(seed)} boss gate refused`).toBeGreaterThanOrEqual(at30.bossGatedAttempt);
    }
  });
});
