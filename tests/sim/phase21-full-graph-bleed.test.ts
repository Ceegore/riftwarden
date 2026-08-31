/**
 * Phase 21 §9 FULL-GRAPH WORST-CASE BLEED. The main-path bleed (in the
 * instability differential) folds the worst case on ONE guaranteed chain with
 * one restore cut; this drives the SAME worst-case bleed over the GREEDY-LAST
 * FULL GRAPH (seed 503 threads a merchant AND an anchor: battle → merchant →
 * elite → battle → elite → anchor → scout → boss) with `RunManager.restore()`
 * cuts at EVERY hop, folding THREE clean-room oracles at every step:
 *
 *   instability === foldInstability(ledger)   (enter deltas + escalating 5×k
 *     defeat taxes − service reductions, floor-clamped — the same oracle the
 *     ledger-fold walk uses);
 *   gold        === startGold − 30 × committed services (a pure bleed has no
 *     victories and defeats pay nothing — the ONLY gold movement is the
 *     service cost);
 *   totalTax    === Σ 5k over the committed escalation (the ledger is the
 *     only authority — a restore never re-rolls it).
 *
 * The economic determinism must hold on the WHOLE graph — every side branch,
 * every elite, the boss — not just the guaranteed main chain, and across a
 * reload at every hop.
 */
import { describe, expect, it } from 'vitest';
import { RunManager } from '../../src/game/expedition/run-manager.js';
import { enterTransactionId, actionTransactionId } from '../../src/features/expedition/transaction-ids.js';
import { MAX_REENGAGE_ATTEMPTS } from '../../src/game/expedition/nodes/handlers/combat.js';
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

const isCombat = (t: string): boolean => t === 'battle' || t === 'elite' || t === 'boss';

// ---------------------------------------------------------------------------
// CLEAN-ROOM ORACLES (independent specs — never import the handler modules).
// ---------------------------------------------------------------------------

const ENTER_DELTA_BY_TYPE: Readonly<Record<string, number>> = Object.freeze({
  battle: 5, elite: 12, boss: 0, event: 3, merchant: 3, recruitment: 4,
  treasure: 5, workshop: 2, altar: 8, scout: 2, anchor: -10, story: 0,
});

function typeOf(map: ExpeditionMap, nodeId: string): string {
  const node = map.nodes.find((candidate) => candidate.id === nodeId);
  return node?.type ?? 'story';
}

/** Folds the committed ledger into the instability the run SHOULD have. */
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

/** Folds the committed escalation into the total defeat tax paid. */
function taxFold(ledger: Readonly<Record<string, TransactionRecord>>): number {
  let tax = 0;
  const defeatCountByNode = new Map<string, number>();
  for (const entry of Object.values(ledger)) {
    if (entry.status !== 'COMMITTED' || entry.action !== 'ENGAGE_DEFEAT') continue;
    const attempt = (defeatCountByNode.get(entry.nodeId) ?? 0) + 1;
    defeatCountByNode.set(entry.nodeId, attempt);
    tax += 5 * attempt;
  }
  return tax;
}

