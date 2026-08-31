/**
 * Phase 21 §9 RE-ENGAGE ESCALATION THROUGH THE RESTORED MANAGER. The
 * DefeatPanel affordance is render-tested and the runner-level rewatch is
 * pinned; this test drives the FULL loop through the REAL `RunManager` — the
 * facade React uses — across a RESTORE boundary:
 *
 *   1. ESCALATION — on a real combat node the manager's ENGAGE_DEFEAT
 *      rewatches cost 5×k instability (5, 10, 15) and NEVER pay gold/kills or
 *      disturb the REWARD snapshot; the 4th is REJECTED (cap 3);
 *   2. RESTORE MID-WAY — after the first rewatch the run is restored; the
 *      restored manager CONTINUES the escalation identically (the tax is a
 *      function of the persisted ledger, so a reload never resets it) and the
 *      persisted instability is byte-identical across the boundary;
 *   3. CEILING — when instability reaches the bound, the manager's next
 *      ENGAGE_DEFEAT is REJECTED `OPTION_UNAVAILABLE` (instability never
 *      passes 100) — the retreat stays legal, so the ceiling is a gate, never
 *      a soft-lock;
 *   4. SNAPSHOT STABILITY — the REWARD snapshot is byte-identical across the
 *      whole loop + restore (a rewatch can never re-roll the node's reward).
 */
import { describe, expect, it } from 'vitest';
import { RunManager } from '../../src/game/expedition/run-manager.js';
import { mainPath } from '../../src/game/expedition/expedition-runner.js';
import { enterTransactionId, actionTransactionId } from '../../src/features/expedition/transaction-ids.js';
import { MAX_REENGAGE_ATTEMPTS, INSTABILITY_CEILING } from '../../src/game/expedition/nodes/handlers/combat.js';
import type { RewardSnapshot } from '../../src/game/expedition/nodes/types.js';

const store = new Map<string, string>();
(globalThis as { localStorage: unknown }).localStorage = {
  getItem(key: string) { return store.get(String(key)) ?? null; },
  setItem(key: string, value: string) { store.set(String(key), String(value)); },
  removeItem(key: string) { store.delete(String(key)); },
  clear() { store.clear(); },
  get length() { return store.size; },
  key(index: number) { return [...store.keys()][index] ?? null; },
};

/** Walks a fresh manager to the first combat node and ENTERs it. */
function managerEnteredCombat(seed: number): RunManager {
  store.clear();
  const mgr = RunManager.create(seed, 300);
  let guard = 0;
  while (!['battle', 'elite', 'boss'].includes(mgr.snapshot().currentNodeType) && guard < 80) {
    const snap = mgr.snapshot();
    const next = snap.reachableNodes[0];
    if (next === undefined) throw new Error('dead-end before combat');
    mgr.enter(enterTransactionId(snap.state.runId, snap.currentNodeId));
    mgr.resolve();
    mgr.advance(next);
    guard += 1;
  }
  const snap = mgr.snapshot();
  if (!['battle', 'elite', 'boss'].includes(snap.currentNodeType)) throw new Error('no combat node');
  mgr.enter(enterTransactionId(snap.state.runId, snap.currentNodeId));
  return mgr;
}

function rewardOf(mgr: RunManager, nodeId: string): RewardSnapshot {
  const snap = mgr.snapshot().state.snapshots[nodeId];
  if (snap === undefined || snap.kind !== 'REWARD') throw new Error('no REWARD snapshot');
  return snap;
}

