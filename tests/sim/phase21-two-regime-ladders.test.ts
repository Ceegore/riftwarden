/**
 * Phase 21 §9 TWO-REGIME per-seed ladders for the WHOLE gated class. The
 * start-gold sweep DISCOVERED that the gold side shapes the ceiling class:
 * with the recovery service affordable (S ≥ 30) every gated walk gates its
 * boss at the FIRST re-engage (clean, zero defeats); without it (S ≤ 29) the
 * ceiling binds EARLIER in the walk. This pins BOTH regime curves for all 13
 * gated seeds — the exact post-node instability ladder + the exact gate shape
 * per combat node (committed attempts / gated attempt):
 *
 *   PURE class (903, 962, 963): in NO-RECOVERY the LAST prior combat node
 *   gates one attempt earlier (elite 3 → gated@3) and the boss COMMITS ONE
 *   defeat before gating@2 — versus 0 defeats gated@1 in recovery.
 *   CASCADE 900-like (900, 959): recovery gates elite@2; no-recovery the
 *   elite gates@1 AND the boss stays clean gated@1.
 *   CASCADE 915-like (915, 918, 942, 967, 973): the last prior battle gates@3
 *   in recovery vs gated@2 in no-recovery; boss clean gated@1 in both.
 *   CASCADE 916-like (916, 917, 947): same, the last prior elite gates@3 →
 *   gated@2; boss clean gated@1.
 *
 * Invariants pinned on BOTH regimes of every seed: every gate is a durable
 * `OPTION_UNAVAILABLE` REJECTED record, the clean-room fold equals the scalar
 * at EVERY step, the gold fold is exact (470 = 500−30 in recovery; 29 in
 * no-recovery — the refused service never pays), instability never exceeds
 * the shared bound, and the run finishes (a refused recovery is never a
 * soft-lock).
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

/** Per combat node: committed attempts + gated attempt (null = full stack). */
interface GateShape { readonly type: string; readonly committed: number; readonly gated: number | null; }

interface RegimeCurve {
  /** Post-node instability ladder, one entry per node in walk order. */
  readonly ladder: readonly number[];
  /** Per-combat-node gate shape (walk order, boss last). */
  readonly shapes: readonly GateShape[];
  readonly gold: number;
  readonly gateTx: readonly string[];
}

