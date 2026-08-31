/**
 * Phase 21 §9 REJECTED-ATTEMPT DURABILITY. The round-trip tests pin the
 * arithmetic of what a rejection leaves BEHIND in the trajectory; this pins
 * the LEDGER CONTRACT of a ceiling-rejected re-engage on seed 903 (the PURE
 * class: the boss is the ONLY gated node of the whole walk):
 *
 *   1. the rejection is a DURABLE ledger record — the returned result AND the
 *      stored entry both carry `status: 'REJECTED'` with the ceiling reason
 *      `OPTION_UNAVAILABLE` (a cap/limit drift would surface here);
 *   2. a SECOND rejected attempt with a fresh transaction id NEVER advances
 *      the tax and never increments the node's committed-defeat count — the
 *      escalation stays at attempt 1 (5);
 *   3. a `RunManager.restore()` mid-boundary keeps EVERY rejected record
 *      byte-identically (tx id, status, reason) at the same instability — the
 *      rejected attempt survives the reload;
 *   4. the clean-room fold SKIPS rejected records: with the walk's rejects in
 *      the ledger, `fold(ledger) === 97` exactly (the persisted scalar);
 *   5. the rejection never soft-locks: the retreat commits on the restored
 *      manager, the node resolves and the run finishes.
 */
import { describe, expect, it } from 'vitest';
import { RunManager } from '../../src/game/expedition/run-manager.js';
import { mainPath } from '../../src/game/expedition/expedition-runner.js';
import { enterTransactionId, actionTransactionId } from '../../src/features/expedition/transaction-ids.js';
import { INSTABILITY_CEILING, MAX_REENGAGE_ATTEMPTS } from '../../src/game/expedition/nodes/handlers/combat.js';
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

function countCommittedDefeats(ledger: Readonly<Record<string, TransactionRecord>>, nodeId: string): number {
  return Object.values(ledger).filter((e) => e.nodeId === nodeId && e.status === 'COMMITTED' && e.action === 'ENGAGE_DEFEAT').length;
}

const isCombat = (t: string): boolean => t === 'battle' || t === 'elite' || t === 'boss';

