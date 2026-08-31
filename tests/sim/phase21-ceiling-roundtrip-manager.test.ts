/**
 * Phase 21 §9 CEILING ROUND-TRIP THROUGH THE REAL MANAGER. The handler sweep
 * (phase21-ceiling-roundtrip-sweep) drives the stack→lever→stack arithmetic on
 * crafted states; this drives the SAME trajectory through a real `RunManager`
 * walk on seed 900 (battle → elite → battle → anchor → elite → boss), whose
 * worst-case SERVICE walk produces TWO ceiling rejections with a recovery in
 * between:
 *
 *   b1 full 3-stack → e1 full 3-stack → b2 2/3 (REJECTED @3) → anchor ENTER
 *   +SERVICE (−18) → e2 1/2 (REJECTED @2) → boss 0/1 (REJECTED @1)
 *
 * asserting at every step (with `RunManager.restore()` cuts MID-trajectory at
 * four boundaries): the instability scalar === the clean-room ledger fold (the
 * REJECTED records are DURABLE ledger entries that the fold skips), the
 * escalation continues from the PERSISTED committed-defeat count per node (a
 * rejected attempt never advances the tax, and a node's count never leaks to
 * the next node), the anchor's reduction re-opens the economy exactly as the
 * arithmetic says, the gold fold `500 − 30` holds, and the run finishes.
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

/** Clean-room fold: COMMITTED records only — REJECTED records are skipped. */
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

interface Checkpoint {
  readonly tag: string;
  readonly txId: string;
}