/** Walk the REAL manager in a regime; fold-exactness asserted at every step. */
function walkRegime(seed: number, startGold: number): RegimeCurve {
  store.clear();
  const mgr = RunManager.create(seed, startGold);
  const path = mainPath(mgr.map);
  const runId = mgr.snapshot().state.runId;
  const ladder: number[] = [];
  const shapes: GateShape[] = [];
  const gateTx: string[] = [];
  const goldFold = (): number => {
    let gold = startGold;
    for (const entry of Object.values(mgr.snapshot().state.ledger)) {
      if (entry.status === 'COMMITTED' && entry.action === 'SERVICE') gold -= MERCHANT_SERVICE_PRICE_GOLD;
    }
    return gold;
  };
  const assertFolds = (label: string): void => {
    const snap = mgr.snapshot();
    expect(snap.state.instability, `${label} fold (seed ${String(seed)})`).toBe(foldInstability(mgr.map, snap.state.ledger));
    expect(snap.state.gold, `${label} gold (seed ${String(seed)})`).toBe(goldFold());
    expect(snap.state.instability, `${label} bound`).toBeLessThanOrEqual(INSTABILITY_CEILING);
  };
  for (let guard = 0; guard < path.length; guard += 1) {
    const snap = mgr.snapshot();
    const nodeId = snap.currentNodeId;
    const type = snap.currentNodeType;
    mgr.enter(enterTransactionId(runId, nodeId));
    if (isCombat(type)) {
      let committed = 0;
      let gated: number | null = null;
      for (let attempt = 1; attempt <= MAX_REENGAGE_ATTEMPTS; attempt += 1) {
        const txId = actionTransactionId(runId, nodeId, 'ENGAGE_DEFEAT', `t-${String(guard)}-${String(attempt)}`);
        const record = mgr.act({ transactionId: txId, nodeId, action: 'ENGAGE_DEFEAT' });
        if (record.status !== 'COMMITTED') {
          expect(record.reason, `gate reason ${type}@${String(attempt)} (seed ${String(seed)})`).toBe('OPTION_UNAVAILABLE');
          expect(mgr.snapshot().state.ledger[txId]?.status).toBe('REJECTED');
          expect(mgr.snapshot().state.ledger[txId]?.reason).toBe('OPTION_UNAVAILABLE');
          gateTx.push(txId);
          gated = attempt;
          break;
        }
        committed += 1;
      }
      shapes.push({ type, committed, gated });
      mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'DECLINE', `td-${String(guard)}`), nodeId, action: 'DECLINE' });
    } else if (type === 'anchor' || type === 'merchant') {
      const txId = actionTransactionId(runId, nodeId, 'SERVICE', `ts-${String(guard)}`);
      const record = mgr.act({ transactionId: txId, nodeId, action: 'SERVICE' });
      if (record.status !== 'COMMITTED') {
        expect(record.reason, `no-recovery refusal (seed ${String(seed)})`).toBe('INSUFFICIENT_GOLD');
        mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'DECLINE', `tx-${String(guard)}`), nodeId, action: 'DECLINE' });
      }
    } else {
      mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'DECLINE', `ty-${String(guard)}`), nodeId, action: 'DECLINE' });
    }
    assertFolds(`pre-resolve ${type}@${String(guard)}`);
    mgr.resolve();
    assertFolds(`resolve ${type}@${String(guard)}`);
    ladder.push(mgr.snapshot().state.instability);
    const next = path[guard + 1];
    if (next === undefined) break;
    mgr.advance(next);
  }
  const final = mgr.snapshot();
  expect(final.state.gold).toBe(goldFold());
  mgr.finish();
  expect(mgr.snapshot().runStatus).toBe('finished');
  return { ladder, shapes, gold: final.state.gold, gateTx };
}

interface SeedCurve {
  readonly recoveryLadder: readonly number[];
  /** per combat node `(committed, gated)` — gated null = ungated. */
  readonly recoveryShapes: readonly (readonly (number | null)[])[];
  readonly noRecoveryLadder: readonly number[];
  readonly noRecoveryShapes: readonly (readonly (number | null)[])[];
}

