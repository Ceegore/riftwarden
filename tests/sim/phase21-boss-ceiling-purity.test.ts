/**
 * Phase 21 §9 BOSS 0-ENTER CEILING PURITY. The boss ENTER costs 0
 * instability, so on a boss the re-engage ceiling is reached PURELY by prior
 * nodes. Seed 903's main path (battle → event → battle → anchor → elite →
 * boss) with the worst-case bleed policy pins this exactly:
 *
 *   battle1 +3 stack → 35, event → 38, battle2 +3 stack → 73, anchor ENTER
 *   −10 + SERVICE −8 → 55, elite +3 stack → 97, boss ENTER +0 → 97.
 *
 * The boss is the ONLY node whose re-engage stack is ceiling-gated — its
 * FIRST attempt is REJECTED (OPTION_UNAVAILABLE, 97 + 5 > 100 — not the cap:
 * zero defeats on the boss), while every prior combat node committed its FULL
 * 3-attempt stack with zero gating. The fold holds at every step, and the
 * path-order-exactness pin is: folding ONLY the prior-node ledger entries
 * equals 97 — the boss contributes exactly 0 (ENTER delta 0 + no committed
 * defeats), so the ceiling state is 100% the prior path's doing, and the
 * bleed is path-order-exact, not node-local.
 */
import { describe, expect, it } from 'vitest';
import { RunManager } from '../../src/game/expedition/run-manager.js';
import { mainPath } from '../../src/game/expedition/expedition-runner.js';
import { definitionOf } from '../../src/game/expedition/node-registry.js';
import { enterTransactionId, actionTransactionId } from '../../src/features/expedition/transaction-ids.js';
import { MAX_REENGAGE_ATTEMPTS, INSTABILITY_CEILING } from '../../src/game/expedition/nodes/handlers/combat.js';
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

/** Clean-room oracle — independent of the handler modules. */
const ENTER_DELTA_BY_TYPE: Readonly<Record<string, number>> = Object.freeze({
  battle: 5, event: 3, anchor: -10, elite: 12, boss: 0,
});

function typeOf(map: ExpeditionMap, nodeId: string): string {
  const node = map.nodes.find((candidate) => candidate.id === nodeId);
  return node?.type ?? 'story';
}

function foldInstability(map: ExpeditionMap, ledger: Readonly<Record<string, TransactionRecord>>, excludeNode?: string): number {
  let instability = 0;
  const defeatCountByNode = new Map<string, number>();
  for (const entry of Object.values(ledger)) {
    if (entry.status !== 'COMMITTED') continue;
    if (excludeNode !== undefined && entry.nodeId === excludeNode) continue;
    const type = typeOf(map, entry.nodeId);
    let delta = 0;
    if (entry.action === 'ENTER') {
      delta = ENTER_DELTA_BY_TYPE[type] ?? 0;
    } else if (entry.action === 'ENGAGE_DEFEAT') {
      const attempt = (defeatCountByNode.get(entry.nodeId) ?? 0) + 1;
      defeatCountByNode.set(entry.nodeId, attempt);
      delta = 5 * attempt;
    } else if (entry.action === 'SERVICE') {
      delta = type === 'anchor' ? -8 : 0;
    }
    instability = Math.max(0, instability + delta);
  }
  return instability;
}