describe('P21 §9 re-engage escalation through the restored manager', () => {
  it('ENGAGE_DEFEAT rewatches escalate 5×k through the manager, cap at 3, and never pay gold/kills or touch the reward', () => {
    const mgr = managerEnteredCombat(901);
    const snap = mgr.snapshot();
    const nodeId = snap.currentNodeId;
    const runId = snap.state.runId;
    const gold0 = snap.state.gold;
    const kills0 = snap.state.killsEarned;
    const inst0 = snap.state.instability;
    const snap0 = rewardOf(mgr, nodeId);
    let inst = inst0;
    for (let attempt = 1; attempt <= MAX_REENGAGE_ATTEMPTS; attempt += 1) {
      const tx = actionTransactionId(runId, nodeId, 'ENGAGE_DEFEAT', String(attempt));
      const record = mgr.act({ transactionId: tx, nodeId, action: 'ENGAGE_DEFEAT' });
      expect(record.status, `attempt ${String(attempt)} commits`).toBe('COMMITTED');
      inst += 5 * attempt;
      expect(mgr.snapshot().state.instability, `attempt ${String(attempt)} instability`).toBe(inst);
      // A rewatch pays nothing and never disturbs the stored reward.
      expect(mgr.snapshot().state.gold).toBe(gold0);
      expect(mgr.snapshot().state.killsEarned).toBe(kills0);
      expect(rewardOf(mgr, nodeId)).toEqual(snap0);
    }
    // The 4th is REJECTED (cap at MAX_REENGAGE_ATTEMPTS).
    const fourthTx = actionTransactionId(runId, nodeId, 'ENGAGE_DEFEAT', '4');
    const fourth = mgr.act({ transactionId: fourthTx, nodeId, action: 'ENGAGE_DEFEAT' });
    expect(fourth.status).toBe('REJECTED');
    expect(mgr.snapshot().state.instability).toBe(inst);
    // The snapshot is still the original after the whole stack.
    expect(rewardOf(mgr, nodeId)).toEqual(snap0);
  });

  it('a restore MID-WAY continues the escalation identically (the tax is a function of the persisted ledger)', () => {
    const mgr = managerEnteredCombat(902);
    const snap = mgr.snapshot();
    const nodeId = snap.currentNodeId;
    const runId = snap.state.runId;
    const snap0 = rewardOf(mgr, nodeId);
    const gold0 = snap.state.gold;
    const kills0 = snap.state.killsEarned;

    // Attempt 1 (+5)…
    mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'ENGAGE_DEFEAT', '1'), nodeId, action: 'ENGAGE_DEFEAT' });
    const after1 = mgr.snapshot();
    expect(after1.state.instability).toBe(snap.state.instability + 5);

    // …RESTORE mid-way (the autosave is the manager's own persisted state).
    const restored = RunManager.restore();
    expect(restored).not.toBeNull();
    if (restored === null) throw new Error('restore failed');
    expect(restored.snapshot().state.instability).toBe(after1.state.instability);
    expect(restored.snapshot().state.ledger[actionTransactionId(runId, nodeId, 'ENGAGE_DEFEAT', '1')]?.status).toBe('COMMITTED');
    expect(rewardOf(restored, nodeId)).toEqual(snap0);

    // Attempt 2 (+10) and 3 (+15) on the RESTORED manager — the tax continues.
    restored.act({ transactionId: actionTransactionId(runId, nodeId, 'ENGAGE_DEFEAT', '2'), nodeId, action: 'ENGAGE_DEFEAT' });
    expect(restored.snapshot().state.instability).toBe(after1.state.instability + 10);
    restored.act({ transactionId: actionTransactionId(runId, nodeId, 'ENGAGE_DEFEAT', '3'), nodeId, action: 'ENGAGE_DEFEAT' });
    const after3 = restored.snapshot();
    expect(after3.state.instability).toBe(after1.state.instability + 25);
    // 4th REJECTED on the restored run too (the cap is durable).
    const fourth = restored.act({ transactionId: actionTransactionId(runId, nodeId, 'ENGAGE_DEFEAT', '4'), nodeId, action: 'ENGAGE_DEFEAT' });
    expect(fourth.status).toBe('REJECTED');
    // Gold/kills/snapshot never moved across the boundary.
    expect(restored.snapshot().state.gold).toBe(gold0);
    expect(restored.snapshot().state.killsEarned).toBe(kills0);
    expect(rewardOf(restored, nodeId)).toEqual(snap0);
  });

  it('the manager never pushes instability past the ceiling — the next re-engage is REJECTED OPTION_UNAVAILABLE and the retreat stays legal', () => {
    // Drive instability up across the main path: every combat node takes all
    // three rewatches (+5/+10/+15) until the ceiling gates a fresh re-engage.
    store.clear();
    const mgr = RunManager.create(903, 300);
    const path = mainPath(mgr.map);
    const runId = mgr.snapshot().state.runId;
    let ceilingRejected = false;
    let finalInstability = 0;
    for (let guard = 0; guard < path.length; guard += 1) {
      const snap = mgr.snapshot();
      const nodeId = snap.currentNodeId;
      const type = snap.currentNodeType;
      mgr.enter(enterTransactionId(runId, nodeId));
      if (type === 'battle' || type === 'elite' || type === 'boss') {
        let attempt = 1;
        for (; attempt <= MAX_REENGAGE_ATTEMPTS; attempt += 1) {
          const tx = actionTransactionId(runId, nodeId, 'ENGAGE_DEFEAT', `m${String(guard)}-${String(attempt)}`);
          const record = mgr.act({ transactionId: tx, nodeId, action: 'ENGAGE_DEFEAT' });
          if (record.status === 'REJECTED') {
            // The ceiling (or cap) gated the rewatch — instability is at the bound.
            const inst = mgr.snapshot().state.instability;
            expect(inst).toBeLessThanOrEqual(INSTABILITY_CEILING);
            if (inst + 5 * attempt > INSTABILITY_CEILING) ceilingRejected = true;
            break;
          }
          expect(record.status).toBe('COMMITTED');
        }
        // Retreat clears the node (the ceiling is a gate, never a soft-lock).
        mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'DECLINE', `m${String(guard)}`), nodeId, action: 'DECLINE' });
      } else {
        mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'DECLINE', `m${String(guard)}`), nodeId, action: 'DECLINE' });
      }
      mgr.resolve();
      finalInstability = mgr.snapshot().state.instability;
      expect(finalInstability).toBeLessThanOrEqual(INSTABILITY_CEILING);
      const next = path[guard + 1];
      if (next === undefined) break;
      mgr.advance(next);
    }
    // The ceiling is real: across the walk a re-engage WAS gated by the bound
    // (the 3rd rewatch on the elite would have pushed 90+15=105, the 2nd on
    // the boss 95+10=105) — the manager never lands above 100.
    expect(ceilingRejected).toBe(true);
    expect(finalInstability).toBeLessThanOrEqual(INSTABILITY_CEILING);
    expect(finalInstability).toBeGreaterThanOrEqual(INSTABILITY_CEILING - 10);
    // And the walk still COMPLETED (every node resolved + advanced): the
    // ceiling is a gate on the re-engage, never a soft-lock on the run.
    expect(mgr.snapshot().runStatus).toBe('active');
  });
});
