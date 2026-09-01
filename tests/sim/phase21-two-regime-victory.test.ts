/**
 * Phase 21 §9 TWO-REGIME VICTORY BOUNDARY. The two-regime ladder test proved
 * the gold side SHAPES the ceiling class; this pins the victory side per
 * regime over the WHOLE gated class:
 *
 *   NO-RECOVERY (S=29, service refused) — the PURE trio's boss carries ONE
 *   COMMITTED defeat (its attempt 2 is ceiling-gated), and a COMMITTED
 *   defeat can never become a win: the victory ENGAGE is REJECTED
 *   `ACTION_LIMIT`, the run can only DECLINE, gold stays 29 (the +15 bounty
 *   never pays). The CASCADE seeds' boss is CLEAN (0 defeats, gated@1) in
 *   BOTH regimes → the victory ENGAGE COMMITS and gold lands on 29+15 = 44.
 *   RECOVERY (S=500) — every gated seed's boss is clean → victory legal,
 *   gold lands on 500−30+15 = 485.
 *
 * The gold-side fold INCLUDES the victory ENGAGE as a committed record
 * (recovery S−30+15, no-recovery S+15 when legal, S+0 when the win is
 * impossible) and holds at every step: never double-paying, never negative;
 * the bounty is exactly the disclosed 15 (kill_boss); a won boss's claim
 * grants exactly once; the run finishes in every one of the 26 walks.
 */
import { describe, expect, it } from 'vitest';
import { RunManager } from '../../src/game/expedition/run-manager.js';
import { mainPath } from '../../src/game/expedition/expedition-runner.js';
import { enterTransactionId, actionTransactionId } from '../../src/features/expedition/transaction-ids.js';
import { INSTABILITY_CEILING, MAX_REENGAGE_ATTEMPTS, bountyForKinds } from '../../src/game/expedition/nodes/handlers/combat.js';
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

/** Gold fold INCLUDING the victory ENGAGE as a committed record (+15 per ENGAGE). */
function foldGold(start: number, ledger: Readonly<Record<string, TransactionRecord>>): number {
  let gold = start;
  for (const entry of Object.values(ledger)) {
    if (entry.status !== 'COMMITTED') continue;
    if (entry.action === 'SERVICE') gold -= MERCHANT_SERVICE_PRICE_GOLD;
    if (entry.action === 'ENGAGE') gold += bountyForKinds(entry.completedKinds ?? []);
  }
  return gold;
}

const isCombat = (t: string): boolean => t === 'battle' || t === 'elite' || t === 'boss';
const isService = (t: string): boolean => t === 'anchor' || t === 'merchant';

interface WalkResult {
  readonly bossDefeats: number;
  readonly engage: { readonly status: string; readonly reason: string | undefined };
  readonly gold: number;
  readonly bossGatedAttempt: number;
}

function countDefeats(ledger: Readonly<Record<string, TransactionRecord>>, nodeId: string): number {
  return Object.values(ledger).filter((e) => e.nodeId === nodeId && e.status === 'COMMITTED' && e.action === 'ENGAGE_DEFEAT').length;
}

/** Walk one seed×regime with defeat stacks, SERVICE (or its refusal) and —
 * on the boss — the victory ENGAGE + claim, asserting folds at every step. */
function walk(seed: number, startGold: number): WalkResult {
  store.clear();
  const mgr = RunManager.create(seed, startGold);
  const path = mainPath(mgr.map);
  const runId = mgr.snapshot().state.runId;
  let bossId = '';
  let bossDefeats = 0;
  let bossGatedAttempt = 0;
  let engage: { readonly status: string; readonly reason: string | undefined } = { status: '', reason: undefined };
  const assertFolds = (label: string): void => {
    const snap = mgr.snapshot();
    expect(snap.state.instability, `${seed}@${startGold} ${label} fold`).toBe(foldInstability(mgr.map, snap.state.ledger));
    expect(snap.state.gold, `${seed}@${startGold} ${label} gold`).toBe(foldGold(startGold, snap.state.ledger));
    expect(snap.state.instability, `${seed}@${startGold} ${label} ≤ ceiling`).toBeLessThanOrEqual(INSTABILITY_CEILING);
  };
  for (let guard = 0; guard < path.length; guard += 1) {
    const snap = mgr.snapshot();
    const nodeId = snap.currentNodeId;
    const type = snap.currentNodeType;
    mgr.enter(enterTransactionId(runId, nodeId));
    if (isCombat(type)) {
      for (let attempt = 1; attempt <= MAX_REENGAGE_ATTEMPTS; attempt += 1) {
        const record = mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'ENGAGE_DEFEAT', `w-${String(guard)}-${String(attempt)}`), nodeId, action: 'ENGAGE_DEFEAT' });
        if (record.status !== 'COMMITTED') {
          expect(record.reason).toBe('OPTION_UNAVAILABLE');
          if (type === 'boss') bossGatedAttempt = attempt;
          break;
        }
        if (type === 'boss') bossDefeats = attempt;
      }
      if (type === 'boss') {
        bossId = nodeId;
        // THE BOUNDARY: a victory ENGAGE on the boss (king kill_boss kind).
        bossDefeats = countDefeats(mgr.snapshot().state.ledger, nodeId);
        const record = mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'ENGAGE', 'win'), nodeId, action: 'ENGAGE', completedKinds: ['kill_boss'] });
        engage = { status: record.status, reason: record.reason };
        if (record.status === 'COMMITTED') {
          const reward = mgr.snapshot().state.snapshots[nodeId];
          if (reward !== undefined && reward.kind === 'REWARD' && reward.rewardIds[0] !== undefined) {
            const optionId = reward.rewardIds[0];
            const claim = mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'CLAIM_REWARD', optionId), nodeId, action: 'CLAIM_REWARD', optionId });
            expect(claim.status).toBe('COMMITTED');
          }
        } else {
          mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'DECLINE', 'wl'), nodeId, action: 'DECLINE' });
        }
      } else {
        mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'DECLINE', `wd-${String(guard)}`), nodeId, action: 'DECLINE' });
      }
    } else if (isService(type)) {
      const record = mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'SERVICE', `ws-${String(guard)}`), nodeId, action: 'SERVICE' });
      if (record.status !== 'COMMITTED') {
        expect(record.reason).toBe('INSUFFICIENT_GOLD');
        mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'DECLINE', `wx-${String(guard)}`), nodeId, action: 'DECLINE' });
      }
    } else {
      mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'DECLINE', `wy-${String(guard)}`), nodeId, action: 'DECLINE' });
    }
    assertFolds(`action ${type}@${String(guard)}`);
    mgr.resolve();
    assertFolds(`resolve ${type}@${String(guard)}`);
    const next = path[guard + 1];
    if (next === undefined) break;
    mgr.advance(next);
  }
  expect(bossId.length).toBeGreaterThan(0);
  const finalGold = mgr.snapshot().state.gold;
  mgr.finish();
  expect(mgr.snapshot().runStatus).toBe('finished');
  return { bossDefeats, engage, gold: finalGold, bossGatedAttempt };
}