// Probe-verified over the whole class with the exact SERVICE walk (S=500
// recovery, S=29 no-recovery: the flat price is 30, so 29 always refuses).
const CURVES = Object.freeze({
  903: Object.freeze({ recoveryLadder: Object.freeze([35, 38, 73, 55, 97, 97]), recoveryShapes: Object.freeze([[3, null], [3, null], [3, null], [0, 1]]), noRecoveryLadder: Object.freeze([35, 38, 73, 63, 90, 95]), noRecoveryShapes: Object.freeze([[3, null], [3, null], [2, 3], [1, 2]]) }),
  962: Object.freeze({ recoveryLadder: Object.freeze([35, 38, 73, 55, 97, 97]), recoveryShapes: Object.freeze([[3, null], [3, null], [3, null], [0, 1]]), noRecoveryLadder: Object.freeze([35, 38, 73, 63, 90, 95]), noRecoveryShapes: Object.freeze([[3, null], [3, null], [2, 3], [1, 2]]) }),
  963: Object.freeze({ recoveryLadder: Object.freeze([35, 37, 72, 54, 96, 96]), recoveryShapes: Object.freeze([[3, null], [3, null], [3, null], [0, 1]]), noRecoveryLadder: Object.freeze([35, 37, 72, 62, 89, 94]), noRecoveryShapes: Object.freeze([[3, null], [3, null], [2, 3], [1, 2]]) }),
  900: Object.freeze({ recoveryLadder: Object.freeze([35, 77, 97, 79, 96, 96]), recoveryShapes: Object.freeze([[3, null], [3, null], [2, 3], [1, 2], [0, 1]]), noRecoveryLadder: Object.freeze([35, 77, 97, 87, 99, 99]), noRecoveryShapes: Object.freeze([[3, null], [3, null], [2, 3], [0, 1], [0, 1]]) }),
  915: Object.freeze({ recoveryLadder: Object.freeze([35, 77, 97, 79, 99, 99]), recoveryShapes: Object.freeze([[3, null], [3, null], [2, 3], [2, 3], [0, 1]]), noRecoveryLadder: Object.freeze([35, 77, 97, 87, 97, 97]), noRecoveryShapes: Object.freeze([[3, null], [3, null], [2, 3], [1, 2], [0, 1]]) }),
  916: Object.freeze({ recoveryLadder: Object.freeze([35, 70, 90, 72, 99, 99]), recoveryShapes: Object.freeze([[3, null], [3, null], [2, 3], [2, 3], [0, 1]]), noRecoveryLadder: Object.freeze([35, 70, 90, 80, 97, 97]), noRecoveryShapes: Object.freeze([[3, null], [3, null], [2, 3], [1, 2], [0, 1]]) }),
  917: Object.freeze({ recoveryLadder: Object.freeze([35, 70, 90, 72, 99, 99]), recoveryShapes: Object.freeze([[3, null], [3, null], [2, 3], [2, 3], [0, 1]]), noRecoveryLadder: Object.freeze([35, 70, 90, 80, 97, 97]), noRecoveryShapes: Object.freeze([[3, null], [3, null], [2, 3], [1, 2], [0, 1]]) }),
  918: Object.freeze({ recoveryLadder: Object.freeze([35, 77, 97, 79, 99, 99]), recoveryShapes: Object.freeze([[3, null], [3, null], [2, 3], [2, 3], [0, 1]]), noRecoveryLadder: Object.freeze([35, 77, 97, 87, 97, 97]), noRecoveryShapes: Object.freeze([[3, null], [3, null], [2, 3], [1, 2], [0, 1]]) }),
  942: Object.freeze({ recoveryLadder: Object.freeze([35, 77, 97, 79, 99, 99]), recoveryShapes: Object.freeze([[3, null], [3, null], [2, 3], [2, 3], [0, 1]]), noRecoveryLadder: Object.freeze([35, 77, 97, 87, 97, 97]), noRecoveryShapes: Object.freeze([[3, null], [3, null], [2, 3], [1, 2], [0, 1]]) }),
  947: Object.freeze({ recoveryLadder: Object.freeze([35, 70, 90, 72, 99, 99]), recoveryShapes: Object.freeze([[3, null], [3, null], [2, 3], [2, 3], [0, 1]]), noRecoveryLadder: Object.freeze([35, 70, 90, 80, 97, 97]), noRecoveryShapes: Object.freeze([[3, null], [3, null], [2, 3], [1, 2], [0, 1]]) }),
  959: Object.freeze({ recoveryLadder: Object.freeze([35, 77, 97, 79, 96, 96]), recoveryShapes: Object.freeze([[3, null], [3, null], [2, 3], [1, 2], [0, 1]]), noRecoveryLadder: Object.freeze([35, 77, 97, 87, 99, 99]), noRecoveryShapes: Object.freeze([[3, null], [3, null], [2, 3], [0, 1], [0, 1]]) }),
  967: Object.freeze({ recoveryLadder: Object.freeze([35, 77, 97, 79, 99, 99]), recoveryShapes: Object.freeze([[3, null], [3, null], [2, 3], [2, 3], [0, 1]]), noRecoveryLadder: Object.freeze([35, 77, 97, 87, 97, 97]), noRecoveryShapes: Object.freeze([[3, null], [3, null], [2, 3], [1, 2], [0, 1]]) }),
  973: Object.freeze({ recoveryLadder: Object.freeze([35, 77, 97, 79, 99, 99]), recoveryShapes: Object.freeze([[3, null], [3, null], [2, 3], [2, 3], [0, 1]]), noRecoveryLadder: Object.freeze([35, 77, 97, 87, 97, 97]), noRecoveryShapes: Object.freeze([[3, null], [3, null], [2, 3], [1, 2], [0, 1]]) }),
}) as Readonly<Record<number, SeedCurve>>;