describe('P21 §9 full-graph worst-case bleed (restore at every hop)', () => {
  it('the greedy-last full-graph bleed folds gold + instability + total-tax EXACTLY at every step with restore cuts at EVERY hop', { timeout: 60_000 }, () => {
    store.clear();
    const seed = 503;
    const startGold = 500;
    const SERVICE_GOLD = 30;
    let mgr = RunManager.create(seed, startGold);
    const visited = new Set<string>();
    const runId = mgr.snapshot().state.runId;
    let servicesCommitted = 0;
    let totalTax = 0;
    let cuts = 0;
    let guard = 0;

    const goldFold = (ledger: Readonly<Record<string, TransactionRecord>>): number => {
      let gold = startGold;
      for (const entry of Object.values(ledger)) {
        if (entry.status !== 'COMMITTED' || entry.action !== 'SERVICE') continue;
        gold -= SERVICE_GOLD;
      }
      return gold;
    };

    const assertFolds = (label: string): void => {
      const snap = mgr.snapshot();
      expect(snap.state.instability, `${label} instability`).toBe(foldInstability(mgr.map, snap.state.ledger));
      expect(snap.state.gold, `${label} gold`).toBe(goldFold(snap.state.ledger));
      expect(taxFold(snap.state.ledger), `${label} total tax`).toBe(totalTax);
    };

    while (guard < 200) {
      const snap = mgr.snapshot();
      const type = snap.currentNodeType;
      const nodeId = snap.currentNodeId;
      visited.add(nodeId);

      mgr.enter(enterTransactionId(runId, nodeId));
      assertFolds(`after ENTER ${nodeId}`);

      if (isCombat(type)) {
        // Exhaust the re-engage budget on EVERY combat node (elite + boss
        // included) — the ceiling gates whatever would pass 100.
        for (let attempt = 1; attempt <= MAX_REENGAGE_ATTEMPTS; attempt += 1) {
          const record = mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'ENGAGE_DEFEAT', `fg-${String(guard)}-${String(attempt)}`), nodeId, action: 'ENGAGE_DEFEAT' });
          if (record.status !== 'COMMITTED') break;
          totalTax += 5 * attempt;
          assertFolds(`after defeat ${String(attempt)} ${nodeId}`);
        }
        // Retreat clears the lost node (never a soft-lock).
        mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'DECLINE', `fd-${String(guard)}`), nodeId, action: 'DECLINE' });
        assertFolds(`after retreat ${nodeId}`);
      } else if (type === 'anchor' || type === 'merchant') {
        // The recovery lever: SERVICE (−8 anchor / −10 merchant) at the 30
        // gold cost. A rejected service (gold/floor) commits nothing and is
        // followed by a DECLINE so the visit seals before resolve.
        const record = mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'SERVICE', `fs-${String(guard)}`), nodeId, action: 'SERVICE' });
        if (record.status === 'COMMITTED') servicesCommitted += 1;
        assertFolds(`after service attempt ${nodeId}`);
        if (record.status !== 'COMMITTED') {
          mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'DECLINE', `fx-${String(guard)}`), nodeId, action: 'DECLINE' });
        }
      } else {
        mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'DECLINE', `fy-${String(guard)}`), nodeId, action: 'DECLINE' });
        assertFolds(`after DECLINE ${nodeId}`);
      }

      mgr.resolve();
      assertFolds(`after resolve ${nodeId}`);

      // RESTORE CUT AT EVERY HOP: the restored manager carries the same
      // ledger/scalars and continues identically.
      const beforeNode = mgr.snapshot().currentNodeId;
      const restored = RunManager.restore();
      expect(restored).not.toBeNull();
      if (restored === null) throw new Error('manager restore failed');
      mgr = restored;
      expect(mgr.snapshot().currentNodeId).toBe(beforeNode);
      assertFolds(`after restore-cut ${nodeId}`);
      cuts += 1;

      // Greedy-last: thread the next unvisited branch.
      const candidates = mgr.snapshot().reachableNodes.filter((id) => !visited.has(id));
      const next = candidates[candidates.length - 1];
      if (next === undefined) break;
      mgr.advance(next);
      assertFolds(`after advance ${nodeId}`);
      guard += 1;
    }

    // The full-graph bleed is BOUNDED and exact.
    expect(cuts).toBeGreaterThanOrEqual(6); // 8-node graph → 7 restore cuts
    expect(servicesCommitted).toBeGreaterThanOrEqual(2); // BOTH the merchant AND the anchor took the SERVICE
    expect(totalTax).toBeGreaterThan(0);
    const final = mgr.snapshot();
    expect(final.currentNodeType).toBe('boss'); // the whole graph was threaded
    expect(final.state.gold).toBe(goldFold(final.state.ledger));
    expect(final.state.gold).toBeGreaterThanOrEqual(0);
    expect(final.state.instability).toBe(foldInstability(mgr.map, final.state.ledger));
    expect(taxFold(final.state.ledger)).toBe(totalTax);
    // Defeats pay no gold and no kills: the pure bleed never moved either.
    expect(final.state.killsEarned).toBe(0);
    // The final full-graph state is itself a deterministic snapshot: the walk
    // covered every node kind the oracle folds.
    const coveredTypes = new Set<string>();
    for (const id of visited) coveredTypes.add(typeOf(mgr.map, id));
    expect(coveredTypes.has('merchant')).toBe(true);
    expect(coveredTypes.has('anchor')).toBe(true);
    expect(coveredTypes.has('boss')).toBe(true);
  });
});