describe('P21 §9 rejected-attempt durability (seed 903, the PURE class)', () => {
  it('a ceiling-rejected re-engage is a durable REJECTED ledger record with the exact reason, survives a restore byte-identically, never advances the tax, and leaves the retreat legal', { timeout: 60_000 }, () => {
    store.clear();
    let mgr = RunManager.create(903, 500);
    const path = mainPath(mgr.map);
    const runId = mgr.snapshot().state.runId;

    // The SERVICE walk to the boss: full stacks on every combat node, the
    // anchor service, fold-exact at every step. The boss is the ONLY gated
    // node of the walk (the PURE-class property, re-pinned here).
    const rejections: { readonly type: string; readonly attempt: number }[] = [];
    let bossContractsRun = false;
    let tx1 = '';
    let tx2 = '';
    let bossId = '';
    for (let guard = 0; guard < path.length; guard += 1) {
      const snap = mgr.snapshot();
      const nodeId = snap.currentNodeId;
      const type = snap.currentNodeType;
      mgr.enter(enterTransactionId(runId, nodeId));
      bossId = nodeId;
      if (isCombat(type)) {
        for (let attempt = 1; attempt <= MAX_REENGAGE_ATTEMPTS; attempt += 1) {
          const record = mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'ENGAGE_DEFEAT', `w-${String(guard)}-${String(attempt)}`), nodeId, action: 'ENGAGE_DEFEAT' });
          if (record.status !== 'COMMITTED') {
            expect(record.reason, `reason ${type}@${String(guard)}`).toBe('OPTION_UNAVAILABLE');
            rejections.push({ type, attempt });
            if (type === 'boss') {
              // THE BOSS CONTRACTS — run while the visit is still open.
              // CONTRACT 1 — the rejection is a DURABLE ledger record with the
              // exact reason: the RETURNED result AND the STORED entry both
              // carry status + reason, and nothing moved.
              const instAtBoss = mgr.snapshot().state.instability;
              expect(instAtBoss).toBe(97);
              tx1 = actionTransactionId(runId, nodeId, 'ENGAGE_DEFEAT', 'rej-1');
              const result1 = mgr.act({ transactionId: tx1, nodeId, action: 'ENGAGE_DEFEAT' });
              expect(result1.status).toBe('REJECTED');
              expect(result1.reason).toBe('OPTION_UNAVAILABLE');
              expect(mgr.snapshot().state.ledger[tx1]?.status).toBe('REJECTED');
              expect(mgr.snapshot().state.ledger[tx1]?.reason).toBe('OPTION_UNAVAILABLE');
              expect(mgr.snapshot().state.instability).toBe(instAtBoss); // +0
              expect(countCommittedDefeats(mgr.snapshot().state.ledger, nodeId)).toBe(0);
              // CONTRACT 2 — a SECOND rejected attempt with a fresh id NEVER
              // advances the tax: the escalation stays at attempt 1 (5).
              tx2 = actionTransactionId(runId, nodeId, 'ENGAGE_DEFEAT', 'rej-1b');
              const result2 = mgr.act({ transactionId: tx2, nodeId, action: 'ENGAGE_DEFEAT' });
              expect(result2.status).toBe('REJECTED');
              expect(result2.reason).toBe('OPTION_UNAVAILABLE');
              expect(mgr.snapshot().state.instability).toBe(instAtBoss);
              expect(countCommittedDefeats(mgr.snapshot().state.ledger, nodeId)).toBe(0);
              expect(mgr.snapshot().state.ledger[tx2]?.status).toBe('REJECTED');
              expect(mgr.snapshot().state.ledger[tx2]?.reason).toBe('OPTION_UNAVAILABLE');
              // CONTRACT 3 — a restore mid-boundary keeps EVERY rejected
              // record byte-identically at the same instability.
              const restored = RunManager.restore();
              expect(restored).not.toBeNull();
              if (restored === null) throw new Error('restore failed');
              mgr = restored;
              expect(mgr.snapshot().state.instability).toBe(instAtBoss);
              expect(mgr.snapshot().state.ledger[tx1]?.status).toBe('REJECTED');
              expect(mgr.snapshot().state.ledger[tx1]?.reason).toBe('OPTION_UNAVAILABLE');
              expect(mgr.snapshot().state.ledger[tx2]?.status).toBe('REJECTED');
              expect(mgr.snapshot().state.ledger[tx2]?.reason).toBe('OPTION_UNAVAILABLE');
              // CONTRACT 4 — the fold SKIPS rejected records: with the walk's
              // own rejection AND both fresh rejects in the ledger, the fold
              // still equals the persisted scalar (97), and the derived
              // re-engage count (the panel's) is still 0.
              expect(foldInstability(mgr.map, mgr.snapshot().state.ledger)).toBe(97);
              expect(mgr.snapshot().state.instability).toBe(foldInstability(mgr.map, mgr.snapshot().state.ledger));
              expect(Object.values(mgr.snapshot().state.ledger).filter((e) => e.status === 'REJECTED').length).toBe(3);
              expect(countCommittedDefeats(mgr.snapshot().state.ledger, nodeId)).toBe(0);
              bossContractsRun = true;
            }
            break;
          }
        }
        mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'DECLINE', `wd-${String(guard)}`), nodeId, action: 'DECLINE' });
      } else if (type === 'anchor' || type === 'merchant') {
        const record = mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'SERVICE', `ws-${String(guard)}`), nodeId, action: 'SERVICE' });
        if (record.status !== 'COMMITTED') {
          mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'DECLINE', `wx-${String(guard)}`), nodeId, action: 'DECLINE' });
        }
      } else {
        mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'DECLINE', `wy-${String(guard)}`), nodeId, action: 'DECLINE' });
      }
      expect(mgr.snapshot().state.instability, `fold at ${type}`).toBe(foldInstability(mgr.map, mgr.snapshot().state.ledger));
      mgr.resolve();
      const next = path[guard + 1];
      if (next === undefined) break;
      mgr.advance(next);
    }
    // The boss was the ONLY rejection of the whole walk (PURE), and the full
    // contract ran on the OPEN boss visit.
    expect(rejections).toEqual([{ type: 'boss', attempt: 1 }]);
    expect(bossContractsRun).toBe(true);

    // CONTRACT 5 — never a soft-lock: the retreat had committed inside the
    // walk (on the RESTORED manager), the node resolved, the run finishes.
    mgr.finish();
    expect(mgr.snapshot().runStatus).toBe('finished');
    expect(mgr.snapshot().state.instability).toBe(97);
    expect(mgr.snapshot().state.instability).toBeLessThanOrEqual(INSTABILITY_CEILING);
    expect(mgr.snapshot().state.ledger[tx1]?.status).toBe('REJECTED');
    expect(mgr.snapshot().state.ledger[tx2]?.status).toBe('REJECTED');
    expect(bossId.length).toBeGreaterThan(0);
  });
});