const PURE_SEEDS: readonly number[] = Object.freeze([903, 962, 963]);
const CASCADE_SEEDS: readonly number[] = Object.freeze([900, 915, 916, 917, 918, 942, 947, 959, 967, 973]);

describe('P21 §9 two-regime per-seed ladders for the whole gated class', () => {
  it('every gated seed: BOTH regime curves are exactly the pinned ladders with the exact per-node gate shapes, fold-exact at every step, runs finish', { timeout: 60_000 }, () => {
    const seeds = [...PURE_SEEDS, ...CASCADE_SEEDS];
    expect(seeds.length).toBe(13);
    for (const seed of seeds) {
      const pinned = CURVES[seed];
      if (pinned === undefined) throw new Error(`no pinned curve for seed ${String(seed)}`);
      // RECOVERY regime (service affordable at S=500 → gold folds 470).
      const recovery = walkRegime(seed, 500);
      expect(recovery.ladder, `seed ${String(seed)} recovery ladder`).toEqual(pinned.recoveryLadder);
      expect(recovery.shapes.map((s) => [s.committed, s.gated]), `seed ${String(seed)} recovery shapes`).toEqual(pinned.recoveryShapes);
      expect(recovery.gold, `seed ${String(seed)} recovery gold`).toBe(470);
      expect(recovery.gateTx.length).toBe(pinned.recoveryShapes.filter(([, g]) => g !== null).length);
      // NO-RECOVERY regime (service refused at S=29 → gold folds 29, never spent).
      const noRecovery = walkRegime(seed, 29);
      expect(noRecovery.ladder, `seed ${String(seed)} no-recovery ladder`).toEqual(pinned.noRecoveryLadder);
      expect(noRecovery.shapes.map((s) => [s.committed, s.gated]), `seed ${String(seed)} no-recovery shapes`).toEqual(pinned.noRecoveryShapes);
      expect(noRecovery.gold, `seed ${String(seed)} no-recovery gold`).toBe(29);
    }
  });

  it('the gold side SHAPES the class: without the recovery, the LAST prior combat node always gates at least one attempt EARLIER, and the PURE trio is the ONLY class where the boss pays a defeat', { timeout: 60_000 }, () => {
    for (const seed of [...PURE_SEEDS, ...CASCADE_SEEDS]) {
      const recovery = walkRegime(seed, 500);
      const noRecovery = walkRegime(seed, 29);
      // Every gate in both regimes was a durable OPTION_UNAVAILABLE rejection
      // (asserted inside the walk); each walk's gates are distinct ledger txs.
      expect(recovery.gateTx.length).toBeGreaterThanOrEqual(1);
      expect(noRecovery.gateTx.length).toBeGreaterThanOrEqual(1);
      const lastPriorR = recovery.shapes[recovery.shapes.length - 2];
      const lastPriorN = noRecovery.shapes[noRecovery.shapes.length - 2];
      if (lastPriorR === undefined || lastPriorN === undefined) throw new Error('no last prior shape');
      const lastPriorGatesEarlier = lastPriorN.gated !== null
        && (lastPriorR.gated === null || lastPriorN.gated <= lastPriorR.gated);
      expect(lastPriorGatesEarlier, `seed ${String(seed)} last-prior gates earlier without recovery`).toBe(true);
      // The boss: PURE pays exactly one defeat in no-recovery (gated@2 vs gated@1
      // clean); every CASCADE seed keeps the boss clean (0 defeats) in BOTH.
      const bossR = recovery.shapes[recovery.shapes.length - 1];
      const bossN = noRecovery.shapes[noRecovery.shapes.length - 1];
      if (bossR === undefined || bossN === undefined) throw new Error('no boss shape');
      if (PURE_SEEDS.includes(seed)) {
        expect(bossN.committed).toBe(1);
        expect(bossN.gated).toBe(2);
        expect(bossR.committed).toBe(0);
        expect(bossR.gated).toBe(1);
      } else {
        expect(bossN.committed).toBe(0);
        expect(bossN.gated).toBe(1);
        expect(bossR.committed).toBe(0);
        expect(bossR.gated).toBe(1);
      }
    }
  });
});