const PURE_SEEDS: readonly number[] = Object.freeze([903, 962, 963]);
const CASCADE_SEEDS: readonly number[] = Object.freeze([900, 915, 916, 917, 918, 942, 947, 959, 967, 973]);
const ALL_GATED: readonly number[] = Object.freeze([...PURE_SEEDS, ...CASCADE_SEEDS]);

describe('P21 §9 two-regime victory boundary over the whole gated class', () => {
  it('PURE trio, NO-RECOVERY: the boss carries a committed defeat → victory IMPOSSIBLE (ACTION_LIMIT), gold stays 29, the run only finishes', { timeout: 60_000 }, () => {
    for (const seed of PURE_SEEDS) {
      const r = walk(seed, 29);
      expect(r.bossDefeats, `seed ${String(seed)} boss defeat`).toBe(1);
      expect(r.bossGatedAttempt, `seed ${String(seed)} gate`).toBe(2);
      expect(r.engage.status, `seed ${String(seed)} ENGAGE`).toBe('REJECTED');
      expect(r.engage.reason, `seed ${String(seed)} reason`).toBe('ACTION_LIMIT');
      expect(r.gold, `seed ${String(seed)} gold`).toBe(29); // the +15 bounty NEVER pays
    }
  });

  it('CASCADE class, NO-RECOVERY: the boss is clean in BOTH regimes → victory COMMITS, gold 29+15 = 44', { timeout: 60_000 }, () => {
    for (const seed of CASCADE_SEEDS) {
      const r = walk(seed, 29);
      expect(r.bossDefeats, `seed ${String(seed)} boss defeat`).toBe(0);
      expect(r.engage.status, `seed ${String(seed)} ENGAGE`).toBe('COMMITTED');
      expect(r.gold, `seed ${String(seed)} gold`).toBe(44);
    }
  });

  it('RECOVERY regime on ALL 13 gated seeds: every boss is clean → victory COMMITS, gold 500−30+15 = 485', { timeout: 60_000 }, () => {
    for (const seed of ALL_GATED) {
      const r = walk(seed, 500);
      expect(r.bossDefeats, `seed ${String(seed)} boss defeat`).toBe(0);
      expect(r.engage.status, `seed ${String(seed)} ENGAGE`).toBe('COMMITTED');
      expect(r.engage.reason, `seed ${String(seed)}`).toBeUndefined();
      expect(r.gold, `seed ${String(seed)} gold`).toBe(485);
    }
  });

  it('the bounty is EXACTLY the disclosed 15 (kill_boss) and the gold fold with the ENGAGE as a committed record is exact on every walk', { timeout: 60_000 }, () => {
    expect(bountyForKinds(['kill_boss'])).toBe(15);
    // 26 walks, every fold already asserted stepwise inside walk(); the final
    // gold obeys the closed form: recovery 485 / no-recovery 44 cascades, 29 pure.
    for (const seed of [...ALL_GATED]) {
      const recovery = walk(seed, 500);
      const noRecovery = walk(seed, 29);
      expect(recovery.gold).toBe(485);
      if (PURE_SEEDS.includes(seed)) {
        expect(noRecovery.gold).toBe(29);
      } else {
        expect(noRecovery.gold).toBe(44);
      }
      expect(recovery.engage.status).toBe('COMMITTED');
    }
  });
});