describe('P21 §9 boss 0-ENTER ceiling purity', () => {
  it('the boss is the ONLY ceiling-gated node: its ENTER adds 0, its first re-engage is REJECTED at the ceiling, and the fold credits the prior ledger exactly', { timeout: 60_000 }, () => {
    store.clear();
    const mgr0 = RunManager.create(903, 500);
    const path = mainPath(mgr0.map);
    const mgr = mgr0;
    const runId = mgr.snapshot().state.runId;
    const nodeDefeats: { type: string; nodeId: string; attempts: number; gatedAt: number[] }[] = [];
    const trace: { label: string; instability: number }[] = [];
    let bossNodeId: string | undefined;

    const pushTrace = (label: string): void => {
      trace.push({ label, instability: mgr.snapshot().state.instability });
    };

    for (let guard = 0; guard < path.length; guard += 1) {
      const snap = mgr.snapshot();
      const type = snap.currentNodeType;
      const nodeId = snap.currentNodeId;
      const isBoss = type === 'boss';
      if (isBoss) bossNodeId = nodeId;

      const beforeEnter = mgr.snapshot().state.instability;
      mgr.enter(enterTransactionId(runId, nodeId));
      const afterEnter = mgr.snapshot().state.instability;
      // The boss ENTER costs EXACTLY 0 (registry default) — the ceiling at
      // the boss is purely the prior path's doing.
      if (isBoss) {
        expect(afterEnter - beforeEnter).toBe(0);
        expect(definitionOf('boss').defaultInstabilityDelta).toBe(0);
      }
      expect(mgr.snapshot().state.instability).toBe(foldInstability(mgr.map, mgr.snapshot().state.ledger));
      pushTrace(`enter ${type}`);

      if (type === 'battle' || type === 'elite' || type === 'boss') {
        const cell: { type: string; nodeId: string; attempts: number; gatedAt: number[] } = { type, nodeId, attempts: 0, gatedAt: [] };
        for (let attempt = 1; attempt <= MAX_REENGAGE_ATTEMPTS; attempt += 1) {
          const record = mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'ENGAGE_DEFEAT', `p-${String(guard)}-${String(attempt)}`), nodeId, action: 'ENGAGE_DEFEAT' });
          if (record.status !== 'COMMITTED') {
            cell.gatedAt.push(attempt);
            // The boss's FIRST attempt is ceiling-gated (OPTION_UNAVAILABLE,
            // never the cap — zero defeats on the boss).
            if (isBoss) {
              expect(attempt).toBe(1);
              expect(record.reason).toBe('OPTION_UNAVAILABLE');
              expect(mgr.snapshot().state.instability).toBe(97);
              expect(97 + 5).toBeGreaterThan(INSTABILITY_CEILING);
            }
            break;
          }
          cell.attempts += 1;
        }
        nodeDefeats.push(cell);
        pushTrace(`stack ${type}`);
        // The boss DECLINES after the rejected re-engage — never a soft-lock;
        // prior nodes retreat after their full stacks.
        mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'DECLINE', `pd-${String(guard)}`), nodeId, action: 'DECLINE' });
        pushTrace(`decline ${type}`);
      } else if (type === 'anchor') {
        mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'SERVICE', `ps-${String(guard)}`), nodeId, action: 'SERVICE' });
        pushTrace(`service ${type}`);
        mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'DECLINE', `pd-${String(guard)}`), nodeId, action: 'DECLINE' });
      } else {
        mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'DECLINE', `px-${String(guard)}`), nodeId, action: 'DECLINE' });
      }
      expect(mgr.snapshot().state.instability).toBe(foldInstability(mgr.map, mgr.snapshot().state.ledger));
      mgr.resolve();
      const next = path[guard + 1];
      if (next === undefined) break;
      mgr.advance(next);
    }

    // THE EXACT TRACE (worst-case bleed on seed 903's main path): the
    // instability ladder — battle1 +5 → +30 stack (35), event +3 (38),
    // battle2 +5 → +30 stack (73), anchor −10 enter (63) −8 service (55),
    // elite +12 → +30 stack (97), boss +0 (97). The boss ENTER and its
    // rejected stack change NOTHING — the ceiling state is the prior path's.
    const ladder = trace.map((t) => t.instability);
    expect(ladder).toEqual([5, 35, 35, 38, 43, 73, 73, 63, 55, 67, 97, 97, 97, 97, 97]);

    // THE BOSS IS THE ONLY CEILING-GATED NODE: every prior combat node
    // committed its FULL 3-attempt stack with ZERO gating.
    expect(nodeDefeats).toHaveLength(4);
    const battles = nodeDefeats.filter((n) => n.type === 'battle');
    const elite = nodeDefeats.find((n) => n.type === 'elite');
    const boss = nodeDefeats.find((n) => n.type === 'boss');
    expect(battles).toHaveLength(2);
    for (const b of battles) {
      expect(b.attempts).toBe(3);
      expect(b.gatedAt).toEqual([]);
    }
    expect(elite?.attempts).toBe(3);
    expect(elite?.gatedAt).toEqual([]);
    expect(boss?.attempts).toBe(0);
    expect(boss?.gatedAt).toEqual([1]);

    // PATH-ORDER-EXACT: folding ONLY the prior-node ledger entries (the boss
    // excluded) equals the boss's instability — the boss contributes exactly
    // 0 (ENTER delta 0 + no committed defeats), so the ceiling state is the
    // prior ledger's, and the bleed is path-order-exact, not node-local.
    if (bossNodeId === undefined) throw new Error('boss not reached');
    expect(foldInstability(mgr.map, mgr.snapshot().state.ledger, bossNodeId)).toBe(97);
    expect(foldInstability(mgr.map, mgr.snapshot().state.ledger)).toBe(97);
    // The boss's REJECTED attempt is a DURABLE ledger record (skipped by the
    // fold — it never moved instability).
    const bossRecords = Object.values(mgr.snapshot().state.ledger).filter((r) => r.nodeId === bossNodeId);
    expect(bossRecords.some((r) => r.action === 'ENGAGE_DEFEAT' && r.status === 'REJECTED' && r.reason === 'OPTION_UNAVAILABLE')).toBe(true);
    // The final scalar agrees with the fold.
    expect(mgr.snapshot().state.instability).toBe(97);
    // The run is not soft-locked: the boss cleared and the run can finish.
    mgr.finish();
    expect(mgr.snapshot().runStatus).toBe('finished');
  });
});
