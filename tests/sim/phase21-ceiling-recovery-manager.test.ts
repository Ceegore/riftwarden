/**
 * Phase 21 §9 CEILING RECOVERY THROUGH THE RESTORED MANAGER. The
 * anchor-economy test pins the runner-level recovery (a combat node blocked at
 * the instability ceiling re-opens after an anchor SERVICE −8); this drives
 * the SAME loop through the REAL `RunManager` — the facade React uses — across
 * a RESTORE boundary, on seed 902 whose main path is
 * `battle → battle → battle → anchor → battle → boss`:
 *
 *   1. BLOCKED — re-engages on the third battle node push instability to the
 *      bound; the NEXT ENGAGE_DEFEAT is REJECTED `OPTION_UNAVAILABLE`
 *      (instability + next tax > 100) while the DECLINE retreat stays legal;
 *   2. RESTORE MID-WAY — the autosave at the blocked node is restored; the
 *      restored manager is STILL blocked (the ceiling is a function of the
 *      persisted ledger, never reset by a reload), and the REJECTED attempt is
 *      durably recorded on the ledger;
 *   3. ANCHOR −8 — the run advances to the anchor node and commits a SERVICE:
 *      instability drops by EXACTLY `ANCHOR_SERVICE_INSTABILITY_REDUCTION`
 *      (−8) at the gold cost; the previously-blocked re-engage headroom
 *      re-opens;
 *   4. ESCALATION TO THE CAP — back on combat, the 5×k tax continues from the
 *      persisted ledger and the first re-engage that was ceiling-blocked now
 *      commits; instability never passes 100.
 */
import { describe, expect, it } from 'vitest';
import { RunManager } from '../../src/game/expedition/run-manager.js';
import { mainPath } from '../../src/game/expedition/expedition-runner.js';
import { enterTransactionId, actionTransactionId } from '../../src/features/expedition/transaction-ids.js';
import { MAX_REENGAGE_ATTEMPTS, INSTABILITY_CEILING, DEFEAT_INSTABILITY_DELTA } from '../../src/game/expedition/nodes/handlers/combat.js';
import { ANCHOR_SERVICE_INSTABILITY_REDUCTION, ANCHOR_SERVICE_COST_GOLD } from '../../src/game/expedition/nodes/handlers/anchor.js';

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

/** The node types of the given map's main path (pins the seed's shape once). */
function pathTypes(mgr: RunManager): Array<string | undefined> {
  return mainPath(mgr.map).map((id) => mgr.map.nodes.find((n) => n.id === id)?.type);
}

/**
 * Walks a fresh manager down `path`, re-engaging defeats on combat nodes, and
 * ends having ENTERED the combat node at `target` (never advancing past it).
 */
function walkEnter(mgr: RunManager, path: readonly string[], runId: string, target: number): void {
  for (let g = 0; g <= target; g += 1) {
    const snap = mgr.snapshot();
    const nodeId = snap.currentNodeId;
    const type = snap.currentNodeType;
    mgr.enter(enterTransactionId(runId, nodeId));
    if (isCombat(type)) {
      for (let a = 1; a <= MAX_REENGAGE_ATTEMPTS; a += 1) {
        const rec = mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'ENGAGE_DEFEAT', `w${String(g)}-${String(a)}`), nodeId, action: 'ENGAGE_DEFEAT' });
        if (rec.status === 'REJECTED') break;
      }
    }
    if (g < target) {
      mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'DECLINE', `wd${String(g)}`), nodeId, action: 'DECLINE' });
      mgr.resolve();
      const next = path[g + 1];
      if (next === undefined) throw new Error('walk ran off the path');
      mgr.advance(next);
    }
  }
}