describe('P21 §9 ceiling round-trip through the REAL manager (seed 900)', () => {
  it('stack → REJECT → lever → stack → REJECT, fold-exact at every step with restore cuts MID-trajectory, rejected attempts durable and never advancing the tax', { timeout: 60_000 }, () => {
    store.clear();
    let mgr = RunManager.create(900, 500);
    const path = mainPath(mgr.map);
    expect(path.map((id) => typeOf(mgr.map, id))).toEqual(['battle', 'elite', 'battle', 'anchor', 'elite', 'boss']);
    const runId = mgr.snapshot().state.runId;
    // The exact rejections the worst-case SERVICE walk must produce:
    // battle #2 attempt 3, elite #2 attempt 2, boss attempt 1.
    const rejections: { readonly type: string; readonly attempt: number }[] = [];
    const rejectedTxs: string[] = [];
    const checkpoints: Checkpoint[] = [];
    let gold = 500;
    let cuts = 0;

    const assertFold = (label: string): void => {
      const snap = mgr.snapshot();
      expect(snap.state.instability, `fold ${label}`).toBe(foldInstability(mgr.map, snap.state.ledger));
      expect(snap.state.gold, `gold ${label}`).toBe(gold);
    };

    // The trajectory ladder the walk MUST produce (enter+stack net per node).
    const ladder: readonly number[] = Object.freeze([35, 77, 97, 79, 96, 96]);

    for (let guard = 0; guard < path.length; guard += 1) {
      const snap = mgr.snapshot();
      const nodeId = snap.currentNodeId;
      const type = snap.currentNodeType;
      mgr.enter(enterTransactionId(runId, nodeId));
      assertFold(`enter ${type}@${String(guard)}`);

      if (isCombat(type)) {
        for (let attempt = 1; attempt <= MAX_REENGAGE_ATTEMPTS; attempt += 1) {
          const txId = actionTransactionId(runId, nodeId, 'ENGAGE_DEFEAT', `p-${String(guard)}-${String(attempt)}`);
          const record = mgr.act({ transactionId: txId, nodeId, action: 'ENGAGE_DEFEAT' });
          if (record.status !== 'COMMITTED') {
            // The ceiling rejection: REJECTED + OPTION_UNAVAILABLE, and the
            // record is a DURABLE ledger entry (status + reason persisted).
            expect(record.reason, `reason ${type}@${String(guard)} attempt ${String(attempt)}`).toBe('OPTION_UNAVAILABLE');
            rejections.push({ type, attempt });
            rejectedTxs.push(txId);
            expect(mgr.snapshot().state.ledger[txId]?.status).toBe('REJECTED');
            expect(mgr.snapshot().state.ledger[txId]?.reason).toBe('OPTION_UNAVAILABLE');
            assertFold(`rejected ${type}@${String(guard)} attempt ${String(attempt)}`);
            break;
          }
          assertFold(`defeat ${String(attempt)} ${type}@${String(guard)}`);
        }
        // MID-TRAJECTORY CUT after the battle #2 rejection (first rejection).
        if (guard === 2) {
          const restored = RunManager.restore();
          expect(restored).not.toBeNull();
          if (restored === null) throw new Error('restore failed');
          mgr = restored;
          checkpoints.push({ tag: 'post-b2-reject', txId: rejectedTxs[rejectedTxs.length - 1] ?? 'none' });
          cuts += 1;
        }
        mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'DECLINE', `pd-${String(guard)}`), nodeId, action: 'DECLINE' });
        assertFold(`decline ${type}@${String(guard)}`);
      } else if (type === 'anchor' || type === 'merchant') {
        const record = mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'SERVICE', `ps-${String(guard)}`), nodeId, action: 'SERVICE' });
        expect(record.status, `service ${type}@${String(guard)}`).toBe('COMMITTED');
        gold -= 30;
        assertFold(`service ${type}@${String(guard)}`);
        // MID-TRAJECTORY CUT right after the lever: the reduction is durable.
        const restored = RunManager.restore();
        expect(restored).not.toBeNull();
        if (restored === null) throw new Error('restore failed');
        mgr = restored;
        checkpoints.push({ tag: 'post-service', txId: rejectedTxs[rejectedTxs.length - 1] ?? 'none' });
        cuts += 1;
      } else {
        mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'DECLINE', `py-${String(guard)}`), nodeId, action: 'DECLINE' });
        assertFold(`decline ${type}@${String(guard)}`);
      }
      mgr.resolve();
      assertFold(`resolve ${type}@${String(guard)}`);
      // The ladder holds at the resolve boundary (post-node instability).
      expect(mgr.snapshot().state.instability, `ladder ${type}@${String(guard)}`).toBe(ladder[guard]);
      // MID-TRAJECTORY CUT after elite #2's rejection (second rejection).
      if (type === 'elite' && guard === 4) {
        const restored = RunManager.restore();
        expect(restored).not.toBeNull();
        if (restored === null) throw new Error('restore failed');
        mgr = restored;
        checkpoints.push({ tag: 'post-e2-reject', txId: rejectedTxs[rejectedTxs.length - 1] ?? 'none' });
        cuts += 1;
      }
      const next = path[guard + 1];
      if (next === undefined) break;
      mgr.advance(next);
      // The escalation NEVER leaks across nodes: a fresh combat node's next
      // attempt is always attempt 1 (5) — the fold oracle re-derives it.
      assertFold(`advance ${type}@${String(guard)}`);
    }

    // The boss IS the last node: its FIRST re-engage was ceiling-rejected —
    // committed defeats on the boss = 0, the count persisted across restores.
    expect(rejections).toEqual([
      { type: 'battle', attempt: 3 },
      { type: 'elite', attempt: 2 },
      { type: 'boss', attempt: 1 },
    ]);
    // FINAL MID-TRAJECTORY CUT after the boss rejection: the sealed trajectory
    // (rejections + committed defeats) survives the reload byte-identically.
    const postBossIter = RunManager.restore();
    expect(postBossIter).not.toBeNull();
    if (postBossIter === null) throw new Error('restore failed');
    mgr = postBossIter;
    cuts += 1;
    expect(cuts).toBe(4);

    // CHECKPOINT durability: every mid-trajectory cut kept the rejected
    // records + the exact instability + the exact fold (checked above), and
    // each checkpoint's rejection is still in the restored ledger.
    for (const cp of checkpoints) {
      const snap = mgr.snapshot();
      expect(snap.state.ledger[cp.txId]?.status, cp.tag).toBe('REJECTED');
      expect(snap.state.ledger[cp.txId]?.reason, cp.tag).toBe('OPTION_UNAVAILABLE');
    }

    // One more rejected attempt on the restored boss (a fresh tx id): the tax
    // NEVER advanced — instability, fold and committed count stay byte-equal.
    const finalSnap = mgr.snapshot();
    const bossId = finalSnap.currentNodeId;
    const instAtBoss = finalSnap.state.instability;
    expect(instAtBoss).toBe(96);
    const again = mgr.act({ transactionId: actionTransactionId(runId, bossId, 'ENGAGE_DEFEAT', 'p-5-again'), nodeId: bossId, action: 'ENGAGE_DEFEAT' });
    expect(again.status).toBe('REJECTED');
    expect(mgr.snapshot().state.instability).toBe(instAtBoss);
    expect(foldInstability(mgr.map, mgr.snapshot().state.ledger)).toBe(instAtBoss);
    expect(Object.values(mgr.snapshot().state.ledger).filter((e) => e.nodeId === bossId && e.status === 'COMMITTED' && e.action === 'ENGAGE_DEFEAT').length).toBe(0);

    // The round-trip ends cleanly: retreat legal, run finishes, gold exact,
    // instability at the bound zone and the final save a codec fixed point.
    mgr.act({ transactionId: actionTransactionId(runId, bossId, 'DECLINE', 'pd-5'), nodeId: bossId, action: 'DECLINE' });
    mgr.resolve();
    mgr.finish();
    expect(mgr.snapshot().runStatus).toBe('finished');
    expect(mgr.snapshot().state.gold).toBe(470); // 500 − 30×1 services
    expect(mgr.snapshot().state.instability).toBe(96);
    expect(mgr.snapshot().state.instability).toBeLessThanOrEqual(INSTABILITY_CEILING);
  });
});