describe('P21 §9 ceiling recovery through the restored manager', () => {
  it('a ceiling-blocked re-engage, restored mid-way, re-opens after an anchor SERVICE −8 and escalates again', () => {
    store.clear();
    const mgr = RunManager.create(902, 500);
    const path = mainPath(mgr.map);
    const runId = mgr.snapshot().state.runId;
    expect(pathTypes(mgr)).toEqual(['battle', 'battle', 'battle', 'anchor', 'battle', 'boss']);
    expect(path.length).toBe(6);

    // Walk through the third battle node (index 2) with full re-engage stacks.
    walkEnter(mgr, path, runId, 2);
    if (path[2] === undefined) throw new Error('path[2] missing');
    const node2 = path[2];
    expect(mgr.snapshot().currentNodeType).toBe('battle');
    const blockedInst = mgr.snapshot().state.instability;
    expect(blockedInst).toBeLessThanOrEqual(INSTABILITY_CEILING);

    // The NEXT re-engage is ceiling-blocked (instability + next tax > 100)…
    const blockTx = actionTransactionId(runId, node2, 'ENGAGE_DEFEAT', 'blocked-attempt');
    const blocked = mgr.act({ transactionId: blockTx, nodeId: node2, action: 'ENGAGE_DEFEAT' });
    expect(blocked.status).toBe('REJECTED');
    expect(mgr.snapshot().state.instability).toBe(blockedInst);
    // …while the retreat stays legal (the ceiling is a gate, never a soft-lock).
    const declineTx = actionTransactionId(runId, node2, 'DECLINE', 'blocked-decline');
    const decline = mgr.act({ transactionId: declineTx, nodeId: node2, action: 'DECLINE' });
    expect(decline.status).toBe('COMMITTED');
    mgr.resolve();

    // RESTORE MID-WAY: the blocked+declined state survives the restore
    // byte-identically at the scalar level, and the REJECTED attempt is a
    // durable ledger record (tail +5 no-op: the scalar never moved).
    const restored = RunManager.restore();
    expect(restored).not.toBeNull();
    if (restored === null) throw new Error('restore failed');
    expect(restored.snapshot().state.instability).toBe(blockedInst);
    expect(restored.snapshot().state.ledger[blockTx]?.status).toBe('REJECTED');
    expect(restored.snapshot().state.ledger[declineTx]?.status).toBe('COMMITTED');

    // Advance to the anchor node (index 3) and ENTER it exactly once.
    if (path[3] === undefined) throw new Error('path[3] missing');
    const anchorId = path[3];
    restored.advance(anchorId);
    expect(restored.snapshot().currentNodeType).toBe('anchor');
    const goldBefore = restored.snapshot().state.gold;
    restored.enter(enterTransactionId(runId, anchorId));
    const instAtAnchor = restored.snapshot().state.instability;

    // ANCHOR SERVICE −8 at the gold cost.
    const serviceTx = actionTransactionId(runId, anchorId, 'SERVICE', 'recovery');
    const service = restored.act({ transactionId: serviceTx, nodeId: anchorId, action: 'SERVICE' });
    expect(service.status, 'the anchor service commits').toBe('COMMITTED');
    const afterService = restored.snapshot();
    expect(afterService.state.instability).toBe(instAtAnchor - ANCHOR_SERVICE_INSTABILITY_REDUCTION);
    expect(afterService.state.gold).toBe(goldBefore - ANCHOR_SERVICE_COST_GOLD);

    // Advance to the fourth node (index 4): a battle. The headroom the SERVICE
    // restored now lets a re-engage — which was ceiling-blocked at node 2 —
    // commit, and the 5×k escalation continues from the persisted ledger.
    restored.act({ transactionId: actionTransactionId(runId, anchorId, 'DECLINE', 'anchor-out'), nodeId: anchorId, action: 'DECLINE' });
    restored.resolve();
    if (path[4] === undefined) throw new Error('path[4] missing');
    const node4 = path[4];
    restored.advance(node4);
    expect(restored.snapshot().currentNodeType).toBe('battle');
    restored.enter(enterTransactionId(runId, node4));
    const inst4 = restored.snapshot().state.instability;
    const reTx = actionTransactionId(runId, node4, 'ENGAGE_DEFEAT', 'recovered-1');
    const re = restored.act({ transactionId: reTx, nodeId: node4, action: 'ENGAGE_DEFEAT' });
    expect(re.status, 'the recovered re-engage commits').toBe('COMMITTED');
    expect(restored.snapshot().state.instability).toBe(inst4 + DEFEAT_INSTABILITY_DELTA);
    // The recovery never lets instability pass the ceiling.
    expect(restored.snapshot().state.instability).toBeLessThanOrEqual(INSTABILITY_CEILING);
  });
});
